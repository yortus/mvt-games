import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';
import { noUnownedResource } from './no-unowned-resource';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
    languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
});

ruleTester.run('no-unowned-resource', noUnownedResource, {
    valid: [
        // Made in a variable, which the view can list in `owns`
        'const body = new CubeGeometry();\nconst el = <group owns={[body]}><mesh geometry={body} /></group>;',
        // A shared part, or one chosen by a getter, is made elsewhere
        'const el = <mesh geometry={parts.wheel} material={() => (isLit ? parts.lit : parts.dark)} />;',
        // A `new` in any other attribute is allowed
        'const el = <mesh position={new Vector3(1, 2, 3)} />;',
        // Passed straight to a function, which may free it
        'const el = <mesh geometry={kit.own(new PlaneGeometry(1, 1))} />;',
        // A texture looked up, not made
        'const el = <sprite texture={Texture.from(\'ship\')} />;',
    ],
    invalid: [
        {
            code: 'const el = <mesh geometry={new CubeGeometry({ width: 2 })} />;',
            errors: [{ messageId: 'unowned', data: { name: 'CubeGeometry', attribute: 'geometry' } }],
        },
        {
            // Reported once, at the outermost `new`, though the material's options make a texture too
            code: 'const el = <mesh material={new FlatMaterial({ baseColorTexture: new Texture(source) })} />;',
            errors: [{ messageId: 'unowned', data: { name: 'FlatMaterial', attribute: 'material' } }],
        },
        {
            // A getter that makes a new one every frame is worse still
            code: 'const el = <sprite texture={() => new PIXI.Texture(source)} />;',
            errors: [{ messageId: 'unowned', data: { name: 'Texture', attribute: 'texture' } }],
        },
    ],
});
