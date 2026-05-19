import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createHttpApiServer } from "../../src/server/http-api-server.js";
import { MockPiAdapter } from "../../src/server/pi/mock-pi-adapter.js";
import { PathPolicy } from "../../src/server/security/path-policy.js";
import { SessionRegistry } from "../../src/server/session/session-registry.js";

const servers: http.Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  })));
});

describe("HTTP API branding", () => {
  it("exposes app name and icon from environment on health", async () => {
    const previousName = process.env.PI_REMOTE_APP_NAME;
    const previousIcon = process.env.PI_REMOTE_APP_ICON;
    process.env.PI_REMOTE_APP_NAME = "Moody Lab";
    process.env.PI_REMOTE_APP_ICON = "🚀";
    try {
      const baseUrl = await makeServer();
      await expect(fetchJson(`${baseUrl}/api/health`)).resolves.toMatchObject({
        appName: "Moody Lab",
        appIcon: "🚀",
      });
    } finally {
      restoreEnv("PI_REMOTE_APP_NAME", previousName);
      restoreEnv("PI_REMOTE_APP_ICON", previousIcon);
    }
  });
});

async function makeServer(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "prc-branding-api-"));
  const projectRoot = path.join(root, "project");
  const sessionRoot = path.join(root, "sessions");
  await fs.mkdir(projectRoot, { recursive: true });
  await fs.mkdir(sessionRoot, { recursive: true });
  const registry = new SessionRegistry({
    adapter: new MockPiAdapter({ sessionRoot }),
    pathPolicy: new PathPolicy({ allowedProjectRoots: [projectRoot], allowedSessionRoots: [sessionRoot] }),
  });
  const server = createHttpApiServer({ registry, adapterKind: "test", projectRoot, sessionRoot, defaultCwd: projectRoot });
  servers.push(server);
  return listen(server);
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
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

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
