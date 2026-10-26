import type { KeyboardEvent } from 'react';
import type { KeyPress, LiveState } from '../../live/scheduler.ts';

const HOPS = [
  { title: 'You press a key', text: 'The keyboard sends a small key code over USB to the USB controller on the motherboard.' },
  { title: 'Interrupt!', text: 'The USB controller raises an interrupt: an electrical “stop, I need attention” signal to the CPU.' },
  {
    title: 'CPU drops what it was doing',
    text: 'At the end of its current instruction the CPU saves the running program’s registers, switches to kernel mode and jumps to the handler address listed in the interrupt table, the one the kernel filled in during boot.',
  },
  {
    title: 'Kernel driver handles the key',
    text: 'The keyboard driver reads the key code, turns it into an input event and wakes up the program that was sleeping in read(), waiting for exactly this.',
  },
  {
    title: 'Scheduler switches programs',
    text: 'The scheduler picks the woken editor. A context switch restores the editor’s saved registers and its private memory map, then drops back to user mode.',
  },
  { title: 'The app gets the key', text: 'Inside the editor, read() returns with the key. The editor adds the letter to its text, still in user mode.' },
  {
    title: 'Pixels change',
    text: 'The editor redraws its window and the graphics card sends the new frame to the screen. The whole trip takes far less than a millisecond on real hardware.',
  },
];

export function KeystrokeJourney({ state }: { state: LiveState }) {
  const j = state.journey;
  return (
    <div className="journey-live">
      <div className="journey-head">
        <h3 className="mini-head">Journey of your last key</h3>
        {j ? <code className="journey-key">{j.label}</code> : <span className="dim">type something in the editor</span>}
      </div>
      <ol>
        {HOPS.map((h, i) => {
          const finished = j !== null && j.hop >= HOPS.length - 1;
          const status = !j ? '' : i < j.hop || finished ? 'done' : i === j.hop ? 'current' : '';
          return (
            <li key={h.title} className={status}>
              <span className="hop-n">{i + 1}</span>
              <div>
                <b>{h.title}</b>
                <p>{h.text}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="hint">
        On a real desktop there is one more stop between 4 and 5: the display server (compositor) receives the event first and
        forwards it to the focused window. On a text console the terminal (TTY) layer does that job.
      </p>
    </div>
  );
}

export function EditorApp({
  state,
  running,
  onKey,
}: {
  state: LiveState;
  running: boolean;
  onKey: (k: KeyPress) => void;
}) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      onKey({ kind: 'save' });
    } else if (e.ctrlKey || e.metaKey || e.altKey) {
      return;
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      onKey({ kind: 'backspace' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onKey({ kind: 'enter' });
    } else if (e.key.length === 1) {
      e.preventDefault();
      onKey({ kind: 'char', ch: e.key });
    }
  };

  const editor = state.procs.find((p) => p.kind === 'editor');
  const waiting = state.hwQueue.length + state.inputQueue.length;

  return (
    <div className="editor-app">
      <div className="app-window">
        <div className="app-bar">
          <span className="dots" aria-hidden="true">
            ● ● ●
          </span>
          <span>{state.editorStatus} · Text editor (PID 2048)</span>
          <span className={`app-state ${editor?.state ?? ''}`}>{editor?.state ?? '—'}</span>
        </div>
        <div
          className="app-body"
          tabIndex={0}
          role="textbox"
          aria-multiline="true"
          aria-label="Type here. Each key travels through the simulated computer before it appears."
          onKeyDown={onKeyDown}
        >
          {state.editorText || <span className="placeholder">Click here and type. Letters only appear once the editor process has handled them.</span>}
          <span className="caret">▏</span>
        </div>
      </div>
      <div className="app-actions">
        <button type="button" onClick={() => 'hello'.split('').forEach((ch) => onKey({ kind: 'char', ch }))}>
          Type “hello”
        </button>
        <button type="button" onClick={() => onKey({ kind: 'save' })}>
          💾 Save (Ctrl+S)
        </button>
        <span className="hint">
          keys waiting: <b>{state.hwQueue.length}</b> in the USB controller · <b>{state.inputQueue.length}</b> in the kernel
        </span>
      </div>
      {!running && waiting > 0 && <p className="paused-note">The simulation is paused. Press ▶ Run or Step 1 ms to let the CPU handle your key.</p>}
      {state.journey && (
        <p className="hint">
          Last key: <code>{state.journey.label}</code>, now at step {Math.min(state.journey.hop + 1, 7)} of 7 below.
        </p>
      )}
    </div>
  );
}
