// Spike probe: does a three.js picture (a second WebGL context) change the Pixi pictures drawn after it?
import { describe } from 'vitest';
import { visualTest, visualThreeTest } from '../harness';
import { speedPose } from '../speed/poses';

const PROBES = [39, 0, 12, 30];
const sphere = async () => {
    const T = await import('three');
    const scene = new T.Scene();
    scene.add(new T.Mesh(new T.SphereGeometry(1, 32, 16), new T.MeshStandardMaterial({ color: 0xff4f8b })), new T.AmbientLight(0xffffff, 1));
    const camera = new T.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 4);
    return { scene, camera };
};

describe('three between', () => {
    for (const i of PROBES) visualTest(`start: ${speedPose(i).name}`, speedPose(i).pose);
    visualThreeTest('sphere', sphere, { width: 100, height: 100 });
    for (const i of PROBES) visualTest(`after three: ${speedPose(i).name}`, speedPose(i).pose);
    visualThreeTest('sphere again', sphere, { width: 100, height: 100 });
});
