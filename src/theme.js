export const THEME_KEY = 'peforma.theme';
export const AUTO_LIGHT_START = 7;
export const AUTO_LIGHT_END = 19;

export function isLightHour(date = new Date()) {
  const minutes = date.getHours() * 60 + date.getMinutes();
  return minutes >= AUTO_LIGHT_START * 60 && minutes < AUTO_LIGHT_END * 60;
}

export function resolveTheme(preference, date = new Date()) {
  if (preference === 'light' || preference === 'dark') return preference;
  return isLightHour(date) ? 'light' : 'dark';
}

export function readThemePreference() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'light' || saved === 'dark' || saved === 'auto' ? saved : 'auto';
  } catch {
    return 'auto';
  }
}

export function applyTheme(theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#111112' : '#f5f6f3');
}
