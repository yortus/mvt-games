// These are the visual test harness's own tests. Each one checks one case
// of capturing an HTML view.
import { expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { adoptHtmlRules, quantizeFontSizes, settleAnimations } from '../html-rules';
import { htmlTest } from '../visual-test';

function createBlock(markup: string): HTMLElement {
    const root = document.createElement('div');
    root.style.cssText = 'padding:8px;color:#e6edf3;font-size:14px;';
    root.innerHTML = markup;
    return root;
}

htmlTest('text, drawn blank', () => createBlock('<h3 style="margin:0">A heading</h3><p style="width:180px">A paragraph long enough to wrap onto a second line.</p>'));

htmlTest('a styled control', () => createBlock('<button style="font:inherit;padding:6px 14px;border:1px solid #30363d;border-radius:6px;background:#21262d;color:#c9d1d9">Spin</button>'));

htmlTest('a rotated image', () => createBlock(`<img style="width:80px;transform:rotate(-4deg)" src="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><rect width="40" height="30" fill="#2a1766"/><circle cx="20" cy="15" r="10" fill="#5bd1ff"/></svg>')}">`));

htmlTest('at a fixed size', { width: 120, height: 80 }, () => createBlock('<div style="width:40px;height:40px;background:#ff4f8b"></div>'));

// Animations are brought to rest before the capture: the spinner, which
// never ends, is cancelled, and the fade, which ends, is finished. Each
// repeat must match the one reference.
htmlTest('animations, at rest', { repeats: 3 }, () => createBlock(`
    <style>
        @keyframes test-spin { to { transform: rotate(360deg) } }
        @keyframes test-fade { from { opacity: 0 } to { opacity: 1 } }
    </style>
    <div style="display:flex;gap:12px">
        <div style="width:30px;height:30px;background:#5bd1ff;animation:test-spin .7s linear infinite"></div>
        <div style="width:30px;height:30px;background:#ff4f8b;animation:test-fade 5s forwards"></div>
    </div>`));

// A web component's text, in its shadow root, is blank too, and its odd
// font size is rounded to a quarter pixel. The act step sees both, so a
// measurement that it takes matches the image.
htmlTest('text in a shadow root, drawn blank', {
    act: (block) => {
        const text = block.shadowRoot?.querySelector('p') as HTMLElement;
        expect(getComputedStyle(text).fontFamily).toContain('Visual Blank');
        expect(getComputedStyle(text).fontSize).toBe('17.25px');
    },
}, () => {
    const block = createBlock('');
    const shadow = block.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<style>p { font-family: Arial, sans-serif; font-size: 17.3px; margin: 0; width: 160px }</style><p>Text in a web component, long enough to wrap.</p>';
    return block;
});

// A root whose position is fixed or absolute, such as a modal overlay's,
// takes no room in the page. The image reaches its far edges, so the box
// is 30 pixels in from the left and 20 from the top.
htmlTest('a root with position: fixed', () => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;left:30px;top:20px;width:80px;height:40px;border-radius:6px;background:#5bd1ff';
    return overlay;
});

// A margin takes in what the view draws outside its box, such as a focus
// ring. This button is the whole view.
htmlTest('a button, focused, in a margin', {
    margin: 6,
    act: () => userEvent.tab(),
}, () => {
    const block = createBlock(BUTTON);
    block.style.padding = '0';
    return block;
});

// A view that runs on real time is held still with Vitest's fake timers,
// moved on to a moment, and given back real timers before the pose
// returns, since the capture waits for frames. The light comes on after
// 300 ms, and the image catches it on.
htmlTest('a view on real time, held still with fake timers', () => {
    vi.useFakeTimers();
    try {
        const block = createBlock('<div style="width:30px;height:30px;background:#30363d"></div>');
        const light = block.firstElementChild as HTMLElement;
        setTimeout(() => (light.style.background = '#ffe45c'), 300);
        requestAnimationFrame(() => (light.style.borderRadius = '50%'));
        vi.advanceTimersByTime(300);
        return block;
    }
    finally {
        vi.useRealTimers();
    }
});

