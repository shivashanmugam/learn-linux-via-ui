import { useEffect, useState } from 'react';
import { SiteLayout } from '../components/SiteLayout.tsx';
import { CpuTimeline } from '../components/live/CpuTimeline.tsx';
import { KERNEL_REASON, describeWho } from '../live/labels.ts';
import { EditorApp, KeystrokeJourney } from '../components/live/EditorApp.tsx';
import { EventLog, ProcessTable } from '../components/live/ProcessPanel.tsx';
import { ProtectionExplainer } from '../components/live/ProtectionExplainer.tsx';
import {
  SLICE_MS,
  TICK_MS,
  createLive,
  isRunning,
  pressKey,
  step,
  toggleProcess,
  type KeyPress,
  type LiveState,
} from '../live/scheduler.ts';
import { pageHref } from '../site.ts';

const WAYS = [
  {
    icon: '⏱',
    title: 'Timer interrupts',
    text: `During boot the kernel programmed a hardware timer to interrupt the CPU every few milliseconds (here every ${TICK_MS} ms). Whatever is running gets paused, and the kernel decides whether someone else should get a turn. This is why one stuck program cannot freeze the whole computer.`,
  },
  {
    icon: '⌨',
    title: 'Device interrupts',
    text: 'The keyboard, mouse, disk and network card interrupt the CPU when something happens: a key was pressed, data arrived, a write finished. The kernel’s driver handles it and wakes up whichever program was waiting.',
  },
  {
    icon: '📞',
    title: 'System calls',
    text: 'Programs run in user mode and are not allowed to touch hardware. To read a key, sleep, open a file or draw on screen they make a system call, a special instruction that deliberately jumps into the kernel.',
  },
];

