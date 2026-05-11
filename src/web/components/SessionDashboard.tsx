import { useEffect, useMemo, useState } from "react";
import type { SessionCardData, SessionDashboardApi } from "../api/session-api.js";
import "./session-dashboard.css";

export interface SessionDashboardProps {
  readonly api: SessionDashboardApi;
}

type SortMode = "recent" | "name" | "cwd";

export function SessionDashboard({ api }: SessionDashboardProps) {
  const [sessions, setSessions] = useState<readonly SessionCardData[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [cwd, setCwd] = useState("/tmp/project");
  const [sessionName, setSessionName] = useState("");
  const [query, setQuery] = useState("");
  const [showPaths, setShowPaths] = useState(false);
  const [namedOnly, setNamedOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.listSessions().then(setSessions).catch((caught: unknown) => setError(errorMessage(caught)));
  }, [api]);

  const visibleSessions = useMemo(() => {
    const lowered = query.toLowerCase();
    const filtered = sessions.filter((session) => {
      if (namedOnly && !session.sessionName) return false;
      const haystack = [session.sessionName, session.cwd, session.id, session.model].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(lowered);
    });
    return [...filtered].sort((a, b) => {
      if (sortMode === "name") return (a.sessionName ?? a.id).localeCompare(b.sessionName ?? b.id);
      if (sortMode === "cwd") return a.cwd.localeCompare(b.cwd);
      return b.lastActivity - a.lastActivity;
    });
  }, [namedOnly, query, sessions, sortMode]);

  const activeSession = activeSessionId ? sessions.find((session) => session.id === activeSessionId) : null;

  async function createSession() {
    setError(null);
    const created = await api.createSession({ cwd, ...(sessionName.trim() ? { sessionName: sessionName.trim() } : {}) });
    setSessions((current) => [created, ...current]);
    setActiveSessionId(created.id);
    setSessionName("");
  }

  async function renameActive() {
    if (!activeSession) return;
    const name = window.prompt("New session name", activeSession.sessionName ?? "");
    if (name === null) return;
    const updated = await api.renameSession(activeSession.id, name);
    setSessions((current) => current.map((session) => session.id === updated.id ? updated : session));
  }

  async function deleteActive() {
    if (!activeSession) return;
    if (!window.confirm(`Delete session ${activeSession.sessionName ?? activeSession.id}?`)) return;
    await api.deleteSession(activeSession.id);
    setSessions((current) => current.filter((session) => session.id !== activeSession.id));
    setActiveSessionId(null);
  }

  return (
    <main className="session-dashboard">
      <aside className="session-sidebar" aria-label="Sessions">
        <header>
          <h1>pi remote</h1>
          <p>{sessions.length} sessions</p>
        </header>

        <section aria-label="Create session" className="session-create">
          <label>
            CWD
            <input value={cwd} onChange={(event) => setCwd(event.target.value)} aria-label="New session cwd" />
          </label>
          <label>
            Name
            <input value={sessionName} onChange={(event) => setSessionName(event.target.value)} aria-label="New session name" />
          </label>
          <button type="button" onClick={() => void createSession()}>New session</button>
        </section>

        <section aria-label="Session browser controls" className="session-controls">
          <input placeholder="Search sessions" value={query} onChange={(event) => setQuery(event.target.value)} />
          <label><input type="checkbox" checked={showPaths} onChange={(event) => setShowPaths(event.target.checked)} /> Show paths</label>
          <label><input type="checkbox" checked={namedOnly} onChange={(event) => setNamedOnly(event.target.checked)} /> Named only</label>
          <select aria-label="Sort sessions" value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
            <option value="recent">Recent</option>
            <option value="name">Name</option>
            <option value="cwd">CWD</option>
          </select>
        </section>

        {error ? <p role="alert">{error}</p> : null}

        <ul className="session-list">
          {visibleSessions.map((session) => (
            <li key={session.id}>
              <button
                type="button"
                className={session.id === activeSessionId ? "active" : ""}
                onClick={() => setActiveSessionId(session.id)}
              >
                <strong>{session.sessionName ?? session.id}</strong>
                <span>{session.status}</span>
                <small>{showPaths ? session.cwd : basename(session.cwd)}</small>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="active-session" aria-label="Active session">
        {activeSession ? (
          <>
            <header>
              <h2>{activeSession.sessionName ?? activeSession.id}</h2>
              <div className="active-actions">
                <button type="button" onClick={() => void renameActive()}>Rename</button>
                <button type="button" onClick={() => void deleteActive()}>Delete</button>
              </div>
            </header>
            <dl>
              <dt>Status</dt><dd>{activeSession.status}</dd>
              <dt>CWD</dt><dd>{activeSession.cwd}</dd>
              <dt>Model</dt><dd>{activeSession.model ?? "not selected"}</dd>
              <dt>Tokens</dt><dd>{activeSession.tokenSummary ?? "n/a"}</dd>
            </dl>
          </>
        ) : (
          <p>Select or create a session.</p>
        )}
      </section>
    </main>
  );
}

function basename(value: string): string {
  return value.split("/").filter(Boolean).at(-1) ?? value;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
