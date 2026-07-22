import { expectedParentLevel, nextLevelForParent } from "../shared/data/isa95";

test("returns enterprise level when parent is null", () => {
  expect(nextLevelForParent(null)).toBe("enterprise");
});

test("returns correct next level for equipment", () => {
  expect(nextLevelForParent("equipment")).toBe("subsystem");
});

test("returns expected parent for area", () => {
  expect(expectedParentLevel("area")).toBe("site");
});
