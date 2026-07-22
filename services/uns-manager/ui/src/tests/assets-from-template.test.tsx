import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CreateAssetActions } from "../features/assets/CreateAssetActions";

test("calls from-template action with selected template", async () => {
  const user = userEvent.setup();
  const onFromTemplate = vi.fn();

  render(
    <CreateAssetActions
      selectedParent={{
        id: "11111111-1111-1111-1111-111111111111",
        level: "enterprise",
        name: "ENT_1",
      }}
      templateOptions={[{ id: "tpl-1", level: "site", name: "VESTAS_V90_2MW" }]}
      onCreateFromTemplate={onFromTemplate}
      onCreateManual={() => {}}
    />,
  );

  await user.selectOptions(screen.getByLabelText("Template"), "tpl-1");
  await user.type(screen.getByLabelText("Asset Name"), "SITE_FROM_TEMPLATE");
  await user.click(screen.getByRole("button", { name: "Create from Template" }));

  expect(onFromTemplate).toHaveBeenCalledWith({
    parent_id: "11111111-1111-1111-1111-111111111111",
    template_id: "tpl-1",
    name: "SITE_FROM_TEMPLATE",
    descriptive_overrides: {},
    analytical_overrides: {},
  });
});
