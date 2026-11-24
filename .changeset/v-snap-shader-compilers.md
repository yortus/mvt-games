---
'v-snap': minor
---

A reference now passes on every machine, including arm64 ones, without any setting to change.

SwiftShader, the software GPU that v-snap draws WebGL with, compiles shaders with one of two shader compilers. x64 machines use Subzero, and arm64 machines use LLVM. Each shader compiler draws exactly the same images on every machine that uses it, but the two round some drawing differently. So 3D scenes drawn on a Mac used to differ from references drawn on Windows or Linux, in a few pixels along the edges of shapes.

Each reference now records the shader compiler that drew it, and v-snap reads the machine's own from the browser.

- When the same shader compiler drew the reference, an image must match it within the tolerance, as before.
- When the other shader compiler drew it, a pixel may also differ by as much as one sample crossing an edge could change it. That's at most the pixel's largest step to one of its neighbours. A pixel that changes where the image is flat still fails. The diff shows these pixels in orange, and the failure message names both shader compilers.
- `-u` rewrites any change to a reference that your machine's shader compiler drew. It keeps a reference from the other shader compiler if your image matches it closely, so references don't flip back and forth between machines.

A reference written before this version doesn't record a shader compiler, so it counts as drawn with Subzero, as every earlier reference was. Windows on arm64 now counts as Subzero too, since Playwright runs x64 Chromium there.

If a test can't pass across the two shader compilers, and you can't change its scene, you can skip it on one, as a last resort. `v-snap` exports `shaderCompiler`, so you can write `canvasTest.skipIf(shaderCompiler === 'llvm')`.