it('gives up its font size rounding to a size set after it', () => {
    const block = createBlock('<p style="font-size:13.3px">One</p><p style="font-size:15.1px">Two</p>');
    document.body.append(block);
    try {
        const [one, two] = block.querySelectorAll('p');
        const unround = quantizeFontSizes(block);
        expect([one.style.fontSize, two.style.fontSize]).toEqual(['13.25px', '15px']);
        two.style.fontSize = '20.1px';
        unround();
        expect([one.style.fontSize, two.style.fontSize]).toEqual(['13.3px', '20.1px']);
    }
    finally {
        block.remove();
    }
});

// A test's act step runs once the view is in the page, after its kind's
// prepare step. After the image, the pointer leaves the page, so the second
// button, where the first one was, isn't hovered.
const BUTTON = `<style>
        .test-button { font: inherit; padding: 6px 14px; border: 1px solid #30363d; border-radius: 6px; background: #21262d; color: #c9d1d9 }
        .test-button:hover { background: #ff4f8b }
        .test-button:focus-visible { outline: 3px solid #5bd1ff; outline-offset: 2px }
    </style>
    <button class="test-button">Spin</button>`;

htmlTest('a button, hovered', {
    act: async (block) => {
        expect(block.isConnected).toBe(true);
        await userEvent.hover(block.querySelector('button') as HTMLElement);
    },
}, () => createBlock(BUTTON));

htmlTest('a button, after a hovered one', () => createBlock(BUTTON));

htmlTest('a button, focused from the keyboard', { act: () => userEvent.tab() }, () => createBlock(BUTTON));

it('leaves nothing hovered after a test that acted', () => {
    const cover = createBlock('');
    cover.style.cssText = 'position:fixed;inset:0';
    document.body.append(cover);
    try {
        expect(cover.matches(':hover')).toBe(false);
    }
    finally {
        cover.remove();
    }
});

// A test's viewport and colour scheme reach its media queries, and the page
// returns to its own afterwards.
const RESPONSIVE = `<style>
        .test-box { width: 60px; height: 30px; background: #5bd1ff }
        @media (max-width: 500px) { .test-box { background: #ffe45c } }
        @media (prefers-color-scheme: light) { .test-box { border: 4px solid #ff4f8b } }
    </style>
    <div class="test-box"></div>`;

htmlTest('a media query, at a narrow viewport', { viewport: { width: 400, height: 300 } }, () => createBlock(RESPONSIVE));

htmlTest('a media query, in the light colour scheme', { colorScheme: 'light' }, () => createBlock(RESPONSIVE));

htmlTest('a media query, with the page as it was', () => createBlock(RESPONSIVE));

it('returns to the page\'s own viewport and colour scheme after a test', () => {
    expect([innerWidth, innerHeight]).toEqual([1280, 800]);
    expect(matchMedia('(prefers-color-scheme: dark)').matches).toBe(true);
});

it('gives the page rules to an open shadow root', () => {
    const block = createBlock('');
    const shadow = block.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<style>p { font-family: Arial }</style><p>Text</p>';
    document.body.append(block);
    try {
        adoptHtmlRules(block);
        expect(getComputedStyle(shadow.querySelector('p') as Element).fontFamily).toContain('Visual Blank');
    }
    finally {
        block.remove();
    }
});

it('brings animations to rest', async () => {
    const block = createBlock('<div style="width:10px;height:10px"></div>');
    document.body.append(block);
    try {
        const box = block.firstElementChild as HTMLElement;
        const spin = box.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: 700, iterations: Infinity });
        const fade = box.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 5000, fill: 'forwards' });
        await settleAnimations(block);
        expect(spin.playState).toBe('idle');
        expect(fade.playState).toBe('finished');
        expect(getComputedStyle(box).opacity).toBe('1');
    }
    finally {
        block.remove();
    }
});
