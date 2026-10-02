/** @jsxImportSource @mvtjs/three/jsx */

import { ConeGeometry, MeshStandardMaterial, type Object3D, PlaneGeometry } from 'three';
import { List } from '@mvtjs/three/jsx';
import type { FlockModel } from '../boids';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface FlockViewBindings {
    model: FlockModel;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The boids demo's flock, in 3D: the same model as the 2D demo, drawn with the
 * three.js JSX runtime. The arena lies flat, a model metre is a world unit,
 * and the model's y is the world's z. Clicking the ground adds boids;
 * clicking a boid takes some away.
 */
export function FlockView(bindings: FlockViewBindings): Object3D {
    const { model } = bindings;
    const halfWidth = model.arenaWidth / 2;
    const halfDepth = model.arenaHeight / 2;

    // Shared by every boid. The view made them, so it releases them.
    // A cone points along +y; turned to point along +x, a boid's heading is a
    // rotation about y.
    const boidGeometry = new ConeGeometry(0.7, 2.4, 8).rotateZ(-Math.PI / 2);
    const boidMaterial = new MeshStandardMaterial({ color: 0x58a6ff });
    const groundGeometry = new PlaneGeometry(model.arenaWidth, model.arenaHeight);
    const groundMaterial = new MeshStandardMaterial({ color: 0x21262d });

    return (
        <group onDestroyed={release}>
            <ambientLight intensity={0.8} />
            <directionalLight x={30} y={60} z={20} intensity={1.8} />
            <mesh
                geometry={groundGeometry}
                material={groundMaterial}
                rotationX={-Math.PI / 2}
                onClick={addBoids}
            />
            <List items={() => model.boids}>
                {(boid) => (
                    <mesh
                        geometry={boidGeometry}
                        material={boidMaterial}
                        y={1}
                        x={() => boid().position.x - halfWidth}
                        z={() => boid().position.y - halfDepth}
                        rotationY={() => -Math.atan2(boid().vy, boid().vx)}
                        onClick={removeBoids}
                    />
                )}
            </List>
        </group>
    );

    function addBoids(): void {
        model.boidCount = Math.min(model.boidCount + BOIDS_PER_CLICK, MAX_BOIDS);
    }

    function removeBoids(): void {
        model.boidCount = Math.max(model.boidCount - BOIDS_PER_CLICK, MIN_BOIDS);
    }

    function release(): void {
        boidGeometry.dispose();
        boidMaterial.dispose();
        groundGeometry.dispose();
        groundMaterial.dispose();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const BOIDS_PER_CLICK = 20;
const MIN_BOIDS = 20;
const MAX_BOIDS = 600;
