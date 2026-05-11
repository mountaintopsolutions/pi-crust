import React from "react";
import { createRoot } from "react-dom/client";
import { SessionDashboard } from "./components/SessionDashboard.js";
import type { SessionCardData, SessionDashboardApi, NewSessionInput } from "./api/session-api.js";

let sessions: SessionCardData[] = [];

const demoApi: SessionDashboardApi = {
  async listSessions() {
    return sessions;
  },
  async createSession(input: NewSessionInput) {
    const created: SessionCardData = {
      id: crypto.randomUUID(),
      cwd: input.cwd,
      ...(input.sessionName === undefined ? {} : { sessionName: input.sessionName }),
      status: "idle",
      model: "mock/model",
      tokenSummary: "0 tokens",
      lastActivity: Date.now(),
    };
    sessions = [created, ...sessions];
    return created;
  },
  async renameSession(sessionId: string, name: string) {
    sessions = sessions.map((session) => session.id === sessionId ? { ...session, sessionName: name } : session);
    const updated = sessions.find((session) => session.id === sessionId);
    if (!updated) throw new Error(`Unknown session: ${sessionId}`);
    return updated;
  },
  async deleteSession(sessionId: string) {
    sessions = sessions.filter((session) => session.id !== sessionId);
  },
};

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
  <React.StrictMode>
    <SessionDashboard api={demoApi} />
  </React.StrictMode>,
);
