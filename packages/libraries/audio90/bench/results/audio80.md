<!-- Written by `npm run bench -w audio90 -- audio80 --save`. Don't edit it by hand. -->

Measured 2026-10-28 on Intel(R) Core(TM) Ultra 9 185H, win32 10.0.26200, Node.js 26.10.0. Each time is the median of 3 runs, each in its own process, and ± marks runs that disagreed by more than 5%. Each count ran once.

**Time per 128-sample block (2.67 ms of sound at 48 kHz), voices straight to the output** (µs)

| Wave | 1 voice | 2 voices | 4 voices |
| --- | --- | --- | --- |
| pulse, with a sweep and vibrato | 7.75 | 9.48 | 13 ±8% |
| saw and pulse combined | 7.67 | 8.91 | 11.9 |
| noise | 7.81 | 9.28 ±5% | 11.6 ±10% |

**Time per 128-sample block, voices split between the two filters** (µs)

| Wave | 1 voice | 2 voices | 4 voices |
| --- | --- | --- | --- |
| pulse, with a sweep and vibrato | 7.73 | 9.53 | 13.1 ±6% |
| saw and pulse combined | 7.59 ±8% | 8.98 | 12 |
| noise | 7.84 | 9.19 | 11.1 |

**Bytes allocated per block, four voices, both filters, the echo** (B)

| Wave | 4 voices |
| --- | --- |
| pulse, with a sweep and vibrato | 0 |
