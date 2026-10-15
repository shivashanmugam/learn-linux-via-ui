import { useEffect, useRef } from 'react';
import type { CpuState } from '../cpu/cpu.ts';
import { toBin } from '../cpu/isa.ts';

export function OutputPanel({ cpu }: { cpu: CpuState }) {
  return (
    <section className="panel output">
      <h2>Output</h2>
      <div className="screen" aria-live="polite">
        {cpu.output.length === 0 ? (
          <span className="placeholder">no output yet — OUT sends ACC here</span>
        ) : (
          cpu.output.map((v, i) => (
            <span key={i} className={`out-value${i === cpu.output.length - 1 ? ' latest' : ''}`} title={toBin(v)}>
              {v}
            </span>
          ))
        )}
      </div>
    </section>
  );
}

export function TracePanel({ cpu }: { cpu: CpuState }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [cpu.trace.length]);

  return (
    <section className="panel trace">
      <h2>State changes, instruction by instruction</h2>
      <div className="trace-list" ref={ref}>
        {cpu.trace.length === 0 && <p className="placeholder">Each completed instruction and what it changed will appear here.</p>}
        {cpu.trace.map((t) => (
          <div key={t.n} className="trace-row">
            <span className="trace-n">#{t.n}</span>
            <span className="trace-addr">@{t.address}</span>
            <code className="trace-op">{t.text}</code>
            <span className="trace-changes">
              {t.changes.length === 0 ? (
                <span className="change none">no data changed</span>
              ) : (
                t.changes.map((c) => (
                  <span key={c} className={`change${c.startsWith('M[') ? ' mem' : c.startsWith('output') ? ' out' : ''}`}>
                    {c}
                  </span>
                ))
              )}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
