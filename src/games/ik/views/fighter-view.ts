import { Container, Sprite, type Texture } from 'pixi.js';
import type { DefeatVariant, Facing, FighterPhase, MoveKind } from '../data';
import { textures, SCREEN_WIDTH, ARENA_WIDTH, GROUND_Y_PX, MOVE_DATA, TURN_TEXTURE_SEQUENCE } from '../data';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface FighterViewBindings {
    getX(): number;
    getHeight(): number;
    getFacing(): Facing;
    getPhase(): FighterPhase;
    getMove(): MoveKind | undefined;
    getProgress(): number;
    getDefeatVariant(): DefeatVariant;
    getTint(): number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createFighterView(bindings: FighterViewBindings): Container {
    const scale = SCREEN_WIDTH / ARENA_WIDTH;
    const tex = textures.get();

    // Pre-build 0-based texture arrays for type-safe indexing.
    // Object.values preserves ascending numeric key order in JS.
    const walkFrames = Object.values(tex.walk);
    const punchFrames = Object.values(tex.punch);
    const kickFrames = Object.values(tex.kick);
    const footsweepFrames = Object.values(tex.footsweep);
    const crouchPunchFrames = Object.values(tex.crouchPunch);
    const roundhouseFrames = Object.values(tex.roundhouse);
    const flyingKickFrames = Object.values(tex.flyingKick);
    const fwdSaultFrames = Object.values(tex.fwdSault);
    const backSaultFrames = Object.values(tex.backSault);
    const jumpFrames = Object.values(tex.jump);
    const turnFrames = Object.values(tex.turn);
    const blockFrames = Object.values(tex.block);
    const defeatFrames = {
        a: Object.values(tex.defeatA),
        b: Object.values(tex.defeatB),
        c: Object.values(tex.defeatC),
        d: Object.values(tex.defeatD),
    };
    const wonFrames = Object.values(tex.won);
    const lostFrames = Object.values(tex.lost);

    // Move kind to texture array lookup (shared references, no per-tick alloc)
    const moveTextureMap: Record<string, Texture[]> = {
        'high-punch': punchFrames,
        'back-lunge-punch': punchFrames,
        'high-kick': kickFrames,
        'mid-kick': kickFrames,
        'low-kick': kickFrames,
        'back-low-kick': kickFrames,
        'foot-sweep': footsweepFrames,
        'crouch-punch': crouchPunchFrames,
        'back-crouch-punch': crouchPunchFrames,
        'roundhouse': roundhouseFrames,
        'flying-kick': flyingKickFrames,
        'front-somersault': fwdSaultFrames,
        'back-somersault': backSaultFrames,
        'jump': jumpFrames,
    };

    const view = new Container();
    view.label = 'fighter';

    // Sprite anchored at bottom-centre
    const sprite = new Sprite({
        texture: walkFrames[0],
        anchor: { x: 0.5, y: 1 },
    });
    view.addChild(sprite);

    view.onRender = refresh;
    return view;

    function refresh(): void {
        // Position
        const x = bindings.getX() * scale;
        const heightPx = bindings.getHeight() * scale;
        view.position.set(x, GROUND_Y_PX - heightPx);

        // Facing: source sprites face left; flip for right
        view.scale.x = bindings.getFacing() === 'right' ? -1 : 1;

        // Tint
        sprite.tint = bindings.getTint();

        // Texture (derived from phase + progress every frame)
        sprite.texture = resolveTexture();
    }

    // -----------------------------------------------------------------------
    // Texture resolution
    // -----------------------------------------------------------------------

    function resolveTexture(): Texture {
        const phase = bindings.getPhase();
        const progress = bindings.getProgress();

        // prettier-ignore
        switch (phase) {
            case 'idle':         return walkFrames[0];
            case 'walking':      return walkFrames[progressToIndex(progress, walkFrames.length)];
            case 'turning':      return resolveTurnTexture(progress);
            case 'blocking':     return blockFrames[progressToIndex(progress, blockFrames.length)];
            case 'hit-reacting': return walkFrames[0];
            case 'defeated':     return resolveDefeatTexture(progress);
            case 'won':          return resolveWonTexture(progress);
            case 'lost':         return lostFrames[0];
            case 'attacking':
            case 'airborne':     return resolveMoveTexture(progress);
            default:             return walkFrames[0];
        }
    }

    function resolveTurnTexture(progress: number): Texture {
        const segIdx = progressToIndex(progress, TURN_TEXTURE_SEQUENCE.length);
        const texIdx = TURN_TEXTURE_SEQUENCE[segIdx];
        return turnFrames[texIdx];
    }

    function resolveWonTexture(progress: number): Texture {
        // 4 toggles over the duration: frame 0, 1, 0, 1
        const toggle = progressToIndex(progress, 4);
        return wonFrames[toggle % 2];
    }

    function resolveDefeatTexture(progress: number): Texture {
        const frames = defeatFrames[bindings.getDefeatVariant()];
        return frames[progressToIndex(progress, frames.length)];
    }

    function resolveMoveTexture(progress: number): Texture {
        const move = bindings.getMove();
        if (!move) return walkFrames[0];

        const frames = moveTextureMap[move];
        if (!frames) return walkFrames[0];

        const md = MOVE_DATA[move];
        const durations = md.frameDurationMs;
        const seq = md.frameSequence;

        // Compute total duration and find current segment
        let totalMs = 0;
        for (let i = 0; i < durations.length; i++) totalMs += durations[i];

        const elapsedMs = progress * totalMs;
        let accumulated = 0;
        let segIdx = durations.length - 1;
        for (let i = 0; i < durations.length; i++) {
            accumulated += durations[i];
            if (elapsedMs < accumulated) {
                segIdx = i;
                break;
            }
        }

        // Map segment index to texture index
        const texIdx = seq ? seq[segIdx] : segIdx;
        return frames[texIdx] ?? frames[0];
    }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/** Map a 0..1 progress to a 0-based index, clamped to [0, count-1]. */
function progressToIndex(progress: number, count: number): number {
    const i = Math.floor(progress * count);
    return i < 0 ? 0 : i >= count ? count - 1 : i;
}
