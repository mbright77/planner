import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const outputPath = path.join(packageRoot, 'src', 'generated.ts');
const port = 5054;
const baseUrl = `http://127.0.0.1:${port}`;
const openApiUrl = `${baseUrl}/openapi/v1.json`;

async function waitForOpenApi(url, retries = 60) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until the API is ready.
    }

    await delay(500);
  }

  throw new Error(`Timed out waiting for OpenAPI document at ${url}`);
}

async function runChild(command, args, options) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, options);

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code ?? 'unknown'}`));
    });
    child.on('error', reject);
  });
}

async function run() {
  await mkdir(path.dirname(outputPath), { recursive: true });

  const apiProcess = spawn(
    'dotnet',
    ['run', '--project', 'apps/api/src/Planner.Api/Planner.Api.csproj', '--urls', baseUrl],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        ASPNETCORE_ENVIRONMENT: 'Development',
      },
      stdio: 'inherit',
    },
  );

  try {
    await waitForOpenApi(openApiUrl);

    await runChild('pnpm', ['exec', 'openapi-typescript', openApiUrl, '--output', outputPath], {
      cwd: packageRoot,
      stdio: 'inherit',
    });
  } finally {
    apiProcess.kill('SIGTERM');
    await new Promise((resolve) => apiProcess.on('exit', resolve));
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
