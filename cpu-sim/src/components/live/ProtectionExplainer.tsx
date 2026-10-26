import { useEffect, useState } from 'react';
import { pageHref } from '../../site.ts';

type ProcId = 'editor' | 'music';

interface Mapping {
  vaddr: string;
  what: string;
  frame: number | null;
  perm: string;
  kernelOnly?: boolean;
}

const PROCS: Record<ProcId, { name: string; pid: number; maps: Mapping[] }> = {
  editor: {
    name: 'Text editor',
    pid: 2048,
    maps: [
      { vaddr: '0x0040_0000', what: 'program code', frame: 5, perm: 'read · run' },
      { vaddr: '0x0040_1000', what: 'data (your text)', frame: 3, perm: 'read · write' },
      { vaddr: '0x0040_2000', what: 'nothing here', frame: null, perm: '' },
      { vaddr: '0xFFFF_8000_…', what: 'kernel', frame: 1, perm: 'kernel only', kernelOnly: true },
    ],
  },
  music: {
    name: 'Music player',
    pid: 2051,
    maps: [
      { vaddr: '0x0040_0000', what: 'program code', frame: 7, perm: 'read · run' },
      { vaddr: '0x0040_1000', what: 'data (audio)', frame: 6, perm: 'read · write' },
      { vaddr: '0x0040_2000', what: 'nothing here', frame: null, perm: '' },
      { vaddr: '0xFFFF_8000_…', what: 'kernel', frame: 1, perm: 'kernel only', kernelOnly: true },
    ],
  },
};

const FRAMES: { owner: ProcId | 'kernel' | 'free' | 'firmware'; label: string }[] = [
  { owner: 'firmware', label: 'firmware (reserved)' },
  { owner: 'kernel', label: 'kernel' },
  { owner: 'kernel', label: 'kernel data' },
  { owner: 'editor', label: 'editor data' },
  { owner: 'free', label: 'free' },
  { owner: 'editor', label: 'editor code' },
  { owner: 'music', label: 'music data' },
  { owner: 'music', label: 'music code' },
];

const ROW_Y = (i: number) => 64 + i * 52;
const FRAME_Y = (f: number) => 40 + f * 30;

function PageTableDiagram({ proc }: { proc: ProcId }) {
  const p = PROCS[proc];
  return (
    <svg className="pt-diagram" viewBox="0 0 780 290" role="img" aria-label={`Page table of the ${p.name}`}>
      <text x={14} y={22} className="pt-head">
        VIRTUAL ADDRESS · what the program uses
      </text>
      <text x={290} y={22} className="pt-head">
        PAGE TABLE of {p.name.toUpperCase()}
      </text>
      <text x={590} y={22} className="pt-head">
        PHYSICAL RAM · real location
      </text>

      {FRAMES.map((f, i) => {
        const used = p.maps.some((m) => m.frame === i);
        return (
          <g key={i} className={`pt-frame owner-${f.owner}${used ? ' used' : ''}`}>
            <rect x={590} y={FRAME_Y(i)} width={176} height={26} rx={5} />
            <text x={600} y={FRAME_Y(i) + 17} className="pt-frame-n">
              page {i}
            </text>
            <text x={756} y={FRAME_Y(i) + 17} textAnchor="end" className="pt-frame-label">
              {f.label}
            </text>
          </g>
        );
      })}

      {p.maps.map((m, i) => {
        const y = ROW_Y(i);
        const missing = m.frame === null;
        return (
          <g key={`${proc}-${i}`} className={`pt-row${missing ? ' missing' : ''}${m.kernelOnly ? ' kernel' : ''}`}>
            <rect x={14} y={y - 20} width={220} height={40} rx={7} className="pt-vbox" />
            <text x={26} y={y - 3} className="pt-addr">
              {m.vaddr}
            </text>
            <text x={26} y={y + 12} className="pt-what">
              {m.what}
            </text>
            <path d={`M234 ${y} H288`} className="pt-arrow" />
            <rect x={290} y={y - 20} width={230} height={40} rx={7} className="pt-entry" />
            <text x={302} y={y - 3} className="pt-addr">
              {missing ? 'no entry' : `→ physical page ${m.frame}`}
            </text>
            <text x={302} y={y + 12} className="pt-what">
              {missing ? 'using it causes a page fault' : m.perm}
            </text>
            {!missing && <path d={`M520 ${y} C555 ${y}, 555 ${FRAME_Y(m.frame!) + 13}, 588 ${FRAME_Y(m.frame!) + 13}`} className="pt-link" />}
          </g>
        );
      })}

      <text x={290} y={282} className="pt-cr3">
        CR3 register → this table (the kernel swaps it on every switch between programs)
      </text>
    </svg>
  );
}

