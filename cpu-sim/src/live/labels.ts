import type { KernelReason, LiveState, Who } from './scheduler.ts';

export const KERNEL_REASON: Record<KernelReason, { letter: string; label: string }> = {
  timer: { letter: 'T', label: 'timer interrupt' },
  keyboard: { letter: 'K', label: 'keyboard interrupt' },
  disk: { letter: 'D', label: 'disk interrupt' },
  read: { letter: 'r', label: 'system call read()' },
  nanosleep: { letter: 's', label: 'system call nanosleep()' },
  write: { letter: 'w', label: 'system call write()' },
  exit: { letter: 'x', label: 'system call exit()' },
};

export function describeWho(s: LiveState, who: Who | undefined): string {
  if (!who) return 'not started';
  if (who.type === 'idle') return 'idle';
  if (who.type === 'kernel') return `kernel · ${KERNEL_REASON[who.reason].label}`;
  return s.names[who.pid]?.name ?? `PID ${who.pid}`;
}
