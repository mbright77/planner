import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const appUrl = 'http://127.0.0.1:4173';
const chromePath = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const reportDir = path.resolve('.lighthouse');
const reportPath = path.join(reportDir, 'mobile-report');

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: false,
      ...options,
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code ?? 'unknown'}.`));
    });

    child.on('error', reject);
  });
}

async function waitForServer(url, attempts = 40) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw new Error('Timed out waiting for the preview server.');
}

async function readJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to fetch ${url}.`);
  }

  return response.json();
}

async function verifyManifest() {
  const html = await fetch(appUrl).then((response) => response.text());
  if (!html.includes('rel="manifest"')) {
    throw new Error('Landing page is missing a manifest link.');
  }

  if (!html.includes('name="theme-color"')) {
    throw new Error('Landing page is missing a theme-color meta tag.');
  }

  const manifest = await readJson(`${appUrl}/manifest.webmanifest`);
  const requiredFields = ['name', 'short_name', 'display', 'background_color', 'theme_color'];
  for (const field of requiredFields) {
    if (!manifest[field]) {
      throw new Error(`Manifest is missing ${field}.`);
    }
  }
}

async function main() {
  await mkdir(reportDir, { recursive: true });
  await run('pnpm', ['run', 'build']);

  const preview = spawn('pnpm', ['exec', 'vite', 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], {
    stdio: 'inherit',
    shell: false,
  });

  try {
    await waitForServer(appUrl);
    await verifyManifest();
    await run('npx', [
      '--yes',
      'lighthouse',
      appUrl,
      '--chrome-path',
      chromePath,
      '--only-categories',
      'performance,accessibility,best-practices,seo',
      '--form-factor',
      'mobile',
      '--screenEmulation.mobile',
      '--output',
      'html',
      '--output',
      'json',
      '--output-path',
      reportPath,
      '--quiet',
    ]);
  } finally {
    preview.kill('SIGTERM');
    await new Promise((resolve) => preview.on('exit', resolve));
  }

  console.log(`Saved Lighthouse reports to ${reportPath}.html and ${reportPath}.json`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
