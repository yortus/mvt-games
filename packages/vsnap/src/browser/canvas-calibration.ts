import type { VisualVerdict } from '../protocol';
import { flipRows } from '../shared';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** Draws a calibration image, and returns its pixels. */
export type CanvasCalibration = () => { readonly width: number; readonly height: number; readonly pixels: Uint8Array };

/** A calibration image: a function that draws it, and judges it against its expected hash. */
export type Calibration = (name: string, expectedHash: string | undefined) => Promise<VisualVerdict>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The sample text of the calibration set, in every font and size. */
export const SAMPLE = 'Sphinx of black quartz, judge my vow. 0123456789 $1,250';

/**
 * The canvas calibration set. Each image draws with the browser's own canvas
 * 2D or WebGL, and no renderer library, so it checks the machine and not a
 * library's version. Between them, the images use what Pixi, three.js and
 * other renderers draw with: antialiased paths, gradients, shadows, filters,
 * the test fonts, multisampling, shader maths, texture sampling, blending
 * and half-float render targets.
 */
export const CANVAS_CALIBRATION: Readonly<Record<string, CanvasCalibration>> = {
    'canvas-shapes': () => draw2d(220, 140, (ctx) => {
        ctx.fillStyle = '#ff4f8b';
        ctx.strokeStyle = '#ffe45c';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(40, 40, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.save();
        ctx.translate(110, 40);
        ctx.rotate(0.3);
        ctx.fillStyle = '#5bd1ff';
        ctx.fillRect(-25, -18, 50, 36);
        ctx.restore();
        ctx.lineCap = 'round';
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#2fd27a';
        ctx.beginPath();
        ctx.moveTo(150, 70);
        ctx.bezierCurveTo(170, 10, 200, 90, 210, 20);
        ctx.stroke();
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.strokeRect(8.5, 85.5, 90, 45);
        ctx.setLineDash([]);
        const linear = ctx.createLinearGradient(110, 0, 210, 0);
        linear.addColorStop(0, '#ff4f8b');
        linear.addColorStop(0.5, '#ffe45c');
        linear.addColorStop(1, '#2a1766');
        ctx.fillStyle = linear;
        ctx.beginPath();
        ctx.roundRect(110, 85, 100, 45, 12);
        ctx.fill();
        const radial = ctx.createRadialGradient(55, 105, 2, 55, 108, 20);
        radial.addColorStop(0, '#ffffff');
        radial.addColorStop(1, '#2a1766');
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;
        ctx.fillStyle = radial;
        ctx.beginPath();
        ctx.arc(55, 108, 18, 0, Math.PI * 2);
        ctx.fill();
    }),
    'canvas-images': () => draw2d(220, 120, (ctx) => {
        const checker = createChecker();
        ctx.imageSmoothingEnabled = false;
        drawRotated(ctx, checker, 50, 60, 5.3, 0.3);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        drawRotated(ctx, checker, 160, 60, 5.3, 0.3);
        ctx.globalAlpha = 0.5;
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = '#5bd1ff';
        ctx.fillRect(90, 30, 40, 60);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.filter = 'blur(4px)';
        ctx.fillStyle = '#ffe45c';
        ctx.fillRect(98, 8, 24, 16);
        ctx.filter = 'none';
    }),
    'canvas-text-sans': () => drawTextBlock('"Segoe UI", sans-serif'),
    'canvas-text-mono': () => drawTextBlock('monospace'),
    'canvas-text-effects': () => draw2d(320, 130, (ctx) => {
        ctx.textBaseline = 'top';
        const gradient = ctx.createLinearGradient(0, 8, 0, 52);
        gradient.addColorStop(0, '#ffe45c');
        gradient.addColorStop(1, '#ff4f8b');
        ctx.font = '900 44px sans-serif';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#140a38';
        ctx.strokeText('WIN 1,250', 8, 8);
        ctx.fillStyle = gradient;
        ctx.fillText('WIN 1,250', 8, 8);
        ctx.save();
        ctx.font = '24px monospace';
        ctx.letterSpacing = '3px';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Shadowed, spaced', 8, 64);
        ctx.restore();
        ctx.font = 'italic 20px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Italic text', 8, 100);
    }),
    'webgl-msaa': () => drawWebGl(120, 120, { antialias: true }, (gl) => drawShapes(gl)),
    'webgl-aliased': () => drawWebGl(120, 120, { antialias: false }, (gl) => drawShapes(gl)),
    'webgl-msaa-target': () => drawWebGl(120, 120, { antialias: false }, (gl) => {
        // Draws into a multisampled render target, then resolves it into a
        // texture, as a renderer does for a render texture with
        // antialiasing. The image is read from the texture.
        const target = gl.createFramebuffer();
        const buffer = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, buffer);
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, Math.min(4, gl.getParameter(gl.MAX_SAMPLES) as number), gl.RGBA8, 120, 120);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, buffer);
        drawShapes(gl);
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, 120, 120);
        const resolved = gl.createFramebuffer();
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, resolved);
        gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, target);
        gl.blitFramebuffer(0, 0, 120, 120, 0, 0, 120, 120, gl.COLOR_BUFFER_BIT, gl.NEAREST);
        gl.bindFramebuffer(gl.FRAMEBUFFER, resolved);
    }),
    'webgl-shading': () => drawWebGl(160, 120, { antialias: false }, (gl) => {
        drawFullScreen(gl, SHADING_SHADER, {});
    }),
    'webgl-textures': () => drawWebGl(200, 120, { antialias: false }, (gl) => {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, createTextureSource());
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.clearColor(0.125, 0.125, 0.14, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        const quads: readonly (readonly [x: number, y: number, size: number, angle: number, filter: number])[] = [
            [50, 60, 90, 0.3, gl.NEAREST],
            [130, 55, 90, -0.2, gl.LINEAR],
            [180, 95, 22, 0.5, gl.LINEAR_MIPMAP_LINEAR],
        ];
        for (const [x, y, size, angle, filter] of quads) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter === gl.NEAREST ? gl.NEAREST : gl.LINEAR);
            drawTexturedQuad(gl, { x: x / 200 * 2 - 1, y: 1 - y / 120 * 2, width: size / 200, height: size / 120, angle });
        }
    }),
    'webgl-half-float': () => drawWebGl(160, 80, { antialias: false }, (gl) => {
        // Draws bright colours into a half-float target, then blurs and
        // tone-maps them onto the canvas, as lit and filtered scenes are.
        if (gl.getExtension('EXT_color_buffer_float') === null) throw new Error('The browser can\'t draw into half-float render targets.');
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, 160, 80, 0, gl.RGBA, gl.HALF_FLOAT, NO_PIXELS);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const target = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, target);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        drawFullScreen(gl, BRIGHT_SHADER, {});
        gl.bindFramebuffer(gl.FRAMEBUFFER, CANVAS_FRAMEBUFFER);
        drawFullScreen(gl, BLUR_SHADER, { source: texture });
    }),
};

