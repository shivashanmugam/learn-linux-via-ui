export interface Example {
  id: string;
  title: string;
  description: string;
  watch: string;
  source: string;
}

export const EXAMPLES: Example[] = [
  {
    id: 'add',
    title: 'Add two numbers',
    description: 'Loads x, adds y, and stores the sum back into memory.',
    watch: 'Watch cell 7 ("sum") change from 0 to 12 during STA — the program turns one memory state into another.',
    source: `; Add two numbers and save the result
        LDA x       ; ACC <- x
        ADD y       ; ACC <- ACC + y
        STA sum     ; sum <- ACC  (memory changes!)
        OUT         ; show the result
        HLT         ; stop
x:      DAT 7
y:      DAT 5
sum:    DAT 0
`,
  },
  {
    id: 'multiply',
    title: 'Multiply (loop)',
    description: 'This CPU has no multiply instruction, so it adds a to the result, b times.',
    watch: 'Each pass through the loop, "result" grows by 3 and "count" shrinks by 1. JZ leaves the loop when SUB makes the Z flag 1.',
    source: `; result = a x count, using repeated addition
loop:   LDA result
        ADD a
        STA result  ; result <- result + a
        LDA count
        SUB one
        STA count   ; count <- count - 1
        JZ done     ; finished when count hits 0
        JMP loop
done:   LDA result
        OUT
        HLT
a:      DAT 3
count:  DAT 4
one:    DAT 1
result: DAT 0
`,
  },
  {
    id: 'countdown',
    title: 'Countdown',
    description: 'Prints 5, 4, 3, 2, 1, 0 using a loop and the zero flag.',
    watch: 'LDI puts a constant straight from the instruction into ACC. The loop repeats until SUB sets Z = 1.',
    source: `; Count down from 5 to 0
        LDI 5       ; ACC <- 5 (the number is inside the instruction)
loop:   OUT
        SUB one     ; ACC <- ACC - 1, sets Z when it reaches 0
        JZ done
        JMP loop
done:   OUT
        HLT
one:    DAT 1
`,
  },
  {
    id: 'max',
    title: 'Larger of two',
    description: 'Compares x and y by subtracting, then branches on the carry (borrow) flag.',
    watch: 'x − y goes negative, so the ALU wraps around and sets C = 1. JC uses that flag to choose a path.',
    source: `; Output the larger of x and y, and store it in max
        LDA x
        SUB y       ; borrow (C = 1) if y > x
        JC ybig
        LDA x
        JMP show
ybig:   LDA y
show:   OUT
        STA max
        HLT
x:      DAT 9
y:      DAT 12
max:    DAT 0
`,
  },
  {
    id: 'fib',
    title: 'Fibonacci',
    description: 'Prints Fibonacci numbers until the next one no longer fits in 8 bits.',
    watch: 'Three memory cells (a, b, t) are shuffled every loop. The carry flag detects overflow past 255.',
    source: `; Fibonacci numbers up to 255
loop:   LDA a
        OUT
        ADD b       ; ACC <- a + b
        JC end      ; stop if it overflowed 8 bits
        STA t
        LDA b
        STA a       ; a <- b
        LDA t
        STA b       ; b <- a + b
        JMP loop
end:    HLT
a:      DAT 0
b:      DAT 1
t:      DAT 0
`,
  },
];
