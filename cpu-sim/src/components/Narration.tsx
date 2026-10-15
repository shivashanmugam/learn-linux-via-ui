import { useMemo } from 'react';
import { microPlan, tick, type CpuState } from '../cpu/cpu.ts';
import { disassemble } from '../cpu/isa.ts';

const PHASE_LABEL = { fetch: 'Fetch', decode: 'Decode', execute: 'Execute' } as const;

export function Narration({ cpu }: { cpu: CpuState }) {
  const ev = cpu.lastEvent;
  const next = useMemo(() => (cpu.halted ? null : tick(cpu).lastEvent), [cpu]);
  const { steps, executeKnown } = microPlan(cpu);
  const lastTrace = cpu.trace.at(-1);
  const inFlight = cpu.step > 2;

  return (
    <section className="panel narration">
      <div className="pipeline" aria-label="Micro-steps of the current instruction">
        {(['fetch', 'decode', 'execute'] as const).map((phase) => (
          <div key={phase} className={`stage stage-${phase}`}>
            <div className="stage-name">{PHASE_LABEL[phase]}</div>
            <div className="chips">
              {steps
                .map((s, i) => ({ ...s, i }))
                .filter((s) => s.phase === phase)
                .map((s) => (
                  <span
                    key={s.i}
                    className={`chip${s.i < cpu.step ? ' done' : ''}${s.i === cpu.step && !cpu.halted ? ' next' : ''}`}
                  >
                    {s.label}
                  </span>
                ))}
              {phase === 'execute' && !executeKnown && (
                <span className="chip unknown">depends on the instruction being fetched…</span>
              )}
            </div>
          </div>
        ))}
        <div className="pipeline-meta">
          <span>
            clock ticks <b>{cpu.ticks}</b>
          </span>
          <span>
            instructions <b>{cpu.instructions}</b>
          </span>
          {inFlight && (
            <span>
              now running <b>{disassemble(cpu.ir)}</b>
            </span>
          )}
        </div>
      </div>

      <div className="story">
        {cpu.error ? (
          <div className="event error">
            <h3>Stopped with an error</h3>
            <p>{cpu.error}</p>
          </div>
        ) : ev ? (
          <div className="event" key={cpu.ticks}>
            <div className="event-head">
              <span className={`phase-pill ${ev.phase}`}>{PHASE_LABEL[ev.phase]}</span>
              <h3>{ev.title}</h3>
            </div>
            <code className="rtl">{ev.rtl}</code>
            <p>{ev.explain}</p>
          </div>
        ) : (
          <div className="event">
            <h3>Ready.</h3>
            <p>
              The assembler and loader have already put the program into memory as plain numbers (Part 1 shows how).
              Every register is 0 and PC points at address 0. Press <kbd>Step</kbd> to advance the clock by one tick and
              watch the processor fetch its first instruction.
            </p>
          </div>
        )}

        {cpu.halted && !cpu.error && (
          <p className="final">
            ✅ Finished after {cpu.instructions} instructions and {cpu.ticks} clock ticks. Output:{' '}
            <b>{cpu.output.length ? cpu.output.join(', ') : 'nothing'}</b>. Cells marked “was …” in memory show how the
            program transformed the initial memory state.
          </p>
        )}

        {next && (
          <p className="next">
            <span>Next tick:</span> <span className={`phase-pill small ${next.phase}`}>{PHASE_LABEL[next.phase]}</span>{' '}
            {next.title} — <code>{next.rtl}</code>
          </p>
        )}

        {lastTrace && cpu.step === 0 && !cpu.halted && (
          <p className="next">
            <span>Instruction complete:</span> <code>{lastTrace.text}</code> →{' '}
            {lastTrace.changes.length ? lastTrace.changes.join(', ') : 'no data changed'}
          </p>
        )}
      </div>
    </section>
  );
}