function RingsDiagram() {
  const cx = 150;
  const cy = 150;
  return (
    <svg className="rings-diagram" viewBox="0 0 300 330" role="img" aria-label="CPU privilege rings">
      <defs>
        <marker id="ring-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" className="ring-door-head" />
        </marker>
      </defs>
      <circle cx={cx} cy={cy} r={138} className="ring r3" />
      <circle cx={cx} cy={cy} r={104} className="ring r2" />
      <circle cx={cx} cy={cy} r={74} className="ring r1" />
      <circle cx={cx} cy={cy} r={44} className="ring r0" />
      <text x={cx} y={cy - 4} textAnchor="middle" className="ring-name core">
        Ring 0
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" className="ring-sub core">
        kernel
      </text>
      <text x={cx} y={cy - 55} textAnchor="middle" className="ring-name">
        ring 1 (unused)
      </text>
      <text x={cx} y={cy - 85} textAnchor="middle" className="ring-name">
        ring 2 (unused)
      </text>
      <text x={cx} y={cy - 116} textAnchor="middle" className="ring-name strong">
        Ring 3 · your apps
      </text>
      <path d={`M${cx + 132} ${cy + 118} L${cx + 36} ${cy + 28}`} className="ring-door" markerEnd="url(#ring-arrow)" />
      <text x={cx} y={cy + 166} textAnchor="middle" className="ring-door-label">
        only doors in: system call · interrupt · exception
      </text>
    </svg>
  );
}

const PROTECTION_ID = 'protection';

/** Opens the collapsed explainer and scrolls to it. */
function openProtection() {
  const el = document.getElementById(PROTECTION_ID);
  if (el instanceof HTMLDetailsElement) el.open = true;
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function ProtectionExplainer() {
  const [proc, setProc] = useState<ProcId>('editor');
  const [open, setOpen] = useState(() => window.location.hash === `#${PROTECTION_ID}`);

  // Any in-page link to #protection opens the panel, even if the hash is already set.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const link = e.target instanceof Element ? e.target.closest(`a[href="#${PROTECTION_ID}"]`) : null;
      if (!link) return;
      e.preventDefault();
      window.history.replaceState(null, '', `#${PROTECTION_ID}`);
      openProtection();
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  return (
    <details
      className="panel protection"
      id={PROTECTION_ID}
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>
        <span className="protection-badge" aria-hidden="true">
          ?
        </span>
        <span className="protection-summary-text">
          <b>New to “ring 0 / ring 3” or “page tables”?</b>
          <span>
            Two hardware ideas the simulation below relies on, explained with a diagram and a small interactive demo.
          </span>
        </span>
        <span className="protection-toggle">{open ? 'Hide' : 'Show explanation'}</span>
      </summary>
      <p className="protection-intro">
        Many programs share one CPU and one RAM. Two hardware features, both switched on by the kernel during boot, stop
        them from interfering with each other or with the kernel. The simulation below uses both terms.
      </p>

      <div className="protection-grid">
        <article className="protection-card">
          <span className="asm-why-tag">1 · Ring 0 vs ring 3: what code is allowed to do</span>
          <div className="protection-split">
            <RingsDiagram />
            <ul>
              <li>
                The CPU always knows the <b>privilege level</b> of the code it is running. x86 has four, drawn as rings;
                lower numbers have more power.
              </li>
              <li>
                <b>Ring 0 = kernel mode.</b> Anything goes: talk to devices, switch interrupts off, run <code>HLT</code>,
                change page tables.
              </li>
              <li>
                <b>Ring 3 = user mode.</b> Every normal program. Those powerful instructions are forbidden; trying one makes
                the CPU jump into the kernel, which usually stops the program.
              </li>
              <li>
                The only ways from ring 3 into ring 0 are the “doors” the kernel registered at boot: <b>system calls</b>,{' '}
                <b>interrupts</b> and <b>exceptions</b>. Each lands on kernel code, never on the program’s own code.
              </li>
            </ul>
          </div>
          <p className="hint">
            Why: so a buggy or malicious app cannot take over the hardware, turn off the timer to keep the CPU forever, or
            read other programs’ memory. ARM calls the same idea EL0 (apps) and EL1 (kernel).{' '}
            <a href={pageHref('boot', { stage: '4' })}>Where it starts during boot →</a>
          </p>
        </article>

        <article className="protection-card">
          <span className="asm-why-tag">2 · Page tables: every program gets its own private memory</span>
          <div className="pt-toggle" role="group" aria-label="Show the page table of">
            <span className="dim">Show the page table of:</span>
            {(Object.keys(PROCS) as ProcId[]).map((id) => (
              <button key={id} type="button" className={proc === id ? 'active' : ''} aria-pressed={proc === id} onClick={() => setProc(id)}>
                {PROCS[id].name} <span className="dim">PID {PROCS[id].pid}</span>
              </button>
            ))}
          </div>
          <PageTableDiagram proc={proc} />
          <ul className="pt-points">
            <li>
              Programs only ever use <b>virtual addresses</b>. On every memory access the CPU’s <b>MMU</b> (Memory
              Management Unit) looks the address up in the current <b>page table</b> and finds the <b>physical</b> address
              in the RAM sticks. Memory is handled in 4 KB blocks called <b>pages</b>.
            </li>
            <li>
              Switch between the two programs above: both use the <i>same</i> virtual address <code>0x0040_0000</code>, but
              their tables send it to <i>different</i> physical pages. Neither can even name the other’s memory.
            </li>
            <li>
              The kernel is mapped into every table but marked <b>kernel only</b>, so ring 3 code cannot touch it, while a
              system call can use it instantly.
            </li>
            <li>
              An address with no entry causes a <b>page fault</b>: the CPU jumps into the kernel, which either loads the
              missing data from disk or ends the program with “Segmentation fault”.
            </li>
          </ul>
          <p className="hint">
            Compare Part 2: our tiny CPU put addresses on the bus unchanged, so any program could overwrite any cell.{' '}
            <a href={pageHref('boot', { stage: '9' })}>Where the kernel builds them during boot →</a>
          </p>
        </article>
      </div>
    </details>
  );
}
