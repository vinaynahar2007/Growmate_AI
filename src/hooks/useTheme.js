import { useCallback, useSyncExternalStore } from "react";

export const ACCENTS = [
  { key: "emerald", label: "Emerald", colors: ["#10b981", "#06b6d4"] },
  { key: "indigo", label: "Indigo", colors: ["#7c6cf5", "#5b8cff"] },
  { key: "sunset", label: "Sunset", colors: ["#f43f5e", "#f97316"] },
  { key: "gold", label: "Gold", colors: ["#f59e0b", "#eab308"] },
];

const KEY = "growmate.theme";

function read() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved?.theme && saved?.accent) return saved;
  } catch {
    /* ignore */
  }
  return { theme: "dark", accent: "emerald" };
}

// ---- tiny shared store so every ThemeSwitcher stays in sync ----
let state = read();
const listeners = new Set();

function apply({ theme, accent }) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.setAttribute("data-accent", accent);
  root.classList.add("theme-fade");
  setTimeout(() => root.classList.remove("theme-fade"), 450);
}

function set(patch) {
  state = { ...state, ...patch };
  apply(state);
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn());
}

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const getSnapshot = () => state;

// apply once on module load so there is no flash of the wrong theme
apply(state);

export function useTheme() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const setTheme = useCallback((theme) => set({ theme }), []);
  const setAccent = useCallback((accent) => set({ accent }), []);
  const toggleTheme = useCallback(() => set({ theme: state.theme === "dark" ? "light" : "dark" }), []);
  return { ...snap, setTheme, setAccent, toggleTheme };
}
