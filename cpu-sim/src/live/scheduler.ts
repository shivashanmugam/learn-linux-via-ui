/**
 * A tiny, deterministic model of how an OS shares one CPU core between programs.
 * One step = 1 ms of CPU time. The kernel only runs when an interrupt or a system call happens.
 */

export const TICK_MS = 4; // timer interrupt every 4 ms (Linux CONFIG_HZ=250)
export const SLICE_MS = 8; // a busy program may run this long before the scheduler swaps it out
export const MUSIC_SLEEP_MS = 10;
export const MUSIC_WORK_MS = 2;
export const DISK_MS = 6;
export const TIMELINE_LEN = 60;

export type Kind = 'system' | 'editor' | 'music' | 'compute';
export type ProcState = 'running' | 'ready' | 'sleeping';
export type Syscall = 'read' | 'nanosleep' | 'write' | 'exit';
export type KernelReason = 'timer' | 'keyboard' | 'disk' | Syscall;

export type KeyPress = { kind: 'char'; ch: string } | { kind: 'backspace' } | { kind: 'enter' } | { kind: 'save' };
export type KeyInput = KeyPress & { id: number };

export interface Proc {
  pid: number;
  name: string;
  kind: Kind;
  state: ProcState;
  waitingFor: string | null;
  wakeAt: number | null;
  cpuTime: number;
  work: number;
  pending: Syscall | null;
  got: KeyInput | null;
  resumeSaved: boolean;
  exiting: boolean;
}

export type Who = { type: 'proc'; pid: number } | { type: 'kernel'; reason: KernelReason } | { type: 'idle' };

export interface Slice {
  t: number;
  who: Who;
}

export interface LiveEvent {
  t: number;
  kind: 'irq' | 'syscall' | 'switch' | 'info';
  text: string;
}

export interface Journey {
  keyId: number;
  label: string;
  hop: number;
}

export interface LiveState {
  t: number;
  procs: Proc[];
  names: Record<number, { name: string; kind: Kind }>;
  current: number | null;
  sliceUsed: number;
  lastPid: number | null;
  hwQueue: KeyInput[];
  inputQueue: KeyInput[];
  editorText: string;
  editorStatus: string;
  diskDoneAt: number | null;
  timeline: Slice[];
  events: LiveEvent[];
  journey: Journey | null;
  nextPid: number;
  nextKeyId: number;
  stats: { interrupts: number; syscalls: number; switches: number; idle: number };
}

const NAMES: Record<Kind, string> = {
  system: 'systemd',
  editor: 'Text editor',
  music: 'Music player',
  compute: 'Heavy task',
};

function newProc(pid: number, kind: Kind): Proc {
  const base: Proc = {
    pid,
    name: NAMES[kind],
    kind,
    state: 'ready',
    waitingFor: null,
    wakeAt: null,
    cpuTime: 0,
    work: kind === 'music' ? MUSIC_WORK_MS : 0,
    pending: null,
    got: null,
    resumeSaved: false,
    exiting: false,
  };
  if (kind === 'system') return { ...base, state: 'sleeping', waitingFor: 'events (signals, sockets)' };
  if (kind === 'editor') return { ...base, state: 'sleeping', waitingFor: 'keyboard · read()' };
  return base;
}

export function createLive(): LiveState {
  const procs = [newProc(1, 'system'), newProc(2048, 'editor'), newProc(2051, 'music'), newProc(2093, 'compute')];
  return {
    t: 0,
    procs,
    names: Object.fromEntries(procs.map((p) => [p.pid, { name: p.name, kind: p.kind }])),
    current: null,
    sliceUsed: 0,
    lastPid: null,
    hwQueue: [],
    inputQueue: [],
    editorText: '',
    editorStatus: 'notes.txt',
    diskDoneAt: null,
    timeline: [],
    events: [],
    journey: null,
    nextPid: 2094,
    nextKeyId: 1,
    stats: { interrupts: 0, syscalls: 0, switches: 0, idle: 0 },
  };
}

export const keyLabel = (k: KeyInput): string =>
  k.kind === 'char' ? (k.ch === ' ' ? '␣' : k.ch) : k.kind === 'backspace' ? '⌫' : k.kind === 'enter' ? '⏎' : 'Ctrl+S';

// ---------------------------------------------------------------------------------------------
// Mutable helpers operating on a draft copy inside step().

function clone(s: LiveState): LiveState {
  return {
    ...s,
    procs: s.procs.map((p) => ({ ...p })),
    hwQueue: [...s.hwQueue],
    inputQueue: [...s.inputQueue],
    timeline: [...s.timeline],
    events: [...s.events],
    journey: s.journey ? { ...s.journey } : null,
    stats: { ...s.stats },
    names: { ...s.names },
  };
}

const proc = (n: LiveState, pid: number | null) => (pid === null ? undefined : n.procs.find((p) => p.pid === pid));
const name = (n: LiveState, pid: number | null) => (pid === null ? 'idle' : (n.names[pid]?.name ?? `PID ${pid}`));

