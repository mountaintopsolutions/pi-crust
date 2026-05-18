import { CronPanel } from "../../components/CronPanel.js";
import type { CronApi } from "../../api/session-api.js";
import type { WebActivityContribution } from "../types.js";

export const SCHEDULE_EXTENSION_ID = "core.schedule";
export const SCHEDULE_ACTIVITY_ID = "core.schedule.activity";

export interface CreateScheduleActivityOptions {
  readonly api: CronApi;
  readonly defaultCwd: string;
  readonly onOpenSession: (sessionId: string) => void;
}

export function createScheduleActivity(options: CreateScheduleActivityOptions): WebActivityContribution {
  return {
    id: SCHEDULE_ACTIVITY_ID,
    title: "Schedule",
    order: 20,
    extensionId: SCHEDULE_EXTENSION_ID,
    render: () => (
      <CronPanel
        api={options.api}
        defaultCwd={options.defaultCwd}
        onOpenSession={options.onOpenSession}
      />
    ),
  };
}
