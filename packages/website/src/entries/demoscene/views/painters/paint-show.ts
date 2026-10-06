import type { ShowModel } from '../../models';
import type { VirtualChip } from '../chip';
import { paintBoot } from './paint-boot';
import { paintCredits } from './paint-credits';
import { paintIntro } from './paint-intro';
import { paintLogoPart } from './paint-logo-part';
import { paintPlasmaPart } from './paint-plasma-part';
import { paintSpritesPart } from './paint-sprites-part';
import { paintVectorsPart } from './paint-vectors-part';

// ---------------------------------------------------------------------------
// Painter
// ---------------------------------------------------------------------------

/**
 * Paints the part that is playing into a chip that has just been reset.
 * Painters write the chip's memory and registers and nothing else; the
 * show's brightness is applied after, as the frame becomes colours.
 */
export function paintShow(chip: VirtualChip, show: ShowModel): void {
    const part = show.part;
    if (part === 'boot') paintBoot(chip, show.boot);
    else if (part === 'intro') paintIntro(chip, show.intro);
    else if (part === 'logo') paintLogoPart(chip, show.logo, show.barFlash);
    else if (part === 'plasma') paintPlasmaPart(chip, show.plasma);
    else if (part === 'vectors') paintVectorsPart(chip, show.vectors, show.beat * WASH_STEPS_PER_BEAT);
    else if (part === 'sprites') paintSpritesPart(chip, show.sprites, show.beat * WASH_STEPS_PER_BEAT);
    else paintCredits(chip, show.credits);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Captions' colour washes move on with the beat. */
const WASH_STEPS_PER_BEAT = 4;
