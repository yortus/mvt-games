import type { Container } from 'pixi.js';
import { Object3D } from 'three';
import { destroyElement } from '@mvtjs/html';
import { refreshView } from '@mvtjs/pixi';
import { destroyObject } from '@mvtjs/three';
import { inject, test } from 'vitest';
import { captureHtmlPicture, type HtmlPictureOptions } from './html-picture';
import { describeFailure, hashPixels, isPass, nameCurrentPicture, openSession, toBase64, visualCommands } from './judge';
import { setUpPage } from './page-setup';
import { drawPixiPicture, type PixiPictureOptions, preparePixiPose } from './pixi-picture';
import type { VisualKind, VisualTestMeta, VisualVerdict } from '../protocol';
import { drawThreePicture, type ThreePictureOptions } from './three-picture';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A function whose only job is to return a view that has been arranged
 * into the pose that the test describes. If the view has time to advance, the
 * pose advances it too.
 */
export type Pose<V> = () => V | Promise<V>;

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Declares a visual test of a Pixi or three.js view, which draws on a canvas.
 * The test refreshes the view that the pose returns, draws it, and compares
 * it with its reference, `__screenshots__/<this file>/<describe blocks>-<name>.png`.
 * Canvas tests run in one page that every such file shares. The options
 * come before the pose, as they do in Vitest's `test`, and may be left out
 * for a Pixi view.
 *
 * - A Pixi view is drawn as pixel art unless its options say
 *   `artStyle: 'smooth'`. See `PixiPictureOptions.artStyle` for what each
 *   style means for the picture.
 * - A three.js view is drawn with the camera that its options make, in a
 *   scene that they can dress as its game does.
 *
 * A file declares one kind of visual test only, because each kind runs in
 * its own kind of page.
 */
export function canvasTest(name: string, pose: Pose<Container>): void;
export function canvasTest(name: string, options: PixiPictureOptions, pose: Pose<Container>): void;
export function canvasTest(name: string, options: ThreePictureOptions, pose: Pose<Object3D>): void;
export function canvasTest(
    name: string,
    optionsOrPose: PixiPictureOptions | ThreePictureOptions | Pose<Container>,
    pose?: Pose<Container | Object3D>,
): void {
    declareVisualTest(name, 'canvas', ...sortArguments(optionsOrPose, pose));
}

/**
 * Declares a visual test of an HTML view. The test refreshes the element
 * that the pose returns, and compares a picture of it with its reference,
 * `__screenshots__/<this file>/<describe blocks>-<name>.png`. Each file of
 * HTML tests runs in a page of its own, because a stylesheet stays in a page
 * once it is imported. The view's text is drawn blank, so its layout and
 * styling show.
 *
 * A file declares one kind of visual test only, because each kind runs in
 * its own kind of page.
 */
export function htmlTest(name: string, pose: Pose<Element>): void;
export function htmlTest(name: string, options: HtmlPictureOptions, pose: Pose<Element>): void;
export function htmlTest(name: string, optionsOrPose: HtmlPictureOptions | Pose<Element>, pose?: Pose<Element>): void {
    declareVisualTest(name, 'html', ...sortArguments(optionsOrPose, pose));
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

type AnyPose = Pose<Container | Object3D | Element>;
type AnyOptions = PixiPictureOptions | ThreePictureOptions | HtmlPictureOptions;

/**
 * Returns a declaration's pose and options, in that order. A declaration
 * takes its options before its pose, as Vitest's `test` does, or its pose
 * alone.
 */
function sortArguments(optionsOrPose: AnyOptions | AnyPose, pose: AnyPose | undefined): [AnyPose, AnyOptions] {
    if (typeof optionsOrPose === 'function') return [optionsOrPose, {}];
    if (pose === undefined) throw new Error('A visual test with options needs a pose after them.');
    return [pose, optionsOrPose];
}

function declareVisualTest(name: string, declared: VisualKind, pose: AnyPose, options: AnyOptions): void {
    test(name, async ({ task }) => {
        const kind = inject('visualKind');
        const maxPixels = inject('visualMaxPixels');
        const setup = await setUpPage();
        const id = nameCurrentPicture();
        task.meta.visualPicture = id.name;
        if (kind !== declared) {
            // The config sends each file to the page its declarations ask for,
            // so this happens only if the declarations are hidden from it
            throw new Error(`'${id.test}' is ${declared === 'html' ? 'an HTML' : 'a canvas'} visual test, but its file runs in the ${kind} page. A file declares one kind of visual test only.`);
        }
        const ms: Record<string, number> = {};
        // The casts of `options` here and below are safe, because each
        // declaration pairs its kind of view with its own options.
        if (kind === 'canvas') preparePixiPose(options as PixiPictureOptions);

        let t = performance.now();
        const view = await pose();
        ms.pose = performance.now() - t;
        let verdict: VisualVerdict;
        let size: { width: number; height: number; resolution: number };
        try {
            t = performance.now();
            refreshView(view);
            ms.refresh = performance.now() - t;
            if (view instanceof Element) {
                if (kind !== 'html') throw new Error(`'${id.test}' poses an HTML view. HTML views are declared with htmlTest.`);
                const captured = await captureHtmlPicture(view, { ...(options as HtmlPictureOptions), maxPixels }, id);
                ms.capture = captured.captureMs;
                verdict = captured;
                size = { width: captured.width, height: captured.height, resolution: 1 };
            }
            else {
                if (kind !== 'canvas') throw new Error(`'${id.test}' poses a Pixi or three.js view. Those views are declared with canvasTest.`);
                t = performance.now();
                const picture = view instanceof Object3D
                    ? drawThreePicture(view, { ...(options as ThreePictureOptions), maxPixels })
                    : await drawPixiPicture(view, { ...(options as PixiPictureOptions), maxPixels });
                ms.draw = performance.now() - t;
                if (picture.isBlank) {
                    const hint = view instanceof Object3D ? ' Is the camera looking at it, and is it lit?' : '';
                    throw new Error(`'${id.test}' is blank. The view drew nothing inside its picture.${hint}`);
                }
                const unpinned = setup.takeUnpinnedFamilies();
                if (unpinned.length > 0) {
                    throw new Error(`'${id.test}' uses fonts that no test font stands in for: ${unpinned.join(', ')}. Add them to the families in src/browser/canvas-text.ts, in the @mvtjs/visual-testing package.`);
                }
                t = performance.now();
                const hash = await hashPixels(picture.width, picture.height, picture.pixels);
                ms.hash = performance.now() - t;
                const session = await openSession({});
                t = performance.now();
                verdict = session.hashes[id.name] === hash
                    ? { outcome: 'same', referenceFile: id.name }
                    : await visualCommands.judgeVisualMismatch({ ...id, width: picture.width, height: picture.height, hash, pixels: toBase64(picture.pixels) });
                ms.compare = performance.now() - t;
                size = picture;
            }
        }
        finally {
            if (view instanceof Element) destroyElement(view);
            else if (view instanceof Object3D) destroyObject(view);
            else view.destroy({ children: true });
        }
        const meta: VisualTestMeta = { kind, outcome: verdict.outcome, width: size.width, height: size.height, resolution: size.resolution, ms };
        task.meta.visual = meta;
        if (!isPass(verdict)) throw new Error(describeFailure(id.test, verdict, kind));
    });
}
