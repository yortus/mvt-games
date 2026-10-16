import type { Rect } from './rect';
import type { WallEffectKind } from './transition-view-model';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Draws the wall's burning or developing cards on a canvas: with WebGL, one
 * fragment shader for every card at once; without it, a plain fade.
 */
export interface WallPainter {
    /** Sizes the canvas to `width` by `height` CSS pixels, at `pixelRatio` device pixels to each. */
    readonly resize: (width: number, height: number, pixelRatio: number) => void;
    /** Draws `effect` over the cards. */
    readonly draw: (effect: WallEffectKind, cards: WallCards) => void;
    /** Leaves the canvas clear. */
    readonly clear: () => void;
}

/** The cards a painter draws over. */
export interface WallCards {
    readonly cardCount: () => number;
    /** Card `index`'s rectangle in the viewport, in CSS pixels; zero-sized where there is no card. */
    readonly cardRectAt: (index: number) => Rect;
    /** How far card `index` has burnt, or developed, from 0 to 1. */
    readonly cardProgressAt: (index: number) => number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** A painter for `canvas`: WebGL's, or a plain fade where there is no WebGL. */
export function createWallPainter(canvas: HTMLCanvasElement): WallPainter {
    const background = pageBackground();
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
    return gl === null ? createFadePainter(canvas, background) : createShaderPainter(canvas, gl, background);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The most cards drawn: the shader's arrays are this long. */
const MAX_CARDS = 32;

/** WebGL's painter: one fragment shader draws every card, burning or developing. */
function createShaderPainter(canvas: HTMLCanvasElement, gl: WebGLRenderingContext, background: readonly number[]): WallPainter {
    const program = linkProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    // One triangle over the whole canvas
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'a_position');
    const uniforms = {
        size: gl.getUniformLocation(program, 'u_size'),
        scale: gl.getUniformLocation(program, 'u_scale'),
        background: gl.getUniformLocation(program, 'u_background'),
        count: gl.getUniformLocation(program, 'u_count'),
        mode: gl.getUniformLocation(program, 'u_mode'),
        rects: gl.getUniformLocation(program, 'u_rects'),
        progress: gl.getUniformLocation(program, 'u_progress'),
    };
    const rects = new Float32Array(MAX_CARDS * 4);
    const progress = new Float32Array(MAX_CARDS);
    let pixelRatio = 1;

    return {
        resize(width, height, ratio) {
            pixelRatio = ratio;
            canvas.width = Math.max(1, Math.round(width * ratio));
            canvas.height = Math.max(1, Math.round(height * ratio));
            gl.viewport(0, 0, canvas.width, canvas.height);
        },
        draw(effect, cards) {
            const count = Math.min(MAX_CARDS, cards.cardCount());
            for (let i = 0; i < count; i++) {
                const rect = cards.cardRectAt(i);
                rects[i * 4] = rect.x;
                rects[i * 4 + 1] = rect.y;
                rects[i * 4 + 2] = rect.width;
                rects[i * 4 + 3] = rect.height;
                progress[i] = cards.cardProgressAt(i);
            }
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.useProgram(program);
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.enableVertexAttribArray(position);
            gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
            gl.uniform2f(uniforms.size, canvas.width, canvas.height);
            gl.uniform1f(uniforms.scale, pixelRatio);
            gl.uniform3f(uniforms.background, background[0], background[1], background[2]);
            gl.uniform1i(uniforms.count, count);
            gl.uniform1i(uniforms.mode, effect === 'burn' ? 1 : 2);
            gl.uniform4fv(uniforms.rects, rects);
            gl.uniform1fv(uniforms.progress, progress);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        },
        clear() {
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
        },
    };
}

/** Without WebGL: each card fades out as it burns, and in as it develops. */
function createFadePainter(canvas: HTMLCanvasElement, background: readonly number[]): WallPainter {
    const context = canvas.getContext('2d');
    const fill = `rgb(${background.map((c) => Math.round(c * 255)).join(', ')})`;
    let pixelRatio = 1;
    return {
        resize(width, height, ratio) {
            pixelRatio = ratio;
            canvas.width = Math.max(1, Math.round(width * ratio));
            canvas.height = Math.max(1, Math.round(height * ratio));
        },
        draw(effect, cards) {
            if (context === null) return;
            context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.fillStyle = fill;
            const count = cards.cardCount();
            for (let i = 0; i < count; i++) {
                const rect = cards.cardRectAt(i);
                const progress = cards.cardProgressAt(i);
                context.globalAlpha = effect === 'burn' ? progress : 1 - progress;
                context.fillRect(rect.x - 8, rect.y - 8, rect.width + 16, rect.height + 16);
            }
            context.globalAlpha = 1;
        },
        clear() {
            context?.clearRect(0, 0, canvas.width, canvas.height);
        },
    };
}

/** The page's background colour, as red, green and blue from 0 to 1: what a burnt card leaves. */
function pageBackground(): number[] {
    const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(getComputedStyle(document.body).backgroundColor);
    return match === null ? [13 / 255, 17 / 255, 23 / 255] : [Number(match[1]) / 255, Number(match[2]) / 255, Number(match[3]) / 255];
}

function linkProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram {
    const program = gl.createProgram();
    gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (gl.getProgramParameter(program, gl.LINK_STATUS) !== true) {
        throw new Error(`wall effect: ${gl.getProgramInfoLog(program) ?? 'the shaders did not link'}`);
    }
    return program;
}

function compileShader(gl: WebGLRenderingContext, kind: number, source: string): WebGLShader {
    const shader = gl.createShader(kind);
    if (shader === null) throw new Error('wall effect: no shader');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) !== true) {
        throw new Error(`wall effect: ${gl.getShaderInfoLog(shader) ?? 'a shader did not compile'}`);
    }
    return shader;
}

