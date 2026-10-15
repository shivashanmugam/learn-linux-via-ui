import type { RunMode } from '../hooks/useSimulator.ts';

interface Props {
  running: boolean;
  halted: boolean;
  canGoBack: boolean;
  mode: RunMode;
  speed: number;
  onTick: () => void;
  onInstruction: () => void;
  onBack: () => void;
  onReset: () => void;
  onRun: (running: boolean) => void;
  onMode: (mode: RunMode) => void;
  onSpeed: (speed: number) => void;
}

export function Controls(p: Props) {
  return (
    <section className="panel controls" aria-label="Simulation controls">
      <div className="btn-group">
        <button type="button" onClick={p.onReset} title="Reset registers and restore the original memory (R)">
          ⟲ Reset
        </button>
        <button type="button" onClick={p.onBack} disabled={!p.canGoBack || p.running} title="Undo one step (←)">
          ◀ Back
        </button>
        <button type="button" className="primary" onClick={p.onTick} disabled={p.halted || p.running} title="One clock tick (→)">
          Step ▸
        </button>
        <button type="button" onClick={p.onInstruction} disabled={p.halted || p.running} title="Finish the whole instruction (Shift + →)">
          Step instruction ▸▸
        </button>
        <button
          type="button"
          className={p.running ? 'danger' : 'run'}
          onClick={() => p.onRun(!p.running)}
          disabled={p.halted}
          title="Run / pause (Space)"
        >
          {p.running ? '❚❚ Pause' : '▶ Run'}
        </button>
      </div>
      <div className="run-options">
        <label>
          Run by
          <select value={p.mode} onChange={(e) => p.onMode(e.target.value as RunMode)}>
            <option value="micro">clock tick</option>
            <option value="instruction">instruction</option>
          </select>
        </label>
        <label>
          Speed
          <input type="range" min={1} max={10} value={p.speed} onChange={(e) => p.onSpeed(Number(e.target.value))} />
        </label>
      </div>
      <p className="shortcuts">
        Keys: <kbd>→</kbd> tick · <kbd>Shift</kbd>+<kbd>→</kbd> instruction · <kbd>←</kbd> back · <kbd>Space</kbd> run · <kbd>R</kbd> reset
      </p>
    </section>
  );
}
