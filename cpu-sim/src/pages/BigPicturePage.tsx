import { useState } from 'react';
import { assemble } from '../cpu/assembler.ts';
import { EXAMPLES, type Example } from '../cpu/programs.ts';
import { SiteLayout } from '../components/SiteLayout.tsx';
import { SlideDeck, type Slide } from '../components/intro/SlideDeck.tsx';
import { ComputeSlide } from '../components/intro/ComputeSlide.tsx';
import { JourneySlide } from '../components/intro/JourneySlide.tsx';
import { LoaderDemo } from '../components/intro/LoaderDemo.tsx';
import { assembleOrThrow, pageHref, programParams, readSharedProgram, type SharedProgram } from '../site.ts';

function initialState(): SharedProgram {
  const shared = readSharedProgram();
  return assemble(shared.source).ok ? shared : { example: EXAMPLES[0], source: EXAMPLES[0].source };
}

export function BigPicturePage() {
  const [shared, setShared] = useState(initialState);
  const [program, setProgram] = useState(() => assembleOrThrow(shared.source, 'Program'));
  const [initialSlide] = useState(() => Number(new URLSearchParams(window.location.search).get('slide') ?? '1') - 1);
  const [slide, setSlide] = useState(initialSlide);

  const remember = (p: SharedProgram, s: number) =>
    window.history.replaceState(null, '', pageHref('big-picture', { slide: String(s + 1), ...programParams(p) }));

  const pickExample = (ex: Example) => {
    const next = { example: ex, source: ex.source };
    setShared(next);
    setProgram(assembleOrThrow(ex.source, `Example "${ex.id}"`));
    remember(next, slide);
  };

  const runHref = pageHref('processor', programParams(shared));

  const slides: Slide[] = [
    { id: 'compute', title: 'What is compute, basically?', content: <ComputeSlide /> },
    { id: 'journey', title: 'How does a program get into memory?', content: <JourneySlide /> },
    {
      id: 'loader',
      title: 'Demo: translating a program and loading it into RAM',
      content: <LoaderDemo program={program} exampleId={shared.example?.id ?? null} onPickExample={pickExample} runHref={runHref} />,
    },
  ];

  return (
    <SiteLayout current="big-picture">
      <header className="page-header">
        <span className="deck-kicker">Part 1</span>
        <h1>The big picture</h1>
        <p>
          Before looking inside the processor: what does “computing” actually mean, and how does a program you write end
          up as numbers in memory, ready for the CPU to run?
        </p>
      </header>

      <SlideDeck
        slides={slides}
        initialIndex={initialSlide}
        onChange={(s) => {
          setSlide(s);
          remember(shared, s);
        }}
        finalAction={
          <a className="button primary" href={runHref}>
            Next: Part 2 · Watch the processor run the program ›
          </a>
        }
      />
    </SiteLayout>
  );
}
