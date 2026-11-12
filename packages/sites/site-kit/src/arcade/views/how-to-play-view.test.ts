// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { refreshView } from '@mvtjs/html';
import type { DeviceKind } from '../../device';
import type { ControlRow } from '../../entry-types';
import { ARCADE_CONTROL_KEYS, describeKey } from '../../input';
import { HowToPlayView } from './how-to-play-view';

describe('HowToPlayView', () => {
    it('shows an arcade control as the keys the table has for it, one set of caps for each', () => {
        const view = show([{ action: 'Jump', inputs: [{ control: 'up' }] }], 'desktop');
        expect(keyNames(view)).toEqual(ARCADE_CONTROL_KEYS.up.map(describeKey));
    });

    it('shows two ways of the d-pad as their first keys, then their second keys', () => {
        const view = show([{ action: 'Turn', inputs: [{ control: 'left-right' }] }], 'desktop');
        const [left, right] = [ARCADE_CONTROL_KEYS.left.map(describeKey), ARCADE_CONTROL_KEYS.right.map(describeKey)];
        expect(keyNames(view)).toEqual([`${left[0]} and ${right[0]}`, `${left[1]} and ${right[1]}`]);
    });

    it('shows a control pressed with others as its first key', () => {
        const view = show([{ action: 'Kick', inputs: [[{ control: 'primary' }, { control: 'up' }]] }], 'desktop');
        expect(keyNames(view)).toEqual([describeKey(ARCADE_CONTROL_KEYS.primary[0]), describeKey(ARCADE_CONTROL_KEYS.up[0])]);
    });

    it('shows no keys for an arcade control on a touch screen with no keyboard', () => {
        const view = show([{ action: 'Shoot', inputs: [{ control: 'primary' }], touchInputs: [{ button: 'Fire' }] }], 'handheld');
        expect(keyNames(view)).toEqual([]);
        expect(view.querySelector('.how-button')?.textContent).toBe('Fire');
    });
});

/** The view of `controls`, as a device of `deviceKind` shows it, refreshed once. */
function show(controls: readonly ControlRow[], deviceKind: DeviceKind): HTMLElement {
    const view = HowToPlayView({ howToPlay: () => ({ controls }), deviceKind });
    refreshView(view);
    return view;
}

/** The names of the sets of key caps shown, in order, as assistive technology reads them. */
function keyNames(view: HTMLElement): (string | undefined)[] {
    return [...view.querySelectorAll('.how-keys')].map((keys) => keys.getAttribute('aria-label') ?? undefined);
}