const VERTEX_SHADER = `
attribute vec2 a_position;
void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

/*
 * For each pixel, the card it is over, if any (or the margin round it, where
 * the card's shadow and glow fall), then:
 * - burning (mode 1): when this pixel catches is its distance from the card's
 *   starting corner, roughened by noise. Behind the front: the page's
 *   background. At the front: an ember edge, white-hot to red. Just ahead of
 *   it: scorching. The margin only ever shows the background, once burnt.
 * - developing (mode 2): the card goes from the background to a blank, then
 *   the blank clears to show the card.
 */
const FRAGMENT_SHADER = `
precision highp float;

const int MAX_CARDS = ${MAX_CARDS};
const float RADIUS = 12.0;
const float MARGIN = 8.0;
const float EMBER = 0.025;
const float SCORCH = 0.09;

uniform vec2 u_size;
uniform float u_scale;
uniform vec3 u_background;
uniform int u_count;
uniform int u_mode;
uniform vec4 u_rects[MAX_CARDS];
uniform float u_progress[MAX_CARDS];

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int octave = 0; octave < 4; octave++) {
        value += amplitude * noise(p);
        p *= 2.03;
        amplitude *= 0.5;
    }
    return value;
}

float roundBox(vec2 p, vec2 halfSize, float radius) {
    vec2 q = abs(p) - halfSize + radius;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

void main() {
    vec2 point = vec2(gl_FragCoord.x, u_size.y - gl_FragCoord.y) / u_scale;
    for (int i = 0; i < MAX_CARDS; i++) {
        if (i >= u_count) break;
        vec4 rect = u_rects[i];
        if (rect.z <= 0.0) continue;
        vec2 low = rect.xy - MARGIN;
        vec2 high = rect.xy + rect.zw + MARGIN;
        if (point.x < low.x || point.y < low.y || point.x > high.x || point.y > high.y) continue;

        float progress = u_progress[i];
        bool inside = roundBox(point - (rect.xy + rect.zw * 0.5), rect.zw * 0.5, RADIUS) < 0.0;
        float seed = float(i) * 17.31 + 3.7;
        float grain = fbm((point - rect.xy) / 46.0 + seed);

        if (u_mode == 1) {
            vec2 local = (point - rect.xy) / max(rect.zw, vec2(1.0));
            vec2 start = vec2(hash(vec2(seed, 1.7)), hash(vec2(seed, 9.2)));
            float catches = length(local - start) / 1.42 * 0.6 + grain * 0.4;
            float behind = progress * 1.3 - 0.15 - catches;
            if (behind > 0.0) {
                gl_FragColor = vec4(u_background, 1.0);
            }
            else if (!inside) {
                gl_FragColor = vec4(0.0);
            }
            else if (behind > -EMBER) {
                float heat = 1.0 + behind / EMBER;
                gl_FragColor = vec4(mix(vec3(0.55, 0.08, 0.0), vec3(1.0, 0.88, 0.5), heat), 1.0);
            }
            else if (behind > -SCORCH) {
                float alpha = 0.85 * (1.0 - (-behind - EMBER) / (SCORCH - EMBER));
                gl_FragColor = vec4(vec3(0.12, 0.06, 0.02) * alpha, alpha);
            }
            else {
                gl_FragColor = vec4(0.0);
            }
            return;
        }

        vec3 blank = vec3(0.32, 0.31, 0.27) * (0.85 + 0.3 * grain);
        vec3 colour = inside ? blank : u_background;
        float alpha = 1.0;
        if (progress < 0.15) colour = inside ? mix(u_background, blank, progress / 0.15) : u_background;
        else alpha = 1.0 - smoothstep(0.15, 1.0, progress);
        gl_FragColor = vec4(colour * alpha, alpha);
        return;
    }
    gl_FragColor = vec4(0.0);
}
`;
