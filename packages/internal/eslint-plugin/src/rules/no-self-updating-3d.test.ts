import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';
import { noSelfUpdating3d } from './no-self-updating-3d';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({ languageOptions: { parser: tseslint.parser } });

ruleTester.run('no-self-updating-3d', noSelfUpdating3d, {
    valid: [
        'const sparks = new ParticleSystem3D({ emitRate: 30, autoUpdate: false });',
        'const robot = new Model3D({ source, autoUpdate: false, autoPlay: false });',
        'const robot = Model3D.from(source, { autoUpdate: false });',
        // A live texture updates itself only when `autoUpdate` is turned on
        'const screen = new ContainerTexture({ container: board, width: 512, height: 256 });',
        'const screen = new ContainerTexture({ container: board, autoUpdate: false });',
        'sparks.autoUpdate = false;',
        // Other classes may have an option of the same name
        'const thing = new Thing({ autoUpdate: true });',
    ],
    invalid: [
        { code: 'const sparks = new ParticleSystem3D({ emitRate: 30 });', errors: [{ messageId: 'defaultsOn', data: { name: 'ParticleSystem3D' } }] },
        { code: 'const robot = new Model3D(source);', errors: [{ messageId: 'defaultsOn', data: { name: 'Model3D' } }] },
        { code: 'const orbit = new extras.OrbitCamera({ autoUpdate: isLive });', errors: [{ messageId: 'defaultsOn', data: { name: 'OrbitCamera' } }] },
        { code: 'const view = View3D.from(source);', errors: [{ messageId: 'defaultsOn', data: { name: 'View3D.from' } }] },
        { code: 'const screen = new ContainerTexture({ container: board, autoUpdate: true });', errors: [{ messageId: 'turnedOn' }] },
        { code: 'screen.autoUpdate = !paused;', errors: [{ messageId: 'turnedOn' }] },
    ],
});
