import { expect, it } from 'vitest';
import { findShaderCompiler } from './shader-compiler';

// The renderer strings that Chromium reported on x64 machines and Windows on arm64, on macOS and Linux on arm64, and
// what a later SwiftShader might report
it('finds the shader compiler in the WebGL renderer string', () => {
    const found = [
        'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)',
        'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)',
        'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Turbo 2) (0x0000C0DE)), SwiftShader driver)',
        'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    ].map(findShaderCompiler);
    expect(found).toEqual(['subzero', 'llvm', 'turbo', 'unknown']);
});
