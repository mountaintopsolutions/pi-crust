import { describe, expect, it } from "vitest";
import { createPrcExtensionHost } from "../../src/extensions/registry.js";
import { createPrcExtensionHarness } from "../helpers/extension-harness.js";

describe("PRC extension registry harness", () => {
  it("activates inline extension factories and runs registered commands", async () => {
    const harness = await createPrcExtensionHarness({
      extensions: [{
        id: "test.extension",
        factory: (prc) => {
          prc.commands.register({ id: "test.hello", title: "Hello", slashName: "hello", run: (input) => ({ input, ok: true }) });
        },
      }],
    });
    try {
      expect(harness.extensions.diagnostics).toEqual([]);
      expect(harness.extensions.commands.list().map((command) => command.invocationName)).toEqual(["test.hello"]);
      expect(harness.extensions.commands.getSlashCommand("hello")?.id).toBe("test.hello");
      await expect(harness.extensions.commands.run("test.hello", "world")).resolves.toEqual({ input: "world", ok: true });
    } finally {
      await harness.cleanup();
    }
  });

  it("suffixes duplicate command invocation names", async () => {
    const host = createPrcExtensionHost();
    await host.activateAll([
      { id: "alpha", factory: (prc) => prc.commands.register({ id: "shared", title: "Alpha", run: () => "alpha" }) },
      { id: "beta", factory: (prc) => prc.commands.register({ id: "shared", title: "Beta", run: () => "beta" }) },
    ]);

    expect(host.commands.list().map((command) => command.invocationName)).toEqual(["shared", "shared:1"]);
    await expect(host.commands.run("shared")).resolves.toBe("alpha");
    await expect(host.commands.run("shared:1")).resolves.toBe("beta");
  });

  it("registers activity views and removes contributions on dispose", async () => {
    const host = createPrcExtensionHost();
    await host.activate({
      id: "panel",
      factory: (prc) => {
        prc.activity.registerView({ id: "panel.view", title: "Panel", order: 10, render: "Hello from test extension" });
      },
    });

    expect(host.activity.get("panel.view")?.title).toBe("Panel");
    await host.dispose();
    expect(host.activity.list()).toEqual([]);
  });

  it("isolates activation errors and keeps earlier contributions", async () => {
    const host = createPrcExtensionHost();
    await host.activateAll([
      { id: "good", factory: (prc) => prc.commands.register({ id: "good", title: "Good", run: () => "ok" }) },
      { id: "bad", factory: () => { throw new Error("boom"); } },
    ]);

    expect(host.commands.get("good")?.title).toBe("Good");
    expect(host.diagnostics).toEqual([{ extensionId: "bad", level: "error", message: "boom" }]);
  });

  it("dispatches extension server routes with path params and JSON bodies", async () => {
    const host = createPrcExtensionHost();
    await host.activate({
      id: "server-test",
      factory: (prc) => {
        prc.server.routes.post("/echo/:name", async (request) => ({
          status: 201,
          body: { name: request.params.name, body: await request.json() },
        }));
      },
    });

    const req = ReadableRequest.fromJson("POST", { value: 42 });
    const response = await host.serverRoutes.dispatch(req as never, new URL("http://localhost/api/extensions/server-test/echo/alice"));
    expect(response).toEqual({ status: 201, body: { name: "alice", body: { value: 42 } } });
  });
});

class ReadableRequest {
  method: string;
  headers: Record<string, string> = {};

  private constructor(method: string, private readonly chunks: readonly Buffer[]) {
    this.method = method;
  }

  static fromJson(method: string, body: unknown): ReadableRequest {
    return new ReadableRequest(method, [Buffer.from(JSON.stringify(body))]);
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<Buffer> {
    yield* this.chunks;
  }
}