function log(n: LiveState, kind: LiveEvent['kind'], text: string) {
  n.events.unshift({ t: n.t, kind, text });
  if (n.events.length > 40) n.events.length = 40;
}

function advanceJourney(n: LiveState, key: KeyInput | null | undefined, hop: number) {
  if (key && n.journey && n.journey.keyId === key.id && n.journey.hop < hop) n.journey.hop = hop;
}

/** Give the CPU to `pid` (or nothing). Marks the previous process ready if it was still runnable. */
function switchTo(n: LiveState, pid: number | null): string {
  const prev = proc(n, n.current);
  if (n.current === pid) return '';
  if (prev && prev.state === 'running') prev.state = 'ready';
  const next = proc(n, pid);
  if (next) {
    next.state = 'running';
    n.lastPid = pid;
    advanceJourney(n, next.got, 4);
  }
  n.current = pid;
  n.sliceUsed = 0;
  n.stats.switches += 1;
  return pid === null ? 'nothing is ready, so the CPU goes idle (HLT)' : `switch to ${name(n, pid)}`;
}

/** Round-robin: the next ready process after the one that ran last. */
function pickNext(n: LiveState, exclude: number | null = null): number | null {
  const ready = n.procs.filter((p) => p.state !== 'sleeping' && p.pid !== exclude && !(p.pid === n.current && p.state === 'running'));
  const candidates = ready.filter((p) => p.state === 'ready');
  if (!candidates.length) return null;
  const after = candidates.find((p) => n.lastPid !== null && p.pid > n.lastPid);
  return (after ?? candidates[0]).pid;
}

function handleKeyboard(n: LiveState) {
  const key = n.hwQueue.shift()!;
  n.stats.interrupts += 1;
  advanceJourney(n, key, 3);
  const editor = n.procs.find((p) => p.kind === 'editor');
  if (editor && editor.state === 'sleeping' && editor.waitingFor?.startsWith('keyboard')) {
    editor.got = key;
    editor.state = 'ready';
    editor.waitingFor = null;
    const sw = switchTo(n, editor.pid);
    log(n, 'irq', `⌨ Keyboard interrupt → kernel reads key “${keyLabel(key)}”, wakes the Text editor (it was waiting in read()) → ${sw || 'it keeps the CPU'}`);
    return;
  }
  n.inputQueue.push(key);
  log(n, 'irq', `⌨ Keyboard interrupt → key “${keyLabel(key)}” queued in the kernel; the editor is busy and will read it next`);
}

function handleDisk(n: LiveState) {
  n.diskDoneAt = null;
  n.stats.interrupts += 1;
  const editor = n.procs.find((p) => p.kind === 'editor');
  if (editor && editor.waitingFor?.startsWith('disk')) {
    editor.state = 'ready';
    editor.waitingFor = null;
    editor.resumeSaved = true;
    const sw = switchTo(n, editor.pid);
    log(n, 'irq', `💾 Disk interrupt → “write finished” → kernel wakes the Text editor → ${sw}`);
  } else {
    log(n, 'irq', '💾 Disk interrupt → write finished');
  }
}

function handleTimer(n: LiveState) {
  n.stats.interrupts += 1;
  const woke: string[] = [];
  for (const p of n.procs) {
    if (p.state === 'sleeping' && p.wakeAt !== null && p.wakeAt <= n.t) {
      p.state = 'ready';
      p.wakeAt = null;
      p.waitingFor = null;
      p.work = MUSIC_WORK_MS;
      woke.push(p.name);
    }
  }
  const cur = proc(n, n.current);
  const parts: string[] = [];
  if (woke.length) parts.push(`${woke.join(', ')} woke up (sleep time over)`);
  if (!cur) {
    const next = pickNext(n);
    if (next !== null) parts.push(switchTo(n, next));
    else parts.push('nothing to run, back to idle');
  } else if (n.sliceUsed >= SLICE_MS) {
    const next = pickNext(n, cur.pid);
    if (next !== null) parts.push(`${cur.name} used its ${SLICE_MS} ms slice → ${switchTo(n, next)}`);
    else {
      n.sliceUsed = 0;
      parts.push(`${cur.name} used its slice, but nobody else is waiting, so it continues`);
    }
  } else {
    parts.push(`${cur.name} may continue (${n.sliceUsed}/${SLICE_MS} ms used)`);
  }
  log(n, 'irq', `⏱ Timer interrupt → kernel: ${parts.join('; ')}`);
}

