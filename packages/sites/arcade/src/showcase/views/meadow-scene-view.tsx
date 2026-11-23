/** @jsxImportSource @mvtjs/pixi-3d */

import type { Container3D } from '@pixi/3d';
import type { GameModel } from '../models';
import { MeadowBackdropView } from './meadow-backdrop-view';
import { MeadowCameraView } from './meadow-camera-view';
import { MeadowCloudsView } from './meadow-clouds-view';
import { MeadowGroundView } from './meadow-ground-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface MeadowSceneViewBindings {
    readonly model: GameModel;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** The meadow outside, in 3D, seen through the player's eyes. */
export function MeadowSceneView({ model }: MeadowSceneViewBindings): Container3D {
    return (
        <group>
            <MeadowCameraView
                playerX={() => model.playerX}
                playerZ={() => model.playerZ}
                playerHeading={() => model.playerHeading}
                playerPitch={() => model.playerPitch}
                groundHeight={() => model.groundHeight}
            />
            <MeadowBackdropView
                playerX={() => model.playerX}
                playerZ={() => model.playerZ}
                groundHeight={() => model.groundHeight}
            />
            <MeadowGroundView
                terrain={model.meadow}
                playerX={() => model.playerX}
                playerZ={() => model.playerZ}
                isShown={() => model.isOutside}
            />
            <MeadowCloudsView playerX={() => model.playerX} playerZ={() => model.playerZ} />
        </group>
    );
}
