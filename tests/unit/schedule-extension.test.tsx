// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createScheduleActivity, SCHEDULE_ACTIVITY_ID, SCHEDULE_EXTENSION_ID } from "../../src/web/extensions/builtin/schedule-extension.js";

function cronApi() {
  return {
    list: vi.fn(async () => ({ jobs: [], filePath: "/cron.json" })),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    runNow: vi.fn(),
  };
}

describe("core.schedule web extension", () => {
  it("contributes the Schedule activity through the web extension shape", async () => {
    const activity = createScheduleActivity({ api: cronApi(), defaultCwd: "/repo", onOpenSession: vi.fn() });

    expect(activity).toMatchObject({
      id: SCHEDULE_ACTIVITY_ID,
      title: "Schedule",
      extensionId: SCHEDULE_EXTENSION_ID,
    });

    render(<>{activity.render()}</>);

    expect(await screen.findByRole("heading", { name: "Schedule" })).toBeInTheDocument();
  });
});
