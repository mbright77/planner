import { beforeEach, describe, expect, it, vi } from 'vitest';

import { initTheme, setTheme } from '../shared/lib/theme';

describe('theme defaults', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = '';

    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('dark'),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  });

  it('uses dark mode by default when no preference is stored', () => {
    const resolved = initTheme();

    expect(resolved).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('persists and applies explicit light mode selection', () => {
    setTheme('light');

    expect(window.localStorage.getItem('planner-theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');
  });
});