function handleSyscall(n: LiveState, cur: Proc): Syscall {
  const call = cur.pending!;
  cur.pending = null;
  n.stats.syscalls += 1;
  let text = '';
  if (call === 'read') {
    const queued = n.inputQueue.shift();
    if (queued) {
      cur.got = queued;
      log(n, 'syscall', `📞 ${cur.name} calls read() → a key is already waiting, so it returns at once`);
      return call;
    }
    cur.state = 'sleeping';
    cur.waitingFor = 'keyboard · read()';
    text = `📞 ${cur.name} calls read() → no key yet, so it goes to sleep`;
  } else if (call === 'nanosleep') {
    cur.state = 'sleeping';
    cur.wakeAt = n.t + MUSIC_SLEEP_MS;
    cur.waitingFor = `timer · wake at ${cur.wakeAt} ms`;
    text = `📞 ${cur.name} calls nanosleep(${MUSIC_SLEEP_MS} ms) → sleeps until its next audio buffer is due`;
  } else if (call === 'write') {
    cur.state = 'sleeping';
    cur.waitingFor = 'disk · write()';
    n.diskDoneAt = n.t + DISK_MS;
    text = `📞 ${cur.name} calls write() → kernel tells the disk to store the file, editor sleeps until it is done`;
  } else {
    n.procs = n.procs.filter((p) => p.pid !== cur.pid);
    text = `📞 ${cur.name} calls exit() → kernel frees its memory`;
  }
  const next = pickNext(n, cur.pid);
  n.current = call === 'exit' ? null : n.current;
  log(n, 'syscall', `${text} → ${switchTo(n, next) || 'idle'}`);
  return call;
}

function runUser(n: LiveState, cur: Proc) {
  cur.cpuTime += 1;
  n.sliceUsed += 1;
  if (cur.exiting) {
    cur.pending = 'exit';
    return;
  }
  if (cur.kind === 'music') {
    cur.work -= 1;
    if (cur.work <= 0) cur.pending = 'nanosleep';
  } else if (cur.kind === 'editor') {
    const key = cur.got;
    cur.got = null;
    if (cur.resumeSaved) {
      cur.resumeSaved = false;
      n.editorStatus = 'notes.txt — saved ✓';
      cur.pending = 'read';
      return;
    }
    if (key) {
      if (key.kind === 'char') n.editorText = (n.editorText + key.ch).slice(-600);
      else if (key.kind === 'enter') n.editorText = (n.editorText + '\n').slice(-600);
      else if (key.kind === 'backspace') n.editorText = n.editorText.slice(0, -1);
      if (key.kind !== 'save') n.editorStatus = 'notes.txt — edited';
      advanceJourney(n, key, 6);
      cur.pending = key.kind === 'save' ? 'write' : 'read';
    } else {
      cur.pending = 'read';
    }
  }
}

/** Advance the machine by 1 ms. */
export function step(s: LiveState): LiveState {
  const n = clone(s);
  let who: Who;
  const cur = proc(n, n.current);

  if (n.hwQueue.length) {
    handleKeyboard(n);
    who = { type: 'kernel', reason: 'keyboard' };
  } else if (n.diskDoneAt !== null && n.t >= n.diskDoneAt) {
    handleDisk(n);
    who = { type: 'kernel', reason: 'disk' };
  } else if (n.t % TICK_MS === 0) {
    handleTimer(n);
    who = { type: 'kernel', reason: 'timer' };
  } else if (cur && cur.pending) {
    who = { type: 'kernel', reason: handleSyscall(n, cur) };
  } else if (cur) {
    runUser(n, cur);
    who = { type: 'proc', pid: cur.pid };
  } else {
    n.stats.idle += 1;
    who = { type: 'idle' };
  }

  n.timeline.push({ t: n.t, who });
  if (n.timeline.length > TIMELINE_LEN) n.timeline.shift();
  n.t += 1;
  return n;
}

// ---------------------------------------------------------------------------------------------
// User actions

export function pressKey(s: LiveState, input: KeyPress): LiveState {
  const key: KeyInput = { ...input, id: s.nextKeyId };
  return {
    ...s,
    hwQueue: [...s.hwQueue, key],
    nextKeyId: s.nextKeyId + 1,
    journey: { keyId: key.id, label: keyLabel(key), hop: 1 },
  };
}

export function toggleProcess(s: LiveState, kind: 'music' | 'compute'): LiveState {
  const n = clone(s);
  const existing = n.procs.find((p) => p.kind === kind && !p.exiting);
  if (existing) {
    if (existing.pid === n.current) {
      existing.exiting = true;
      log(n, 'info', `✋ You asked ${existing.name} to quit; it will call exit() the next time it runs`);
    } else {
      n.procs = n.procs.filter((p) => p.pid !== existing.pid);
      log(n, 'info', `✋ ${existing.name} quit while it was not on the CPU; the kernel freed its memory`);
    }
    return n;
  }
  const p = newProc(n.nextPid, kind);
  n.procs.push(p);
  n.names[p.pid] = { name: p.name, kind };
  n.nextPid += 1;
  log(n, 'info', `▶ You started ${p.name} (PID ${p.pid}); it waits in the ready queue for the scheduler`);
  return n;
}

export const isRunning = (s: LiveState, kind: Kind) => s.procs.some((p) => p.kind === kind && !p.exiting);
