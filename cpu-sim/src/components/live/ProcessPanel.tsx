import type { LiveState } from '../../live/scheduler.ts';

export function ProcessTable({ state }: { state: LiveState }) {
  return (
    <table className="proc-table">
      <thead>
        <tr>
          <th>PID</th>
          <th>Program</th>
          <th>State</th>
          <th>Waiting for</th>
          <th>CPU time</th>
        </tr>
      </thead>
      <tbody>
        {state.procs.map((p) => (
          <tr key={p.pid} className={`kind-${p.kind}`}>
            <td className="mono">{p.pid}</td>
            <td>
              <span className={`swatch lane-${p.kind}`} /> {p.name}
            </td>
            <td>
              <span className={`pstate ${p.state}`}>{p.state}</span>
            </td>
            <td className="dim">{p.waitingFor ?? (p.state === 'ready' ? 'the CPU' : '—')}</td>
            <td className="mono">{p.cpuTime} ms</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function EventLog({ state }: { state: LiveState }) {
  return (
    <ol className="event-log">
      {state.events.length === 0 && <li className="placeholder">Press ▶ Run. Every time the kernel gets the CPU, it is logged here.</li>}
      {state.events.slice(0, 14).map((e, i) => (
        <li key={`${e.t}-${i}-${e.text.length}`} className={`ev-${e.kind}`}>
          <span className="ev-t">{e.t} ms</span>
          <span>{e.text}</span>
        </li>
      ))}
    </ol>
  );
}
