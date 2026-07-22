export function useDirtyGuard(isDirty: boolean) {
  function confirmNavigation() {
    if (!isDirty) {
      return true;
    }

    return window.confirm("You have unsaved changes. Continue?");
  }

  return { confirmNavigation };
}
