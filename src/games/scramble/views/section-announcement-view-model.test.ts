import { describe, it, expect } from 'vitest';
import { createSectionAnnouncementViewModel } from './section-announcement-view-model';

describe('SectionAnnouncementViewModel', () => {
    it('starts invisible', () => {
        const vm = createSectionAnnouncementViewModel({ getSectionIndex: () => -1 });
        expect(vm.isVisible).toBe(false);
        expect(vm.alpha).toBe(0);
        expect(vm.text).toBe('');
    });

    it('becomes visible when section index changes', () => {
        let sectionIndex = -1;
        const vm = createSectionAnnouncementViewModel({ getSectionIndex: () => sectionIndex });
        sectionIndex = 0;
        vm.update(0);
        expect(vm.isVisible).toBe(true);
        expect(vm.alpha).toBe(1);
        expect(vm.text).toBe('SECTION 1 - MOUNTAINS');
    });

    it('shows correct section name for each index', () => {
        let sectionIndex = -1;
        const vm = createSectionAnnouncementViewModel({ getSectionIndex: () => sectionIndex });
        sectionIndex = 1;
        vm.update(0);
        expect(vm.text).toBe('SECTION 2 - CAVES');
    });

    it('stays fully opaque during display period', () => {
        let sectionIndex = -1;
        const vm = createSectionAnnouncementViewModel({ getSectionIndex: () => sectionIndex });
        sectionIndex = 0;
        vm.update(0);
        vm.update(1000); // halfway through 2000ms display
        expect(vm.isVisible).toBe(true);
        expect(vm.alpha).toBe(1);
    });

    it('fades out after display period', () => {
        let sectionIndex = -1;
        const vm = createSectionAnnouncementViewModel({ getSectionIndex: () => sectionIndex });
        sectionIndex = 0;
        vm.update(0);
        vm.update(2250); // 250ms into 500ms fade
        expect(vm.isVisible).toBe(true);
        expect(vm.alpha).toBeCloseTo(0.5, 1);
    });

    it('becomes invisible after total duration', () => {
        let sectionIndex = -1;
        const vm = createSectionAnnouncementViewModel({ getSectionIndex: () => sectionIndex });
        sectionIndex = 0;
        vm.update(0);
        vm.update(2600); // past 2500ms total
        expect(vm.isVisible).toBe(false);
        expect(vm.text).toBe('');
    });

    it('can be re-triggered with a different section', () => {
        let sectionIndex = -1;
        const vm = createSectionAnnouncementViewModel({ getSectionIndex: () => sectionIndex });
        sectionIndex = 0;
        vm.update(0);
        vm.update(2600);
        expect(vm.isVisible).toBe(false);

        sectionIndex = 2;
        vm.update(0);
        expect(vm.isVisible).toBe(true);
        expect(vm.text).toBe('SECTION 3 - BASE');
    });
});
