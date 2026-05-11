export interface RemoteStatusPanelProps {
  readonly connected: boolean;
  readonly reconnecting: boolean;
  readonly lowBandwidth: boolean;
  readonly readOnly: boolean;
  readonly pendingApprovals: readonly { readonly sessionId: string; readonly title: string }[];
  readonly totalCost: string;
  readonly idleSessions: number;
  readonly onToggleLowBandwidth: (enabled: boolean) => void;
  readonly onToggleReadOnly: (enabled: boolean) => void;
  readonly onOpenApproval: (sessionId: string) => void;
  readonly onDisposeIdle: () => void;
}

export function RemoteStatusPanel(props: RemoteStatusPanelProps) {
  return (
    <section aria-label="Remote status">
      <h2>Remote</h2>
      <p>{props.connected ? "connected" : props.reconnecting ? "reconnecting" : "offline"}</p>
      <label><input type="checkbox" checked={props.lowBandwidth} onChange={(event) => props.onToggleLowBandwidth(event.target.checked)} /> Low bandwidth</label>
      <label><input type="checkbox" checked={props.readOnly} onChange={(event) => props.onToggleReadOnly(event.target.checked)} /> Read only</label>
      <section aria-label="Approval inbox">
        {props.pendingApprovals.map((approval) => <button key={approval.sessionId} type="button" onClick={() => props.onOpenApproval(approval.sessionId)}>{approval.title}</button>)}
      </section>
      <p>Total cost: {props.totalCost}</p>
      <p>Idle sessions: {props.idleSessions}</p>
      <button type="button" onClick={props.onDisposeIdle}>Dispose idle sessions</button>
    </section>
  );
}
