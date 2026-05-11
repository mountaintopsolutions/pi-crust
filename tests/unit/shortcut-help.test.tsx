// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShortcutHelp } from "../../src/web/components/ShortcutHelp.js";

describe("ShortcutHelp", () => {
  it("opens when ? is pressed outside an input", () => {
    render(<ShortcutHelp />);
    expect(screen.queryByRole("dialog", { name: "Keyboard shortcuts" })).not.toBeInTheDocument();

    fireEvent.keyDown(document.body, { key: "?" });
    expect(screen.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeInTheDocument();
  });

  it("does not open when ? is pressed inside a textarea", () => {
    render(<><textarea aria-label="something" /><ShortcutHelp /></>);
    fireEvent.keyDown(screen.getByLabelText("something"), { key: "?" });
    expect(screen.queryByRole("dialog", { name: "Keyboard shortcuts" })).not.toBeInTheDocument();
  });

  it("closes on Escape", () => {
    render(<ShortcutHelp />);
    fireEvent.keyDown(document.body, { key: "?" });
    expect(screen.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Keyboard shortcuts" })).not.toBeInTheDocument();
  });

  it("closes via the close button", () => {
    render(<ShortcutHelp />);
    fireEvent.keyDown(document.body, { key: "?" });
    fireEvent.click(screen.getByRole("button", { name: "Close shortcuts" }));
    expect(screen.queryByRole("dialog", { name: "Keyboard shortcuts" })).not.toBeInTheDocument();
  });
});
