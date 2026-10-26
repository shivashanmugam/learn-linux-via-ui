/**
 * The boot sequence of a typical x86-64 PC with UEFI firmware booting Linux (GRUB + systemd).
 * Each stage is a snapshot of the whole machine; the UI renders it, nothing here is simulated.
 */

export type Part = 'button' | 'pwrctl' | 'psu' | 'flash' | 'cpu' | 'ram' | 'disk' | 'keyboard' | 'display';

export type Wire =
  | 'btn-pwr'
  | 'pwr-psu'
  | 'psu-cpu'
  | 'flash-cpu'
  | 'flash-ram'
  | 'cpu-ram'
  | 'cpu-disk'
  | 'disk-ram'
  | 'kbd-cpu'
  | 'cpu-display';

export type Phase = 'power' | 'reset' | 'firmware' | 'bootloader' | 'kernel' | 'user';

export const PHASES: { id: Phase; label: string }[] = [
  { id: 'power', label: 'Power' },
  { id: 'reset', label: 'CPU reset' },
  { id: 'firmware', label: 'Firmware' },
  { id: 'bootloader', label: 'Bootloader' },
  { id: 'kernel', label: 'Kernel' },
  { id: 'user', label: 'User space' },
];

export type RegionId = 'fw' | 'grub' | 'kernel' | 'initrd' | 'kdata' | 'systemd' | 'apps';
export type RegionState = 'loading' | 'present' | 'freed';

export const REGIONS: { id: RegionId; label: string; owner: Phase }[] = [
  { id: 'fw', label: 'Firmware (runtime)', owner: 'firmware' },
  { id: 'grub', label: 'Bootloader (shim → GRUB)', owner: 'bootloader' },
  { id: 'kernel', label: 'Linux kernel', owner: 'kernel' },
  { id: 'initrd', label: 'initramfs (temp root)', owner: 'kernel' },
  { id: 'kdata', label: 'Page tables, IDT, data', owner: 'kernel' },
  { id: 'systemd', label: 'systemd (PID 1)', owner: 'user' },
  { id: 'apps', label: 'Login, desktop, apps', owner: 'user' },
];

export type DiskFile = 'shim' | 'grubefi' | 'grubcfg' | 'vmlinuz' | 'initrd' | 'init' | 'apps';

export const DISK_LAYOUT: { partition: string; files: { id: DiskFile; name: string }[] }[] = [
  {
    partition: 'EFI partition (FAT32)',
    files: [
      { id: 'shim', name: 'shimx64.efi' },
      { id: 'grubefi', name: 'grubx64.efi' },
    ],
  },
  {
    partition: 'Linux root (ext4)',
    files: [
      { id: 'grubcfg', name: '/boot/grub/grub.cfg' },
      { id: 'vmlinuz', name: '/boot/vmlinuz' },
      { id: 'initrd', name: '/boot/initrd.img' },
      { id: 'init', name: '/sbin/init' },
      { id: 'apps', name: '/usr/bin/… apps' },
    ],
  },
];

export type Screen = 'off' | 'black' | 'logo' | 'grub' | 'kernel' | 'login' | 'desktop';

export interface CpuView {
  state: 'Off' | 'Held in reset' | 'Running';
  running: string;
  ip: string;
  /** Where the instruction pointer points: the firmware chip or a RAM region. */
  ipIn: 'flash' | RegionId | null;
  mode: string;
  privilege: string;
}

export interface LogLine {
  src: 'firmware' | 'shim' | 'grub' | 'kernel' | 'systemd';
  text: string;
}

export interface BootStage {
  id: string;
  phase: Phase;
  title: string;
  short: string;
  parts: Part[];
  wires: Wire[];
  power: 'standby' | 'ramping' | 'on';
  status: Partial<Record<'pwrctl' | 'psu' | 'keyboard' | 'display', string>>;
  cpu: CpuView;
  ram: 'off' | 'uninit' | 'ready';
  regions: Partial<Record<RegionId, RegionState>>;
  diskRead?: DiskFile[];
  screen: Screen;
  log?: LogLine[];
  what: string;
  why: string;
  real: string;
  /** Link back to an idea from an earlier or later part. */
  connect?: string;
  /** Optional step-by-step explanation shown under the main text. */
  deepDive?: { title: string; steps: string[]; note?: string };
}

