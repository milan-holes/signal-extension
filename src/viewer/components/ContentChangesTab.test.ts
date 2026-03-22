import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ContentChangesTab from './ContentChangesTab.vue';

describe('ContentChangesTab.vue', () => {
    it('renders empty state', () => {
        const wrapper = mount(ContentChangesTab, { props: { changes: [], screencast: [] } });
        expect(wrapper.text()).toContain('No content changes recorded.');
    });

    it('renders changes correctly', () => {
        const changes = [
            { type: 'edit', selector: '#app', timestamp: 1600000000, oldValue: 'a', newValue: 'b' }
        ];
        const wrapper = mount(ContentChangesTab, { props: { changes, screencast: [] } });

        expect(wrapper.text()).not.toContain('No content changes recorded.');
        expect(wrapper.text()).toContain('#app');
        expect(wrapper.text()).toContain('- a');
        expect(wrapper.text()).toContain('+ b');
    });

    it('truncates long text in changes', () => {
        const longString = 'a'.repeat(300);
        const changes = [
            { newValue: longString }
        ];
        const wrapper = mount(ContentChangesTab, { props: { changes, screencast: [] } });
        expect(wrapper.text()).toContain('a'.repeat(200) + '…');
    });
});
