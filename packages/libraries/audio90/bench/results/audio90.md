<!-- Written by `npm run bench -- audio90 --save`. Don't edit it by hand. -->

Measured 2026-10-28 on Intel(R) Core(TM) Ultra 9 185H, win32 10.0.26200, Node.js 26.10.0. Each time is the median of 3 runs, each in its own process, and ± marks runs that disagreed by more than 5%. Each count ran once.

**Time per 128-sample stereo block (2.67 ms of sound at 48 kHz), the chorus, echo and reverb running** (µs)

| Engine | no voices | 1 voice | 8 voices | 16 voices |
| --- | --- | --- | --- | --- |
| the effects alone | 13.9 |  |  |  |
| FM, four operators (an electric piano) |  | 24.1 ±9% | 72.3 | 122 ±6% |
| FM, with the console character |  | 24.3 | 89.9 | 162 |
| analog, one saw, a 24 dB filter (an acid bass) |  | 19.2 | 45 | 73.7 |
| analog, seven saws in stereo (a supersaw), within the budget of 48 oscillators |  | 21.9 ±8% | 66.6 ±8% | 104 ±5% |
| sample, looping |  | 31.6 | 54.6 ±8% | 79.9 ±9% |
| a busy mix of every engine |  |  | 99.3 | 162 |

**Bytes allocated per block, by engine on sixteen voices** (B)

| Engine | no voices | 16 voices |
| --- | --- | --- |
| the effects alone | 1 |  |
| FM, four operators (an electric piano) |  | 0 |
| FM, with the console character |  | 0 |
| analog, one saw, a 24 dB filter (an acid bass) |  | 0 |
| analog, seven saws in stereo (a supersaw), within the budget of 48 oscillators |  | 0 |
| sample, looping |  | 12 |
| a busy mix of every engine |  | 10 |

**A busy song of ten channels played on the chip, per tick of 1/60 s: the clock, the song player, the writes, and 800 samples rendered**

| Engine | Time per tick (µs) | Bytes allocated per tick (B) |
| --- | --- | --- |
| a busy song, played on the chip | 592 | 44 |

**Bouncing a sample, as an entry does while it loads: the median of seven, each made afresh**

| Sample | Time (ms) | Samples kept |
| --- | --- | --- |
| an orchestra hit, 0.75 s at 32 kHz | 9.41 ±13% | 24,000 |
| a two-bar break, 2.8 s at 26 kHz and 12 bits, in 32 slices | 13.3 | 73,412 |
| 8 s of two seven-saw chords and two FM notes at 32 kHz, all of sample memory | 119 | 256,000 |
| the same, with the song setting the reverb, so the effects run | 163 | 256,000 |
