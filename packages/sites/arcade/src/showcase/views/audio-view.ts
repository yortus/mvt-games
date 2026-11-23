import { Container } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import { createRandom } from '@mvtjs/site-kit/random';
import type { SfxChip } from '@mvtjs/site-kit/sound';
import { createReaction } from '@mvtjs/utils';
import { BIRD_CALL, BIRD_CHIRP, BIRD_TRILL, RIVER_BABBLE, RIVER_RUSH } from '../data';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface AudioViewBindings {
    /** The chip the sounds play on. It is the view's output, so the view reads it once. */
    readonly sfx: SfxChip<'audio90'>;
    /** Whether the player is outside, in the meadow. */
    readonly isOutside: () => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Plays the meadow's sounds. As the player arrives outside, the river starts
 * to rush and babble, and keeps on for as long as they stay. Birds sing now
 * and then, from one side or the other. Each bird sings a short phrase of a
 * few notes, then goes quiet for a while. The halls are silent.
 */
export function AudioView({ sfx, isOutside }: AudioViewBindings): Container {
    const view = new Container();
    view.label = 'arcade-hall-audio';
    // The river's two plays, held while the player is outside
    let rushId = -1;
    let babbleId = -1;
    const startRiverWhenGoingOutside = createReaction({
        watch: isOutside,
        when: true,
        react: () => {
            rushId = sfx.play(RIVER_RUSH);
            babbleId = sfx.play(RIVER_BABBLE);
        },
    });
    // Released, so the river fades out as its sounds' release says
    const stopRiverWhenGoingInside = createReaction({
        watch: isOutside,
        when: false,
        react: () => {
            sfx.stop(rushId);
            sfx.stop(babbleId);
        },
    });
    const random = createRandom({ seed: BIRD_SEED });
    /** How long until the next note of the bird singing, or the next bird. */
    let untilNoteMs = FIRST_BIRD_MS;
    /** How many notes are left in the phrase being sung. */
    let notesLeft = 0;
    /** The bird singing: its sound, its note and where it is. */
    let birdSound = 0;
    let birdNote = 0;
    let birdPan = 0;
    /** How many notes have come due, and how many have been played. */
    let notesDue = 0;
    let notesPlayed = 0;

    setUpdate(view, (deltaMs) => {
        if (!isOutside()) return;
        untilNoteMs -= deltaMs;
        if (untilNoteMs > 0) return;
        if (notesLeft === 0) startPhrase();
        notesLeft--;
        notesDue++;
        untilNoteMs = notesLeft > 0 ? random.between(NOTE_GAP_MS * 0.7, NOTE_GAP_MS * 1.4) : random.between(MIN_QUIET_MS, MAX_QUIET_MS);
    });

    setRefresh(view, () => {
        startRiverWhenGoingOutside();
        stopRiverWhenGoingInside();
        if (notesDue === notesPlayed) return;
        notesPlayed = notesDue;
        // Each note of a phrase wanders a little from the bird's own
        const note = birdNote + NOTE_STEPS[notesPlayed % NOTE_STEPS.length];
        sfx.play(BIRD_SOUNDS[birdSound], { note, pan: birdPan });
    });
    return view;

    /** Picks a bird, somewhere round the player, and how many notes it sings. */
    function startPhrase(): void {
        birdSound = random.nextIndex(BIRD_SOUNDS.length);
        birdNote = BIRD_NOTES[birdSound] + random.nextIndex(5) - 2;
        birdPan = random.between(-0.8, 0.8);
        notesLeft = birdSound === 0 ? 2 + random.nextIndex(4) : 1 + random.nextIndex(2);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const BIRD_SOUNDS = [BIRD_CHIRP, BIRD_TRILL, BIRD_CALL] as const;
/** Each sound's own note, as a note number, round which each bird of its kind sings. */
const BIRD_NOTES: readonly number[] = [93, 100, 86];
/** How a phrase's notes step round the bird's own, in semitones. */
const NOTE_STEPS: readonly number[] = [0, 2, -1, 3, 0, 5];
const BIRD_SEED = 1618;
/** The first bird sings soon after the player arrives. */
const FIRST_BIRD_MS = 1800;
/** The gap between the notes of a phrase, and the quiet between phrases. */
const NOTE_GAP_MS = 170;
const MIN_QUIET_MS = 900;
const MAX_QUIET_MS = 4200;
