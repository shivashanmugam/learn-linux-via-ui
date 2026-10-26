import type { ReactNode } from 'react';
import { DISK_LAYOUT, REGIONS, type BootStage, type Part, type Wire } from '../../boot/stages.ts';

const WIRES: Record<Wire, { d: string; label: string; lx: number; ly: number; anchor?: 'start' | 'middle' | 'end'; both?: boolean }> = {
  'btn-pwr': { d: 'M95 98 V150', label: 'press', lx: 104, ly: 128, anchor: 'start' },
  'pwr-psu': { d: 'M95 228 V280', label: 'turn on', lx: 104, ly: 258, anchor: 'start' },
  'psu-cpu': { d: 'M170 319 H240', label: 'Power Good', lx: 205, ly: 310 },
  'flash-cpu': { d: 'M365 104 V150', label: 'fetch', lx: 375, ly: 131, anchor: 'start' },
  'flash-ram': { d: 'M490 48 H560', label: 'copy', lx: 525, ly: 40 },
  'cpu-ram': { d: 'M490 236 H560', label: 'memory bus', lx: 525, ly: 228, both: true },
  'cpu-disk': { d: 'M490 336 H520 V388 H860 V362', label: 'read request', lx: 690, ly: 381 },
  'disk-ram': { d: 'M790 190 H742', label: 'copy', lx: 766, ly: 181 },
  'kbd-cpu': { d: 'M365 418 V362', label: 'interrupt', lx: 375, ly: 396, anchor: 'start' },
  'cpu-display': { d: 'M460 362 V402 H650 V418', label: 'draw', lx: 560, ly: 397 },
};

const WIRE_IDS = Object.keys(WIRES) as Wire[];

/** Vertical position of each disk partition heading. */
const DISK_PART_Y = DISK_LAYOUT.map((_, i) => 62 + DISK_LAYOUT.slice(0, i).reduce((sum, p) => sum + 34 + p.files.length * 18, 0));

function PartBox({
  part,
  stage,
  x,
  y,
  w,
  h,
  title,
  children,
}: {
  part: Part;
  stage: BootStage;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  children?: ReactNode;
}) {
  const active = stage.parts.includes(part);
  return (
    <g className={`mpart mpart-${part}${active ? ' active' : ''}`}>
      <rect x={x} y={y} width={w} height={h} rx={10} />
      <text x={x + 12} y={y + 20} className="mpart-title">
        {title}
      </text>
      {children}
    </g>
  );
}

function Field({ x, y, label, value }: { x: number; y: number; label: string; value: string }) {
  return (
    <g>
      <text x={x} y={y} className="mfield-label">
        {label}
      </text>
      <text x={x} y={y + 17} className="mfield-value">
        {value}
      </text>
    </g>
  );
}

