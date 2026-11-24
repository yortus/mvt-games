/**
 * Finds the shader compiler that SwiftShader uses on this machine.
 *
 * v-snap draws WebGL in SwiftShader, a GPU in software, so that every
 * machine runs the same drawing code. SwiftShader compiles each shader for
 * the processor it runs on, with one of two shader compilers. On x64 it uses
 * Subzero. Subzero isn't built for arm64, so there SwiftShader uses LLVM.
 * The two shader compilers round some arithmetic differently, since LLVM
 * fuses a multiply and an add into one step, which rounds once. But each
 * shader compiler draws exactly the same images on every machine that uses
 * it, whatever its processor or operating system.
 *
 * So the shader compiler, not the processor's architecture, decides which
 * machines draw alike. Windows on arm64 shows the difference: Playwright
 * runs x64 Chromium there, emulated, so it uses Subzero and draws exactly as
 * x64 machines do.
 */

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * The shader compiler of a reference that doesn't record one. Every
 * reference written before v-snap recorded shader compilers was drawn on
 * x64, with Subzero.
 */
export const DEFAULT_SHADER_COMPILER = 'subzero';

/**
 * Returns the shader compiler that a WebGL renderer string names, such as
 * `subzero` for `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)
 * (0x0000C0DE)), SwiftShader driver)`, or `llvm` for `... (SwiftShader Device
 * (LLVM 10.0.0) ...`. A string that names another shader compiler returns
 * its first word, in lower case, so it counts as a shader compiler of its
 * own. A string that isn't SwiftShader's returns `unknown`, though the
 * environment check stops such a run first.
 */
export function findShaderCompiler(webglRenderer: string): string {
    const name = /SwiftShader Device \(([^)]*)\)/.exec(webglRenderer)?.[1].trim();
    if (name === undefined || name === '') return 'unknown';
    return name.split(/\s/)[0].toLowerCase();
}

/** Returns a shader compiler's name as people write it, for messages. */
export function toShaderCompilerName(shaderCompiler: string): string {
    return SHADER_COMPILER_NAMES[shaderCompiler] ?? shaderCompiler;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const SHADER_COMPILER_NAMES: Readonly<Record<string, string>> = { subzero: 'Subzero', llvm: 'LLVM' };
