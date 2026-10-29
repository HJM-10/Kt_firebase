import { create } from 'zustand';
export function applyTheme(theme) {
  document.documentElement.classList.toggle('light', theme === 'light');
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}
const saved = localStorage.getItem('theme');
const initial = saved === 'dark' ? 'dark' : 'light';
applyTheme(initial);
const useThemeStore = create(set => ({
  theme: initial,
  setTheme: theme => { applyTheme(theme); localStorage.setItem('theme', theme); set({ theme }); },
}));
export default useThemeStore;
