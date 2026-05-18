// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
describe("bundled schedule web module", () => {
  it("can use the generic host request helper instead of a built-in cron client", async () => {
    // @ts-expect-error bundled extension web modules are plain JavaScript assets.
    const { renderActivity } = await import("../../extensions/schedule/web.mjs") as { renderActivity: (props: { React: typeof React; api: unknown }) => React.ReactNode };
    const request = vi.fn(async (path: string) => {
      expect(path).toBe("/api/cron");
      return { jobs: [], filePath: "/cron.json" };
    });

    render(<>{renderActivity({ React, api: { request } })}</>);

    expect(await screen.findByRole("heading", { name: "Schedule" })).toBeInTheDocument();
    await waitFor(() => expect(request).toHaveBeenCalledWith("/api/cron"));
    expect(screen.getByText("/cron.json")).toBeInTheDocument();
  });
});
