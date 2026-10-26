import { useEffect, useState } from 'react';
import { SiteLayout } from '../components/SiteLayout.tsx';
import { MachineDiagram } from '../components/boot/MachineDiagram.tsx';
import { BootLog, Monitor } from '../components/boot/Monitor.tsx';
import { BootCard } from '../components/boot/BootCard.tsx';
import { PHASES, STAGES, type LogLine } from '../boot/stages.ts';
import { pageHref } from '../site.ts';

const PLAY_MS = 6500;

const RELAY = [
  { who: 'Firmware (UEFI)', lives: 'flash chip on the motherboard', job: 'sets up RAM, finds hardware', next: 'loads the bootloader' },
  { who: 'Bootloader (GRUB)', lives: 'EFI partition on the disk', job: 'understands filesystems, shows menu', next: 'loads kernel + initramfs' },
  { who: 'Linux kernel', lives: '/boot/vmlinuz on the disk', job: 'memory, interrupts, drivers, scheduler', next: 'starts /sbin/init' },
  { who: 'systemd (PID 1)', lives: '/sbin/init on the disk', job: 'starts every system service', next: 'starts the login screen' },
  { who: 'Desktop & your apps', lives: '/usr/bin/… on the disk', job: 'what you actually use', next: 'run until shutdown' },
];

function initialIndex(): number {
  const n = Number(new URLSearchParams(window.location.search).get('stage'));
  return Number.isInteger(n) && n >= 1 && n <= STAGES.length ? n - 1 : 0;
}

export function BootPage() {
  const [index, setIndex] = useState(initialIndex);
  const [playing, setPlaying] = useState(false);
  const stage = STAGES[index];
  const last = STAGES.length - 1;
  const isPlaying = playing && index < last;

  const go = (i: number) => {
    const next = Math.max(0, Math.min(last, i));
    setIndex(next);
    window.history.replaceState(null, '', next === 0 ? pageHref('boot') : pageHref('boot', { stage: String(next + 1) }));
  };

  useEffect(() => {
    if (!isPlaying) return;
    const id = window.setTimeout(() => go(index + 1), PLAY_MS);
    return () => window.clearTimeout(id);
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('input, textarea, select, [contenteditable]') || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'ArrowRight') {
        setPlaying(false);
        go(index + 1);
      } else if (e.key === 'ArrowLeft') {
        setPlaying(false);
        go(index - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const allLines: LogLine[] = STAGES.slice(0, index + 1).flatMap((s) => s.log ?? []);
  const freshFrom = allLines.length - (stage.log?.length ?? 0);
  const kernelLines = allLines.filter((l) => l.src === 'kernel' || l.src === 'systemd');
  const powerOn = () => {
    go(1);
    setPlaying(true);
  };

  return (
    <SiteLayout current="boot">
      <header className="page-header">
        <span className="deck-kicker">Part 3</span>
        <h1>From power button to a running operating system</h1>
        <p>
          When you press the power button, RAM is empty and the CPU knows nothing. Follow every step a real PC takes to get
          from there to a login screen: which chip is working, what gets copied into RAM, and where the CPU’s instruction
          pointer is at each moment. The example is a typical x86-64 PC with UEFI firmware booting Linux.
        </p>
      </header>

      <section className="panel boot-panel">
        <div className="boot-top">
          <button
            type="button"
            className={`power-btn${index === 0 ? ' pulse' : ''}`}
            onClick={index === 0 ? powerOn : () => go(0)}
            title={index === 0 ? 'Press the power button' : 'Power off and start again'}
          >
            <span className="power-icon" aria-hidden="true">
              ⏻
            </span>
            {index === 0 ? 'Press the power button' : 'Power off'}
          </button>

          <div className="boot-controls">
            <button type="button" onClick={() => (setPlaying(false), go(index - 1))} disabled={index === 0}>
              ◀ Back
            </button>
            <button
              type="button"
              className={isPlaying ? 'danger' : 'run'}
              onClick={() => (index >= last ? (go(0), setPlaying(false)) : setPlaying(!isPlaying))}
            >
              {isPlaying ? '❚❚ Pause' : index >= last ? '⟲ Start over' : '▶ Auto-play'}
            </button>
            <button type="button" className="primary" onClick={() => (setPlaying(false), go(index + 1))} disabled={index >= last}>
              Next ▶
            </button>
            <span className="demo-progress">
              {index + 1} / {STAGES.length}
            </span>
          </div>
        </div>

        <nav className="phase-track" aria-label="Boot stages">
          {PHASES.map((p) => (
            <div key={p.id} className={`phase-group phase-${p.id}${stage.phase === p.id ? ' current' : ''}`}>
              <span className="phase-name">{p.label}</span>
              <div className="phase-stages">
                {STAGES.map((s, i) =>
                  s.phase === p.id ? (
                    <button
                      key={s.id}
                      type="button"
                      className={i === index ? 'active' : i < index ? 'done' : ''}
                      aria-current={i === index}
                      onClick={() => (setPlaying(false), go(i))}
                    >
                      {s.short}
                    </button>
                  ) : null,
                )}
              </div>
            </div>
          ))}
        </nav>
        {isPlaying && <div className="play-bar" key={index} style={{ animationDuration: `${PLAY_MS}ms` }} />}

        <div className="boot-grid">
          <div className="boot-diagram">
            <MachineDiagram stage={stage} />
          </div>
          <BootCard stage={stage} key={stage.id} />
        </div>

        <div className="boot-lower">
          <div>
            <h3 className="mini-head">What you see on the screen</h3>
            <Monitor screen={stage.screen} kernelLines={kernelLines} />
          </div>
          <div>
            <h3 className="mini-head">Boot log (example messages)</h3>
            <BootLog lines={allLines} freshFrom={freshFrom} />
          </div>
        </div>
      </section>

      <section className="panel relay">
        <h2>The boot relay race</h2>
        <p className="relay-intro">
          Every stage is a program that lives somewhere permanent, gets copied into RAM, does its job, then loads the next
          program and hands over the CPU’s instruction pointer. Only the kernel stays in charge until you shut down.
        </p>
        <ol className="relay-chain">
          {RELAY.map((r) => (
            <li key={r.who}>
              <b>{r.who}</b>
              <span>
                <i>lives in</i> {r.lives}
              </span>
              <span>
                <i>does</i> {r.job}
              </span>
              <span className="relay-next">→ {r.next}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="panel next-part">
        <div>
          <span className="deck-kicker">Up next · Part 4</span>
          <h2 className="deck-title">How does the OS keep running?</h2>
          <p>
            After booting, the kernel does not sit in a loop. It gets the CPU back through timer interrupts, key presses and
            system calls. Watch it happen live, and type into a program to follow your keystroke through the machine.
          </p>
        </div>
        <a className="button primary" href={pageHref('live')}>
          Part 4 · A live machine →
        </a>
      </section>
    </SiteLayout>
  );
}