export function LivePage() {
  const [state, setState] = useState<LiveState>(createLive);
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(8);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setState((s) => step(s)), 1000 / speed);
    return () => window.clearInterval(id);
  }, [running, speed]);

  const last = state.timeline.at(-1);
  const cur = state.procs.find((p) => p.pid === state.current);
  const onKey = (k: KeyPress) => setState((s) => pressKey(s, k));

  let nowTitle = 'Not started';
  let nowText = 'Press ▶ Run to start the clock.';
  let nowMode = '—';
  let nowClass = 'idle';
  if (last?.who.type === 'kernel') {
    nowClass = 'kernel';
    nowMode = 'kernel mode (ring 0)';
    nowTitle = `Kernel: ${KERNEL_REASON[last.who.reason].label}`;
    nowText = ['timer', 'keyboard', 'disk'].includes(last.who.reason)
      ? 'An interrupt paused the running program. The CPU saved its registers and jumped into the kernel’s handler. Afterwards the kernel either resumes that program or switches to another.'
      : 'A program asked the kernel for something with a system call. The kernel does the privileged work, then returns to the program or, if it has to wait, runs someone else.';
  } else if (last?.who.type === 'proc') {
    nowClass = state.names[last.who.pid]?.kind ?? 'compute';
    nowMode = 'user mode (ring 3)';
    nowTitle = `${describeWho(state, last.who)} (PID ${last.who.pid})`;
    nowText =
      'An ordinary program is executing its own instructions. It can only touch its own memory; for anything else it must make a system call. The kernel is not running at all right now.';
  } else if (last?.who.type === 'idle') {
    nowTitle = 'Idle: nothing is ready to run';
    nowMode = 'halted (HLT)';
    nowText =
      'Every program is waiting for something. The kernel’s idle loop executes HLT, the same instruction as in Part 2, and the CPU sleeps, saving power, until the next interrupt wakes it.';
  }

  return (
    <SiteLayout current="live">
      <header className="page-header">
        <span className="deck-kicker">Part 4</span>
        <h1>How the OS keeps the computer alive</h1>
        <p>
          At the end of booting the kernel started the first programs and handed them the CPU. So how does the operating
          system stay in control, run many programs “at once” and react the instant you press a key? The secret: the
          kernel is not a loop that runs all the time. It is woken up, again and again, by interrupts and system calls.
        </p>
      </header>

      <section className="panel ways">
        <h2>Three ways the kernel gets the CPU back</h2>
        <div className="ways-grid">
          {WAYS.map((w) => (
            <article key={w.title}>
              <span className="ways-icon" aria-hidden="true">
                {w.icon}
              </span>
              <h3>{w.title}</h3>
              <p>{w.text}</p>
            </article>
          ))}
        </div>
        <p className="hint">
          A fourth way is an <b>exception</b>: a program does something illegal or unusual (divides by zero, touches memory
          that is not mapped yet) and the CPU itself jumps into the kernel to deal with it.
        </p>
      </section>

      <ProtectionExplainer />

      <section className="panel live-panel">
        <div className="live-top">
          <div>
            <span className="deck-kicker">Live simulation · one CPU core</span>
            <h2 className="deck-title">Who is using the CPU, millisecond by millisecond</h2>
          </div>
          <div className="live-controls">
            <button type="button" className={running ? 'danger' : 'run'} onClick={() => setRunning(!running)}>
              {running ? '❚❚ Pause' : '▶ Run'}
            </button>
            <button type="button" onClick={() => setState((s) => step(s))} disabled={running}>
              Step 1 ms
            </button>
            <button type="button" onClick={() => setState(createLive())}>
              ⟲ Reset
            </button>
            <label className="speed">
              Speed
              <input type="range" min={1} max={40} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
              <span className="dim">{Math.round(1000 / speed)}× slower than real</span>
            </label>
          </div>
        </div>

        <div className="live-toggles">
          <span className="dim">Programs:</span>
          <button type="button" className={isRunning(state, 'compute') ? 'on' : ''} onClick={() => setState((s) => toggleProcess(s, 'compute'))}>
            {isRunning(state, 'compute') ? '■ Stop' : '▶ Start'} Heavy task <span className="dim">(always busy)</span>
          </button>
          <button type="button" className={isRunning(state, 'music') ? 'on' : ''} onClick={() => setState((s) => toggleProcess(s, 'music'))}>
            {isRunning(state, 'music') ? '■ Stop' : '▶ Start'} Music player <span className="dim">(works 2 ms, sleeps 10 ms)</span>
          </button>
          <span className="dim">Text editor: sleeps until you type below</span>
        </div>

        <div className="cpu-now-row">
          <div className={`cpu-now ${nowClass}`} key={`${nowClass}-${nowTitle}`}>
            <span className="cpu-now-label">CPU right now · {state.t} ms</span>
            <b>{nowTitle}</b>
            <span className="cpu-now-mode">{nowMode}</span>
            <p>{nowText}</p>
          </div>
          <dl className="live-stats">
            <div>
              <dt>interrupts</dt>
              <dd>{state.stats.interrupts}</dd>
            </div>
            <div>
              <dt>system calls</dt>
              <dd>{state.stats.syscalls}</dd>
            </div>
            <div>
              <dt>context switches</dt>
              <dd>{state.stats.switches}</dd>
            </div>
            <div>
              <dt>idle</dt>
              <dd>{state.t ? Math.round((state.stats.idle / state.t) * 100) : 0}%</dd>
            </div>
          </dl>
        </div>

        <CpuTimeline state={state} />
        <div className="tl-legend">
          <span>
            Each column is 1 ms; only <b>one</b> row can be filled per column because one core runs one thing at a time.
          </span>
          <span>
            Kernel letters: <b>T</b> timer · <b>K</b> keyboard · <b>D</b> disk · <b>r</b>/<b>s</b>/<b>w</b>/<b>x</b> system calls read,
            sleep, write, exit.
          </span>
          <span>
            A busy program may keep the CPU for up to {SLICE_MS} ms before the timer lets the scheduler swap it out. Kernel work
            really takes microseconds; it is drawn as a full column so you can see it.
          </span>
          <span>
            Not sure what “kernel mode (ring 0)” and “user mode (ring 3)” mean?{' '}
            <a href="#protection">Rings and page tables, explained ↑</a>
          </span>
        </div>

        <div className="live-grid">
          <div className="live-col">
            <h3 className="mini-head">Type into a running program</h3>
            <EditorApp state={state} running={running} onKey={onKey} />
            <KeystrokeJourney state={state} />
          </div>
          <div className="live-col">
            <h3 className="mini-head">Processes (like the top command)</h3>
            <ProcessTable state={state} />
            <p className="hint">
              {cur ? (
                <>
                  <b>{cur.name}</b> owns the CPU now.{' '}
                </>
              ) : null}
              <i>Sleeping</i> programs use no CPU at all; they are simply skipped until an interrupt wakes them. That is why a
              computer with hundreds of processes can still be mostly idle.
            </p>
            <h3 className="mini-head">What the kernel did (newest first)</h3>
            <EventLog state={state} />
          </div>
        </div>
      </section>

      <section className="panel modes">
        <h2>Putting it together</h2>
        <div className="ways-grid">
          <article>
            <h3>What a context switch really does</h3>
            <p>
              When the scheduler moves the CPU from one program to another, the kernel (in ring 0) saves the old program’s
              registers, loads the new program’s registers, points the CPU at the new program’s <b>page table</b>, and
              returns to <b>ring 3</b>. To the program it looks as if it never stopped. See the{' '}
              <a href="#protection">rings and page tables</a> above.
            </p>
          </article>
          <article>
            <h3>Why one program can’t freeze the computer</h3>
            <p>
              A program in ring 3 cannot switch off interrupts, so the timer interrupt <i>always</i> gets the CPU back to the
              kernel. And because of page tables, a crashing program can only damage its own memory: the kernel simply
              throws its pages away and everything else keeps running.
            </p>
          </article>
          <article>
            <h3>Many cores, same idea</h3>
            <p>
              A real CPU has several cores, each with its own timer and its own copy of this timeline, all run by the same
              kernel. Linux’s scheduler (EEVDF since kernel 6.6) is far smarter than this round-robin one, weighing priorities
              and fairness, but the mechanism is identical.
            </p>
          </article>
        </div>
      </section>

      <section className="panel recap">
        <h2>The whole picture</h2>
        <ol className="recap-list">
          <li>
            <b>Computing</b> is turning numbers into other numbers with simple rules.{' '}
            <a href={pageHref('big-picture')}>Part 1</a>
          </li>
          <li>
            A <b>CPU</b> fetches an instruction from RAM, decodes it, executes it, and repeats. <a href={pageHref('processor')}>Part 2</a>
          </li>
          <li>
            <b>Booting</b> is a relay of loaders, firmware → bootloader → kernel → systemd, that fills empty RAM and points
            the CPU at the next program. <a href={pageHref('boot')}>Part 3</a>
          </li>
          <li>
            A <b>live system</b> is the kernel getting the CPU back on every interrupt and system call, sharing it between
            programs and waking them when what they wait for arrives. You are here.
          </li>
        </ol>
      </section>
    </SiteLayout>
  );
}
