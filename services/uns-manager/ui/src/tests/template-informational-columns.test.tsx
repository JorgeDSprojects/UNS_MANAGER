import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import { TemplateInformationalTable } from "../features/templates/TemplateInformationalTable";

test("shows range columns for subsystem", () => {
  render(
    <TemplateInformationalTable
      onCreate={() => {}}
      onDelete={() => {}}
      rows={[]}
      templateLevel="subsystem"
    />,
  );

  expect(screen.getByText("range_min")).toBeInTheDocument();
  expect(screen.getByText("range_max")).toBeInTheDocument();
});

test("shows aggregation columns for equipment", () => {
  render(
    <TemplateInformationalTable
      onCreate={() => {}}
      onDelete={() => {}}
      rows={[]}
      templateLevel="equipment"
    />,
  );

  expect(screen.getByText("agg_type")).toBeInTheDocument();
  expect(screen.getByText("source_field")).toBeInTheDocument();
});
