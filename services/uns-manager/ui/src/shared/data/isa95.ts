export const ISA95_LEVELS = ["enterprise", "site", "area", "equipment", "subsystem"] as const;

export type Isa95Level = (typeof ISA95_LEVELS)[number];

const PARENT_BY_LEVEL: Record<Isa95Level, Isa95Level | null> = {
  enterprise: null,
  site: "enterprise",
  area: "site",
  equipment: "area",
  subsystem: "equipment",
};

export function expectedParentLevel(level: Isa95Level): Isa95Level | null {
  return PARENT_BY_LEVEL[level];
}

export function nextLevelForParent(parentLevel: Isa95Level | null): Isa95Level | null {
  if (parentLevel === null) {
    return "enterprise";
  }

  const index = ISA95_LEVELS.indexOf(parentLevel);
  if (index < 0 || index + 1 >= ISA95_LEVELS.length) {
    return null;
  }

  return ISA95_LEVELS[index + 1];
}

export function levelLabel(level: Isa95Level): string {
  return level.charAt(0).toUpperCase() + level.slice(1);
}
