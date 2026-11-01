import { Container } from 'pixi.js';
import { definePixiProject } from 'playground';
import { MAZE_LAYOUT } from './data';
import { createCatModel } from './models';
import { CatView, MazeView, PositionView, TILE_SIZE } from './views';

const WIDTH = 640;
const HEIGHT = 360;

// A cat in a maze. The model knows the maze only as rows and columns of
// tiles, and gives the cat's place as a row and a column. The views decide
// how big a tile is drawn, in views/tile-size.ts.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    background: 0x0d1520,
    start: ({ stage }) => {
        const cat = createCatModel({
            isWalkable: (row, col) => MAZE_LAYOUT[row][col] !== '#',
            startRow: 1,
            startCol: 1,
        });

        // The maze and the cat, centred above the numbers
        const maze = new Container();
        maze.addChild(
            MazeView({ layout: MAZE_LAYOUT }),
            CatView({ row: () => cat.row, col: () => cat.col, direction: () => cat.direction }),
        );
        maze.position.set((WIDTH - MAZE_LAYOUT[0].length * TILE_SIZE) / 2, 16);

        const position = PositionView({ row: () => cat.row, col: () => cat.col });
        position.position.set(maze.x, maze.y + MAZE_LAYOUT.length * TILE_SIZE + 14);

        stage.addChild(maze, position);
        return cat;
    },
});
