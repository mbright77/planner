export type AppTheme = 'light' | 'dark' | 'system';

const THEME_STORAGE_KEY = 'planner-theme';
const DEFAULT_THEME: AppTheme = 'dark';

function resolveTheme(theme: AppTheme): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  return theme;
}

function applyResolvedTheme(theme: 'light' | 'dark') {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
}

export function getStoredTheme(): AppTheme | null {
  const value = window.localStorage.getItem(THEME_STORAGE_KEY);

  if (value === 'light' || value === 'dark' || value === 'system') {
    return value;
  }

  return null;
}

export function initTheme(): AppTheme {
  const theme = getStoredTheme() ?? DEFAULT_THEME;
  applyResolvedTheme(resolveTheme(theme));
  return theme;
}

export function setTheme(theme: AppTheme) {
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyResolvedTheme(resolveTheme(theme));
}
