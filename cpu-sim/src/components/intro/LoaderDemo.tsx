import { useEffect, useState } from 'react';
import type { ListingEntry, Program } from '../../cpu/assembler.ts';
import { MEMORY_SIZE, opByCode, toBin } from '../../cpu/isa.ts';
import { EXAMPLES, type Example } from '../../cpu/programs.ts';
import { AssemblyExplainer } from './AssemblyExplainer.tsx';

type DemoStep = { kind: 'source' } | { kind: 'pass1' } | { kind: 'encode'; index: number } | { kind: 'start' };

interface Props {
  program: Program;
  exampleId: string | null;
  onPickExample: (example: Example) => void;
  /** Link to the processor page with this program loaded. */
  runHref: string;
}

function buildSteps(program: Program): DemoStep[] {
  return [
    { kind: 'source' },
    { kind: 'pass1' },
    ...program.listing.map((_, index) => ({ kind: 'encode' as const, index })),
    { kind: 'start' },
  ];
}

function SourceLine({ raw }: { raw: string }) {
  const at = raw.indexOf(';');
  if (at < 0) return <>{raw || ' '}</>;
  return (
    <>
      {raw.slice(0, at)}
      <span className="src-comment">{raw.slice(at)}</span>
    </>
  );
}

function EncodeCard({ entry }: { entry: ListingEntry }) {
  const bits = toBin(entry.word);
  if (entry.kind === 'data') {
    return (
      <div className="encode-card">
        <div className="encode-head">
          Line {entry.line}: <code>{entry.text}</code>
        </div>
        <div className="encode-row">
          <code className="tok data">DAT {entry.operandText}</code>
          <span className="encode-why">
            DAT is <b>not an instruction</b>. It tells the assembler to put this number into a memory cell.
            {entry.operandSource === 'label' && ` (${entry.operandText} is a label, so its address is used.)`}
          </span>
        </div>
        <div className="encode-row">
          <span className="encode-label">number</span>
          <code className="tok data">{entry.operandValue}</code>
          <span className="encode-arrow">→ binary →</span>
          <code className="byte data-bits">{bits}</code>
        </div>
        <div className="encode-result">
          📥 write <b>{entry.word}</b> into <b>RAM[{entry.address}]</b>
          {entry.label && (
            <span className="dim">
              {' '}
              (label <code>{entry.label}</code> means address {entry.address})
            </span>
          )}
        </div>
      </div>
    );
  }

  const op = opByCode(entry.opcode ?? -1);
  const operandWhy =
    entry.operandSource === 'label'
      ? `"${entry.operandText}" is a label → look it up in the label table → address ${entry.operandValue}`
      : entry.operandSource === 'number'
        ? `the number ${entry.operandValue} is written directly`
        : `${entry.mnemonic} needs no operand, so these bits are 0`;

  return (
    <div className="encode-card">
      <div className="encode-head">
        Line {entry.line}: <code>{entry.text}</code>
      </div>
      <div className="encode-row">
        <span className="encode-label">operation</span>
        <code className="tok">{entry.mnemonic}</code>
        <span className="encode-arrow">→ instruction table →</span>
        <code className="byte opcode">{toBin(entry.opcode ?? 0, 4)}</code>
        <span className="encode-why">
          opcode {entry.opcode} = “{op?.name}”
        </span>
      </div>
      <div className="encode-row">
        <span className="encode-label">operand</span>
        <code className="tok">{entry.operandText ?? '—'}</code>
        <span className="encode-arrow">→</span>
        <code className="byte operand">{toBin(entry.operandValue, 4)}</code>
        <span className="encode-why">{operandWhy}</span>
      </div>
      <div className="encode-row combine">
        <span className="encode-label">together</span>
        <code className="byte big">
          <span className="opcode">{bits.slice(0, 4)}</span>
          <span className="operand">{bits.slice(4)}</span>
        </code>
        <span className="encode-arrow">=</span>
        <code className="tok">{entry.word}</code>
        <span className="encode-why">one byte = one number</span>
      </div>
      <div className="encode-result">
        📥 write <b>{entry.word}</b> into <b>RAM[{entry.address}]</b>
      </div>
    </div>
  );
}

