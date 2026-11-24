import { findShaderCompiler } from '../shared';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * The shader compiler that SwiftShader uses on this machine: `subzero` on
 * x64 machines and Windows on arm64, and `llvm` on Linux and macOS on
 * arm64. The two draw the edges of 3D shapes a little differently, so a
 * test that can't pass across them can skip on one, as a last resort:
 *
 * ```ts
 * canvasTest.skipIf(shaderCompiler === 'llvm')('fog over the hills', SIZE, pose);
 * ```
 */
export const shaderCompiler: string = findShaderCompiler(readWebglRenderer());

/** Returns the page's WebGL renderer string, or `none` if the page can't make a WebGL context. */
export function readWebglRenderer(): string {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (gl === null) return 'none';
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = info === null ? 'none' : String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
    // A page may hold only so many WebGL contexts, so this one is released at once
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return renderer;
}
