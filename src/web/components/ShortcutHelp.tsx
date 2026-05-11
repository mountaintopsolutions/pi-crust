import { useEffect, useState } from "react";
import "./shortcut-help.css";

interface Shortcut {
  readonly keys: string;
  readonly label: string;
}

const SHORTCUTS: readonly Shortcut[] = [
  { keys: "Enter", label: "Send (or steer while streaming)" },
  { keys: "Shift+Enter", label: "Newline" },
  { keys: "Cmd/Ctrl+Enter", label: "Send" },
  { keys: "Alt+Enter", label: "Queue follow-up" },
  { keys: "Esc", label: "Abort while streaming" },
  { keys: "Alt+↑", label: "Recall prompt history" },
  { keys: "Tab", label: "Path completion after @" },
  { keys: "?", label: "Open this dialog" },
];

export function ShortcutHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (event.key === "Escape" && open) {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "?") return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      setOpen(true);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="shortcut-help-backdrop"
      role="presentation"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        className="shortcut-help"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <h2>Keyboard shortcuts</h2>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close shortcuts">×</button>
        </header>
        <dl>
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.keys}>
              <dt><kbd>{shortcut.keys}</kbd></dt>
              <dd>{shortcut.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}
