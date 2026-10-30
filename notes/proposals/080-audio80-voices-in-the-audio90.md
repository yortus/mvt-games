# Proposal: The Audio80's Voices Inside the Audio90

> One chip kind in place of two. The Audio90's first four voices become the
> Audio80, exactly as it is now, and its other twelve stay Audio90 voices.
> Every Audio80 sound and song keeps sounding exactly the same, a game can
> use both kinds of voice at once, and the package and the Arcade lose the
> idea of choosing a chip. Two pieces of work stand on their own and come
> first: chips that do no work while they are silent, and tracker tokens
> that mean the same thing on every voice.

**Status:** proposed. Nothing built.

**Written:** 2026-10-30, on `vnext`, with `audio90` 0.8.0 published. Checked
against the two synthesisers, the song grammars and the Arcade's entries;
nothing measured yet.

**Related:**
[audio90](../../packages/libraries/audio90/README.md) and its guides,
[the Audio80 synthesiser](../../packages/libraries/audio90/src/audio80/synthesiser/audio80-synthesiser.ts),
[the Audio90 synthesiser](../../packages/libraries/audio90/src/audio90/synthesiser/audio90-synthesiser.ts),
[the shared cell grammar](../../packages/libraries/audio90/src/shared/notation/cell-grammar.ts),
[the worklet's chip runner](../../packages/libraries/audio90/src/web/worklet/chip-runner.ts),
[the Arcade's entry starters](../../packages/sites/arcade/src/entry-types/entry-starter.ts),
[076](../tasks/backlog/076-audio90-api-gaps.md) (gaps in the API),
[077](./077-audio90-studio.md) (the Studio, whose sound designer would then
design for one chip).

| Decision | Recommendation | Section |
| --- | --- | --- |
| Shape of the chip | Voices 0-3 are the Audio80, unchanged; voices 4-15 are Audio90 voices. 4 + 12, not 4 + 16 | 2, 5 |
| Exactness | Audio80 sounds and songs render byte-identical to today, checked against the reference renders | 5.2 |
| Silence | Both chips rest while nothing sounds: zeros out, no voice or effect work. First, on its own | 3 |
| Notation | One token, one meaning, on every voice, in cells and step tables. A token a voice can't honour is an error. Second, on its own | 4 |
| `f` | Keeps brightness. The Audio80's shared-filter cutoff gets a token of its own | 4.3 |
| Songs | An Audio80 song or an Audio90 song first; songs that mix the two later | 6 |
| Not chosen | Porting the Audio80's features into the Audio90's engines | 2 |

---

## 1. Why

The package has two chips, and the Arcade has to know which one each entry
uses: `soundChip: 'audio80' | 'audio90'`, `MusicChip<'audio80'>`, and the
pairs of browser, headless and worklet wrappers. Nine entries use the
Audio80 (astrovoid, burrow-bust, crumb-chase, dojo-duel, fenceline,
fruit-machine, fuel-run, galaxy-raiders, kwazy-cactii) and two use the
Audio90 (neon-monsoon, the Tune Tracker).

The Audio90 is not a superset of the Audio80, so it can't simply replace
it. It has no pitched noise, no combined waves, no wavetables, no ring
modulation, no pulse-width sweeps, no shared filters and no 8- or 12-bit
character. Those are the sounds that make the Audio80 sound like the
1980s.

Building the Audio80 into the Audio90 as its first four voices gives the
superset without porting anything. It has precedent from the decade the
Audio90 imitates. The Mega Drive paired an FM chip with a simple
square-wave chip, and the Game Boy Advance kept the Game Boy's four voices
beside its sample channels.

## 2. Settled Decisions

Do not reopen these without new information.

- **Embed, don't port.** Making the Audio90's analog engine reproduce the
  Audio80 (a noise wave in step tables, pulse-width modulation, combined
  waves, shared filter buses, an 80s output stage) would end up moving
  most of the Audio80's 2,800 lines into a synthesiser that already has
  1,600. And it would still not be exact unless it used the same
  algorithms. Running the Audio80 synthesiser itself as the first four
  voices is exact by construction.
- **4 + 12 voices.** The most voices any Audio90 song uses today is 10, so
  twelve Audio90 voices are enough, and the chip keeps sixteen voices in
  all.
- **Chips do no work when silent.** It's a requirement, not an
  optimisation to measure first (section 3).
- **One token, one meaning.** Today `f` means different things on the two
  chips. That is a fault worth fixing whether or not the chips merge
  (section 4).

## 3. Chips That Rest When Silent

### 3.1 What happens today

Only a paused chip skips work. The worklet fills its block with zeros when
the chip's clock is paused
([chip-runner.ts:237](../../packages/libraries/audio90/src/web/worklet/chip-runner.ts#L237)).
A chip that is playing, but has nothing sounding, runs its whole
per-sample loop:

- **The Audio80** steps every voice's oscillator, and the noise register of
  any voice whose wave includes noise, even when the voice is idle. It runs
  both filters, the echo, the DC blocker and the soft clip on every sample.
- **The Audio90** skips idle voices, but runs the chorus, echo and reverb
  on every sample whenever it has effects, which a browser chip does by
  default (`hasEffects ?? true`). It also runs the DC blockers, the
  limiter and the stereo width on every sample.

In the Arcade, silence is the common case. A sound-effects chip is quiet
between effects, and a music chip is quiet between songs. Each entry has
two chips, and the home page has its own.

### 3.2 The design

A chip **rests** for a block when all of these hold:

1. Every voice is idle.
2. No command falls within the block, including those the sequencer writes
   for the block.
3. Its effects and filters have gone quiet. Every echo and reverb buffer,
   filter state and DC blocker holds exact zeros.

While it rests, it writes zeros and moves its clock on. The sequencer still
advances, since it is cheap, and a command it writes ends the rest.

**Going quiet.** Echoes and reverbs have tails, so (3) needs a test. Once
the effects' output has stayed below `TINY` (the threshold
`clearTinyValues` already uses) for the length of the longest delay line,
the chip clears every buffer to exact zeros. From then on, rendering would
produce exact zeros anyway, so resting changes nothing.

### 3.3 Keeping it exact

Some state moves with time even while a chip is silent. Resting must move
it the same way, or the next note sounds different from today.

- **The Audio80's idle voices.** Oscillator phases and noise registers run
  freely. A note doesn't reset them
  ([startNote](../../packages/libraries/audio90/src/audio80/synthesiser/audio80-synthesiser.ts#L301)),
  only `resetAll` does, so the phase a note starts at, and its noise
  sequence, depend on everything since the last reset. While resting, keep
  stepping these clocks per sample. It costs four additions a sample, plus
  the noise clocks, and keeps renders byte-identical. Don't reset them at
  each note instead: every noise hit would then be the same waveform, which
  changes the chip's character.
- **The Audio90's free-running parts.** The chorus phase and LFOs that are
  not retriggered move on in `controlAll`. Keep moving them once per
  control block while resting.

The headless chips share the synthesisers, so they rest the same way, and
tests stay exact. If a reference render changes at all, it can only be
where the tails were cleared, below `TINY`. Check, and re-baseline in a
commit of its own if needed.

### 3.4 How to know it works

- A unit test for each chip: play a sound, let it end, and check that once
  the tails have died the chip renders exact zeros and its voice and effect
  counters stop moving.
- A benchmark of rendering a second of a silent but playing chip, before
  and after. The benchmarks have no audio suite yet, so this adds one.

## 4. One Token, One Meaning

### 4.1 The rule

A token means the same thing on every chip and every voice, in song cells
and step tables alike. A token that a voice can't honour is an error that
names its row and channel (or its step), never quietly ignored. The
Audio90's parser already reports errors this way
(`row 3, channel 0: c37 needs an analog instrument`). Today the Audio80
ignores `f` on a sound with no filter.

### 4.2 Where the chips differ today

| Token | Audio80 | Audio90 |
| --- | --- | --- |
| `f` in a cell | Sets the absolute cutoff (80 Hz to about 14.5 kHz) of the shared filter the channel's sound goes through, which moves every channel on that filter | Brightness, relative to the sound as written (`fF`), of the channel's own voice. It closes an analog or sample filter, and softens FM modulators |
| `f` in a step table | Absolute cutoff, as above | Brightness, as above |
| `p` in a step table | Pulse width | Not accepted, although `p` in a cell is |
| Waves in a step table | `triangle`, `saw`, `pulse`, `noise`, the combined waves, `wavetable` | `saw`, `pulse`, `triangle`, `sine` |

The waves are not a clash: a name means the same wave on both chips, and
each chip has some the other lacks. Under the rule, a wave a voice lacks is
an error.

### 4.3 `f`

Brightness keeps `f`. It applies to every Audio90 engine, FM included,
where an absolute cutoff means nothing. The Audio80's shared-filter cutoff
moves to a token of its own (section 9.1). That doesn't apply to Audio90
voices, which have no shared filter, and brightness doesn't apply to
Audio80 voices, which have no filter of their own, so each is an error on
the other kind of voice.

The migration is small. dojo-duel's step tables use `f` 23 times as an
Audio80 cutoff. Two tunes, `breakdown-build` and `squelch`, use it as
brightness, and keep it.

### 4.4 `p` in Audio90 step tables

Accept it, as Audio90 cells already do, for analog voices with a pulse
wave. That fills a gap rather than fixing a clash.

## 5. The Audio80's Voices Inside the Audio90

### 5.1 The chip

- **Voices 0-3** are an Audio80 synthesiser, run unchanged: its waves,
  noise, wavetables, ring modulation and sync between voices 0-3, its two
  shared filters, its echo and its character (`clean`, `classic`, `raw`).
- **Voices 4-15** are the Audio90's voices as they are now, with its
  reverb, stereo echo, chorus and pump.
- `play(sound)` chooses the voices from `sound.chip`. An `Audio80Sound`
  plays on voices 0-3, an `Audio90Sound` on voices 4-15. `priority` and
  `maxVoices` work within each group, as they do on two chips today.
- The chip has two characters, one for each group of voices.

### 5.2 Exactness

An Audio80 sound or song must render byte-identical to today. For that:

1. **The Audio80 voices keep their own output stage.** Today they remove
   DC offset, then soft-clip with `tanh`
   ([audio80-synthesiser.ts:536-540](../../packages/libraries/audio90/src/audio80/synthesiser/audio80-synthesiser.ts#L536-L540)).
   The Audio90's final curve only approximates `tanh`. So the Audio80
   group's mono output is clipped by its own stage, then sent to left and
   right at full level, not through the pan law, which would drop it by
   3 dB. Only then is it added to the Audio90 group's output.
2. **When both groups sound,** their sum can pass full scale, so it needs
   a final guard. That is new behaviour, for new uses only. With only the
   Audio80 voices sounding, the guard must leave the output untouched.
3. **The Audio90's effects leave voices 0-3 alone** by default. The pump
   doesn't duck them, and they send nothing to the reverb, echo or chorus.

The reference renders prove it: every Audio80 sound and song renders on
the new chip byte for byte as on the old one.

### 5.3 Silence

Each group rests on its own terms (section 3). A game that uses only the
Audio80 voices pays nothing for the Audio90's effects, and the reverse.

## 6. Songs

Today an Audio90 song's channel `n` plays on voice `n`, and the pump and
`mixer` name channels by number. With the Audio90 voices starting at 4,
that mapping moves inside the chip.

**First, songs of one kind.** An Audio80 song plays on voices 0-3, exactly
as now. An Audio90 song's channel `n` plays on voice `4 + n`, and the song
keeps numbering its channels from 0, so no Audio90 song changes. The
music chip still plays one song at a time.

**Later, mixed songs,** if a game wants a chip lead over an FM bass. Their
channels would take both kinds of instrument, which touches the parser,
the printer, the tracker and the sequencer, and needs section 4 done. How
a mixed song says which channels are Audio80 ones is open (section 9.2).

## 7. The Arcade and the Package

- **The Arcade:** remove `SoundChipKind` and the chip-kind type parameters.
  Every entry gets two Audio90 chips. The nine Audio80 entries change only
  their starter, and their loudness stays as tuned, since their output is
  byte-identical.
- **The package:** remove the Audio80's browser, headless and worklet
  wrappers (`web/audio80.ts`, `headless/headless-audio80.ts`, the Audio80
  processor and runner). `createAudio80Sound` and `createAudio80Song` stay,
  as the way you write for voices 0-3. The `Audio80` chip export is
  deprecated for a release, as `chiptune` was, then removed. This is a
  breaking release.
- **The docs:** one chip, with a chapter on its Audio80 voices. The README
  changes from "pick your decade" to "a 1990s chip with the 1980s built
  in".

## 8. Costs and Risks

- **The worklet bundle** always carries both synthesisers. That's a small
  cost.
- **A song or sound that needs more than twelve Audio90 voices** no longer
  fits. None does today, since the most any song uses is 10.
- **The combined output stage** (section 5.2) is the subtle part. Its tests
  need cases where both groups sound loudly at once, as well as the
  byte-identical checks.
- **Resting must never cut a tail short** that someone can hear. The
  threshold sits far below audibility, but the test for "gone quiet" needs
  care with long echo feedback.

## 9. Open Questions

1. **The token for the Audio80's shared-filter cutoff.** It needs a letter
   no token uses. Avoid `F`: `p` and `P` already mean unrelated things, and
   a second unrelated pair by case would make that worse.
2. **How a mixed song names its Audio80 channels.** Perhaps a setting such
   as `audio80Channels: 4`, which makes the first four channels Audio80
   ones. Decide this when mixed songs are wanted.
3. **Should voices 0-3 be able to opt into the Audio90's effects?** For
   example, the `r` token as a reverb send. That's harmless to exactness if
   the default stays off.
4. **Sound options that share a name but differ in shape,** such as
   `filter` (`'a' | 'b'` on the Audio80, an object on the Audio90). These
   belong to a sound's kind, so they are less confusing than tokens. Leave
   them unless the Studio (077) finds them a problem.

## 10. Implementation Steps

Stages 1 and 2 are worth doing whether or not the rest goes ahead.

1. **Rest when silent** (section 3): the resting test and clearing in both
   synthesisers, the free-running clocks kept moving, the unit tests and an
   audio benchmark. Re-baseline reference renders only if they change, in
   their own commit.
2. **One token, one meaning** (section 4): choose the cutoff token, make an
   unhonoured token an error in both chips' cells and step tables, accept
   `p` in Audio90 step tables, migrate dojo-duel, and update the tracker
   guide.
3. **The Audio80 voices** (section 5): the Audio90 synthesiser owns an
   Audio80 synthesiser for voices 0-3, with the combined output stage and
   command routing. Check every Audio80 reference render byte for byte on
   the new chip.
4. **Songs of one kind** (section 6): the sequencer and the driver place
   each kind of song on its own voices.
5. **The Arcade and the package** (section 7): move the nine entries,
   remove the chip kind, deprecate the `Audio80` chip, rewrite the guides,
   and add a changeset for the breaking release.
6. **Mixed songs** (section 6), when a game wants them.
