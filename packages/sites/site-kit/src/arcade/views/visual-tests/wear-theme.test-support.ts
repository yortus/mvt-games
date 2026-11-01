import { onTestFinished } from 'vitest';
import type { ThemeKind } from '../../models';

/**
 * Marks the page with `theme` for the test that calls it, as the page marks
 * itself (`data-theme` on `<html>`), so a pose is drawn in that theme. The
 * mark comes off as the test finishes, so the next test is in the default.
 */
export function wearTheme(theme: ThemeKind): void {
    document.documentElement.dataset.theme = theme;
    onTestFinished(() => {
        delete document.documentElement.dataset.theme;
    });
}
