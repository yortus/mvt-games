// The printed book's page breaks: a Paged.js handler, which print-book.ts
// loads into the document before laying it out. It runs in the browser, so
// it is plain JavaScript.
//
// Paged.js lays a page out as columns of the page's size: whatever doesn't
// fit flows into a second column, past the page's end, and Paged.js breaks
// the page where that begins. It can miss some of it, and break below lines
// that are already in the second column, which would lose them. It measures
// the page once, so when a footnote takes room at the foot, it can miss the
// lines pushed past the page entirely. When a page changes size after it's
// laid out, Paged.js checks it again, but without the page's measurements,
// and finds the whole page overflowing. And it keeps
// a heading with what follows only when that falls wholly onto the next
// page, so a heading could end a page with one line of its section under it,
// and a paragraph could leave one line behind or carry one line over. This
// handler moves each break back until the page ends well:
//
// - Nothing that doesn't fit the page comes before the break.
// - A heading keeps at least two lines of what follows it, and so does a
//   paragraph that ends with a colon, which introduces what follows.
// - A paragraph or list item leaves at least two lines on the page (no
//   orphans) and carries at least two on to the next (no widows). A block of
//   code does the same with its lines.
// - A break never moves back to the top of the page, which would leave the
//   page empty. There, the first rule that can't be kept is given up.

/* global window, document, Node, NodeFilter */