// ---------------------------------------------------------------------------
// Internals: canvas 2D
// ---------------------------------------------------------------------------

const BACKGROUND = '#202024';

/** Draws on a new 2D canvas, over the background, and returns its pixels. */
function draw2d(width: number, height: number, drawOn: (ctx: CanvasRenderingContext2D) => void): ReturnType<CanvasCalibration> {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('The browser gave no 2D canvas context.');
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, width, height);
    drawOn(ctx);
    const data = ctx.getImageData(0, 0, width, height).data;
    return { width, height, pixels: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) };
}

/** Draws the sample text in three weights and four sizes, in one font family. */
function drawTextBlock(family: string): ReturnType<CanvasCalibration> {
    return draw2d(640, 270, (ctx) => {
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#ffffff';
        let y = 4;
        for (const weight of [400, 700, 900]) {
            for (const size of [10, 13, 16, 24]) {
                ctx.font = `${weight} ${size}px ${family}`;
                ctx.fillText(SAMPLE, 4, y);
                y += Math.ceil(size * 1.35);
            }
        }
    });
}

/** Returns a 16 by 16 canvas of 4 by 4 squares in four colours. */
function createChecker(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('The browser gave no 2D canvas context.');
    for (let i = 0; i < 16; i++) {
        ctx.fillStyle = ['#ff4f8b', '#ffe45c', '#2a1766', '#5bd1ff'][(i % 4 + Math.floor(i / 4)) % 4];
        ctx.fillRect((i % 4) * 4, Math.floor(i / 4) * 4, 4, 4);
    }
    return canvas;
}

function drawRotated(ctx: CanvasRenderingContext2D, image: HTMLCanvasElement, x: number, y: number, scale: number, angle: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.drawImage(image, -image.width / 2, -image.height / 2);
    ctx.restore();
}

