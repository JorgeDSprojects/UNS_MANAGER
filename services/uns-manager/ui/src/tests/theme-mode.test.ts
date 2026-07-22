import {
  applyDensity,
  applyTheme,
  DENSITY_STORAGE_KEY,
  resolveInitialDensity,
  resolveInitialTheme,
  THEME_STORAGE_KEY,
} from "../shared/ui/theme";

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-density");
  vi.restoreAllMocks();
});

test("resolveInitialTheme prefers explicit local storage value", () => {
  window.localStorage.setItem(THEME_STORAGE_KEY, "light");

  expect(resolveInitialTheme()).toBe("light");
});

test("resolveInitialTheme uses system preference when storage is empty", () => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: true,
      media: "(prefers-color-scheme: light)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  });

  expect(resolveInitialTheme()).toBe("light");
});

test("applyTheme stores and applies selected theme", () => {
  applyTheme("dark");

  expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
});

test("resolveInitialDensity prefers explicit local storage value", () => {
  window.localStorage.setItem(DENSITY_STORAGE_KEY, "compact");

  expect(resolveInitialDensity()).toBe("compact");
});

test("resolveInitialDensity defaults to comfortable", () => {
  expect(resolveInitialDensity()).toBe("comfortable");
});

test("applyDensity stores and applies selected density", () => {
  applyDensity("compact");

  expect(document.documentElement.getAttribute("data-density")).toBe("compact");
  expect(window.localStorage.getItem(DENSITY_STORAGE_KEY)).toBe("compact");
});
