const NAME_RE = /^[A-Z0-9_]+$/;

export function validateAssetName(name: string): string | null {
  if (!NAME_RE.test(name)) {
    return "Asset name must match ^[A-Z0-9_]+$";
  }

  return null;
}
