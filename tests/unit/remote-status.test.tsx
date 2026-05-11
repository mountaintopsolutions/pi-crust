// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthTokenVerifier, createPairingToken } from "../../src/server/security/auth-token.js";
import { RemoteStatusPanel } from "../../src/web/components/RemoteStatusPanel.js";

describe("remote/mobile controls", () => {
  it("verifies app-level auth tokens and creates pairing tokens", () => {
    const verifier = new AuthTokenVerifier("secret");
    expect(verifier.verify("secret")).toBe(true);
    expect(verifier.verify("wrong")).toBe(false);
    expect(verifier.verify(undefined)).toBe(false);
    expect(createPairingToken()).toHaveLength(32);
  });

  it("renders reconnect/mobile status and controls", () => {
    const handlers = { onToggleLowBandwidth: vi.fn(), onToggleReadOnly: vi.fn(), onOpenApproval: vi.fn(), onDisposeIdle: vi.fn() };
    render(<RemoteStatusPanel
      connected={false}
      reconnecting
      lowBandwidth={false}
      readOnly
      pendingApprovals={[{ sessionId: "s1", title: "Approve bash?" }]}
      totalCost="$1.23"
      idleSessions={2}
      {...handlers}
    />);

    expect(screen.getByText("reconnecting")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Low bandwidth"));
    fireEvent.click(screen.getByLabelText("Read only"));
    fireEvent.click(screen.getByRole("button", { name: "Approve bash?" }));
    fireEvent.click(screen.getByRole("button", { name: "Dispose idle sessions" }));
    expect(handlers.onToggleLowBandwidth).toHaveBeenCalledWith(true);
    expect(handlers.onToggleReadOnly).toHaveBeenCalledWith(false);
    expect(handlers.onOpenApproval).toHaveBeenCalledWith("s1");
    expect(handlers.onDisposeIdle).toHaveBeenCalled();
    expect(screen.getByText("Total cost: $1.23")).toBeInTheDocument();
  });
});
