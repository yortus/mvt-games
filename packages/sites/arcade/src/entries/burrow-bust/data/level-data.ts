// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface EnemySpawn {
    readonly row: number;
    readonly col: number;
    readonly kind: EnemyKind;
}

export interface LevelConfig {
    readonly enemySpawns: readonly EnemySpawn[];
    readonly rockPositions: readonly [number, number][];
    readonly diggerSpeed: number;
    readonly enemySpeed: number;
    /** Seconds between ghost-through-dirt attempts. */
    readonly ghostInterval: number;
}

// ---------------------------------------------------------------------------
// Level Definitions
// ---------------------------------------------------------------------------

export const LEVELS: readonly LevelConfig[] = [
    // Level 1 - easy intro
    {
        enemySpawns: [
            { row: 3, col: 3, kind: 'mole' },
            { row: 3, col: 10, kind: 'mole' },
            { row: 7, col: 7, kind: 'salamander' },
            { row: 11, col: 2, kind: 'mole' },
        ],
        rockPositions: [
            [2, 6],
            [6, 3],
        ],
        diggerSpeed: 5,
        enemySpeed: 2.5,
        ghostInterval: 8,
    },
    // Level 2 - introduce the salamander
    {
        enemySpawns: [
            { row: 3, col: 3, kind: 'mole' },
            { row: 3, col: 10, kind: 'mole' },
            { row: 7, col: 5, kind: 'salamander' },
            { row: 11, col: 11, kind: 'mole' },
            { row: 15, col: 5, kind: 'mole' },
        ],
        rockPositions: [
            [2, 6],
            [6, 11],
            [10, 3],
        ],
        diggerSpeed: 5,
        enemySpeed: 3,
        ghostInterval: 7,
    },
    // Level 3
    {
        enemySpawns: [
            { row: 3, col: 3, kind: 'mole' },
            { row: 3, col: 10, kind: 'salamander' },
            { row: 7, col: 7, kind: 'mole' },
            { row: 11, col: 2, kind: 'salamander' },
            { row: 15, col: 9, kind: 'mole' },
            { row: 15, col: 4, kind: 'mole' },
        ],
        rockPositions: [
            [2, 4],
            [6, 10],
            [10, 7],
        ],
        diggerSpeed: 5,
        enemySpeed: 3.5,
        ghostInterval: 6,
    },
    // Level 4
    {
        enemySpawns: [
            { row: 3, col: 4, kind: 'salamander' },
            { row: 3, col: 10, kind: 'mole' },
            { row: 7, col: 6, kind: 'mole' },
            { row: 7, col: 8, kind: 'salamander' },
            { row: 11, col: 3, kind: 'mole' },
            { row: 15, col: 5, kind: 'mole' },
            { row: 15, col: 10, kind: 'salamander' },
        ],
        rockPositions: [
            [2, 7],
            [6, 2],
            [10, 11],
            [14, 6],
        ],
        diggerSpeed: 5,
        enemySpeed: 4,
        ghostInterval: 5,
    },
    // Level 5 - hard
    {
        enemySpawns: [
            { row: 3, col: 3, kind: 'salamander' },
            { row: 3, col: 11, kind: 'salamander' },
            { row: 7, col: 5, kind: 'mole' },
            { row: 7, col: 9, kind: 'mole' },
            { row: 11, col: 2, kind: 'salamander' },
            { row: 11, col: 12, kind: 'mole' },
            { row: 15, col: 4, kind: 'mole' },
            { row: 15, col: 10, kind: 'salamander' },
        ],
        rockPositions: [
            [2, 6],
            [6, 1],
            [6, 12],
            [10, 7],
            [14, 4],
        ],
        diggerSpeed: 5,
        enemySpeed: 4.5,
        ghostInterval: 4,
    },
];

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

type EnemyKind = 'mole' | 'salamander';
