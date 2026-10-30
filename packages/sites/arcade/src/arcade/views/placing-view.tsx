/** @jsxImportSource @mvtjs/html */
import { type HighscoreRow, INITIALS_LENGTH } from '../../highscores';
import { createComputed, watch } from '@mvtjs/utils';
import type { PlacingPhase, PlacingProblem } from '../models';
import { focusOnOpen } from './focus-on-open';
import { HighscoreTableView } from './highscore-table-view';
import { createInitialsViewModel, OK_CELL } from './initials-view-model';
import { formatRank } from './labels';
import { PixelTextView } from './pixel-text-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What the placing view shows, and what it reports. */
export interface PlacingViewBindings {
    /** Where a score that places is: none, waiting for initials, being sent, or shown in its table. */
    readonly placing: () => PlacingPhase;
    readonly score: () => number;
    /** Where it places: while asking, where it would; once shown, where it went, if it did. */
    readonly rank: () => number | undefined;
    /** Once shown, why it is not in its table, if it is not. */
    readonly problem: () => PlacingProblem | undefined;
    /** The table it places in, best first. */
    readonly rows: () => readonly HighscoreRow[];
    /** Initials to offer as it opens: the visitor's last, if any. */
    readonly rememberedInitials: () => string | undefined;
    readonly onInitialsEntered?: (initials: string) => void;
    readonly onSkipPressed?: () => void;
    readonly onContinuePressed?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Over the held entry, when a run's score places: "NEW HIGHSCORE", the score
 * and its place, and the initials prompt (an `InitialsViewModel`, this
 * view's presentation state), worked by the keys or by the buttons on each
 * cell. Once the score is sent, the table it went into, its row flashing,
 * and a line if it did not get in; any of Enter, Space or Escape, or
 * Continue, goes back to the game. In HTML, so it works over an entry of any
 * renderer.
 */
export function PlacingView(bindings: PlacingViewBindings): Element {
    const initials = createInitialsViewModel();
    const watcher = watch({ placing: bindings.placing });
    const scoreText = createComputed({ watch: bindings.score, compute: (score) => String(score) });
    const placeText = createComputed({ watch: bindings.rank, compute: (rank) => `${formatRank(rank ?? 999)} PLACE` });
    const focusPanel = focusOnOpen({
        isOpen: () => bindings.placing() !== 'none',
        target: (layer) => layer.querySelector<HTMLElement>('.placing-panel') ?? undefined,
    });
    const cells: Element[] = [];
    for (let index = 0; index < INITIALS_LENGTH; index++) cells.push(cellAt(index));
    window.addEventListener('keydown', onKeyDown);

    return (
        // The focus step is on a wrapper that is never hidden, so it sees the panel close
        <div class="placing-layer" onUpdate={update} onRefresh={focusPanel} onDestroyed={() => window.removeEventListener('keydown', onKeyDown)}>
            <div class="placing" visible={() => bindings.placing() !== 'none'}>
                <section class="placing-panel" role="dialog" aria-modal="true" aria-label="New highscore" tabIndex={-1}>
                    <div class="placing-ask" visible={isAsking}>
                        <h2 class="placing-title">{PixelTextView({ text: 'NEW HIGHSCORE' })}</h2>
                        <p class="placing-score">{PixelTextView({ text: scoreText })}</p>
                        <p class="placing-place">{PixelTextView({ text: placeText })}</p>
                        <div class="initials" role="group" aria-label="Your initials">
                            {cells}
                            <button type="button" class={okClass} aria-label="OK: enter these initials" onClick={pressOk}>
                                {PixelTextView({ text: 'OK' })}
                            </button>
                        </div>
                        <p class="placing-hint" aria-live="polite" text={hintText} />
                        <button type="button" class="placing-skip" text={skipText} disabled={isSending} onClick={pressSkip} />
                    </div>
                    <div class="placing-shown" visible={() => bindings.placing() === 'shown'}>
                        <h2 class="placing-title">{PixelTextView({ text: 'HIGH SCORES' })}</h2>
                        <HighscoreTableView rows={bindings.rows} status={() => 'ready'} highlightRank={bindings.rank} />
                        <p class="placing-message" visible={() => shownMessage() !== ''} text={shownMessage} />
                        <button type="button" class="placing-continue" text="Continue" onClick={() => bindings.onContinuePressed?.()} />
                    </div>
                </section>
            </div>
        </div>
    );

    /** Opens the prompt afresh as a score starts asking (not when one sent is asked for again), and blinks its cursor. */
    function update(deltaMs: number): void {
        const { placing } = watcher.poll();
        if (placing.changed && placing.current === 'asking' && placing.previous !== 'sending') {
            initials.open(bindings.rememberedInitials());
        }
        initials.update(deltaMs);
    }

    function cellAt(index: number): Element {
        const label = createComputed({
            watch: () => initials.letterAt(index),
            compute: (char) => `Initial ${index + 1}: ${describeLetter(char)}`,
        });
        return (
            <div class="initials-cell">
                <button type="button" class="initials-step" aria-label="Previous character" text="▲" disabled={isSending} onClick={() => stepAt(index, -1)} />
                <button
                    type="button"
                    class={() => letterClass(index)}
                    aria-label={label}
                    disabled={isSending}
                    onClick={() => initials.moveTo(index)}
                >
                    {PixelTextView({ text: () => initials.letterAt(index), label: '' })}
                </button>
                <button type="button" class="initials-step" aria-label="Next character" text="▼" disabled={isSending} onClick={() => stepAt(index, 1)} />
            </div>
        );
    }

    function stepAt(index: number, by: 1 | -1): void {
        initials.moveTo(index);
        initials.step(by);
    }

    function pressOk(): void {
        if (isSending()) return;
        initials.moveTo(OK_CELL);
        if (initials.fire() === 'send') bindings.onInitialsEntered?.(initials.initials);
    }

    function pressSkip(): void {
        if (initials.escape() === 'skip') bindings.onSkipPressed?.();
    }

    /** The prompt's keys while it asks; while it sends, they are held back from the page; once shown, they go back to the game. */
    function onKeyDown(e: KeyboardEvent): void {
        const placing = bindings.placing();
        if (placing === 'none' || e.ctrlKey || e.metaKey || e.altKey) return;
        if (placing === 'asking') {
            const result = initials.pressKey(e.key);
            if (result === 'ignored') return;
            if (result === 'send') bindings.onInitialsEntered?.(initials.initials);
            else if (result === 'skip') bindings.onSkipPressed?.();
        }
        else if (placing === 'shown' && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) {
            bindings.onContinuePressed?.();
        }
        else if (!(placing === 'sending' && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape'))) {
            return;
        }
        e.preventDefault();
    }

    function isAsking(): boolean {
        const placing = bindings.placing();
        return placing === 'asking' || placing === 'sending';
    }

    function isSending(): boolean {
        return bindings.placing() === 'sending';
    }

    function letterClass(index: number): string {
        if (initials.cursor !== index) return 'initials-letter';
        return initials.isCursorShown && !isSending() ? 'initials-letter is-cursor is-lit' : 'initials-letter is-cursor';
    }

    function okClass(): string {
        if (initials.cursor !== OK_CELL) return 'initials-ok';
        return initials.isCursorShown && !isSending() ? 'initials-ok is-cursor is-lit' : 'initials-ok is-cursor';
    }

    function hintText(): string {
        if (isSending()) return 'Sending…';
        if (initials.isRejected) return 'Those initials can\'t be used: try others.';
        if (initials.isConfirmingSkip) return 'Press Esc again to skip, and not enter this score.';
        return 'Type your initials, or choose them with ▲ ▼, then OK.';
    }

    function skipText(): string {
        return initials.isConfirmingSkip ? 'Skip: sure?' : 'Skip';
    }

    function shownMessage(): string {
        const problem = bindings.problem();
        if (problem === 'unreachable') return 'The highscores could not be reached, so this score was not saved.';
        if (problem === 'refused') return 'The highscores turned this score down.';
        return bindings.rank() === undefined ? 'Others got there first: this score no longer makes the table.' : '';
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A character of initials, as a screen reader says it. */
function describeLetter(char: string): string {
    if (char === ' ') return 'space';
    return char === '.' ? 'full stop' : char;
}
