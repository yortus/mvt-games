import { describe, expect, it } from 'vitest';
import { createLayoutModel, DEFAULT_SIZES } from './layout-model';

describe('a layout model', () => {
    it('starts at the default sizes, showing the code', () => {
        const layout = createLayoutModel();
        expect(layout.filesWidth).toBe(DEFAULT_SIZES.filesWidth);
        expect(layout.runWidth).toBe(DEFAULT_SIZES.runWidth);
        expect(layout.consoleHeight).toBe(DEFAULT_SIZES.consoleHeight);
        expect(layout.narrowPanel).toBe('code');
        expect(layout.runPaneTab).toBe('console');
    });

    it('starts at saved sizes, brought inside their limits', () => {
        const layout = createLayoutModel({ saved: { filesWidth: 300, runWidth: 99999, isFilesFolded: true } });
        expect(layout.filesWidth).toBe(300);
        expect(layout.runWidth).toBeLessThan(99999);
        expect(layout.consoleHeight).toBe(DEFAULT_SIZES.consoleHeight);
        expect(layout.isFilesFolded).toBe(true);
    });

    it('resizes each pane the way its divider moves, within limits', () => {
        const layout = createLayoutModel();
        layout.resizeFiles(20);
        expect(layout.filesWidth).toBe(DEFAULT_SIZES.filesWidth + 20);
        // The run pane is right of its divider, so it grows as the divider moves left
        layout.resizeRun(-20);
        expect(layout.runWidth).toBe(DEFAULT_SIZES.runWidth + 20);
        // The console is below its divider, so it grows as the divider moves up
        layout.resizeConsole(-20);
        expect(layout.consoleHeight).toBe(DEFAULT_SIZES.consoleHeight + 20);
        layout.resizeFiles(-10000);
        const smallest = layout.filesWidth;
        layout.resizeFiles(-1);
        expect(layout.filesWidth).toBe(smallest);
    });

    it('matches a file by its name first, then by letters in order', () => {
        const layout = createLayoutModel();
        layout.openQuickOpen(['main.ts', 'models/ball-model.ts', 'models/index.ts', 'views/ball-view.ts']);
        expect(layout.isQuickOpenOpen).toBe(true);
        expect(layout.quickOpenMatches).toHaveLength(4);
        layout.setQuickOpenQuery('ball');
        expect(layout.quickOpenMatches).toEqual(['models/ball-model.ts', 'views/ball-view.ts']);
        layout.setQuickOpenQuery('mbm');
        expect(layout.quickOpenMatches).toEqual(['models/ball-model.ts']);
        layout.setQuickOpenQuery('zzz');
        expect(layout.quickOpenMatches).toEqual([]);
        layout.closeQuickOpen();
        expect(layout.isQuickOpenOpen).toBe(false);
    });

    it('opens one dialog at a time: Projects, Project options, Help, or opening a file by name', () => {
        const layout = createLayoutModel({});
        layout.openQuickOpen(['main.ts']);
        layout.openProjects();
        expect(layout.isProjectsOpen).toBe(true);
        expect(layout.isQuickOpenOpen).toBe(false);
        layout.openQuickOpen(['main.ts']);
        expect(layout.isProjectsOpen).toBe(false);
        layout.closeQuickOpen();
        layout.openProjects();
        layout.closeProjects();
        expect(layout.isProjectsOpen).toBe(false);
        layout.openProjectOptions();
        expect(layout.isProjectOptionsOpen).toBe(true);
        layout.openProjects();
        expect(layout.isProjectOptionsOpen).toBe(false);
        layout.openProjectOptions();
        layout.closeProjectOptions();
        expect(layout.isProjectOptionsOpen).toBe(false);
        layout.openHelp();
        expect(layout.isHelpOpen).toBe(true);
        layout.openProjects();
        expect(layout.isHelpOpen).toBe(false);
        layout.openHelp();
        layout.closeHelp();
        expect(layout.isHelpOpen).toBe(false);
    });

    it('folds a folder in the file list, and unfolds it, as a new set each time', () => {
        const layout = createLayoutModel({});
        const before = layout.foldedFolders;
        layout.toggleFolder('models');
        expect(layout.foldedFolders.has('models')).toBe(true);
        expect(layout.foldedFolders).not.toBe(before);
        layout.toggleFolder('models');
        expect(layout.foldedFolders.has('models')).toBe(false);
    });
});
