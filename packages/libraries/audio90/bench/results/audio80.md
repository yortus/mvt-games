<!-- Written by `npm run bench -w audio90 -- audio80 --save`. Don't edit it by hand. -->

Measured 2026-10-28 on Intel(R) Core(TM) Ultra 9 185H, win32 10.0.26200, Node.js 26.10.0. Each time is the median of 3 runs, each in its own process, and ± marks runs that disagreed by more than 5%. Each count ran once.

**Time per 128-sample block (2.67 ms of sound at 48 kHz), voices straight to the output** (µs)

| Wave | 1 voice | 2 voices | 4 voices |
| --- | --- | --- | --- |
| pulse, with a sweep and vibrato | 8.14 ±7% | 9.73 ±5% | 13.2 |
| saw and pulse combined | 8.01 | 9.39 | 12 |
| noise | 8.21 | 9.59 | 12 ±6% |

**Time per 128-sample block, voices split between the two filters** (µs)

| Wave | 1 voice | 2 voices | 4 voices |
| --- | --- | --- | --- |
| pulse, with a sweep and vibrato | 7.55 ±8% | 9.2 ±5% | 12.7 ±6% |
| saw and pulse combined | 7.29 | 8.92 ±6% | 12 |
| noise | 7.67 | 9.1 ±6% | 10.9 |

**Bytes allocated per block, four voices, both filters, the echo** (B)

| Wave | 4 voices |
| --- | --- |
| pulse, with a sweep and vibrato | 0 |
