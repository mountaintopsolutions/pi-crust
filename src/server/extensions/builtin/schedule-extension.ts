import type { BuiltInPrcExtension } from "../../../extensions/bootstrap.js";
import { parseCron, CronParseError, nextRun as cronNextRun } from "../../cron/cron-expression.js";
import type { CronJob } from "../../cron/cron-store.js";
import type { CronScheduler } from "../../cron/cron-scheduler.js";
import type { CronStore } from "../../cron/cron-store.js";

export interface CreateScheduleServerExtensionOptions {
  readonly store: CronStore;
  readonly scheduler: CronScheduler;
}

export function createScheduleServerExtension(options: CreateScheduleServerExtensionOptions): BuiltInPrcExtension {
  return {
    id: "core.schedule",
    factory(prc) {
      prc.server.api.get("/api/cron", async () => {
        const jobs = await options.store.list();
        return { jobs: jobs.map(toCronJobView), filePath: options.store.filePath };
      });
      prc.server.api.post("/api/cron", async (request) => {
        const body = await request.json<{ name?: string; schedule?: string; prompt?: string; cwd?: string; enabled?: boolean }>();
        const validation = validateCronInput(body);
        if (validation) return { status: 400, body: { error: validation } };
        const job = await options.store.create({
          name: body.name!.trim(),
          schedule: body.schedule!.trim(),
          prompt: body.prompt ?? "",
          cwd: body.cwd!,
          enabled: body.enabled !== false,
        });
        await refreshNextRun(options.store, job.id, job.schedule);
        const fresh = (await options.store.get(job.id))!;
        return toCronJobView(fresh);
      });
      prc.server.api.post("/api/cron/:id", async (request) => {
        const jobId = request.params.id!;
        const body = await request.json<{ name?: string; schedule?: string; prompt?: string; cwd?: string; enabled?: boolean }>();
        if (body.schedule !== undefined) {
          try { parseCron(body.schedule); } catch (error) {
            return { status: 400, body: { error: error instanceof CronParseError ? `Invalid schedule: ${error.message}` : "Invalid schedule" } };
          }
        }
        const updated = await options.store.update(jobId, {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.schedule !== undefined ? { schedule: body.schedule } : {}),
          ...(body.prompt !== undefined ? { prompt: body.prompt } : {}),
          ...(body.cwd !== undefined ? { cwd: body.cwd } : {}),
          ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
        });
        if (!updated) return { status: 404, body: { error: "cron job not found" } };
        if ((body.schedule !== undefined || body.enabled !== undefined) && updated.enabled) await refreshNextRun(options.store, jobId, updated.schedule);
        const fresh = (await options.store.get(jobId))!;
        return toCronJobView(fresh);
      });
      prc.server.api.post("/api/cron/:id/delete", async (request) => {
        const ok = await options.store.delete(request.params.id!);
        if (!ok) return { status: 404, body: { error: "cron job not found" } };
        return { ok: true };
      });
      prc.server.api.post("/api/cron/:id/run", async (request) => {
        try {
          const jobId = request.params.id!;
          const result = await options.scheduler.runJobNow(jobId);
          const fresh = (await options.store.get(jobId))!;
          return { job: toCronJobView(fresh), sessionId: result.sessionId, sessionFile: result.sessionFile };
        } catch (error) {
          return { status: 400, body: { error: error instanceof Error ? error.message : String(error) } };
        }
      });
    },
  };
}

async function refreshNextRun(store: CronStore, jobId: string, schedule: string): Promise<void> {
  try {
    const parsed = parseCron(schedule);
    const next = cronNextRun(parsed, new Date());
    if (next) await store.update(jobId, { nextRun: next.getTime() });
  } catch { /* invalid schedules are reported elsewhere */ }
}

function toCronJobView(job: CronJob) {
  let scheduleError: string | undefined;
  try { parseCron(job.schedule); } catch (error) {
    scheduleError = error instanceof Error ? error.message : String(error);
  }
  return {
    id: job.id,
    name: job.name,
    schedule: job.schedule,
    prompt: job.prompt,
    cwd: job.cwd,
    enabled: job.enabled,
    lastRun: job.lastRun ?? null,
    nextRun: job.nextRun ?? null,
    lastSessionId: job.lastSessionId ?? null,
    scheduleError: scheduleError ?? null,
  };
}

function validateCronInput(body: { name?: string; schedule?: string; cwd?: string }): string | null {
  if (!body.name || !body.name.trim()) return "name is required";
  if (!body.schedule || !body.schedule.trim()) return "schedule is required";
  if (!body.cwd || !body.cwd.trim()) return "cwd is required";
  try { parseCron(body.schedule); } catch (error) {
    return error instanceof CronParseError ? `Invalid schedule: ${error.message}` : "Invalid schedule";
  }
  return null;
}
