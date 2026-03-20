import { Container, Sprite } from 'pixi.js';
import { watch } from '#common';
import type { DefeatVariant, Facing, FighterPhase, MoveKind } from '../data';
import { textures, SCREEN_WIDTH, ARENA_WIDTH, GROUND_Y_PX } from '../data';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface FighterViewBindings {
    getX(): number;
    getJumpHeight(): number;
    getFacing(): Facing;
    getPhase(): FighterPhase;
    getMoveKind(): MoveKind | undefined;
    getFrameIndex(): number;
    getDefeatVariant(): DefeatVariant;
    getTint(): number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createFighterView(bindings: FighterViewBindings): Container {
    const scale = SCREEN_WIDTH / ARENA_WIDTH;
    const tex = textures.get();

    const watcher = watch({
        phase: bindings.getPhase,
        moveKind: bindings.getMoveKind,
        frameIndex: bindings.getFrameIndex,
        defeatVariant: bindings.getDefeatVariant,
    });

    const view = new Container();
    view.label = 'fighter';

    // Sprite anchored at bottom-centre
    const sprite = new Sprite({
        texture: tex.walk[1],
        anchor: { x: 0.5, y: 1 },
    });
    view.addChild(sprite);

    view.onRender = refresh;
    return view;

    function refresh(): void {
        // Position
        const x = bindings.getX() * scale;
        const jumpPx = bindings.getJumpHeight() * scale;
        view.position.set(x, GROUND_Y_PX - jumpPx);

        // Facing: source sprites face left; flip for right
        const facing = bindings.getFacing();
        view.scale.x = facing === 'right' ? -1 : 1;

        // Tint
        sprite.tint = bindings.getTint();

        // Texture (only swap when animation state changes)
        const watched = watcher.poll();
        if (
            watched.phase.changed ||
            watched.moveKind.changed ||
            watched.frameIndex.changed ||
            watched.defeatVariant.changed
        ) {
            sprite.texture = resolveTexture(
                bindings.getPhase(),
                bindings.getMoveKind(),
                bindings.getFrameIndex(),
                bindings.getDefeatVariant(),
            );
        }
    }

    function resolveTexture(
        phase: FighterPhase,
        moveKind: MoveKind | undefined,
        frameIndex: number,
        defeatVariant: DefeatVariant,
    ) {
        // 1-based texture keys from the registry
        const fi = frameIndex + 1;

        // prettier-ignore
        switch (phase) {
            case 'idle': return tex.walk[1];
            case 'walking': return tex.walk[clampKey(fi, 8) as keyof typeof tex.walk];
            case 'turning': return tex.turn[clampKey(fi, 5) as keyof typeof tex.turn];
            case 'blocking': return tex.block[clampKey(fi, 3) as keyof typeof tex.block];
            case 'hit-reacting': return tex.walk[1];
            case 'defeated': return resolveDefeatTexture(defeatVariant, fi);
            case 'won': return tex.won[clampKey(fi, 2) as keyof typeof tex.won];
            case 'lost': return tex.lost[1];
            case 'attacking':
            case 'airborne': return resolveMoveTexture(moveKind, fi);
            default: return tex.walk[1];
        }
    }

    function resolveMoveTexture(moveKind: MoveKind | undefined, fi: number) {
        // prettier-ignore
        switch (moveKind) {
            case 'high-punch':
            case 'back-lunge-punch': return tex.punch[clampKey(fi, 6) as keyof typeof tex.punch];
            case 'high-kick':
            case 'mid-kick':
            case 'low-kick': return tex.kick[clampKey(fi, 7) as keyof typeof tex.kick];
            case 'foot-sweep': return tex.footsweep[clampKey(fi, 4) as keyof typeof tex.footsweep];
            case 'crouch-punch':
            case 'back-crouch-punch': return tex.crouchPunch[clampKey(fi, 2) as keyof typeof tex.crouchPunch];
            case 'back-low-kick': return tex.kick[clampKey(fi, 7) as keyof typeof tex.kick];
            case 'roundhouse': return tex.roundhouse[clampKey(fi, 4) as keyof typeof tex.roundhouse];
            case 'flying-kick': return tex.flyingKick[clampKey(fi, 5) as keyof typeof tex.flyingKick];
            case 'front-somersault': return tex.fwdSault[clampKey(fi, 6) as keyof typeof tex.fwdSault];
            case 'back-somersault': return tex.backSault[clampKey(fi, 6) as keyof typeof tex.backSault];
            case 'jump': return tex.jump[1];
            default: return tex.walk[1];
        }
    }

    function resolveDefeatTexture(variant: DefeatVariant, fi: number) {
        const key = clampKey(fi, 3);
        // prettier-ignore
        switch (variant) {
            case 'a': return tex.defeatA[key as keyof typeof tex.defeatA];
            case 'b': return tex.defeatB[key as keyof typeof tex.defeatB];
            case 'c': return tex.defeatC[key as keyof typeof tex.defeatC];
            case 'd': return tex.defeatD[key as keyof typeof tex.defeatD];
        }
    }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/** Clamp a 1-based key to [1, max] to avoid out-of-range lookups. */
function clampKey(fi: number, max: number): number {
    if (fi < 1) return 1;
    if (fi > max) return max;
    return fi;
}
