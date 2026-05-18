import http from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createPrcExtensionHost } from "../../src/extensions/registry.js";
import { createHttpApiServer } from "../../src/server/http-api-server.js";
import { MockPiAdapter } from "../../src/server/pi/mock-pi-adapter.js";
import { PathPolicy } from "../../src/server/security/path-policy.js";
import { SessionRegistry } from "../../src/server/session/session-registry.js";
import { createTempPrcHome, type TempPrcHome } from "../helpers/temp-prc-home.js";

const servers: http.Server[] = [];
const homes: TempPrcHome[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  })));
  await Promise.all(homes.splice(0).map((home) => home.cleanup()));
});

describe("HTTP API extension routes", () => {
  it("serves routes contributed by an activated server extension", async () => {
    const home = await createTempPrcHome();
    homes.push(home);
    const extensions = createPrcExtensionHost();
    await extensions.activate({
      id: "route-test",
      factory: (prc) => {
        prc.server.routes.get("/ping", () => ({ ok: true, source: prc.extensionId }));
        prc.server.routes.post("/echo/:name", async (request) => ({ body: { name: request.params.name, input: await request.json() } }));
      },
    });
    const registry = new SessionRegistry({
      adapter: new MockPiAdapter({ sessionRoot: home.sessionRoot }),
      pathPolicy: new PathPolicy({ allowedProjectRoots: [home.projectRoot], allowedSessionRoots: [home.sessionRoot] }),
    });
    const server = createHttpApiServer({
      registry,
      adapterKind: "test",
      projectRoot: home.projectRoot,
      sessionRoot: home.sessionRoot,
      defaultCwd: home.projectRoot,
      extensions,
    });
    servers.push(server);
    const baseUrl = await listen(server);

    await expect(fetchJson(`${baseUrl}/api/extensions/route-test/ping`)).resolves.toEqual({ ok: true, source: "route-test" });
    await expect(fetchJson(`${baseUrl}/api/extensions/route-test/echo/alice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: 42 }),
    })).resolves.toEqual({ name: "alice", input: { value: 42 } });
    const missing = await fetch(`${baseUrl}/api/extensions/route-test/missing`);
    expect(missing.status).toBe(404);
  });
});

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, init);
  expect(response.ok).toBe(true);
  return response.json();
}

function listen(server: http.Server): Promise<string> {
  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("server did not bind to TCP"));
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}