export function LoaderDemo({ program, exampleId, onPickExample, runHref }: Props) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [shownProgram, setShownProgram] = useState(program);

  // Restart the demo whenever a different program is loaded.
  if (shownProgram !== program) {
    setShownProgram(program);
    setStep(0);
    setPlaying(false);
  }

  const steps = buildSteps(program);
  const last = steps.length - 1;
  const current = steps[Math.min(step, last)];
  const isPlaying = playing && step < last;

  useEffect(() => {
    if (!isPlaying) return;
    const id = window.setTimeout(() => setStep((s) => s + 1), step === 0 ? 1600 : 1300);
    return () => window.clearTimeout(id);
  }, [isPlaying, step]);

  const go = (delta: number | null) => {
    setPlaying(false);
    setStep((s) => (delta === null ? 0 : Math.max(0, Math.min(last, s + delta))));
  };
  const togglePlay = () => {
    if (isPlaying) return setPlaying(false);
    if (step >= last) setStep(0);
    setPlaying(true);
  };

  const written = current.kind === 'encode' ? current.index + 1 : current.kind === 'start' ? program.listing.length : 0;
  const writingIndex = current.kind === 'encode' ? current.index : -1;
  const showAddresses = step >= 1;
  const entryByLine = new Map(program.listing.map((e) => [e.line, e]));
  const sourceLines = program.source.replace(/\s+$/, '').split(/\r?\n/);

  return (
    <div className="slide-body loader-demo">
      <div className="demo-top">
        <div className="examples small">
          {EXAMPLES.map((ex) => (
            <button key={ex.id} type="button" className={ex.id === exampleId ? 'selected' : ''} onClick={() => onPickExample(ex)}>
              {ex.title}
            </button>
          ))}
          {exampleId === null && <span className="custom-tag">your own program</span>}
        </div>
        <div className="demo-controls">
          <button type="button" onClick={() => go(null)} disabled={step === 0} title="Restart" aria-label="Restart">
            ⟲
          </button>
          <button type="button" onClick={() => go(-1)} disabled={step === 0}>
            ◀ Prev
          </button>
          <button type="button" className={isPlaying ? 'danger' : 'run'} onClick={togglePlay}>
            {isPlaying ? '❚❚ Pause' : '▶ Play'}
          </button>
          <button type="button" className="primary" onClick={() => go(1)} disabled={step >= last}>
            Next ▶
          </button>
          <span className="demo-progress">
            step {step + 1} / {steps.length}
          </span>
        </div>
      </div>

      <div className="demo-grid">
        <section className="demo-col">
          <h4 className="source-head">
            ① Source text
            <span className="lang-tag" title="Little Man Computer assembly language (LMC-style dialect). See the explanation below the demo.">
              Little Man Computer (LMC) assembly
            </span>
          </h4>
          <pre className="demo-source">
            {sourceLines.map((raw, i) => {
              const entry = entryByLine.get(i + 1);
              const isCurrent = current.kind === 'encode' && program.listing[current.index]?.line === i + 1;
              const done = entry !== undefined && entry.address < written && !isCurrent;
              return (
                <div key={i} className={`src-line${isCurrent ? ' current' : ''}${done ? ' done' : ''}${entry ? '' : ' skip'}`}>
                  <span className="src-gutter">{showAddresses && entry ? entry.address : ''}</span>
                  <span className="src-text">
                    <SourceLine raw={raw} />
                  </span>
                </div>
              );
            })}
          </pre>
        </section>

        <section className="demo-col">
          <h4>② Assembler</h4>
          {current.kind === 'source' && (
            <div className="encode-card">
              <p>
                This is the program as <b>text</b>, written in <b>Little Man Computer (LMC) assembly language</b>. To the CPU it is meaningless. It can only fetch <b>numbers</b> from
                <b> RAM</b>, and right now RAM is empty (all zeros).
              </p>
              <p>
                The assembler will turn each line into <b>one byte</b> (8 bits) and the loader will place byte #0 into
                cell 0, byte #1 into cell 1, and so on. Comments (after <code>;</code>) and blank lines are skipped.
              </p>
              <p className="dim">Press Next ▶ or Play.</p>
            </div>
          )}
          {current.kind === 'pass1' && (
            <div className="encode-card">
              <div className="encode-head">Pass 1: count cells and remember the labels</div>
              <p>
                Some instructions refer to names defined further down (for example <code>ADD y</code> before <code>y:</code> appears).
                So the assembler first reads the whole program and gives each line the next free address (the grey
                numbers on the left). Every <b>label</b> becomes a name for its address:
              </p>
              {program.symbols.length ? (
                <table className="symbols">
                  <thead>
                    <tr>
                      <th>label</th>
                      <th>address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {program.symbols.map((s) => (
                      <tr key={s.name}>
                        <td>
                          <code>{s.name}</code>
                        </td>
                        <td>
                          <code>{s.address}</code> <span className="dim">({toBin(s.address, 4)})</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="dim">This program has no labels.</p>
              )}
              <p className="dim">Pass 2 translates the lines one by one.</p>
            </div>
          )}
          {current.kind === 'encode' && <EncodeCard key={current.index} entry={program.listing[current.index]} />}
          {current.kind === 'start' && (
            <div className="encode-card">
              <div className="encode-head">✅ Loaded: {program.listing.length} bytes in RAM</div>
              <p>
                Code and data now sit side by side in memory, and both are just numbers. The CPU cannot tell which is which.
                It only knows <b>where to start</b>.
              </p>
              <p>
                The loader sets <b>PC = 0</b> and clears the registers. From now on the processor runs on its own:
                fetch the byte at PC → decode it → execute it → repeat.
              </p>
              <a className="button run" href={runHref}>
                ▶ Watch the CPU run it (Part 2) →
              </a>
            </div>
          )}
        </section>

        <section className="demo-col">
          <h4>③ RAM</h4>
          <div className="demo-ram">
            {Array.from({ length: MEMORY_SIZE }, (_, addr) => {
              const entry = program.listing.find((e) => e.address === addr);
              const isWritten = entry !== undefined && addr < written;
              const isWriting = entry !== undefined && addr === program.listing[writingIndex]?.address;
              const isPc = current.kind === 'start' && addr === 0;
              const bits = toBin(isWritten ? entry.word : 0);
              return (
                <div
                  key={`${addr}-${isWriting ? step : 'x'}`}
                  className={`ram-cell${isWritten ? ` filled ${entry.kind}` : ''}${isWriting ? ' writing' : ''}`}
                >
                  <span className="ram-pc">{isPc ? 'PC▸' : ''}</span>
                  <span className="ram-addr">{addr}</span>
                  <span className="ram-bits">
                    {isWritten && entry.kind === 'code' ? (
                      <>
                        <span className="opcode">{bits.slice(0, 4)}</span>
                        <span className="operand">{bits.slice(4)}</span>
                      </>
                    ) : (
                      <span className={isWritten ? 'data-bits' : ''}>{bits}</span>
                    )}
                  </span>
                  <span className="ram-val">{isWritten ? entry.word : 0}</span>
                  <span className="ram-label">{showAddresses ? (entry?.label ?? '') : ''}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <AssemblyExplainer />
    </div>
  );
}
