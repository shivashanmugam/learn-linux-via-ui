import { useEffect, useState } from 'react';
import { assemble } from '../cpu/assembler.ts';
import { EXAMPLES, type Example } from '../cpu/programs.ts';
import { useSimulator, type RunMode } from '../hooks/useSimulator.ts';
import { CpuDiagram } from '../components/CpuDiagram.tsx';
import { MemoryView } from '../components/MemoryView.tsx';
import { Narration } from '../components/Narration.tsx';
import { Controls } from '../components/Controls.tsx';
import { OutputPanel, TracePanel } from '../components/OutputTrace.tsx';
import { ProgramEditor } from '../components/ProgramEditor.tsx';
import { Concepts, IsaReference } from '../components/Reference.tsx';
import { SiteLayout } from '../components/SiteLayout.tsx';
import { assembleOrThrow, pageHref, programParams, readSharedProgram, type SharedProgram } from '../site.ts';

const speedToDelay = (speed: number): number => Math.round(1400 / speed ** 1.4);

function initialState() {
  const shared = readSharedProgram();
  const result = assemble(shared.source);
  if (result.ok) return { shared, program: result.program };
  // A broken ?src= link: show the text in the editor but run the default example.
  return { shared, program: assembleOrThrow(EXAMPLES[0].source, 'Default example') };
}

export function ProcessorPage() {
  const [init] = useState(initialState);
  const [example, setExample] = useState<Example | null>(init.shared.example);
  const [source, setSource] = useState(init.shared.source);
  const [mode, setMode] = useState<RunMode>('micro');
  const [speed, setSpeed] = useState(4);
  const sim = useSimulator(init.program, mode, speedToDelay(speed));
  const { cpu, running, tick, stepInstruction, back, reset, setRunning } = sim;

  const loaded: SharedProgram =
    example && sim.program.source === example.source
      ? { example, source: example.source }
      : { example: null, source: sim.program.source };
  const loaderDemoHref = pageHref('big-picture', { slide: '3', ...programParams(loaded) });

  const remember = (p: SharedProgram) => window.history.replaceState(null, '', pageHref('processor', programParams(p)));

  const selectExample = (ex: Example) => {
    setExample(ex);
    setSource(ex.source);
    sim.load(assembleOrThrow(ex.source, `Example "${ex.id}"`));
    remember({ example: ex, source: ex.source });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable]') || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === ' ' && target.closest('button, summary, a')) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (!running) (e.shiftKey ? stepInstruction : tick)();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (!running) back();
      } else if (e.key === ' ') {
        e.preventDefault();
        setRunning(!running);
      } else if (e.key === 'r' || e.key === 'R') {
        reset();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [running, tick, stepInstruction, back, reset, setRunning]);

  return (
    <SiteLayout current="processor">
      <header className="page-header">
        <span className="deck-kicker">Part 2</span>
        <h1>Watch the processor run the program</h1>
        <p>
          The program is already in RAM as plain numbers (<a href={loaderDemoHref}>see how it got there in Part 1</a>).
          Step through it one clock tick at a time to see how each instruction is fetched, decoded and executed, how the
          ALU computes, and how memory changes until the result appears on the output.
        </p>
      </header>

      <Concepts />

      <Controls
        running={running}
        halted={cpu.halted}
        canGoBack={sim.canGoBack}
        mode={mode}
        speed={speed}
        onTick={tick}
        onInstruction={stepInstruction}
        onBack={back}
        onReset={reset}
        onRun={setRunning}
        onMode={setMode}
        onSpeed={setSpeed}
      />

      <Narration cpu={cpu} />

      <main className="machine">
        <section className="panel cpu">
          <h2>Processor</h2>
          <CpuDiagram cpu={cpu} />
        </section>
        <section className="panel mem">
          <h2>Memory</h2>
          <MemoryView
            cpu={cpu}
            program={sim.program}
            initialMemory={sim.initialMemory}
            editable={!running}
            onPoke={sim.poke}
          />
        </section>
      </main>

      <div className="lower">
        <div className="lower-left">
          <OutputPanel cpu={cpu} />
          <TracePanel cpu={cpu} />
        </div>
        <ProgramEditor
          source={source}
          example={example}
          loaderDemoHref={loaderDemoHref}
          onSourceChange={setSource}
          onSelectExample={selectExample}
          onLoad={(program) => {
            const shared: SharedProgram =
              example && source === example.source ? { example, source } : { example: null, source };
            setExample(shared.example);
            sim.load(program);
            remember(shared);
          }}
        />
      </div>

      <IsaReference />
    </SiteLayout>
  );
}
