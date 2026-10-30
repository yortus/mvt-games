import { Container, Graphics } from 'pixi.js';
import { setRefresh, setUpdate, SKIP_DESCENDANTS } from '@mvtjs/pixi';
import { createReaction } from '@mvtjs/utils';
import { PixelTextView } from '#shared';
import { FARM_FENCED_HORN_MS } from '../data';
import type { Direction } from '../models';
import { drawOutlinedPixels, drawPixels, type PixelRects } from './drawing';
import { DustDevilView } from './dust-devil-view';
import { FarmhandView } from './farmhand-view';
import { SheepView } from './sheep-view';
import { COLOURS, findFarmLook } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface FarmFencedViewBindings {
    /** The scene's size, in pixels. The scene is laid out to fit it, so they are read once. */
    width: number;
    height: number;
    isShown: () => boolean;
    /** The farm just fenced, counting from 1. The next farm is the one after it. */
    farm: () => number;
    /** How long the scene has been playing. */
    elapsedMs: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The celebration as a whole farm is fenced. Under a summer sky, the
 * farm's new fence runs across green pasture, and its sheep bounce for joy
 * behind it, while a little dust devil sulks on the hill. The old farmer
 * pays the farmhand in pie. The farmhand hops in the ute, and it toots and
 * drives off to the next farm, which is windier. Above them, in a text box
 * framed in wood, the title drops in and the lines of the story type out
 * one by one, in the game's pixel font, as in an 80s arcade game.
 *
 * Everything in it follows the scene's elapsed time, so it can be shown at
 * any moment.
 */
export function FarmFencedView(bindings: FarmFencedViewBindings): Container {
    const { width, height } = bindings;

    const backdrop = drawBackdrop(new Graphics(), width, height);
    const clouds = drawClouds(new Graphics());
    const devil = DustDevilView({
        row: () => DEVIL_Y,
        col: () => DEVIL_X,
        cellSize: 1,
        size: () => 0.6,
        isStarving: () => true,
        blowOutProgress: () => 0,
        isShown: () => true,
        blowOutPoints: 0,
    });
    const flock = new Container();
    for (let i = 0; i < SHEEP_XS.length; i++) {
        flock.addChild(SheepView({
            row: () => SHEEP_Y - 4 - computeHop(i),
            col: () => SHEEP_XS[i],
            cellSize: 1,
            spriteScale: 2,
            phase: () => 'walking',
            isFacingLeft: () => i % 2 === 1,
            penPoints: 0,
        }));
    }
    const fence = drawFence(new Graphics(), width);
    const farmer = drawOutlinedPixels(new Graphics(), FARMER, COLOURS.boot);
    farmer.scale.set(2);
    farmer.position.set(FARMER_X, GROUND_Y);
    const farmhand = FarmhandView({
        row: () => GROUND_Y - 2,
        col: computeFarmhandX,
        cellSize: 1,
        spriteScale: 2,
        direction: computeFarmhandDirection,
        isMoving: () => isWalking(bindings.elapsedMs()),
        isStringing: () => false,
        isSnapped: () => false,
    });
    const pie = new Container();
    pie.addChild(drawPixels(new Graphics(), PIE));
    const wisps: Graphics[] = [];
    for (let i = 0; i < 3; i++) {
        const wisp = new Graphics().rect(0, 0, 1, 3).fill({ color: COLOURS.flowerWhite, alpha: 0.7 });
        wisps.push(wisp);
        pie.addChild(wisp);
    }
    const ute = drawOutlinedPixels(new Graphics(), UTE, COLOURS.boot);
    ute.scale.set(2);
    const puffs: Graphics[] = [];
    const dust = new Container();
    for (let i = 0; i < PUFF_COUNT; i++) {
        const puff = new Graphics().circle(0, 0, 6).fill(COLOURS.dustLight);
        puffs.push(puff);
        dust.addChild(puff);
    }

    const title = PixelTextView({ text: 'FARM FENCED!', color: COLOURS.flowerYellow, shadow: COLOURS.shirt, scale: 3, anchorX: 0.5 });
    // Each line of the story, and how much of it has been typed out so far.
    // The rest is spaces, so the line keeps its place as it types.
    const storyLines: string[] = [];
    const typedCounts: number[] = [];
    const typedLines: string[] = [];
    const lines: Container[] = [];
    for (let i = 0; i < LINE_TIMES_MS.length; i++) {
        storyLines.push('');
        typedCounts.push(0);
        typedLines.push('');
        const line = PixelTextView({ text: () => typeLine(i), color: COLOURS.hudText, shadow: COLOURS.earth, scale: 2, anchorX: 0.5 });
        line.position.set(Math.round(width / 2), LINE_TOP + i * LINE_GAP);
        lines.push(line);
    }

    const scene = new Container();
    const panel = drawPanel(new Graphics(), width);
    const storyText = new Container();
    storyText.label = 'story';
    storyText.addChild(title, ...lines);
    // The text shows only inside the box, so the title drops in from behind its frame
    const storyMask = new Graphics().rect(PANEL_INSET + 3, PANEL_TOP + 3, width - PANEL_INSET * 2 - 6, PANEL_HEIGHT - 6).fill(0xffffff);
    storyText.mask = storyMask;
    scene.addChild(backdrop, clouds, devil, flock, fence, farmer, farmhand, pie, dust, ute, panel, storyMask, storyText);
    const mask = new Graphics().rect(0, 0, width, height).fill(0xffffff);
    scene.mask = mask;
    const view = new Container();
    view.label = 'farm-fenced';
    view.addChild(mask, scene);

    const writeStoryWhenFarmChanges = createReaction({ watch: bindings.farm, react: (farm) => writeStory(farm) });
    writeStory(bindings.farm());

    // Hidden, the scene's own views neither update nor refresh
    setUpdate(view, () => (bindings.isShown() ? undefined : SKIP_DESCENDANTS));
    setRefresh(view, refresh);
    return view;

    function refresh(): typeof SKIP_DESCENDANTS | undefined {
        // Called while hidden too, so the story is the right one when the scene shows
        writeStoryWhenFarmChanges();
        view.visible = bindings.isShown();
        if (!view.visible) return SKIP_DESCENDANTS;

        const ms = bindings.elapsedMs();
        clouds.x = Math.round(ms * CLOUD_SPEED);
        title.position.set(Math.round(width / 2), Math.round(TITLE_Y - 60 * (1 - easeOut(ms / TITLE_DROP_MS))));

        farmhand.visible = ms < BOARD_MS;
        placePie(ms);
        placeUte(ms);
    }

    /** Writes the story's lines, in capitals, for the farm just fenced and the next. */
    function writeStory(farm: number): void {
        const story = STORIES[(farm - 1) % STORIES.length];
        storyLines[0] = `${findFarmLook(farm).name} is all fenced in!`.toUpperCase();
        storyLines[1] = story.thanks.toUpperCase();
        storyLines[2] = story.pay.toUpperCase();
        storyLines[3] = `Next job: ${findFarmLook(farm + 1).name}.`.toUpperCase();
        storyLines[4] = story.warning.toUpperCase();
        for (let i = 0; i < typedCounts.length; i++) typedCounts[i] = -1;
    }

    /** Returns line `index` as typed out so far, a character every `TYPE_MS` from its time, padded with spaces to its full length. */
    function typeLine(index: number): string {
        const line = storyLines[index];
        const count = Math.min(line.length, Math.max(0, Math.floor((bindings.elapsedMs() - LINE_TIMES_MS[index]) / TYPE_MS)));
        if (count !== typedCounts[index]) {
            typedCounts[index] = count;
            typedLines[index] = line.slice(0, count).padEnd(line.length);
        }
        return typedLines[index];
    }

    /** The pie: in the farmer's hand, then tossed over to the farmhand's, steaming all the while. */
    function placePie(ms: number): void {
        const toss = Math.min(1, Math.max(0, (ms - PIE_TOSS_MS) / PIE_FLIGHT_MS));
        const fromX = FARMER_X + 12;
        const toX = computeFarmhandX() + (computeFarmhandDirection() === 'left' ? -10 : 10);
        pie.visible = ms < BOARD_MS;
        pie.position.set(
            Math.round(fromX + (toX - fromX) * toss),
            Math.round(GROUND_Y - 10 - Math.sin(toss * Math.PI) * 30),
        );
        for (let i = 0; i < wisps.length; i++) {
            wisps[i].position.set(-3 + i * 3 + Math.round(Math.sin(ms * 0.006 + i * 2) * 1.5), -8 - (i % 2) * 2);
        }
    }

    /** The ute: parked, then off to the right with a bounce, as the tune's horn sounds, leaving puffs of dust. */
    function placeUte(ms: number): void {
        const driveS = Math.max(0, ms - FARM_FENCED_HORN_MS) * 0.001;
        const isDriving = driveS > 0;
        const bounce = isDriving && Math.floor(ms / 70) % 2 === 0 ? -1 : 0;
        ute.position.set(Math.round(UTE_X + computeDriveDistance(driveS)), GROUND_Y + bounce);
        for (let i = 0; i < puffs.length; i++) {
            const puff = puffs[i];
            const ageS = driveS - i * PUFF_GAP_S;
            puff.visible = ageS > 0 && ageS < PUFF_LIFE_S;
            if (!puff.visible) continue;
            const progress = ageS / PUFF_LIFE_S;
            puff.position.set(Math.round(UTE_X + computeDriveDistance(i * PUFF_GAP_S) - 2), GROUND_Y - 4 - Math.round(progress * 10));
            puff.scale.set(0.5 + progress);
            puff.alpha = 0.8 * (1 - progress);
        }
    }

    /** How high sheep `index` is in its bounce, in pixels. The sheep bounce in a wave, once the thanks are given. */
    function computeHop(index: number): number {
        const ms = bindings.elapsedMs() - LINE_TIMES_MS[1];
        if (ms < 0) return 0;
        return Math.round(Math.max(0, Math.sin(ms * 0.009 - index * 0.8)) * 7);
    }

    /** Where the farmhand stands: facing the farmer, until they walk over to the ute's door. */
    function computeFarmhandX(): number {
        const walk = Math.min(1, Math.max(0, (bindings.elapsedMs() - WALK_MS) / (BOARD_MS - WALK_MS)));
        return Math.round(FARMHAND_X + (UTE_DOOR_X - FARMHAND_X) * walk);
    }

    function computeFarmhandDirection(): Direction {
        return bindings.elapsedMs() < WALK_MS ? 'left' : 'right';
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * What is said of each farm as it is fenced, in turn from the first: the
 * thanks, the pay, and a warning about the next. In the pixel font, a line
 * of 38 characters fills the text box, so each line keeps to 35, for a
 * margin.
 */
const STORIES: readonly { readonly thanks: string; readonly pay: string; readonly warning: string }[] = [
    {
        thanks: 'The sheep send their warmest baas.',
        pay: 'Your pay: one pie, barely sat on.',
        warning: 'The boss says: "a touch breezy".',
    },
    {
        thanks: 'No sheep lost. OK, one. It\'s back.',
        pay: 'Your pay: two pies, one handshake.',
        warning: 'The boss says: "a bit blowy".',
    },
    {
        thanks: 'The dust devils demand a manager.',
        pay: 'Your pay: a pie and a new hat.',
        warning: 'The boss says: "mind your hat".',
    },
    {
        thanks: 'Everyone wept. Nobody knows why.',
        pay: 'Your pay: three pies, still warm.',
        warning: 'The boss says: "fresh".',
    },
    {
        thanks: 'Even the beetles look impressed.',
        pay: 'Your pay: a pie the size of a tyre.',
        warning: 'The boss has blown away. Good luck.',
    },
    {
        thanks: 'Three valleys talk of nothing else.',
        pay: 'Your pay: all the pies. Every one.',
        warning: 'The boss says: "probably fine".',
    },
];

// The script, in ms from the start. The title drops in, then each line of
// the story types out in turn. The farmer tosses the pie over as the pay is
// told. The farmhand walks to the ute with the next job, and the ute drives
// off as the tune's horn sounds.
const TITLE_DROP_MS = 700;
const LINE_TIMES_MS: readonly number[] = [800, 2200, 3600, 5200, 6000];
/** How long each character of a line takes to type out. */
const TYPE_MS = 25;
const PIE_TOSS_MS = 3900;
const PIE_FLIGHT_MS = 500;
const WALK_MS = 5400;
const BOARD_MS = 6600;

// The layout, in pixels
const PANEL_TOP = 6;
const PANEL_HEIGHT = 132;
const PANEL_INSET = 6;
const TITLE_Y = 16;
const LINE_TOP = 50;
const LINE_GAP = 17;
const HORIZON_Y = 168;
const FENCE_Y = 204;
const SHEEP_Y = 228;
const SHEEP_XS: readonly number[] = [36, 72, 108, 144, 180, 216];
const DEVIL_X = 330;
const DEVIL_Y = 176;
const GROUND_Y = 300;
const FARMER_X = 210;
const FARMHAND_X = 262;
const UTE_X = 340;
const UTE_DOOR_X = 400;

/** How fast the clouds drift, in pixels per ms. */
const CLOUD_SPEED = 0.006;

/** How fast the ute speeds up as it leaves, in pixels per second per second. */
const UTE_ACCELERATION = 260;
const PUFF_COUNT = 6;
const PUFF_GAP_S = 0.12;
const PUFF_LIFE_S = 0.7;

/** How far the ute has gone, in pixels, `seconds` after it sets off. */
function computeDriveDistance(seconds: number): number {
    return 0.5 * UTE_ACCELERATION * seconds * seconds;
}

function isWalking(ms: number): boolean {
    return ms >= WALK_MS && ms < BOARD_MS;
}

function easeOut(progress: number): number {
    const p = Math.min(1, Math.max(0, progress));
    return 1 - (1 - p) * (1 - p);
}

// ---- Drawing ---------------------------------------------------------------

const SKY = 0x9fd4e8;
const SKY_LOW = 0xc9e7ee;
const SUN = 0xffe27a;
const HILL = 0x4f8a33;
const HILL_FAR = 0x78a65a;

/** The sky, the sun, the hills and the pasture, drawn once. */
function drawBackdrop(g: Graphics, width: number, height: number): Graphics {
    g.rect(0, 0, width, HORIZON_Y).fill(SKY);
    g.rect(0, HORIZON_Y - 40, width, 40).fill(SKY_LOW);
    g.circle(width - 56, 46, 24).fill(SUN);
    g.circle(width - 56, 46, 17).fill(0xfff2b8);
    // Far hills, then near ones, each a row of wide bumps
    for (let x = -40; x < width + 80; x += 110) g.ellipse(x, HORIZON_Y, 80, 30).fill(HILL_FAR);
    for (let x = 20; x < width + 80; x += 150) g.ellipse(x, HORIZON_Y + 8, 100, 26).fill(HILL);
    // Mown pasture, in stripes, down to the bottom
    for (let y = HORIZON_Y; y < height; y += 16) {
        g.rect(0, y, width, 16).fill(Math.floor((y - HORIZON_Y) / 16) % 2 === 0 ? COLOURS.grass : COLOURS.grassStripe);
    }
    // Flowers, scattered the same way each time
    for (let i = 0; i < 70; i++) {
        const x = (i * 97) % width;
        const y = HORIZON_Y + 12 + ((i * 53) % (height - HORIZON_Y - 16));
        g.rect(x, y, 2, 2).fill(FLOWER_COLOURS[i % FLOWER_COLOURS.length]);
    }
    return g;
}

const FLOWER_COLOURS: readonly number[] = [COLOURS.flowerWhite, COLOURS.flowerYellow, COLOURS.flowerPink];

/** Three puffy clouds, each a few overlapping ovals, repeated across twice the width so they can drift. */
function drawClouds(g: Graphics): Graphics {
    const places: readonly (readonly [number, number])[] = [[30, 40], [210, 22], [380, 60], [-150, 30], [-330, 55]];
    for (let i = 0; i < places.length; i++) {
        const [x, y] = places[i];
        g.ellipse(x, y, 26, 9).fill(0xffffff);
        g.ellipse(x - 14, y + 3, 14, 7).fill(0xffffff);
        g.ellipse(x + 12, y - 4, 14, 8).fill(0xffffff);
    }
    return g;
}

/** The text box: dark, in a frame of wood, with a light line inside the frame. */
function drawPanel(g: Graphics, width: number): Graphics {
    const panelWidth = width - PANEL_INSET * 2;
    g.rect(PANEL_INSET, PANEL_TOP, panelWidth, PANEL_HEIGHT).fill(COLOURS.post);
    g.rect(PANEL_INSET + 2, PANEL_TOP + 2, panelWidth - 4, PANEL_HEIGHT - 4).fill(COLOURS.postTop);
    g.rect(PANEL_INSET + 3, PANEL_TOP + 3, panelWidth - 6, PANEL_HEIGHT - 6).fill(COLOURS.hud);
    return g;
}

/** The new fence, across the whole pasture: a post every 30 pixels and two rails. */
function drawFence(g: Graphics, width: number): Graphics {
    g.rect(0, FENCE_Y + 8, width, 3).fill(COLOURS.rail);
    g.rect(0, FENCE_Y + 18, width, 3).fill(COLOURS.rail);
    for (let x = 6; x < width; x += 30) {
        g.rect(x, FENCE_Y, 5, 28).fill(COLOURS.post);
        g.rect(x, FENCE_Y, 5, 2).fill(COLOURS.postTop);
    }
    return g;
}

/** A pie in its tin, centred on the origin. */
const PIE: PixelRects = [
    [-5, 0, 10, 2, COLOURS.reel],
    [-5, -2, 10, 2, 0xc9873e],
    [-4, -3, 8, 1, 0xeec27a],
    [-2, -2, 1, 1, 0x8d5f35],
    [1, -2, 1, 1, 0x8d5f35],
];

// The old farmer, facing right, with the feet at the origin: a wide brown
// hat, a long white beard, a green shirt and brown trousers

const FARMER_HAT = 0x7a5230;
const FARMER_SHIRT = 0x4f7a3a;
const FARMER_TROUSERS = 0x5b4630;

const FARMER: PixelRects = [
    [-2, -18, 5, 2, FARMER_HAT],
    [-4, -16, 9, 1, FARMER_HAT],
    [-2, -15, 5, 3, COLOURS.skin],
    [1, -14, 1, 1, COLOURS.boot],
    [-3, -10, 7, 5, FARMER_SHIRT],
    [-2, -12, 6, 4, COLOURS.wool],
    [0, -8, 3, 1, COLOURS.wool],
    [4, -9, 1, 3, FARMER_SHIRT],
    [4, -6, 1, 1, COLOURS.skin],
    [-3, -5, 7, 3, FARMER_TROUSERS],
    [-3, -2, 2, 2, FARMER_TROUSERS],
    [1, -2, 2, 2, FARMER_TROUSERS],
    [-3, 0, 2, 1, COLOURS.boot],
    [1, 0, 3, 1, COLOURS.boot],
];

// The farmhand's ute, facing right, with its wheels on the origin's line:
// a faded red pickup with a reel of wire and spare posts in its tray

const UTE_BODY = 0xb8452e;
const UTE_DARK = 0x7d2a1b;
const GLASS = 0x9fd4e8;

const UTE: PixelRects = [
    [8, -13, 4, 3, COLOURS.reel],
    [9, -12, 2, 1, COLOURS.wire],
    [14, -16, 2, 6, COLOURS.post],
    [17, -15, 2, 5, COLOURS.post],
    [0, -10, 26, 5, UTE_BODY],
    [0, -11, 26, 1, UTE_DARK],
    [26, -16, 12, 11, UTE_BODY],
    [28, -15, 8, 4, GLASS],
    [30, -10, 1, 4, UTE_DARK],
    [38, -10, 6, 5, UTE_BODY],
    [43, -9, 1, 2, COLOURS.flowerYellow],
    [0, -5, 44, 1, UTE_DARK],
    [5, -5, 8, 5, COLOURS.boot],
    [8, -3, 2, 2, COLOURS.reel],
    [31, -5, 8, 5, COLOURS.boot],
    [34, -3, 2, 2, COLOURS.reel],
];
