import { SiteLayout } from '../components/SiteLayout.tsx';
import { pageHref } from '../site.ts';

export function HomePage() {
  return (
    <SiteLayout current="home">
      <header className="home-hero">
        <h1>
          Inside a tiny CPU <span>from one instruction to a living computer</span>
        </h1>
        <p>
          An interactive, in-browser explanation of how a computer really works: what computing is, how a program ends up
          in memory, how a processor fetches, decodes and executes instructions one clock tick at a time, what happens
          between pressing the power button and seeing a login screen, and how the operating system keeps everything
          running while you type.
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
        <a className="home-card" href={pageHref('boot')}>
          <span className="deck-kicker">Part 3 · 13 steps</span>
          <h2>From power button to operating system</h2>
          <ul>
            <li>What the power button really does, and why the CPU starts at a fixed address</li>
            <li>Firmware, bootloader, Linux kernel and systemd: a relay race of loaders</li>
            <li>Watch RAM fill up and follow the CPU’s instruction pointer at every stage</li>
          </ul>
          <span className="home-cta">Boot the machine →</span>
        </a>
        <a className="home-card" href={pageHref('live')}>
          <span className="deck-kicker">Part 4 · live simulation</span>
          <h2>How the OS keeps the computer alive</h2>
          <ul>
            <li>Timer interrupts, system calls and the scheduler sharing one CPU</li>
            <li>Type into a running program and follow your keystroke through the machine</li>
            <li>User mode vs kernel mode, sleeping processes and the idle HLT</li>
          </ul>
          <span className="home-cta">Watch it live →</span>
        </a>
      </div>

      <p className="home-note">
        New to this? Start with Part 1 and go in order: each part builds on the ideas of the one before.
      </p>
    </SiteLayout>
  );
}
