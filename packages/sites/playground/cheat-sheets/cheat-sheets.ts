import type { CheatSheet } from './cheat-sheet';
import { COLLECTIONS_SHEET } from './collections-sheet';
import { GSAP_ESSENTIALS_SHEET } from './gsap-essentials-sheet';
import { HTML_JSX_SHEET } from './html-jsx-sheet';
import { PIXI_ESSENTIALS_SHEET } from './pixi-essentials-sheet';
import { PIXI_JSX_SHEET } from './pixi-jsx-sheet';
import { SOUND_SHEET } from './sound-sheet';
import { THE_TICK_SHEET } from './the-tick-sheet';
import { THREE_ESSENTIALS_SHEET } from './three-essentials-sheet';
import { THREE_JSX_SHEET } from './three-jsx-sheet';
import { TIME_AND_MOTION_SHEET } from './time-and-motion-sheet';
import { WATCHING_FOR_CHANGES_SHEET } from './watching-for-changes-sheet';
import { YOUR_PROJECT_SHEET } from './your-project-sheet';

/** Every cheat sheet, in the order the playground and the book show them. */
export const CHEAT_SHEETS: readonly CheatSheet[] = [
    YOUR_PROJECT_SHEET,
    THE_TICK_SHEET,
    WATCHING_FOR_CHANGES_SHEET,
    PIXI_JSX_SHEET,
    HTML_JSX_SHEET,
    THREE_JSX_SHEET,
    TIME_AND_MOTION_SHEET,
    COLLECTIONS_SHEET,
    SOUND_SHEET,
    PIXI_ESSENTIALS_SHEET,
    THREE_ESSENTIALS_SHEET,
    GSAP_ESSENTIALS_SHEET,
];
