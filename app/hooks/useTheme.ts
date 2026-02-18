import { useState, useEffect } from 'react';
import { track, EVENTS } from '@/lib/analytics';

function getInitialTheme(): "light" | "dark" {
  if (typeof window === 'undefined') return 'dark';
  const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
  if (savedTheme) return savedTheme;
  // Default to dark mode
  return 'dark';
}

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(getInitialTheme);

  // Persist theme and update document
  useEffect(() => {
    localStorage.setItem("theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      track(EVENTS.THEME_CHANGED, { from_theme: prev, to_theme: next });
      return next;
    });
  };

  return { theme, toggleTheme };
}