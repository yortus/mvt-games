import { Container, Graphics, Text } from 'pixi.js';
import { createPanelView } from './panel-view';
import { KIND_COLORS, MAX_ENTITIES } from '../constants';
import type { WorldEntity } from '../models';
import { FONT, TEXT_RESOLUTION } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface OrderViewBindings {
    /** Active entities in sorted (kind, id) order. Reused array - read only. */
    getEntities(): readonly WorldEntity[];
    getRecomputes(): number;
    getFlash(): number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface OrderViewOptions extends OrderViewBindings {
    width: number;
    height: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createOrderView(options: OrderViewOptions): Container {
    const { getEntities, getRecomputes, getFlash } = options;

    const panel = createPanelView({
        width: options.width,
        height: options.height,
        title: 'Active order',
        subtitle: 'filter + sort',
        getRecomputes,
        getFlash,
    });

    const gap = 5;
    const cols = Math.max(1, Math.floor((panel.contentWidth + gap) / (CHIP_TARGET + gap)));
    const chip = Math.floor((panel.contentWidth + gap) / cols) - gap;

    const squares: Graphics[] = [];
    const labels: Text[] = [];
    const prevColors: number[] = [];
    const prevIds: number[] = [];

    for (let i = 0; i < MAX_ENTITIES; i++) {
        const sq = new Graphics();
        const col = i % cols;
        const row = Math.floor(i / cols);
        sq.position.set(col * (chip + gap), row * (chip + gap));
        sq.visible = false;
        panel.content.addChild(sq);

        const label = new Text({
            text: '',
            resolution: TEXT_RESOLUTION,
            style: { fontFamily: FONT, fontSize: Math.max(8, Math.floor(chip * 0.42)), fill: 0x10141b },
        });
        label.anchor.set(0.5);
        label.position.set(col * (chip + gap) + chip / 2, row * (chip + gap) + chip / 2);
        label.visible = false;
        panel.content.addChild(label);

        squares.push(sq);
        labels.push(label);
        prevColors.push(-1);
        prevIds.push(-1);
    }

    panel.content.onRender = refresh;

    return panel.view;

    // ---- Refresh -----------------------------------------------------------

    function refresh(): void {
        const entities = getEntities();
        const count = Math.min(entities.length, MAX_ENTITIES);

        for (let i = 0; i < count; i++) {
            const e = entities[i];
            const sq = squares[i];
            const label = labels[i];
            sq.visible = true;
            label.visible = true;

            const color = KIND_COLORS[e.kind];
            if (color !== prevColors[i]) {
                prevColors[i] = color;
                sq.clear();
                sq.roundRect(0, 0, chip, chip, Math.min(4, chip * 0.24)).fill({ color });
            }
            if (e.id !== prevIds[i]) {
                prevIds[i] = e.id;
                label.text = String(e.id);
            }
        }

        for (let i = count; i < MAX_ENTITIES; i++) {
            if (!squares[i].visible) break;
            squares[i].visible = false;
            labels[i].visible = false;
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const CHIP_TARGET = 28;
