import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import { TemplateInformationalTable } from "../features/templates/TemplateInformationalTable";

test("shows range columns for subsystem", () => {
  render(
    <TemplateInformationalTable
      onCreate={() => {}}
      onUpdate={() => {}}
      onDelete={() => {}}
      rows={[]}
      templateLevel="subsystem"
    />,
  );

  expect(screen.getAllByText("range_min").length).toBeGreaterThan(0);
  expect(screen.getAllByText("range_max").length).toBeGreaterThan(0);
});

test("shows aggregation columns for equipment", () => {
  render(
    <TemplateInformationalTable
      onCreate={() => {}}
      onUpdate={() => {}}
      onDelete={() => {}}
      rows={[]}
      templateLevel="equipment"
    />,
  );

  expect(screen.getAllByText("agg_type").length).toBeGreaterThan(0);
  expect(screen.getAllByText("source_field").length).toBeGreaterThan(0);
});
