/* ZeroDev Studio shared appearance controller.
   System follows prefers-color-scheme and updates while the page is open. */
(() => {
  'use strict';

  const STORAGE_KEY = 'zerodev-theme';
  const root = document.documentElement;
  const themeControls = () => document.querySelectorAll('[data-theme-select]');
  const systemPreference = window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

  function readPreference() {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return ['light', 'dark', 'system'].includes(saved) ? saved : 'system';
    } catch (error) {
      return 'system';
    }
  }

  function resolveTheme(preference) {
    if (preference === 'light' || preference === 'dark') return preference;
    return systemPreference && systemPreference.matches ? 'dark' : 'light';
  }

  function applyTheme(preference, persist = false) {
    const safePreference = ['light', 'dark', 'system'].includes(preference)
      ? preference
      : 'system';
    const resolved = resolveTheme(safePreference);

    root.dataset.themePreference = safePreference;
    root.dataset.theme = resolved;
    root.style.colorScheme = resolved;

    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.setAttribute('content', resolved === 'dark' ? '#0b1220' : '#f7f9fc');

    themeControls().forEach((control) => {
      control.value = safePreference;
    });

    if (persist) {
      try {
        window.localStorage.setItem(STORAGE_KEY, safePreference);
      } catch (error) {
        // The current page still changes theme when storage is unavailable.
      }
    }
  }

  document.addEventListener('change', (event) => {
    const control = event.target.closest('[data-theme-select]');
    if (control) applyTheme(control.value, true);
  });

  if (systemPreference) {
    const handleSystemChange = () => {
      if (readPreference() === 'system') applyTheme('system');
    };
    if (typeof systemPreference.addEventListener === 'function') {
      systemPreference.addEventListener('change', handleSystemChange);
    } else if (typeof systemPreference.addListener === 'function') {
      systemPreference.addListener(handleSystemChange);
    }
  }

  applyTheme(readPreference());
})();