export function MachineDiagram({ stage }: { stage: BootStage }) {
  const activeWires = new Set(stage.wires);
  const poweredOn = stage.power === 'on';
  const ramRowsY = 66;
  const rowH = 36;
  const ipRow = REGIONS.findIndex((r) => r.id === stage.cpu.ipIn);
  const cpuStateClass = stage.cpu.state === 'Running' ? 'run' : stage.cpu.state === 'Off' ? 'off' : 'reset';

  return (
    <svg className="machine-diagram" viewBox="0 0 940 500" role="img" aria-label="Diagram of the computer's main parts">
      <defs>
        <marker id="m-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" className="arrow-head" />
        </marker>
        <marker id="m-arrow-on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" className="arrow-head active" />
        </marker>
        <pattern id="m-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" className="hatch-line" />
        </pattern>
      </defs>

      <rect x={6} y={6} width={928} height={488} rx={18} className="board" />
      <text x={22} y={486} className="board-label">
        MOTHERBOARD
      </text>

      {WIRE_IDS.map((id) => {
        const wire = WIRES[id];
        const on = activeWires.has(id);
        const marker = on ? 'url(#m-arrow-on)' : 'url(#m-arrow)';
        return (
          <g key={`${id}-${on ? stage.id : 'idle'}`} className={`mwire${on ? ' active' : ''}`}>
            <path d={wire.d} markerEnd={marker} markerStart={wire.both ? marker : undefined} />
            <text x={wire.lx} y={wire.ly} textAnchor={wire.anchor ?? 'middle'} className="mwire-label">
              {wire.label}
            </text>
          </g>
        );
      })}

      {/* Power button */}
      <g className={`mpart mpart-button${stage.parts.includes('button') ? ' active' : ''}`}>
        <circle cx={95} cy={62} r={34} className={stage.id === 'press' ? 'pressed' : undefined} />
        <path d="M84 52 A16 16 0 1 0 106 52" className="power-glyph" />
        <line x1={95} y1={44} x2={95} y2={62} className="power-glyph" />
        <circle cx={140} cy={36} r={5} className={`power-led${poweredOn ? ' on' : ''}`} />
        <text x={150} y={40} className="mfield-label">
          {poweredOn ? 'on' : 'off'}
        </text>
      </g>

      <PartBox part="pwrctl" stage={stage} x={20} y={150} w={150} h={78} title="POWER CONTROLLER">
        <text x={32} y={194} className="mfield-value small">
          {stage.status.pwrctl ?? 'on'}
        </text>
        <text x={32} y={214} className="mfield-label">
          runs on standby power
        </text>
      </PartBox>

      <PartBox part="psu" stage={stage} x={20} y={280} w={150} h={78} title="POWER SUPPLY">
        <text x={32} y={324} className={`mfield-value small${poweredOn ? ' good' : ''}`}>
          {stage.status.psu ?? (poweredOn ? 'on · Power Good ✓' : 'off')}
        </text>
        <text x={32} y={344} className="mfield-label">
          12 V · 5 V · 3.3 V
        </text>
      </PartBox>

      <PartBox part="flash" stage={stage} x={240} y={20} w={250} h={84} title="FIRMWARE CHIP (UEFI)">
        <text x={252} y={62} className="mfield-label">
          flash memory · keeps data when off
        </text>
        <text x={252} y={82} className="mfield-label">
          firmware code · boot order · settings
        </text>
        {stage.cpu.ipIn === 'flash' && (
          <g className="ip-badge">
            <rect x={398} y={8} width={84} height={20} rx={6} />
            <text x={440} y={22} textAnchor="middle">
              ▼ CPU runs here
            </text>
          </g>
        )}
      </PartBox>

      <PartBox part="cpu" stage={stage} x={240} y={150} w={250} h={212} title="CPU">
        <g className={`cpu-state ${cpuStateClass}`}>
          <rect x={380} y={158} width={102} height={20} rx={6} />
          <text x={431} y={172} textAnchor="middle">
            {stage.cpu.state}
          </text>
        </g>
        <Field x={252} y={198} label="running" value={stage.cpu.running} />
        <Field x={252} y={240} label="instruction pointer (IP)" value={stage.cpu.ip} />
        <Field x={252} y={282} label="mode" value={stage.cpu.mode} />
        <Field x={252} y={324} label="privilege" value={stage.cpu.privilege} />
      </PartBox>

      <PartBox part="ram" stage={stage} x={560} y={20} w={182} h={342} title="RAM">
        <text x={730} y={40} textAnchor="end" className="mfield-label">
          {stage.ram === 'off' ? 'empty · no power' : stage.ram === 'uninit' ? 'not set up yet' : '16 GB ready'}
        </text>
        {REGIONS.map((r, i) => {
          const state = stage.regions[r.id];
          const y = ramRowsY + i * (rowH + 4);
          return (
            <g key={`${r.id}-${state ?? 'none'}`} className={`ram-region owner-${r.owner} ${state ?? 'empty'}${i === ipRow ? ' ip' : ''}`}>
              <rect x={570} y={y} width={162} height={rowH} rx={6} />
              <text x={580} y={y + 15} className="region-label">
                {state ? r.label : '—'}
              </text>
              <text x={580} y={y + 29} className="region-state">
                {state === 'loading' ? 'loading…' : state === 'freed' ? 'freed, reused' : state === 'present' ? 'in RAM' : ''}
              </text>
            </g>
          );
        })}
        {stage.ram !== 'ready' && (
          <g className="ram-cover">
            <rect x={570} y={ramRowsY} width={162} height={7 * (rowH + 4) - 4} rx={6} fill="url(#m-hatch)" />
            <text x={651} y={ramRowsY + 136} textAnchor="middle">
              {stage.ram === 'off' ? 'contents lost' : 'memory controller'}
            </text>
            <text x={651} y={ramRowsY + 154} textAnchor="middle">
              {stage.ram === 'off' ? 'when power is off' : 'not configured yet'}
            </text>
          </g>
        )}
        {ipRow >= 0 && (
          <g className="ip-arrow">
            <path d={`M546 ${ramRowsY + ipRow * (rowH + 4) + rowH / 2} l12 0`} />
            <text x={544} y={ramRowsY + ipRow * (rowH + 4) + rowH / 2 + 4} textAnchor="end">
              IP
            </text>
          </g>
        )}
      </PartBox>

      <PartBox part="disk" stage={stage} x={790} y={20} w={140} h={342} title="SSD (DISK)">
        {DISK_LAYOUT.map((p, pi) => {
          const y = DISK_PART_Y[pi];
          return (
            <g key={p.partition}>
              <text x={800} y={y} className="disk-part">
                {p.partition}
              </text>
              {p.files.map((f, i) => (
                <text key={f.id} x={806} y={y + 20 + i * 18} className={`disk-file${stage.diskRead?.includes(f.id) ? ' reading' : ''}`}>
                  {f.name}
                </text>
              ))}
            </g>
          );
        })}
        <text x={800} y={348} className="mfield-label">
          keeps data when off
        </text>
      </PartBox>

      <PartBox part="keyboard" stage={stage} x={240} y={418} w={250} h={64} title="KEYBOARD">
        <text x={478} y={438} textAnchor="end" className="mfield-label">
          {stage.status.keyboard ?? ''}
        </text>
        {Array.from({ length: 10 }, (_, i) => (
          <rect key={i} x={252 + i * 23} y={450} width={19} height={14} rx={3} className="keycap" />
        ))}
      </PartBox>

      <PartBox part="display" stage={stage} x={560} y={418} w={182} h={64} title="DISPLAY">
        <text x={572} y={464} className="mfield-value small">
          {stage.status.display ?? ''}
        </text>
      </PartBox>
    </svg>
  );
}
