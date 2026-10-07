// Spike: each unstyled form control with text on its own, to find which one each system draws differently.
import { describe } from 'vitest';
import { visualHtmlTest } from '../harness';

function control(html: string): () => HTMLElement {
    return () => {
        const root = document.createElement('div');
        root.style.cssText = 'padding:8px;color:#e6edf3;';
        root.innerHTML = html;
        return root;
    };
}

describe('controls', () => {
    visualHtmlTest('button', control('<button>Default button</button>'));
    visualHtmlTest('button disabled', control('<button disabled>Disabled</button>'));
    visualHtmlTest('text input', control('<input type="text" value="Some text">'));
    visualHtmlTest('search with placeholder', control('<input type="search" placeholder="Search games">'));
    visualHtmlTest('select', control('<select><option>Option one</option></select>'));
    visualHtmlTest('textarea', control('<textarea rows="2" cols="16">Two lines\nof text</textarea>'));
    visualHtmlTest('number input', control('<input type="number" value="42">'));
    visualHtmlTest('styled button', control('<button style="font:inherit;padding:6px 14px;border:1px solid #30363d;border-radius:6px;background:#21262d;color:#c9d1d9">Styled</button>'));
});
