import { Container, Graphics } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import {
    AVENUES,
    CHUNK_HEIGHT,
    CROSS_STREET_HEIGHT,
    chunkKindAt,
    groundToScreenY,
    hash,
    type Avenue,
} from './city-layout';
import { NEON, NEON_COLOURS } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface CityViewBindings {
    /** How far the ship has flown over the city, in world-units. */
    scrollY: () => number;
    /** Stage time in milliseconds, for the neon's slow pulse. */
    timeMs: () => number;
    /** The view's size, which sizes its ring buffer of chunks, so read once. */
    width: number;
    height: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The ground far below, seen from high above at night: dark water, a neon
 * seawall, then a city laid out like a circuit board. Rooftops are dark
 * greys; streets are traces, with neon running along the kerbs; some
 * buildings are chips with glowing pins, and some carry neon signs.
 *
 * Two layers: the dark ground, and the neon, drawn with additive blending so
 * it glows over what is under it. Each neon line is a bright core in a dim
 * halo, which reads as a glow at pixel-art scale. Every neon colour is a cool
 * one, leaving the warm colours to the bullets.
 *
 * Written in plain TypeScript: a ring buffer of chunks, each drawn once as it
 * scrolls into view, like Fuel Run's terrain. The view keeps which chunk each
 * graphics shows, and nothing else.
 */
export function CityView(bindings: CityViewBindings): Container {
    const { width, height } = bindings;
    const bufferSize = Math.ceil(height / CHUNK_HEIGHT) + 2;

    const view = new Container();
    view.label = 'city';
    const groundLayer = new Container();
    const neonLayer = new Container();
    view.addChild(groundLayer, neonLayer);

    const grounds: Graphics[] = [];
    const neons: Graphics[] = [];
    for (let i = 0; i < bufferSize; i++) {
        const ground = new Graphics();
        const neon = new Graphics();
        neon.blendMode = 'add';
        grounds.push(ground);
        neons.push(neon);
        groundLayer.addChild(ground);
        neonLayer.addChild(neon);
    }
    // The chunk drawn in each slot of the ring; -1 until drawn.
    const drawnChunks = new Int32Array(bufferSize).fill(-1);

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const scrollY = bindings.scrollY();
        const firstChunk = Math.floor(scrollY / CHUNK_HEIGHT);
        for (let i = 0; i < bufferSize; i++) {
            const chunk = firstChunk + i;
            const slot = chunk % bufferSize;
            if (drawnChunks[slot] !== chunk) {
                drawnChunks[slot] = chunk;
                drawChunk(grounds[slot], neons[slot], chunk, width);
            }
            // A chunk's top edge is the far end of its band of ground.
            const top = groundToScreenY((chunk + 1) * CHUNK_HEIGHT, scrollY, height);
            grounds[slot].y = top;
            neons[slot].y = top;
        }
        neonLayer.alpha = 0.8 + 0.08 * Math.sin(bindings.timeMs() * PULSE_RATE);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const PULSE_RATE = 0.0021;
/** How bright a neon line's halo is, against its core. */
const HALO_ALPHA = 0.22;

const WATER = 0x04060c;
const STREET = 0x08090f;
const LANE_MARK = 0x1a1c27;
const PAVING = 0x111219;
const SEAWALL = 0x2a2c38;
const ROOF_SHADES: readonly number[] = [0x1a1b24, 0x1f2029, 0x23242f, 0x272935, 0x2c2e3b];
const EDGE_LIGHT = 0x3a3d4f;
const EDGE_DARK = 0x0f1016;
const DETAIL_DARK = 0x13141b;
const CHIP_BODY = 0x0d0e14;

function drawChunk(ground: Graphics, neon: Graphics, index: number, width: number): void {
    ground.clear();
    neon.clear();
    switch (chunkKindAt(index)) {
        case 'sea':
            drawSea(ground, neon, index, width);
            break;
        case 'coast':
            drawCoast(ground, neon, index, width);
            break;
        case 'blocks':
            drawCityChunk(ground, neon, index, width, false);
            break;
        case 'hub':
            drawCityChunk(ground, neon, index, width, true);
            break;
    }
}

// ---- Water and coast ------------------------------------------------------

function drawSea(ground: Graphics, neon: Graphics, index: number, width: number): void {
    ground.rect(0, 0, width, CHUNK_HEIGHT).fill(WATER);
    drawReflections(neon, index, width, 0, CHUNK_HEIGHT);
    // Now and then a buoy's light.
    const h = hash(index, 11);
    if (h % 2 === 0) glowDot(neon, 20 + (h % (width - 40)), 10 + ((h >>> 8) % (CHUNK_HEIGHT - 20)), NEON.violet);
}

/** The city's neon reflected in the water: short, faint dashes. */
function drawReflections(neon: Graphics, index: number, width: number, top: number, bottom: number): void {
    for (let y = top + 3; y < bottom - 2; y += 6) {
        for (let x = 0; x < width; x += 20) {
            const h = hash(index * 64 + y, x);
            if (h % 3 !== 0) continue;
            neon.rect(x + (h % 13), y, 3 + ((h >>> 4) % 7), 1).fill({ color: NEON_COLOURS[(h >>> 9) % NEON_COLOURS.length], alpha: 0.18 });
        }
    }
}

/** Water below, a seawall lit along its top, and a promenade of lamps. */
function drawCoast(ground: Graphics, neon: Graphics, index: number, width: number): void {
    const wallTop = 30;
    ground.rect(0, 0, width, CHUNK_HEIGHT).fill(WATER);
    ground.rect(0, 0, width, CROSS_STREET_HEIGHT).fill(STREET);
    ground.rect(0, CROSS_STREET_HEIGHT, width, wallTop - CROSS_STREET_HEIGHT).fill(PAVING);
    ground.rect(0, wallTop, width, 6).fill(SEAWALL);
    ground.rect(0, wallTop + 5, width, 1).fill(EDGE_DARK);
    glowLine(neon, 0, wallTop, width, 1, NEON.cyan);
    for (let x = 6; x < width; x += 16) glowDot(neon, x, CROSS_STREET_HEIGHT + 6, NEON.magenta);
    drawReflections(neon, index, width, wallTop + 6, CHUNK_HEIGHT);
}

// ---- The city -------------------------------------------------------------

/** A cross street along the top, avenues down the length, and blocks of buildings between. */
function drawCityChunk(ground: Graphics, neon: Graphics, index: number, width: number, isHub: boolean): void {
    ground.rect(0, 0, width, CHUNK_HEIGHT).fill(STREET);
    for (let x = 2; x < width; x += 10) ground.rect(x, 3, 5, 1).fill(LANE_MARK);

    let blockLeft = 0;
    for (let a = 0; a <= AVENUES.length; a++) {
        const avenue = a < AVENUES.length ? AVENUES[a] : undefined;
        const blockRight = avenue === undefined ? width : avenue.x;
        const block = { x: blockLeft + 3, y: CROSS_STREET_HEIGHT + 3, width: blockRight - blockLeft - 6, height: CHUNK_HEIGHT - CROSS_STREET_HEIGHT - 6 };
        // A hub chunk's middle block is a plaza around a great chip.
        if (isHub && a === 1) drawPlaza(ground, neon, block, index);
        else drawBlock(ground, neon, block, index, a);
        if (avenue !== undefined) {
            drawAvenue(ground, neon, avenue, index);
            blockLeft = avenue.x + avenue.width;
        }
    }
}

function drawAvenue(ground: Graphics, neon: Graphics, avenue: Avenue, index: number): void {
    const centre = avenue.x + Math.floor(avenue.width / 2);
    for (let y = CROSS_STREET_HEIGHT; y < CHUNK_HEIGHT; y += 9) ground.rect(centre, y, 1, 5).fill(LANE_MARK);
    // A neon trace along each kerb, unbroken from chunk to chunk, with a via on it.
    glowLine(neon, avenue.x - 2, 0, 1, CHUNK_HEIGHT, avenue.neon);
    glowLine(neon, avenue.x + avenue.width + 1, 0, 1, CHUNK_HEIGHT, avenue.neon);
    const viaY = 20 + (hash(index, avenue.x) % 40);
    via(ground, neon, avenue.x - 3, viaY, avenue.neon);
}

interface Rect {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

/** A block of buildings, split by alleys, with now and then a trace along its edge. */
function drawBlock(ground: Graphics, neon: Graphics, block: Rect, index: number, blockNumber: number): void {
    if (block.width < 8) return;
    const seed = hash(index, blockNumber);
    const buildings: Rect[] = [];
    splitBlock(block, seed, 0, buildings);
    for (let i = 0; i < buildings.length; i++) drawBuilding(ground, neon, buildings[i], hash(seed, i));

    // A trace running along the block's top edge from one corner, ending in a via.
    if (seed % 3 === 0) {
        const colour = NEON_COLOURS[(seed >>> 5) % NEON_COLOURS.length];
        const length = Math.min(block.width - 4, 10 + ((seed >>> 8) % 30));
        const fromLeft = (seed >>> 12) % 2 === 0;
        const x = fromLeft ? block.x - 2 : block.x + block.width + 2 - length;
        glowLine(neon, x, block.y - 2, length, 1, colour);
        via(ground, neon, fromLeft ? x + length - 1 : x - 1, block.y - 3, colour);
    }
}

/** Split a block into buildings, at most twice, leaving a 2-unit alley at each cut. */
function splitBlock(rect: Rect, seed: number, depth: number, out: Rect[]): void {
    const canSplitAcross = rect.width >= 30;
    const canSplitDown = rect.height >= 30;
    if (depth >= 2 || (!canSplitAcross && !canSplitDown) || (depth > 0 && seed % 4 === 0)) {
        out.push(rect);
        return;
    }
    const isAcross = canSplitAcross && (!canSplitDown || rect.width > rect.height);
    const size = isAcross ? rect.width : rect.height;
    const cut = Math.floor(size * (0.35 + ((seed % 31) / 31) * 0.3));
    if (isAcross) {
        splitBlock({ x: rect.x, y: rect.y, width: cut - 1, height: rect.height }, hash(seed, 1), depth + 1, out);
        splitBlock({ x: rect.x + cut + 1, y: rect.y, width: rect.width - cut - 1, height: rect.height }, hash(seed, 2), depth + 1, out);
    }
    else {
        splitBlock({ x: rect.x, y: rect.y, width: rect.width, height: cut - 1 }, hash(seed, 1), depth + 1, out);
        splitBlock({ x: rect.x, y: rect.y + cut + 1, width: rect.width, height: rect.height - cut - 1 }, hash(seed, 2), depth + 1, out);
    }
}

/** A rooftop, lit from the top left, with one kind of rooftop detail and maybe some neon. */
function drawBuilding(ground: Graphics, neon: Graphics, b: Rect, seed: number): void {
    const { x, y, width: w, height: h } = b;
    if (w < 4 || h < 4) return;
    const colour = NEON_COLOURS[(seed >>> 4) % NEON_COLOURS.length];
    ground.rect(x, y, w, h).fill(ROOF_SHADES[seed % ROOF_SHADES.length]);
    ground.rect(x, y, w, 1).fill(EDGE_LIGHT);
    ground.rect(x, y, 1, h).fill(EDGE_LIGHT);
    ground.rect(x, y + h - 1, w, 1).fill(EDGE_DARK);
    ground.rect(x + w - 1, y, 1, h).fill(EDGE_DARK);

    switch ((seed >>> 8) % 5) {
        case 0:
            // Panels in rows
            for (let px = x + 3; px < x + w - 3; px += 4) ground.rect(px, y + 3, 1, h - 6).fill(DETAIL_DARK);
            break;
        case 1:
            // A stepped tower, with a light on its spire
            if (w > 12 && h > 12) {
                ground.rect(x + 4, y + 4, w - 8, h - 8).fill(ROOF_SHADES[(seed + 2) % ROOF_SHADES.length]);
                ground.rect(x + 4, y + 4, w - 8, 1).fill(EDGE_LIGHT);
                glowDot(neon, x + Math.floor(w / 2), y + Math.floor(h / 2), colour);
            }
            break;
        case 2:
            // Vents
            for (let vy = y + 3; vy < y + h - 4; vy += 5) {
                for (let vx = x + 3; vx < x + w - 4; vx += 5) ground.rect(vx, vy, 2, 2).fill(DETAIL_DARK);
            }
            break;
        case 3:
            drawChip(ground, neon, b, colour);
            return;
        case 4:
            drawSign(neon, x + 3, y + 3, seed, colour);
            break;
    }
    // A few rooftops carry a neon outline: decals, not floodlights.
    if ((seed >>> 12) % 7 === 0 && w > 10 && h > 10) glowOutline(neon, x + 2, y + 2, w - 4, h - 4, colour);
}

/** A building drawn as a chip: a dark body with glowing pins down two sides. */
function drawChip(ground: Graphics, neon: Graphics, b: Rect, colour: number): void {
    const { x, y, width: w, height: h } = b;
    if (w < 10 || h < 10) return;
    ground.rect(x + 2, y + 2, w - 4, h - 4).fill(CHIP_BODY);
    for (let py = y + 4; py < y + h - 4; py += 3) {
        neon.rect(x, py, 2, 1).fill(colour);
        neon.rect(x + w - 2, py, 2, 1).fill(colour);
    }
    neon.rect(x - 1, y + 3, w + 2, h - 6).fill({ color: colour, alpha: 0.06 });
    glowDot(neon, x + 4, y + 4, colour);
}

/** A small neon sign: a made-up glyph from the hash's bits, glowing as one. */
function drawSign(neon: Graphics, x: number, y: number, seed: number, colour: number): void {
    neon.rect(x - 1, y - 1, 5, 7).fill({ color: colour, alpha: HALO_ALPHA });
    for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 3; col++) {
            if (((seed >>> (row * 3 + col)) & 1) === 1) neon.rect(x + col, y + row, 1, 1).fill(colour);
        }
    }
}

/** The plaza at a hub: paving, rings of traces, and a great chip at the centre with traces running from its pins. */
function drawPlaza(ground: Graphics, neon: Graphics, block: Rect, index: number): void {
    ground.rect(block.x, block.y, block.width, block.height).fill(PAVING);
    const colour = NEON_COLOURS[hash(index, 3) % NEON_COLOURS.length];
    const cx = block.x + Math.floor(block.width / 2);
    const cy = block.y + Math.floor(block.height / 2);
    glowOutline(neon, block.x + 3, block.y + 3, block.width - 6, block.height - 6, colour);
    const chip = 22;
    drawChip(ground, neon, { x: cx - chip / 2, y: cy - chip / 2, width: chip, height: chip }, colour);
    glowOutline(neon, cx - 4, cy - 4, 8, 8, colour);
    // Traces from the chip's sides out to the ring, with a via where each turns.
    for (let i = 0; i < 3; i++) {
        const ty = cy - 6 + i * 6;
        glowLine(neon, block.x + 3, ty, cx - chip / 2 - block.x - 3, 1, colour);
        glowLine(neon, cx + chip / 2, ty, block.x + block.width - 3 - cx - chip / 2, 1, colour);
    }
    via(ground, neon, cx - 1, block.y + 2, colour);
}

// ---- Neon -----------------------------------------------------------------

/** A straight neon line: a bright core in a dim halo one unit wider all round. */
function glowLine(neon: Graphics, x: number, y: number, w: number, h: number, colour: number): void {
    if (w <= 0 || h <= 0) return;
    neon.rect(x - 1, y - 1, w + 2, h + 2).fill({ color: colour, alpha: HALO_ALPHA });
    neon.rect(x, y, w, h).fill(colour);
}

function glowOutline(neon: Graphics, x: number, y: number, w: number, h: number, colour: number): void {
    glowLine(neon, x, y, w, 1, colour);
    glowLine(neon, x, y + h - 1, w, 1, colour);
    glowLine(neon, x, y + 1, 1, h - 2, colour);
    glowLine(neon, x + w - 1, y + 1, 1, h - 2, colour);
}

function glowDot(neon: Graphics, x: number, y: number, colour: number): void {
    neon.rect(x - 1, y - 1, 3, 3).fill({ color: colour, alpha: 0.35 });
    neon.rect(x, y, 1, 1).fill(0xffffff);
}

/** A via: a ring of neon around a dark centre, where a trace ends or turns. */
function via(ground: Graphics, neon: Graphics, x: number, y: number, colour: number): void {
    ground.rect(x, y, 3, 3).fill(EDGE_DARK);
    neon.rect(x - 1, y - 1, 5, 5).fill({ color: colour, alpha: HALO_ALPHA });
    neon.rect(x, y, 3, 1).fill(colour);
    neon.rect(x, y + 2, 3, 1).fill(colour);
    neon.rect(x, y + 1, 1, 1).fill(colour);
    neon.rect(x + 2, y + 1, 1, 1).fill(colour);
}
