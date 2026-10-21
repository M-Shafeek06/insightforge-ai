"use client";

import { useTheme } from "./ThemeProvider";

function SunIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-[18px] w-[18px]"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.42 1.42" />
      <path d="m17.65 17.65 1.42 1.42" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.35 17.65-1.42 1.42" />
      <path d="m19.07 4.93-1.42 1.42" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-[18px] w-[18px]"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.9 13.1A8.5 8.5 0 0 1 10.9 3.1a8.7 8.7 0 1 0 10 10Z" />
      <path d="m16 3 .5 1.5L18 5l-1.5.5L16 7l-.5-1.5L14 5l1.5-.5L16 3Z" />
    </svg>
  );
}

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isLight ? "dark" : "light"} mode`}
      aria-pressed={!isLight}
      title={`Switch to ${isLight ? "dark" : "light"} mode`}
      className="
        glass-button
        inline-flex min-h-10 items-center justify-center gap-2.5
        rounded-xl px-3.5 py-2
        text-sm font-medium
        transition-all duration-200
        hover:-translate-y-0.5
        focus-visible:outline-2
        focus-visible:outline-offset-2
        focus-visible:outline-[var(--accent)]
      "
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
        {isLight ? <MoonIcon /> : <SunIcon />}
      </span>

      <span className="hidden sm:inline">
        {isLight ? "" : ""}
      </span>
    </button>
  );
}