import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';
import { noControlNames } from './no-control-names';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({ languageOptions: { parser: tseslint.parser } });

ruleTester.run('no-control-names', noControlNames, {
    valid: [
        'interface ShipModel { isThrusting: boolean; turning: RotationDirection; }',
        'interface GameModel { readonly startNewRun: () => void; readonly fire: () => void; }',
        // Being held is often the domain's own state
        'interface BallModel { readonly isHeld: boolean; readonly grab: (x: number, y: number) => void; }',
        'type Snake = { direction: Direction; shotsFired: number };',
        // Names that only start or end like a control's
        'interface Model { readonly pressure: number; readonly impressed: boolean; readonly tapestry: string; }',
        // Not a member of a type: a local, or an object built from the controls in the wiring
        'const restartPressed = false;',
        'const config = { onRestartPressed: () => undefined };',
    ],
    invalid: [
        { code: 'interface PlayerInput { restartPressed: boolean; }', errors: [{ messageId: 'controlName' }] },
        { code: 'interface Input { firePressed: boolean; fireReleased: boolean; }', errors: [{ messageId: 'controlName' }, { messageId: 'controlName' }] },
        { code: 'type Gestures = { swipeCount: number; tapCount: number; swipeDirection: Direction };', errors: [{ messageId: 'controlName' }, { messageId: 'controlName' }, { messageId: 'controlName' }] },
        { code: 'interface TrackerModel { readonly pressPlay: () => void; }', errors: [{ messageId: 'controlName' }] },
        { code: 'interface Board { cellTapped(row: number, col: number): void; }', errors: [{ messageId: 'controlName' }] },
        { code: 'interface Menu { readonly onButtonClicked?: () => void; }', errors: [{ messageId: 'controlName' }] },
    ],
});
