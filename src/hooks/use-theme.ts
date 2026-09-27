import { useEffect, useState } from "react";

export function useTheme() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("tradequill-theme");
    return saved
      ? saved === "dark"
      : matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("tradequill-theme", dark ? "dark" : "light");
  }, [dark]);

  return { dark, toggleTheme: () => setDark((value) => !value) };
}
