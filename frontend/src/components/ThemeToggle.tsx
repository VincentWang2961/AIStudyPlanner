"use client";

import { useTheme } from "./ThemeProvider";
import styles from "./ThemeToggle.module.css";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={toggleTheme}
      aria-label={`Switch to ${nextTheme} theme`}
    >
      <span className={styles.icon}>{theme === "dark" ? "☀" : "☾"}</span>
      <span className={styles.text}>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}
