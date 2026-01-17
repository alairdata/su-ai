import { useState, useEffect } from 'react';

function getInitialTheme(): "light" | "dark" {
  if (typeof window === 'undefined') return 'light';
  const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
  return savedTheme || 'light';
}

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(getInitialTheme);

  // Persist theme and update document
  useEffect(() => {
    localStorage.setItem("theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return { theme, toggleTheme };
}