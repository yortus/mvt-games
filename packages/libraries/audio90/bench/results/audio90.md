<!-- Written by `npm run bench -w audio90 -- audio90 --save`. Don't edit it by hand. -->

Measured 2026-10-28 on Intel(R) Core(TM) Ultra 9 185H, win32 10.0.26200, Node.js 26.10.0. Each time is the median of 3 runs, each in its own process, and ± marks runs that disagreed by more than 5%. Each count ran once.

**Time per 128-sample stereo block (2.67 ms of sound at 48 kHz), the chorus, echo and reverb running** (µs)

| Engine | no voices | 1 voice | 8 voices | 16 voices |
| --- | --- | --- | --- | --- |
| the effects alone | 14.6 |  |  |  |
| FM, four operators (an electric piano) |  | 23.4 | 70.8 | 123 ±14% |
| FM, with the console character |  | 24.9 | 89.9 | 161 |
| analog, one saw, a 24 dB filter (an acid bass) |  | 20.4 | 46.1 | 76.3 |
| analog, seven saws in stereo (a supersaw), within the budget of 48 oscillators |  | 22.7 | 70.1 | 104 |
| sample, looping |  | 34.4 | 60.8 ±12% | 88.3 |
| a busy mix of every engine |  |  | 109 ±9% | 174 |

**Bytes allocated per block, by engine on sixteen voices** (B)

| Engine | no voices | 16 voices |
| --- | --- | --- |
| the effects alone | 0 |  |
| FM, four operators (an electric piano) |  | 0 |
| FM, with the console character |  | 1 |
| analog, one saw, a 24 dB filter (an acid bass) |  | 1 |
| analog, seven saws in stereo (a supersaw), within the budget of 48 oscillators |  | 0 |
| sample, looping |  | 13 |
| a busy mix of every engine |  | 10 |

**A busy song of ten channels played on the chip, per tick of 1/60 s: the clock, the song player, the writes, and 800 samples rendered**

| Engine | Time per tick (µs) | Bytes allocated per tick (B) |
| --- | --- | --- |
| a busy song, played on the chip | 621 | 44 |

**Bouncing a sample, as an entry does while it loads: the median of seven, each made afresh**

| Sample | Time (ms) | Samples kept |
| --- | --- | --- |
| an orchestra hit, 0.75 s at 32 kHz | 9.73 | 24,000 |
| a two-bar break, 2.8 s at 26 kHz and 12 bits, in 32 slices | 14.2 | 73,412 |
| 8 s of two seven-saw chords and two FM notes at 32 kHz, all of sample memory | 131 | 256,000 |
| the same, with the song setting the reverb, so the effects run | 164 ±7% | 256,000 |
