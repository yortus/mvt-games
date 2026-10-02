export {
    type Facing,
    type FighterMove,
    type FighterPhase,
    type MoveKind,
    type DefeatVariant,
    type GamePhase,
    type InputDirection,
    type XDirection,
    type YDirection,
    resolveInputDirection,
    resolveMove,
} from './common';
export {
    ARENA_WIDTH,
    ARENA_MIN_X,
    ARENA_MAX_X,
    FIGHTER_BODY_WIDTH,
    FIGHTER_START_LEFT_X,
    FIGHTER_START_RIGHT_X,
    POINTS_TO_WIN_ROUND,
    ROUNDS_TO_WIN_MATCH,
    TURN_TEXTURE_SEQUENCE,
    TURN_FRAME_MS,
    TURN_TOTAL_MS,
    DEFEAT_FRAME_COUNT,
    DEFEAT_FRAME_MS,
    DEFEAT_TOTAL_MS,
    WON_TOGGLE_MS,
    WON_TOGGLE_COUNT,
    WON_TOTAL_MS,
} from './constants';
export { type MoveData, MOVE_DATA } from './move-data';
export { textures } from './textures';
