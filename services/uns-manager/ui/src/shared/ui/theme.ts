export type ThemeMode = "dark" | "light";
export type DensityMode = "comfortable" | "compact";

export const THEME_STORAGE_KEY = "uns-manager-theme";
export const DENSITY_STORAGE_KEY = "uns-manager-density";

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "dark" || value === "light";
}

function isDensityMode(value: string | null): value is DensityMode {
  return value === "comfortable" || value === "compact";
}

export function resolveInitialTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "dark";
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (isThemeMode(storedTheme)) {
    return storedTheme;
  }

  if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: light)").matches) {
    return "light";
  }

  return "dark";
}

export function applyTheme(theme: ThemeMode): void {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", theme);
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }
}

export function resolveInitialDensity(): DensityMode {
  if (typeof window === "undefined") {
    return "comfortable";
  }

  const storedDensity = window.localStorage.getItem(DENSITY_STORAGE_KEY);
  if (isDensityMode(storedDensity)) {
    return storedDensity;
  }

  return "comfortable";
}

export function applyDensity(density: DensityMode): void {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-density", density);
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem(DENSITY_STORAGE_KEY, density);
  }
}
