import { TICK_MS, TIMELINE_LEN, type Kind, type KernelReason, type LiveState, type Slice, type Who } from '../../live/scheduler.ts';
import { KERNEL_REASON } from '../../live/labels.ts';

type Lane = { id: string; label: string; sub: string; kind: Kind | 'kernel' | 'idle'; match: (w: Who) => boolean };

function lanes(s: LiveState): Lane[] {
  const pids = new Set<number>(s.procs.map((p) => p.pid));
  for (const sl of s.timeline) if (sl.who.type === 'proc') pids.add(sl.who.pid);
  const procLanes: Lane[] = [...pids]
    .sort((a, b) => a - b)
    .map((pid) => ({
      id: `p${pid}`,
      label: s.names[pid]?.name ?? `PID ${pid}`,
      sub: `PID ${pid} · user mode`,
      kind: s.names[pid]?.kind ?? 'compute',
      match: (w) => w.type === 'proc' && w.pid === pid,
    }));
  return [
    { id: 'kernel', label: 'Kernel', sub: 'kernel mode (ring 0)', kind: 'kernel', match: (w) => w.type === 'kernel' },
    ...procLanes,
    { id: 'idle', label: 'Idle (HLT)', sub: 'CPU asleep', kind: 'idle', match: (w) => w.type === 'idle' },
  ];
}

export function CpuTimeline({ state }: { state: LiveState }) {
  const pad = TIMELINE_LEN - state.timeline.length;
  const cols: (Slice | null)[] = [...Array.from({ length: pad }, () => null), ...state.timeline];
  const rows = lanes(state);

  return (
    <div className="cpu-timeline" style={{ gridTemplateColumns: `150px repeat(${TIMELINE_LEN}, minmax(0, 1fr))` }}>
      <div className="tl-corner">time (ms) →</div>
      {cols.map((c, i) => (
        <div key={`h${i}`} className={`tl-tick${c && c.t % TICK_MS === 0 ? ' timer' : ''}`}>
          {c && c.t % 20 === 0 ? c.t : ''}
        </div>
      ))}
      {rows.map((lane) => (
        <Row key={lane.id} lane={lane} cols={cols} />
      ))}
    </div>
  );
}

function Row({ lane, cols }: { lane: Lane; cols: (Slice | null)[] }) {
  return (
    <>
      <div className={`tl-label lane-${lane.kind}`}>
        <b>{lane.label}</b>
        <span>{lane.sub}</span>
      </div>
      {cols.map((c, i) => {
        const on = c !== null && lane.match(c.who);
        const last = i === cols.length - 1;
        const letter = on && c!.who.type === 'kernel' ? KERNEL_REASON[c!.who.reason].letter : '';
        return (
          <div
            key={i}
            className={`tl-cell${on ? ` on lane-${lane.kind}` : ''}${last ? ' now' : ''}`}
            title={on && c ? `${c.t} ms: ${lane.label}${letter ? ` (${KERNEL_REASON[(c.who as { reason: KernelReason }).reason].label})` : ''}` : undefined}
          >
            {letter}
          </div>
        );
      })}
    </>
  );
}
