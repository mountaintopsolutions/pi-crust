import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPrcExtensionHost } from "../../src/extensions/registry.js";
import { CronStore } from "../../src/server/cron/cron-store.js";
import { createScheduleServerExtension } from "../../src/server/extensions/builtin/schedule-extension.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("core.schedule server extension", () => {
  it("registers /api/cron compatibility routes through the extension host", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "prc-schedule-extension-"));
    roots.push(root);
    const store = new CronStore(path.join(root, "cron.json"));
    const scheduler = { runJobNow: vi.fn(async () => ({ sessionId: "s1", sessionFile: "/sessions/s1.json" })) };
    const host = createPrcExtensionHost();
    await host.activate(createScheduleServerExtension({ store, scheduler: scheduler as never }));

    const created = await host.serverRoutes.dispatch(ReadableRequest.fromJson("POST", {
      name: "Nightly",
      schedule: "0 1 * * *",
      prompt: "summarize",
      cwd: root,
    }) as never, new URL("http://localhost/api/cron"));
    expect(created?.status).toBe(200);
    expect(created?.body).toMatchObject({ name: "Nightly", prompt: "summarize", cwd: root, enabled: true });

    const listed = await host.serverRoutes.dispatch(ReadableRequest.empty("GET") as never, new URL("http://localhost/api/cron"));
    expect(listed?.body).toMatchObject({ filePath: path.join(root, "cron.json"), jobs: [expect.objectContaining({ name: "Nightly" })] });

    const jobId = (created?.body as { id: string }).id;
    const run = await host.serverRoutes.dispatch(ReadableRequest.empty("POST") as never, new URL(`http://localhost/api/cron/${jobId}/run`));
    expect(run?.body).toMatchObject({ sessionId: "s1", sessionFile: "/sessions/s1.json" });
    expect(scheduler.runJobNow).toHaveBeenCalledWith(jobId);
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

  static empty(method: string): ReadableRequest {
    return new ReadableRequest(method, []);
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<Buffer> {
    yield* this.chunks;
  }
}
