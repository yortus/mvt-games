/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { createComputed } from '@mvtjs/utils';
import { toCalendarDate } from '../models';
import {
    ACCENT_COLOR, CARD_COLOR, DAY_SIZE, DIM_TEXT_COLOR, INK_COLOR, LABEL_STYLE, NUMBER_TEXTS, PENCIL_COLOR, SOLVED_COLOR,
    THIN_LINE_COLOR,
} from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface DayViewBindings {
    /** Where its top left corner is, read once. */
    x: number;
    y: number;
    /** The day it shows, numbered from 1 January 1970, or -1 to show nothing. */
    day: () => number;
    /** Whether the day is today, which rings it. */
    isToday: () => boolean;
    /** Whether the day has a puzzle to play. One that hasn't is faded, and takes no presses. */
    isPlayable: () => boolean;
    /** Whether its puzzle is solved, which ticks it, or started, which marks it with a pencil line. */
    isSolved: () => boolean;
    isStarted: () => boolean;
    onPressed: (day: number) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** A day on the calendar: a card with its date, ticked once its puzzle is solved, and pencilled in once it is started. */
export function DayView(bindings: DayViewBindings): Container {
    const dateText = createComputed({
        watch: bindings.day,
        compute: (day) => (day < 0 ? '' : NUMBER_TEXTS[toCalendarDate(day).day]),
    });
    const isShown = (): boolean => bindings.day() >= 0;
    const press = (): void => {
        if (bindings.isPlayable()) bindings.onPressed(bindings.day());
    };
    return (
        <container
            x={bindings.x}
            y={bindings.y}
            visible={isShown}
            alpha={() => (bindings.isPlayable() ? 1 : UNPLAYABLE_ALPHA)}
            cursor={() => (bindings.isPlayable() ? 'pointer' : 'default')}
            onPointerTap={press}
        >
            <graphics ref={(g) => g.roundRect(0, 0, DAY_SIZE, DAY_SIZE, 10).fill(CARD_COLOR).stroke({ color: THIN_LINE_COLOR, width: 1 })} />
            <graphics
                ref={(g) => g.roundRect(1, 1, DAY_SIZE - 2, DAY_SIZE - 2, 9).stroke({ color: ACCENT_COLOR, width: 2.5 })}
                visible={bindings.isToday}
            />
            <text text={dateText} x={DAY_SIZE / 2} y={22} anchor={0.5} style={LABEL_STYLE} tint={() => (bindings.isPlayable() ? INK_COLOR : DIM_TEXT_COLOR)} />
            <graphics
                ref={(g) => g.moveTo(-10, 0).lineTo(-3, 7).lineTo(11, -8).stroke({ color: SOLVED_COLOR, width: 4, cap: 'round', join: 'round' })}
                x={DAY_SIZE / 2}
                y={46}
                visible={bindings.isSolved}
            />
            <graphics
                ref={(g) => g.moveTo(-11, 2).quadraticCurveTo(-4, -4, 2, 1).quadraticCurveTo(7, 5, 11, -1)
                    .stroke({ color: PENCIL_COLOR, width: 2.2, cap: 'round' })}
                x={DAY_SIZE / 2}
                y={47}
                visible={() => bindings.isStarted() && !bindings.isSolved()}
            />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const UNPLAYABLE_ALPHA = 0.35;
