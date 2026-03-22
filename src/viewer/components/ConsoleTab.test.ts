import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ConsoleTab from './ConsoleTab.vue';

describe('ConsoleTab.vue', () => {
    it('renders an empty state when no errors are provided', () => {
        const wrapper = mount(ConsoleTab, { props: { errors: [] } });
        expect(wrapper.text()).toContain('No console errors match filter');
    });

    it('renders error list and details correctly', async () => {
        const errors = [
            { level: 'error', source: 'test', text: 'Boom', timestamp: 1600000000, count: 1 }
        ];
        const wrapper = mount(ConsoleTab, { props: { errors } });

        // Should see text Boom in the table body
        expect(wrapper.find('tbody').text()).toContain('Boom');
        expect(wrapper.find('tbody').text()).toContain('ERROR');

        // Select the row
        await wrapper.find('tbody tr').trigger('click');

        // Details panel should show
        expect(wrapper.find('.detail-panel').exists()).toBe(true);
        expect(wrapper.find('.detail-panel').text()).toContain('Console ERROR');
        expect(wrapper.find('.detail-panel').text()).toContain('Boom');
    });

    it('filters by level', async () => {
        const errors = [
            { level: 'error', source: 'a', text: 'Err1', timestamp: 1 },
            { level: 'warning', source: 'a', text: 'Warn1', timestamp: 2 },
            { level: 'log', source: 'a', text: 'Log1', timestamp: 3 }
        ];
        const wrapper = mount(ConsoleTab, { props: { errors } });
        
        // Click 'error' filter chip
        const chips = wrapper.findAll('.filter-chip');
        await chips[1].trigger('click'); // error
        expect(wrapper.find('tbody').text()).toContain('Err1');
        expect(wrapper.find('tbody').text()).not.toContain('Warn1');
        expect(wrapper.find('tbody').text()).not.toContain('Log1');
        
        // Click 'warning' filter chip
        await chips[2].trigger('click');
        expect(wrapper.find('tbody').text()).toContain('Warn1');
        expect(wrapper.find('tbody').text()).not.toContain('Err1');
        
        // Click 'All' filter chip
        await chips[0].trigger('click');
        expect(wrapper.find('tbody').text()).toContain('Err1');
        expect(wrapper.find('tbody').text()).toContain('Warn1');
    });

    it('searches messages', async () => {
        const errors = [
            { level: 'error', text: 'Cannot read property', timestamp: 1 },
            { level: 'error', text: 'Network timeout', timestamp: 2 }
        ];
        const wrapper = mount(ConsoleTab, { props: { errors } });
        
        const searchInput = wrapper.find('.search-input');
        await searchInput.setValue('Network');
        expect(wrapper.find('tbody').text()).toContain('Network timeout');
        expect(wrapper.find('tbody').text()).not.toContain('Cannot read');
    });

    it('sorts by column', async () => {
        const errors = [
            { level: 'error', text: 'Alpha', timestamp: 2 },
            { level: 'warning', text: 'Beta', timestamp: 1 }
        ];
        const wrapper = mount(ConsoleTab, { props: { errors } });
        
        // Sort by level
        const headers = wrapper.findAll('.sortable');
        await headers[1].trigger('click'); // level column
        const rows = wrapper.findAll('tbody tr');
        expect(rows.length).toBe(2);
    });

    it('renders stack trace when available', async () => {
        const errors = [
            { level: 'error', text: 'Error!', timestamp: 1, stackTrace: { callFrames: [{ functionName: 'doStuff', url: 'app.js', lineNumber: 42, columnNumber: 10 }] } }
        ];
        const wrapper = mount(ConsoleTab, { props: { errors } });
        await wrapper.find('tbody tr').trigger('click');
        expect(wrapper.find('.detail-panel').text()).toContain('Stack Trace');
        expect(wrapper.find('.detail-panel').text()).toContain('doStuff');
    });

    it('groups identical consecutive errors', () => {
        const errors = [
            { level: 'error', source: 'console', text: 'Same error', timestamp: 1 },
            { level: 'error', source: 'console', text: 'Same error', timestamp: 2 },
            { level: 'error', source: 'console', text: 'Same error', timestamp: 3 }
        ];
        const wrapper = mount(ConsoleTab, { props: { errors } });
        const rows = wrapper.findAll('tbody tr');
        expect(rows.length).toBe(1); // grouped
        expect(wrapper.find('.count-badge').text()).toBe('3');
    });

    it('closes detail panel', async () => {
        const errors = [{ level: 'error', text: 'Boom', timestamp: 1 }];
        const wrapper = mount(ConsoleTab, { props: { errors } });
        await wrapper.find('tbody tr').trigger('click');
        expect(wrapper.find('.detail-panel').exists()).toBe(true);
        await wrapper.find('.close-btn').trigger('click');
        expect(wrapper.find('.detail-panel').exists()).toBe(false);
    });
});
