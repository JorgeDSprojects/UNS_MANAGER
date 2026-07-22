import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CreateAssetActions } from "../features/assets/CreateAssetActions";

test("calls from-template action with selected template", async () => {
  const user = userEvent.setup();
  const onFromTemplate = vi.fn();

  render(
    <CreateAssetActions
      allowedTemplates={[{ id: "tpl-1", name: "VESTAS_V90_2MW" }]}
      onCreateFromTemplate={onFromTemplate}
      onCreateManual={() => {}}
      parentId="11111111-1111-1111-1111-111111111111"
    />,
  );

  await user.selectOptions(screen.getByLabelText("Template"), "tpl-1");
  await user.click(screen.getByRole("button", { name: "Create from Template" }));

  expect(onFromTemplate).toHaveBeenCalledWith({
    parent_id: "11111111-1111-1111-1111-111111111111",
    template_id: "tpl-1",
  });
});
