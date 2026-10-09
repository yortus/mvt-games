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
import type { VisualTestMeta, VisualVerdict } from './protocol';
import { drawThreePicture, type ThreePictureOptions } from './three-picture';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Builds a view in the state to photograph, advancing its time if it has any, and returns it. */
export type Pose<V> = () => V | Promise<V>;

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * One visual test: the view the pose returns, refreshed, drawn and compared
 * with its reference, `__screenshots__/<this file>/<describe blocks>-<name>.png`.
 * A Pixi view is drawn in a `*.visual.tsx` file, as pixel art unless its
 * options say `artStyle: 'smooth'` (see `PixiPictureOptions.artStyle` for
 * what each style means for the picture). A three.js view is drawn in the
 * same files, with the camera its options make, in a scene they can dress
 * as its entry does. An HTML view (whose text is drawn blank, so its layout
 * and styling show) in a `*.html.visual.tsx` file, which runs in a page of
 * its own.
 */
export function visualTest(name: string, pose: Pose<Container>, options?: PixiPictureOptions): void;
export function visualTest(name: string, pose: Pose<Object3D>, options: ThreePictureOptions): void;
export function visualTest(name: string, pose: Pose<Element>, options?: HtmlPictureOptions): void;
export function visualTest(
    name: string,
    pose: Pose<Container | Object3D | Element>,
    options: PixiPictureOptions | ThreePictureOptions | HtmlPictureOptions = {},
): void {
    test(name, async ({ task }) => {
        const kind = inject('visualKind');
        const maxPixels = inject('visualMaxPixels');
        const setup = await setUpPage();
        const id = nameCurrentPicture();
        task.meta.visualPicture = id.name;
        const ms: Record<string, number> = {};
        // The overloads pair each kind of view with its own options
        if (kind === 'pixi') preparePixiPose(options as PixiPictureOptions);

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
                if (kind !== 'html') throw new Error(`'${id.test}' poses an HTML view: HTML views are tested in a *.html.visual.tsx file`);
                const captured = await captureHtmlPicture(view, { ...(options as HtmlPictureOptions), maxPixels }, id);
                ms.capture = captured.captureMs;
                verdict = captured;
                size = { width: captured.width, height: captured.height, resolution: 1 };
            }
            else {
                if (kind !== 'pixi') {
                    throw new Error(`'${id.test}' poses a Pixi or three.js view: they are tested in a *.visual.tsx file, not *.html.visual.tsx`);
                }
                t = performance.now();
                const picture = view instanceof Object3D
                    ? drawThreePicture(view, { ...(options as ThreePictureOptions), maxPixels })
                    : await drawPixiPicture(view, { ...(options as PixiPictureOptions), maxPixels });
                ms.draw = performance.now() - t;
                if (picture.isBlank) {
                    const hint = view instanceof Object3D ? ' (is the camera looking at it, and is it lit?)' : '';
                    throw new Error(`'${id.test}' is blank: the view drew nothing inside its picture${hint}`);
                }
                const unpinned = setup.takeUnpinnedFamilies();
                if (unpinned.length > 0) {
                    throw new Error(`'${id.test}' uses fonts no test font stands in for: ${unpinned.join(', ')}. Add them to the families in src/testing/canvas-text.ts`);
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
