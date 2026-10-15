import { SiteLayout } from '../components/SiteLayout.tsx';
import { pageHref } from '../site.ts';

export function HomePage() {
  return (
    <SiteLayout current="home">
      <header className="home-hero">
        <h1>
          Inside a tiny CPU <span>how instructions turn memory into answers</span>
        </h1>
        <p>
          An interactive, in-browser explanation of how a computer really works: what computing is, how a program ends up
          in memory, and how a simple 8-bit processor fetches, decodes and executes instructions one clock tick at a time
          until the answer appears.
        </p>
      </header>

      <div className="home-cards">
        <a className="home-card" href={pageHref('big-picture')}>
          <span className="deck-kicker">Part 1 · 3 slides</span>
          <h2>The big picture</h2>
          <ul>
            <li>What is compute, basically?</li>
            <li>How does a program get into memory?</li>
            <li>Demo: watch a program get translated into machine code and loaded into RAM, line by line</li>
          </ul>
          <span className="home-cta">Start here →</span>
        </a>
        <a className="home-card" href={pageHref('processor')}>
          <span className="deck-kicker">Part 2 · interactive simulator</span>
          <h2>Watch the processor run the program</h2>
          <ul>
            <li>Step through fetch → decode → execute, one clock tick at a time</li>
            <li>See registers, the ALU, flags and memory change with every instruction</li>
            <li>Run the example programs or write and assemble your own</li>
          </ul>
          <span className="home-cta">Open the simulator →</span>
        </a>
      </div>

      <p className="home-note">
        New to this? Start with Part 1. Each part also links to the other, and the program you pick is carried across.
      </p>
    </SiteLayout>
  );
}