/** Returns a 64 by 64 canvas with sharp squares, text and a gradient, part transparent, to upload as a texture. */
function createTextureSource(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('The browser gave no 2D canvas context.');
    ctx.drawImage(createChecker(), 0, 0, 32, 32);
    const gradient = ctx.createLinearGradient(32, 0, 64, 32);
    gradient.addColorStop(0, 'rgba(91, 209, 255, 1)');
    gradient.addColorStop(1, 'rgba(91, 209, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(32, 0, 32, 32);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 24px sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText('Ag', 4, 36);
    ctx.fillStyle = 'rgba(255, 79, 139, 0.5)';
    ctx.beginPath();
    ctx.arc(48, 48, 12, 0, Math.PI * 2);
    ctx.fill();
    return canvas;
}

// ---------------------------------------------------------------------------
// Internals: WebGL
// ---------------------------------------------------------------------------

/**
 * Draws on a new WebGL 2 canvas, and returns the pixels of the framebuffer
 * that the drawing leaves bound: the canvas's own, or a render target's.
 * The pixels are read straight after drawing, before the page can
 * composite them. The context is then lost on purpose, because a page
 * keeps only so many.
 */
function drawWebGl(
    width: number,
    height: number,
    options: { readonly antialias: boolean },
    drawOn: (gl: WebGL2RenderingContext) => void,
): ReturnType<CanvasCalibration> {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const gl = canvas.getContext('webgl2', { antialias: options.antialias, alpha: false, depth: false, stencil: false, premultipliedAlpha: true });
    if (gl === null) throw new Error('The browser gave no WebGL 2 context.');
    try {
        gl.viewport(0, 0, width, height);
        drawOn(gl);
        const pixels = new Uint8Array(width * height * 4);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        flipRows(pixels, width, height);
        return { width, height, pixels };
    }
    finally {
        gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
}

// eslint-disable-next-line @mvtjs/no-null -- WebGL binds the canvas's own framebuffer when given `null`
const CANVAS_FRAMEBUFFER = null;

// eslint-disable-next-line @mvtjs/no-null -- WebGL makes a texture with no pixels yet when given `null`
const NO_PIXELS = null;

const FULL_SCREEN_VERTEX = `#version 300 es
in vec2 position;
out vec2 uv;
void main() {
    uv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
}`;

const COLOUR_VERTEX = `#version 300 es
in vec2 position;
in vec3 colour;
out vec3 vColour;
void main() {
    vColour = colour;
    gl_Position = vec4(position, 0.0, 1.0);
}`;

const COLOUR_FRAGMENT = `#version 300 es
precision highp float;
in vec3 vColour;
out vec4 outColour;
void main() {
    outColour = vec4(vColour, 1.0);
}`;

const TEXTURED_VERTEX = `#version 300 es
in vec2 position;
uniform vec4 placement;
uniform float angle;
out vec2 uv;
void main() {
    uv = position * 0.5 + 0.5;
    uv.y = 1.0 - uv.y;
    vec2 p = position * placement.zw;
    float c = cos(angle);
    float s = sin(angle);
    gl_Position = vec4(placement.xy + vec2(p.x * c - p.y * s * 0.6, p.x * s / 0.6 + p.y * c), 0.0, 1.0);
}`;

const TEXTURED_FRAGMENT = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D source;
out vec4 outColour;
void main() {
    outColour = texture(source, uv) * 0.85;
}`;

/** A lit sphere with a specular highlight, fog and a sine pattern, tone-mapped and converted to sRGB. */
const SHADING_SHADER = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 outColour;
vec3 toneMap(vec3 c) {
    c *= 0.6;
    return clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), 0.0, 1.0);
}
void main() {
    vec2 p = (uv - vec2(0.5)) * vec2(1.6, 1.2) * 2.2;
    vec3 colour = vec3(0.02, 0.03, 0.08) + 0.05 * sin(vec3(p.x * 9.0, p.y * 7.0, (p.x + p.y) * 5.0));
    float r = length(p);
    if (r < 1.0) {
        vec3 n = normalize(vec3(p, sqrt(1.0 - r * r)));
        vec3 light = normalize(vec3(-0.5, 0.7, 0.6));
        float diffuse = max(dot(n, light), 0.0);
        float specular = pow(max(dot(reflect(-light, n), vec3(0.0, 0.0, 1.0)), 0.0), 32.0);
        vec3 base = mix(vec3(0.18, 0.82, 0.48), vec3(1.0, 0.31, 0.55), smoothstep(-0.6, 0.6, p.y));
        colour = base * (0.15 + 2.2 * diffuse) + vec3(3.0) * specular;
        colour *= exp(-0.4 * (1.0 - n.z));
    }
    outColour = vec4(pow(toneMap(colour), vec3(1.0 / 2.2)), 1.0);
}`;

/** Bright bars and a disc, up to eight times white, for a half-float target. */
const BRIGHT_SHADER = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 outColour;
void main() {
    vec3 colour = vec3(0.0);
    if (fract(uv.x * 6.0) < 0.3) colour = vec3(8.0, 2.0, 0.5) * uv.y;
    float d = length((uv - vec2(0.7, 0.5)) * vec2(2.0, 1.0));
    colour += vec3(0.4, 1.5, 6.0) * smoothstep(0.25, 0.2, d);
    outColour = vec4(colour, 1.0);
}`;

/** A 9 by 9 Gaussian blur of a half-float texture, tone-mapped. */
const BLUR_SHADER = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D source;
out vec4 outColour;
void main() {
    vec2 texel = 1.0 / vec2(textureSize(source, 0));
    vec3 sum = vec3(0.0);
    float total = 0.0;
    for (int x = -4; x <= 4; x++) {
        for (int y = -4; y <= 4; y++) {
            float w = exp(-float(x * x + y * y) / 8.0);
            sum += texture(source, uv + vec2(float(x), float(y)) * texel * 1.5).rgb * w;
            total += w;
        }
    }
    vec3 c = sum / total;
    outColour = vec4(pow(c / (c + vec3(1.0)), vec3(1.0 / 2.2)), 1.0);
}`;

/** Draws a disc with an outline, a thin rotated triangle and a slanted bar, in solid colours. */
function drawShapes(gl: WebGL2RenderingContext): void {
    gl.clearColor(0.125, 0.125, 0.14, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const vertices: number[] = [];
    const addTriangle = (points: readonly number[], colour: readonly number[]): void => {
        for (let i = 0; i < 3; i++) vertices.push(points[i * 2] / 60 - 1, 1 - points[i * 2 + 1] / 60, ...colour);
    };
    const segments = 48;
    for (let i = 0; i < segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        const b = ((i + 1) / segments) * Math.PI * 2;
        addTriangle([45, 45, 45 + Math.cos(a) * 36, 45 + Math.sin(a) * 36, 45 + Math.cos(b) * 36, 45 + Math.sin(b) * 36], [1, 0.894, 0.361]);
        addTriangle([45, 45, 45 + Math.cos(a) * 32, 45 + Math.sin(a) * 32, 45 + Math.cos(b) * 32, 45 + Math.sin(b) * 32], [1, 0.31, 0.545]);
    }
    addTriangle([70, 100, 116, 62, 112, 110], [0.357, 0.82, 1]);
    addTriangle([8, 112, 100, 88, 10, 116], [0.184, 0.824, 0.478]);
    const program = createProgram(gl, COLOUR_VERTEX, COLOUR_FRAGMENT);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    const colour = gl.getAttribLocation(program, 'colour');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(colour);
    gl.vertexAttribPointer(colour, 3, gl.FLOAT, false, 20, 8);
    gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 5);
}

/** Draws one triangle that covers the target, with a fragment shader and its textures. */
function drawFullScreen(gl: WebGL2RenderingContext, fragment: string, textures: Readonly<Record<string, WebGLTexture>>): void {
    const program = createProgram(gl, FULL_SCREEN_VERTEX, fragment);
    gl.useProgram(program);
    let unit = 0;
    for (const [name, texture] of Object.entries(textures)) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(gl.getUniformLocation(program, name), unit);
        unit++;
    }
    drawWithPositions(gl, program, [-1, -1, 3, -1, -1, 3]);
}

/** Draws the bound texture on a rotated quad, centred at x and y in clip space. */
function drawTexturedQuad(gl: WebGL2RenderingContext, quad: { readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly angle: number }): void {
    const program = createProgram(gl, TEXTURED_VERTEX, TEXTURED_FRAGMENT);
    gl.useProgram(program);
    gl.uniform4f(gl.getUniformLocation(program, 'placement'), quad.x, quad.y, quad.width, quad.height);
    gl.uniform1f(gl.getUniformLocation(program, 'angle'), quad.angle);
    gl.uniform1i(gl.getUniformLocation(program, 'source'), 0);
    drawWithPositions(gl, program, [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
}

function drawWithPositions(gl: WebGL2RenderingContext, program: WebGLProgram, positions: readonly number[]): void {
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, positions.length / 2);
}

function createProgram(gl: WebGL2RenderingContext, vertex: string, fragment: string): WebGLProgram {
    const program = gl.createProgram();
    for (const [kind, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]] as const) {
        const shader = gl.createShader(kind);
        if (shader === null) throw new Error('The browser could not create a shader.');
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) !== true) throw new Error(`A calibration shader did not compile: ${gl.getShaderInfoLog(shader)}`);
        gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (gl.getProgramParameter(program, gl.LINK_STATUS) !== true) throw new Error(`A calibration program did not link: ${gl.getProgramInfoLog(program)}`);
    return program;
}