(() => {
    /** The fewest lines of a paragraph, or of code, on either side of a break. */
    const MIN_LINES = 2;

    /** How many times a break may move back, as each move can expose another rule. */
    const MAX_MOVES = 8;

    /** A box that flows as one piece, whose lines the rules count. */
    const BLOCK = 'p, li, dd, dt, h1, h2, h3, h4, h5, .code, figure, .mermaid, .table, blockquote, .custom-block, header';

    /** A block of running text, which may break between its lines. */
    const TEXT_BLOCK = 'p, li, dd, dt';

    const HEADING = 'h1, h2, h3, h4, h5';

    class BookBreaks extends window.Paged.Handler {
        onOverflow(overflow, rendered, measured) {
            pageContent = rendered;
            const isRecheck = typeof measured?.bottom !== 'number';
            const bounds = pageBounds(rendered, measured);
            const hidden = firstHiddenText(rendered, bounds);
            // Paged.js's own finding is meaningless without the measurements:
            // only text past the page counts, and with none, nothing breaks
            // eslint-disable-next-line @mvtjs/no-null -- Paged.js takes null to mean there is no overflow
            if (isRecheck && hidden === undefined) return null;
            if (isRecheck) overflow = undefined;
            if (overflow === undefined || overflow === null) {
                // Paged.js saw nothing past the page, but a footnote may have
                // pushed some there since it measured
                if (hidden === undefined) return undefined;
                overflow = document.createRange();
                overflow.setStart(hidden.container, hidden.offset);
                overflow.setEndAfter(rendered.lastChild);
            }
            let start = { container: overflow.startContainer, offset: overflow.startOffset };
            let moved = false;
            if (hidden !== undefined && isBefore(hidden, start)) {
                start = hidden;
                moved = true;
            }
            const whole = beforeWholeBlock(start);
            if (whole !== undefined) {
                start = whole;
                moved = true;
            }
            for (let i = 0; i < MAX_MOVES; i++) {
                const better = improveBreak(start, rendered, bounds);
                if (better === undefined) break;
                start = better;
                moved = true;
            }
            if (!moved) return overflow;
            const range = document.createRange();
            range.setStart(start.container, start.offset);
            range.setEnd(overflow.endContainer, overflow.endOffset);
            return range;
        }
    }

    window.Paged.registerHandlers(BookBreaks);

    /** Returns an earlier place to break, if the break at `start` breaks a rule and an earlier one can keep it. */
    function improveBreak(start, rendered, bounds) {
        const element = elementAt(start);
        if (element === undefined || !rendered.contains(element)) return undefined;

        // A break inside a block of text, or of code, between its lines
        const textBlock = element.closest(TEXT_BLOCK);
        const code = element.closest('.code');
        const block = textBlock ?? code;
        if (block !== null && !startsBlock(start, block)) {
            const isCode = code !== null && textBlock === null;
            const lines = isCode ? codeLines(code, bounds) : textLines(block, bounds);
            const at = placeOf(start, bounds);
            const before = lines.filter((line) => isEarlier(line, at)).length;
            const after = lines.length - before;
            if (before < MIN_LINES) return beforeElement(block);
            if (after < MIN_LINES) {
                const keep = before - (MIN_LINES - after);
                if (keep < MIN_LINES) return beforeElement(block);
                return isCode ? beforeElement(lines[keep].element) : lineStart(block, lines[keep], bounds);
            }
            return undefined;
        }

        // A break before a whole block: what comes before it may need to
        // come over with it
        const next = element.closest(BLOCK) ?? element;
        // A break inside a table, or another block, between its rows: left as it is
        if (next !== element && !startsBlock(start, next)) return undefined;
        const previous = previousBlock(next, rendered);
        if (previous === undefined) return undefined;
        if (previous.matches(HEADING)) return beforeElement(previous);
        if (previous.matches('p') && previous.textContent.trim().endsWith(':')) {
            const lines = textLines(previous, bounds);
            if (lines.length <= MIN_LINES * 2) return beforeElement(previous);
            return lineStart(previous, lines[lines.length - MIN_LINES], bounds);
        }
        return undefined;
    }

    /** The first text, in reading order, that doesn't fit the page: below it, or in a column past its end. */
    function firstHiddenText(rendered, bounds) {
        const walker = document.createTreeWalker(rendered, NodeFilter.SHOW_TEXT);
        const range = document.createRange();
        for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
            const text = node.textContent ?? '';
            // A table's header row is drawn again at the top of each column
            // the table runs into, but it isn't carried over
            if (text.trim() === '' || node.parentElement?.closest('svg, thead') !== null) continue;
            range.selectNodeContents(node);
            if (![...range.getClientRects()].some((rect) => rect.height > 0 && !fits(rect, bounds))) continue;
            for (let i = 0; i < text.length; i++) {
                if (text[i].trim() === '') continue;
                range.setStart(node, i);
                range.setEnd(node, i + 1);
                // Each of its boxes: a letter after a hyphen at a line's end
                // has one there too, and their union would look as if it fits
                if ([...range.getClientRects()].some((rect) => rect.height > 0 && !fits(rect, bounds))) return { container: node, offset: i };
            }
        }
        return undefined;
    }

    /**
     * Where to break instead, when the break is in a block that breaks only
     * between its parts: in a table, before the first row it cuts, keeping
     * at least two rows on each side, or else before the table; before a line
     * of code; before a heading, figure or callout as a whole. Undefined for
     * running text.
     */
    function beforeWholeBlock(start) {
        const element = elementAt(start);
        if (element === undefined) return undefined;
        const table = element.closest('.table');
        if (table !== null) {
            const rows = [...table.querySelectorAll('.table-row:not(.table-head)')];
            // The rows wholly before the break
            const fit = rows.filter((row) => !isBefore(start, after(row))).length;
            if (fit >= rows.length) return undefined;
            let kept = fit;
            const carried = rows.length - kept;
            if (carried < MIN_LINES) kept = Math.max(kept - (MIN_LINES - carried), 0);
            if (kept < MIN_LINES) {
                const whole = beforeElement(table);
                if (whole !== undefined) return whole;
                // The table starts the page, so as many rows as fit stay
                kept = Math.max(fit, 1);
            }
            return beforeElement(rows[kept]);
        }
        const line = element.closest('.code .line');
        if (line !== null) return beforeElement(line);
        const whole = element.closest(`${HEADING}, figure, .mermaid, .custom-block, header, .code`);
        return whole === null ? undefined : beforeElement(whole);
    }

    /** The page's area as it is now, which a footnote may have made shorter than Paged.js measured it. */
    function pageBounds(rendered, measured) {
        const area = rendered.closest('.pagedjs_page_content')?.getBoundingClientRect();
        if (typeof measured?.bottom !== 'number') return area;
        const bottom = area === undefined ? measured.bottom : Math.min(measured.bottom, area.bottom);
        return { left: measured.left, right: measured.right, top: measured.top, bottom, width: measured.width };
    }

    /** Whether a box is on the page: in its first column, and above its foot. */
    function fits(rect, bounds) {
        return rect.left < bounds.right - 1 && rect.bottom <= bounds.bottom + 1;
    }

    /** The place just after a node. */
    function after(node) {
        const parent = node.parentNode;
        return { container: parent, offset: Array.prototype.indexOf.call(parent.childNodes, node) + 1 };
    }

    /** Whether place `a` comes before place `b` in the document. */
    function isBefore(a, b) {
        const range = document.createRange();
        range.setStart(a.container, a.offset);
        return range.comparePoint(b.container, b.offset) > 0;
    }

    /** The element the break is in, or the one it comes before. */
    function elementAt({ container, offset }) {
        if (container.nodeType === Node.TEXT_NODE) return container.parentElement ?? undefined;
        const child = container.childNodes[offset];
        if (child === undefined) return container;
        return child.nodeType === Node.ELEMENT_NODE ? child : (child.parentElement ?? undefined);
    }

    /** Whether nothing of the block comes before the break. */
    function startsBlock({ container, offset }, block) {
        const range = document.createRange();
        range.setStart(block, 0);
        range.setEnd(container, offset);
        return range.toString().trim() === '';
    }

    /** The page being broken: what Paged.js has laid out on it. */
    let pageContent;

    /** The break just before an element, unless nothing comes before it on the page, which would leave the page empty. */
    function beforeElement(element) {
        const range = document.createRange();
        range.setStart(pageContent, 0);
        range.setEndBefore(element);
        if (range.toString().trim() === '' && range.cloneContents().querySelector('img, svg, table, hr') === null) return undefined;
        const parent = element.parentNode;
        return { container: parent, offset: Array.prototype.indexOf.call(parent.childNodes, element) };
    }

    /** The block before this one, stepping out of the boxes it's first in, such as a list. */
    function previousBlock(block, rendered) {
        let node = block;
        while (node !== rendered && node.previousElementSibling === null) {
            node = node.parentElement;
            if (node === null || node.matches('section, .pagedjs_page_content')) return undefined;
        }
        if (node === rendered) return undefined;
        return node.previousElementSibling;
    }

    /** Which column of the page's layout a box is in: 0 on the page, 1 or more past its end. */
    function columnOf(rect, bounds) {
        return Math.max(0, Math.floor((rect.left - bounds.left + 1) / bounds.width));
    }

    /** A place on the layout, as a column and a height, for reading order. */
    function placeOfRect(rect, bounds) {
        return { column: columnOf(rect, bounds), top: rect.top };
    }

    /** Whether a line starts before a place, in reading order. */
    function isEarlier(line, place) {
        return line.column < place.column || (line.column === place.column && line.top < place.top - 1);
    }

    /** Each line of a block of text, in reading order, by where it starts. */
    function textLines(block, bounds) {
        const range = document.createRange();
        range.selectNodeContents(block);
        const rects = [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0);
        const places = rects.map((rect) => ({ ...placeOfRect(rect, bounds), bottom: rect.bottom }));
        places.sort((a, b) => a.column - b.column || a.top - b.top);
        const lines = [];
        for (const place of places) {
            const last = lines.at(-1);
            if (last !== undefined && last.column === place.column && place.top < last.bottom - 2) last.bottom = Math.max(last.bottom, place.bottom);
            else lines.push({ ...place });
        }
        return lines;
    }

    /** Each line of a block of code, which print-book.ts makes a block of its own, in reading order. */
    function codeLines(code, bounds) {
        return [...code.querySelectorAll('.line')].map((element) => ({ element, ...placeOfRect(element.getBoundingClientRect(), bounds) }));
    }

    /** Where a block's text is, at the start of a line. */
    function lineStart(block, line, bounds) {
        const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
        const range = document.createRange();
        for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
            const text = node.textContent ?? '';
            for (let i = 0; i < text.length; i++) {
                if (text[i].trim() === '') continue;
                range.setStart(node, i);
                range.setEnd(node, i + 1);
                const rect = glyphOf(range);
                if (rect !== undefined && !isEarlier(placeOfRect(rect, bounds), line)) return { container: node, offset: i };
            }
        }
        return undefined;
    }

    /** The box of a range's one letter: its last, since a letter after a hyphen at a line's end has one at the hyphen too. */
    function glyphOf(range) {
        const rects = [...range.getClientRects()].filter((rect) => rect.height > 0);
        return rects.at(-1);
    }

    /** Where the break is on the layout. */
    function placeOf({ container, offset }, bounds) {
        if (container.nodeType === Node.TEXT_NODE) {
            const range = document.createRange();
            const text = container.textContent ?? '';
            // The first visible character from the break, since a space at a line's start has no box
            let i = offset;
            while (i < text.length && text[i].trim() === '') i++;
            range.setStart(container, Math.min(i, text.length));
            range.setEnd(container, Math.min(i + 1, text.length));
            const rect = glyphOf(range);
            if (rect !== undefined) return placeOfRect(rect, bounds);
            return placeOfRect(container.parentElement.getBoundingClientRect(), bounds);
        }
        const child = container.childNodes[offset];
        const element = child?.nodeType === Node.ELEMENT_NODE ? child : container;
        return placeOfRect(element.getBoundingClientRect(), bounds);
    }
})();