const OFF_CPU: CpuView = { state: 'Off', running: 'nothing', ip: '—', ipIn: null, mode: '—', privilege: '—' };

const KERNEL_LOADED = { fw: 'present', kernel: 'present', initrd: 'present', kdata: 'present' } as const;

export const STAGES: BootStage[] = [
  {
    id: 'off',
    phase: 'power',
    title: 'Power off: where everything lives',
    short: 'Off',
    parts: ['flash', 'disk'],
    wires: [],
    power: 'standby',
    status: { pwrctl: 'standby power only', psu: 'off · 5 V standby', display: 'no signal' },
    cpu: OFF_CPU,
    ram: 'off',
    regions: {},
    screen: 'off',
    what:
      'The computer is switched off. The operating system is stored on the disk (SSD) and the firmware is stored in a small flash chip on the motherboard. Both keep their contents without power. RAM is empty: it forgets everything the moment power is removed.',
    why:
      'This is the core problem booting solves. The CPU can only run instructions that are in memory, but RAM is empty at power-on and the OS sits on a disk the CPU cannot execute from. Something has to copy the OS into RAM before it can run, and that something must already be somewhere the CPU can reach.',
    real:
      'A plugged-in PC is never completely off. The power supply keeps a small “standby” rail (5 V) alive so the power controller can notice the button, a network card can listen for Wake-on-LAN, and USB ports can charge your phone.',
    connect:
      'In Part 1 the loader simply placed the program into RAM for you. A real computer has to do that loading itself, starting from nothing.',
  },
  {
    id: 'press',
    phase: 'power',
    title: 'You press the power button',
    short: 'Press',
    parts: ['button', 'pwrctl', 'psu'],
    wires: ['btn-pwr', 'pwr-psu'],
    power: 'ramping',
    status: { pwrctl: 'pressed → turn PSU on', psu: 'switching on…', display: 'no signal' },
    cpu: OFF_CPU,
    ram: 'off',
    regions: {},
    screen: 'off',
    what:
      'The power button is just a tiny switch wired to the motherboard. It does not carry the computer’s power. Pressing it briefly connects two pins; the power controller, which runs on standby power, notices and tells the power supply to switch on its main outputs.',
    why:
      'Using a small signal instead of a big mechanical switch lets the computer decide how to react: a short press can mean “turn on” or “go to sleep”, and holding it for about 4 seconds forces it off even if the software has frozen.',
    real:
      'On a desktop the wire that tells the ATX power supply to turn on is called PS_ON#. On laptops a small “embedded controller” chip handles the button, battery and charging.',
  },
  {
    id: 'powergood',
    phase: 'power',
    title: 'Power settles, then the CPU is released from reset',
    short: 'Power Good',
    parts: ['psu', 'cpu'],
    wires: ['psu-cpu'],
    power: 'on',
    status: { pwrctl: 'on', psu: 'on · Power Good ✓', display: 'no signal' },
    cpu: { ...OFF_CPU, state: 'Held in reset', running: 'nothing yet' },
    ram: 'uninit',
    regions: {},
    screen: 'black',
    what:
      'The power supply ramps its voltages (12 V, 5 V, 3.3 V) up to the right level. Until they are stable, the CPU is deliberately held in reset: it has power but is not allowed to execute anything. Once the supply reports “Power Good”, the reset is released.',
    why:
      'A processor running on half-ready power would execute garbage. Holding it in reset until the voltages are clean guarantees that it always starts from the same, known state.',
    real: 'This takes roughly 0.1–0.5 seconds. It is the short pause between pressing the button and the fans spinning up.',
  },
  {
    id: 'reset',
    phase: 'reset',
    title: 'The CPU wakes up at the reset vector',
    short: 'Reset vector',
    parts: ['cpu', 'flash'],
    wires: ['flash-cpu'],
    power: 'on',
    status: { psu: 'on · Power Good ✓', display: 'no signal' },
    cpu: {
      state: 'Running',
      running: 'first firmware instruction',
      ip: '0xFFFFFFF0',
      ipIn: 'flash',
      mode: '16-bit (real mode)',
      privilege: 'everything allowed',
    },
    ram: 'uninit',
    regions: {},
    screen: 'black',
    what:
      'Coming out of reset, every register is set to a fixed value, and the instruction pointer always gets the same address: 0xFFFFFFF0, called the reset vector. That address is not in RAM. The motherboard routes it to the firmware flash chip, so the very first instruction the CPU fetches comes from the firmware.',
    why:
      'The CPU has no idea what computer it is in, how much RAM there is or where the OS is. The only safe design is to start at one fixed address and put the firmware there. The firmware is the first program, and because it is stored permanently it is always present.',
    real:
      'For backwards compatibility, x86 CPUs still start in 16-bit “real mode”, like the original 1981 IBM PC; the firmware switches to 32-bit and then 64-bit mode within its first few instructions. ARM chips do the same with their own reset address. On modern PCs a small security processor (Intel ME / AMD PSP) checks the firmware just before this happens.',
    connect:
      'This is the PC register from Part 2. On x86 it is called the instruction pointer (RIP). Our tiny CPU started with PC = 0; a real one starts at a fixed address that points to the firmware.',
    deepDive: {
      title: 'What the “privilege” line in the CPU box means: ring 0 and ring 3',
      steps: [
        'A real CPU keeps a privilege level in one of its registers. It decides which instructions the code running right now is allowed to use. x86 has four levels, numbered 0 to 3 and usually drawn as rings inside each other: ring 0 in the middle has full power, ring 3 on the outside has the least.',
        'Ring 0 (kernel mode) may do everything: talk to devices directly, turn interrupts off, halt the CPU (HLT), and change the page tables that control memory. Only the operating system kernel runs here (and the firmware before it).',
        'Ring 3 (user mode) is for ordinary programs such as your browser or editor. If code in ring 3 tries one of those powerful instructions, or touches memory marked “kernel only”, the CPU refuses and jumps into the kernel instead, which usually ends the program. Rings 1 and 2 exist but Linux and Windows do not use them.',
        'Code can only move from ring 3 to ring 0 through doors the kernel sets up during boot: interrupts, exceptions and system calls. Each door leads to an address the kernel chose, so a program can ask the kernel for help but can never run its own code with full power.',
      ],
      note:
        'Right now, just after reset, the CPU is in 16-bit real mode, where none of this protection is switched on yet, hence “everything allowed”. The firmware turns on ring 0 a moment later, and the kernel only starts using ring 3 once it has set up all the rules (stage 11, systemd). ARM processors have the same idea under different names: EL0 for apps and EL1 for the kernel (the numbers run the other way). Part 4 shows the rings as a diagram.',
    },
  },
  {
    id: 'firmware-early',
    phase: 'firmware',
    title: 'Firmware sets up RAM (while having no RAM)',
    short: 'RAM init',
    parts: ['cpu', 'flash', 'ram'],
    wires: ['flash-cpu', 'cpu-ram', 'flash-ram'],
    power: 'on',
    status: { display: 'no signal' },
    cpu: {
      state: 'Running',
      running: 'UEFI firmware (SEC/PEI)',
      ip: '0xFFF8_2A10',
      ipIn: 'flash',
      mode: '32 → 64-bit',
      privilege: 'kernel mode (ring 0)',
    },
    ram: 'uninit',
    regions: { fw: 'loading' },
    screen: 'black',
    log: [
      { src: 'firmware', text: 'SEC: 64-bit mode on, using CPU cache as temporary RAM' },
      { src: 'firmware', text: 'PEI: training memory on 2 DIMMs (RAM sticks)…' },
      { src: 'firmware', text: 'PEI: 16384 MB RAM ready, copying firmware into RAM' },
    ],
    what:
      'The first firmware code runs straight from the flash chip, without any usable RAM. RAM needs its memory controller configured and “trained” (signal timings tested) before it works. Until then the firmware uses the CPU’s built-in cache as a tiny temporary memory. Once RAM works, the firmware copies itself into RAM and continues there.',
    why:
      'Every computer has different RAM: size, speed, and number of sticks. A RAM “stick” is a small removable circuit board with memory chips on it that plugs into a slot on the motherboard. Its official name is a DIMM (Dual In-line Memory Module: “dual in-line” because the gold contacts on the front and back of its edge are separate connections). Laptops use a shorter version called a SO-DIMM (Small Outline DIMM), and many thin laptops have the memory chips soldered directly onto the motherboard instead. A PC might have one 8 GB stick or two 16 GB sticks, and you can add or swap them later. That cannot be hard-wired, so the firmware must discover and configure the RAM on every boot. Running from the flash chip is slow, so moving into RAM as soon as possible speeds everything up.',
    real:
      'UEFI firmware runs in phases: SEC (security, cache-as-RAM), PEI (memory init), DXE (drivers) and BDS (boot device selection). Memory training is why a PC can take a long time to show anything after you install new RAM.',
  },
  {
    id: 'post',
    phase: 'firmware',
    title: 'POST: checking and finding the hardware',
    short: 'POST',
    parts: ['cpu', 'ram', 'disk', 'keyboard', 'display'],
    wires: ['cpu-ram', 'cpu-disk', 'kbd-cpu', 'cpu-display'],
    power: 'on',
    status: { keyboard: 'F2 / Del = setup', display: 'logo' },
    cpu: {
      state: 'Running',
      running: 'UEFI firmware (DXE)',
      ip: '0x7A3D_1C40',
      ipIn: 'fw',
      mode: '64-bit (long mode)',
      privilege: 'kernel mode (ring 0)',
    },
    ram: 'ready',
    regions: { fw: 'present' },
    screen: 'logo',
    log: [
      { src: 'firmware', text: 'DXE: drivers for NVMe, USB (xHCI), graphics (GOP), network' },
      { src: 'firmware', text: 'POST: CPU, memory and devices OK' },
      { src: 'firmware', text: 'USB keyboard found · display 1920×1080' },
    ],
    what:
      'Now running from RAM, the firmware loads its own small drivers and looks for hardware: disks, USB controllers, the keyboard, the graphics card. It runs a quick POST (Power-On Self-Test) and builds a memory map, a list of which RAM addresses are free and which are reserved, to hand to whoever runs next. The manufacturer’s logo appears.',
    why:
      'The next program, the bootloader, must be read from a disk and may need a screen and keyboard to show a menu. The firmware provides simple drivers for these so that every bootloader and OS does not need to know every possible device just to get started.',
    real: 'This is the moment you can press F2, F12 or Del to open the firmware settings (“BIOS setup”) or pick a boot device.',
  },
  {
    id: 'boot-select',
    phase: 'firmware',
    title: 'Choosing what to boot, and loading the bootloader',
    short: 'Boot select',
    parts: ['cpu', 'flash', 'disk', 'ram'],
    wires: ['flash-cpu', 'cpu-disk', 'disk-ram'],
    power: 'on',
    status: { display: 'logo' },
    cpu: {
      state: 'Running',
      running: 'UEFI firmware (BDS)',
      ip: '0x7A3E_0880',
      ipIn: 'fw',
      mode: '64-bit (long mode)',
      privilege: 'kernel mode (ring 0)',
    },
    ram: 'ready',
    regions: { fw: 'present', grub: 'loading' },
    diskRead: ['shim', 'grubefi'],
    screen: 'logo',
    log: [
      { src: 'firmware', text: 'BootOrder: Boot0001 "ubuntu" → \\EFI\\ubuntu\\shimx64.efi' },
      { src: 'firmware', text: 'Secure Boot: shimx64.efi signed by Microsoft UEFI CA ✓ → starting shim' },
      { src: 'shim', text: 'grubx64.efi signed by Canonical ✓ → loading GRUB into RAM' },
      { src: 'shim', text: 'jumping to GRUB' },
    ],
    what:
      'The firmware reads the boot order stored in the flash chip (for example “1. ubuntu on the SSD, 2. USB stick”). The “ubuntu” entry points to one file, \\EFI\\ubuntu\\shimx64.efi, so that is the program the firmware loads first. It checks shim’s digital signature (Secure Boot), copies it into RAM and jumps to it. Shim is a tiny helper whose only job is to load the next file next to it: it checks grubx64.efi’s signature, copies GRUB into RAM and jumps to it. So both files are used, one after the other: firmware → shim → GRUB.',
    why:
      'The firmware does not understand Linux or Windows. It only knows how to load one small, standard program file from a known place. Shim exists because of Secure Boot: the firmware only trusts files signed with keys built into it at the factory, and on almost every PC those are Microsoft’s keys. Linux distributions cannot get Microsoft to sign every new GRUB version, so Microsoft signs shim once, and shim carries the distribution’s own key and uses it to check GRUB.',
    real:
      'Older “legacy BIOS” PCs did something even simpler: they copied the first 512 bytes of the disk (the Master Boot Record) to address 0x7C00 and jumped there. Windows needs no shim because its boot manager (\\EFI\\Microsoft\\Boot\\bootmgfw.efi) is signed by Microsoft directly. Run efibootmgr -v on Linux to see the real boot entries and the file each one points to.',
    deepDive: {
      title: 'Why shimx64.efi runs first and then grubx64.efi',
      steps: [
        'The firmware does not pick a file by looking at names. Each boot entry stored in the flash chip (Boot0000, Boot0001, …) contains the exact path of one file. When Ubuntu was installed, it created the entry “ubuntu” → \\EFI\\ubuntu\\shimx64.efi. So the firmware never chooses between the two; it simply loads whatever the entry points to.',
        'Secure Boot check 1: before running shimx64.efi, the firmware checks its digital signature against the keys in its trusted list (the “db”). Shim is signed by Microsoft’s UEFI certificate, which PC makers pre-install, so the check passes.',
        'Shim has the distribution’s certificate (here Canonical, Ubuntu’s publisher) built into it. It loads grubx64.efi from the same folder (the name is hard-coded in shim) and checks GRUB’s signature with that certificate. Secure Boot check 2 passes.',
        'Shim jumps to GRUB. From here the chain continues: GRUB, and then the kernel, are checked in the same way before they run.',
      ],
      note:
        'If Secure Boot is turned off in the firmware settings, the same path is followed but the signature checks are skipped. If the boot entry is missing (for example, a disk moved to another PC), the firmware falls back to a standard path, \\EFI\\BOOT\\BOOTX64.EFI, which on Ubuntu is another copy of shim. Shim can also trust extra keys you add yourself (Machine Owner Keys, MOK), which lets you run kernels or drivers you compiled.',
    },
    connect: 'This is exactly the loader from Part 1: copy a program’s bytes from storage into RAM, then point the CPU at its first instruction.',
  },
  {
    id: 'grub',
    phase: 'bootloader',
    title: 'The bootloader (GRUB) loads the kernel',
    short: 'GRUB',
    parts: ['cpu', 'ram', 'disk', 'keyboard', 'display'],
    wires: ['cpu-ram', 'cpu-disk', 'disk-ram', 'kbd-cpu', 'cpu-display'],
    power: 'on',
    status: { keyboard: '↑ ↓ Enter', display: 'GRUB menu' },
    cpu: {
      state: 'Running',
      running: 'GRUB bootloader',
      ip: '0x7D21_4B90',
      ipIn: 'grub',
      mode: '64-bit (long mode)',
      privilege: 'kernel mode (ring 0)',
    },
    ram: 'ready',
    regions: { fw: 'present', grub: 'present', kernel: 'loading', initrd: 'loading' },
    diskRead: ['grubcfg', 'vmlinuz', 'initrd'],
    screen: 'grub',
    log: [
      { src: 'grub', text: 'reading /boot/grub/grub.cfg' },
      { src: 'grub', text: 'Loading Linux 6.8.0-45-generic …' },
      { src: 'grub', text: 'Loading initial ramdisk …' },
    ],
    what:
      'The CPU is now executing GRUB from RAM (shim has finished its job and handed over). GRUB reads its settings file, shows a menu (often hidden unless you hold Shift or Esc), then copies two files from the Linux partition into RAM: the kernel (vmlinuz) and a small temporary filesystem (initrd.img). With Secure Boot on, GRUB asks shim to check the kernel’s signature before using it. It writes the kernel command line, e.g. root=UUID=… ro quiet splash, into memory and jumps to the kernel’s entry point.',
    why:
      'The bootloader understands filesystems like ext4 and knows where kernels live, which the firmware does not. It also lets you choose between kernels or operating systems, which is handy when an update goes wrong.',
    real:
      'Booting is a chain of loaders, each a little smarter than the previous one. Some setups skip GRUB entirely and let the firmware load the Linux kernel directly (the “EFI stub”).',
    connect: 'Again the Part 1 loader: GRUB’s whole job is to put the kernel’s bytes into RAM and set the instruction pointer to its first instruction.',
  },
  {
    id: 'kernel',
    phase: 'kernel',
    title: 'The Linux kernel takes over the machine',
    short: 'Kernel start',
    parts: ['cpu', 'ram'],
    wires: ['cpu-ram'],
    power: 'on',
    status: { display: 'boot messages' },
    cpu: {
      state: 'Running',
      running: 'Linux kernel (startup)',
      ip: '0xFFFFFFFF81000000',
      ipIn: 'kernel',
      mode: '64-bit (long mode)',
      privilege: 'kernel mode (ring 0)',
    },
    ram: 'ready',
    regions: { ...KERNEL_LOADED, grub: 'freed', kdata: 'loading' },
    screen: 'kernel',
    log: [
      { src: 'kernel', text: '[    0.000000] Linux version 6.8.0-45-generic' },
      { src: 'kernel', text: '[    0.000000] Command line: BOOT_IMAGE=/boot/vmlinuz root=UUID=3f1c… ro quiet splash' },
      { src: 'kernel', text: '[    0.004112] Memory: 16236012K/16670104K available' },
      { src: 'kernel', text: '[    0.120530] smp: Brought up 1 node, 8 CPUs' },
    ],
    what:
      'The kernel tells the firmware it is taking over (ExitBootServices); from now on the firmware stays out of the way. The kernel reads the memory map, builds page tables (so each program can get its own private view of memory), fills in the interrupt table, which tells the CPU where to jump when the timer fires or a key is pressed, starts the hardware timer and wakes up the other CPU cores. GRUB’s memory is reclaimed.',
    why:
      'Until now one program ran alone with full control. The kernel’s job is to share one machine safely between many programs, so before running any of them it sets up the rules: who owns which memory, and how the kernel gets control back (the timer and interrupts).',
    real:
      'The kernel file is compressed on disk, so the first thing it does is decompress itself. Every extra CPU core also starts at a reset vector and is then pointed at kernel code by the first core.',
    connect: 'The interrupt table and the timer are why the OS “keeps running”. Part 4 shows them in action.',
    deepDive: {
      title: 'What are page tables, and why do they exist?',
      steps: [
        'The problem: soon many programs will sit in RAM at the same time. If every program used real RAM addresses directly, as our tiny CPU in Part 2 did, each one would need to know which RAM is free, and any bug could overwrite another program’s data, or the kernel itself.',
        'The trick: programs never see real RAM addresses. Every address a program uses is a virtual address. On every single memory access, a part of the CPU called the MMU (Memory Management Unit) translates it into a physical address, the real location in the RAM sticks.',
        'The translation is done with a lookup table the kernel writes in RAM: the page table. Memory is split into small blocks called pages (usually 4 KB), and each entry says “this virtual page lives in that physical page”, plus what is allowed there: read, write, run as code, and whether ring 3 programs may touch it at all.',
        'Every process gets its own page table. When the kernel switches from one program to another, it points the CPU at the next program’s table (x86 keeps that pointer in a register called CR3). So address 0x400000 in your editor and 0x400000 in the music player are different bytes of RAM, and neither program can even name the other’s memory.',
        'If a program uses an address that has no entry, the CPU raises a page fault and jumps into the kernel. The kernel either fixes it (for example, loads that part of the program from disk only now, when it is first needed) or stops the program with the famous “Segmentation fault”.',
      ],
      note:
        'Building the page tables is one of the first things the kernel does, because the CPU needs them before it can run any user program safely. On x86-64 the table is a 4-level tree to save space, and the CPU keeps recent translations in a small cache (the TLB) so translating does not slow every access down. Part 4 has an interactive page-table diagram.',
    },
  },
  {
    id: 'drivers',
    phase: 'kernel',
    title: 'Drivers, a temporary root, then the real disk',
    short: 'Drivers',
    parts: ['cpu', 'ram', 'disk'],
    wires: ['cpu-ram', 'cpu-disk', 'disk-ram'],
    power: 'on',
    status: { display: 'boot messages' },
    cpu: {
      state: 'Running',
      running: 'Linux kernel + /init',
      ip: '0xFFFFFFFF8155C2E0',
      ipIn: 'kernel',
      mode: '64-bit (long mode)',
      privilege: 'kernel mode (ring 0)',
    },
    ram: 'ready',
    regions: { ...KERNEL_LOADED, grub: 'freed', initrd: 'freed' },
    screen: 'kernel',
    log: [
      { src: 'kernel', text: '[    0.873311] Run /init as init process' },
      { src: 'kernel', text: '[    1.204551] nvme nvme0: 8/0/0 default/read/poll queues' },
      { src: 'kernel', text: '[    1.902774] EXT4-fs (nvme0n1p2): mounted filesystem ro' },
    ],
    what:
      'The kernel detects devices and starts their drivers. To read the real root disk it may need extra drivers (for NVMe, RAID or disk encryption), and those live on… the disk. To break that loop it first unpacks the initramfs that GRUB put in RAM. A small /init program inside it loads the right drivers, mounts the real root filesystem, switches to it and frees the initramfs.',
    why:
      'One generic kernel has to boot millions of different PCs. Rather than building every driver in, distributions load only what this machine needs, from a tiny temporary filesystem kept in RAM.',
    real: 'On an encrypted laptop, this is where you are asked for your disk password: the initramfs needs it to unlock the root partition.',
  },
  {
    id: 'init',
    phase: 'user',
    title: 'The first user program: systemd (PID 1)',
    short: 'systemd',
    parts: ['cpu', 'ram', 'disk'],
    wires: ['cpu-ram', 'cpu-disk', 'disk-ram'],
    power: 'on',
    status: { display: 'boot messages' },
    cpu: {
      state: 'Running',
      running: 'systemd (process 1)',
      ip: '0x00005A1E7C3D2F10',
      ipIn: 'systemd',
      mode: '64-bit (long mode)',
      privilege: 'user mode (ring 3)',
    },
    ram: 'ready',
    regions: { ...KERNEL_LOADED, grub: 'freed', initrd: 'freed', systemd: 'loading' },
    diskRead: ['init'],
    screen: 'kernel',
    log: [
      { src: 'kernel', text: '[    2.311908] Run /sbin/init as init process' },
      { src: 'systemd', text: 'systemd 255 running in system mode' },
      { src: 'systemd', text: 'Started Journal Service, udev, Network Manager…' },
    ],
    what:
      'The kernel loads /sbin/init (systemd on most distributions) and starts it as the very first process, with ID 1, giving it its own page table. For the first time the CPU drops from ring 0 to ring 3 (user mode, see the reset-vector stage): systemd cannot touch the hardware or other programs’ memory directly and must ask the kernel through system calls. systemd then starts the system services in parallel: logging, device handling, networking, the login manager.',
    why:
      'Everything that is not essential to sharing the hardware lives outside the kernel. If a service crashes, it is just a process that can be restarted. If the kernel crashed, the whole machine would go down.',
    real: 'Every process on Linux descends from PID 1. Run ps -ef --forest or systemctl status in a terminal to see the tree it started.',
    connect:
      'From here on, the kernel is not “running” in a loop. It waits in memory and is entered only when an interrupt or a system call happens. Part 4 shows exactly that.',
  },
  {
    id: 'login',
    phase: 'user',
    title: 'The login screen and desktop appear',
    short: 'Login',
    parts: ['cpu', 'ram', 'disk', 'keyboard', 'display'],
    wires: ['cpu-ram', 'disk-ram', 'kbd-cpu', 'cpu-display'],
    power: 'on',
    status: { keyboard: 'type to log in', display: 'login screen' },
    cpu: {
      state: 'Running',
      running: 'login manager',
      ip: '0x00007F3A91C04E28',
      ipIn: 'apps',
      mode: '64-bit (long mode)',
      privilege: 'user mode (ring 3)',
    },
    ram: 'ready',
    regions: { ...KERNEL_LOADED, grub: 'freed', initrd: 'freed', systemd: 'present', apps: 'loading' },
    diskRead: ['apps'],
    screen: 'login',
    log: [
      { src: 'systemd', text: 'Started GNOME Display Manager' },
      { src: 'systemd', text: 'Reached target Graphical Interface' },
    ],
    what:
      'systemd starts the display manager, which shows the login screen (or a text “login:” prompt on a server). After you log in, your desktop and apps are loaded from disk into RAM. Each one is a separate process with its own private memory.',
    why:
      'Logging in decides which user the programs run as, and therefore which files they may open. Starting the desktop only after login gives each user their own settings and session.',
    real: 'On a typical laptop with an SSD, the whole trip from power button to this screen takes 5–15 seconds. systemd-analyze shows where the time went.',
  },
  {
    id: 'ready',
    phase: 'user',
    title: 'A live computer',
    short: 'Ready',
    parts: ['cpu', 'ram', 'keyboard', 'display'],
    wires: ['cpu-ram', 'kbd-cpu', 'cpu-display'],
    power: 'on',
    status: { keyboard: 'ready', display: 'desktop' },
    cpu: {
      state: 'Running',
      running: 'your apps + kernel on demand',
      ip: 'switches 1000s of times/s',
      ipIn: 'apps',
      mode: '64-bit (long mode)',
      privilege: 'user ↔ kernel',
    },
    ram: 'ready',
    regions: { ...KERNEL_LOADED, grub: 'freed', initrd: 'freed', systemd: 'present', apps: 'present' },
    screen: 'desktop',
    what:
      'The machine is fully up. RAM holds the kernel, systemd, the desktop and your apps; the firmware and bootloader have stepped aside. The CPU keeps switching between programs many times per second, and every key press and timer tick briefly hands control back to the kernel.',
    why:
      'Booting was a relay race: firmware → bootloader → kernel → systemd → desktop. Each runner loaded the next one into RAM and handed over the instruction pointer. Only the kernel stays in charge for the whole session.',
    real: 'Shutting down runs this in reverse: services stop, data is flushed to disk, and the kernel asks the firmware to have the power controller switch the power supply off.',
  },
];
