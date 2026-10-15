import { useState } from 'react';
import { assemble, type AssemblyError, type Program } from '../cpu/assembler.ts';
import { EXAMPLES, type Example } from '../cpu/programs.ts';

interface Props {
  source: string;
  example: Example | null;
  loaderDemoHref: string;
  onSourceChange: (source: string) => void;
  onSelectExample: (example: Example) => void;
  onLoad: (program: Program) => void;
}

export function ProgramEditor({ source, example, loaderDemoHref, onSourceChange, onSelectExample, onLoad }: Props) {
  // Feedback belongs to the exact source text it was produced for; editing hides it.
  const [feedback, setFeedback] = useState<{ source: string; errors: AssemblyError[]; status: string | null } | null>(null);
  const current = feedback?.source === source ? feedback : null;

  const load = () => {
    const result = assemble(source);
    if (result.ok) {
      const used = result.program.kinds.filter((k) => k !== 'empty').length;
      setFeedback({ source, errors: [], status: `Assembled into ${used} bytes and loaded into memory.` });
      onLoad(result.program);
    } else {
      setFeedback({ source, errors: result.errors, status: null });
    }
  };

  return (
    <section className="panel editor">
      <h2>Program</h2>
      <div className="examples" role="tablist">
        {EXAMPLES.map((ex) => (
          <button
            key={ex.id}
            type="button"
            role="tab"
            aria-selected={example?.id === ex.id}
            className={example?.id === ex.id ? 'selected' : ''}
            onClick={() => onSelectExample(ex)}
          >
            {ex.title}
          </button>
        ))}
      </div>
      {example && (
        <div className="example-info">
          <p>{example.description}</p>
          <p className="watch">👀 {example.watch}</p>
        </div>
      )}
      <div className="syntax">
        <span className="syntax-title">Syntax</span>
        <span>
          <code>label: OP operand</code> instruction
        </span>
        <span>
          <code>label: DAT n</code> data cell
        </span>
        <span>
          <code>; comment</code> ignored
        </span>
        <span className="dim">labels are optional · one line = one memory cell</span>
      </div>
      <textarea
        value={source}
        spellCheck={false}
        onChange={(e) => onSourceChange(e.target.value)}
        aria-label="Assembly source code"
        rows={16}
      />
      <div className="editor-actions">
        <button type="button" className="primary" onClick={load}>
          Assemble &amp; load into memory
        </button>
        <a className="hint" href={loaderDemoHref}>
          See how the loaded program is translated &amp; loaded, step by step →
        </a>
      </div>
      {current?.status && <p className="ok">{current.status}</p>}
      {current && current.errors.length > 0 && (
        <ul className="errors">
          {current.errors.map((e, i) => (
            <li key={i}>
              Line {e.line}: {e.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
