import { useEffect, useRef, useState } from 'react';
import { PHASES, type BootStage } from '../../boot/stages.ts';

/**
 * The stage explanation: fixed height with a pinned title. Long text starts clipped behind a
 * "Click to expand" link; expanding turns the body into a scrollable area with a visible scrollbar.
 */
export function BootCard({ stage }: { stage: BootStage }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setOverflows(el.scrollHeight > el.clientHeight + 4));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (expanded) bodyRef.current?.focus({ preventScroll: true });
  }, [expanded]);

  const collapsed = overflows && !expanded;

  return (
    <article className={`boot-card phase-${stage.phase}${collapsed ? ' collapsed' : ''}${expanded ? ' expanded' : ''}`}>
      <header className="boot-card-head">
        <span className="boot-phase">{PHASES.find((p) => p.id === stage.phase)?.label}</span>
        <h2 className="deck-title">{stage.title}</h2>
      </header>
      <div
        className="boot-card-body"
        ref={bodyRef}
        tabIndex={expanded ? 0 : undefined}
        aria-label="Stage explanation"
      >
        <div className="tour-row">
          <span className="tour-label">What happens</span>
          <p>{stage.what}</p>
        </div>
        <div className="tour-row why">
          <span className="tour-label">Why</span>
          <p>{stage.why}</p>
        </div>
        <div className="tour-row real">
          <span className="tour-label">In a real PC</span>
          <p>{stage.real}</p>
        </div>
        {stage.deepDive && (
          <div className="boot-deep">
            <h3>{stage.deepDive.title}</h3>
            <ol>
              {stage.deepDive.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            {stage.deepDive.note && <p className="dim">{stage.deepDive.note}</p>}
          </div>
        )}
        {stage.connect && (
          <div className="boot-connect">
            <span aria-hidden="true">🔗</span> {stage.connect}
          </div>
        )}
      </div>
      {collapsed && (
        <button
          type="button"
          className="expand-link"
          aria-expanded={false}
          onClick={() => setExpanded(true)}
        >
          Click to expand ▾
        </button>
      )}
    </article>
  );
}
