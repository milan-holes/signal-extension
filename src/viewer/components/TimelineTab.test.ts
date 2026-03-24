import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import TimelineTab from './TimelineTab.vue';

describe('TimelineTab.vue', () => {
    it('renders empty states', () => {
        const wrapper = mount(TimelineTab, { props: { data: {}, isEditorMode: false } });
        expect(wrapper.text()).toContain('No screencast frames');
        expect(wrapper.text()).toContain('No user events recorded');
    });

    it('renders correctly with data', async () => {
        const data = {
            screencast: [{ data: 'abcd', wallTime: 100 }],
            userEvents: [{ type: 'click', timestamp: 100, target: { tagName: 'BUTTON' } }]
        };

        const wrapper = mount(TimelineTab, { props: { data, isEditorMode: false } });

        // Check elements
        expect(wrapper.find('img').exists()).toBe(true); // screencast
        expect(wrapper.find('tbody').text()).toContain('USER');

        // Select event to show detail
        await wrapper.find('tbody tr').trigger('click');
        expect(wrapper.find('.timeline-detail-panel').exists()).toBe(true);
    });

    it('renders different event types', () => {
        const data = {
            userEvents: [
                { type: 'click', timestamp: 100, target: { tagName: 'BUTTON', id: 'submit', innerText: 'Submit' } },
                { type: 'input', timestamp: 200, value: 'hello', target: { tagName: 'INPUT', id: 'name' } },
                { type: 'keydown', timestamp: 300, key: 'Enter', target: { tagName: 'INPUT' } },
                { type: 'navigation', timestamp: 400, url: 'https://example.com/page' }
            ]
        };
        const wrapper = mount(TimelineTab, { props: { data, isEditorMode: false } });
        const rows = wrapper.findAll('tbody tr');
        expect(rows.length).toBe(4);
        expect(wrapper.text()).toContain('BUTTON');
        expect(wrapper.text()).toContain('hello');
        expect(wrapper.text()).toContain('Enter');
        expect(wrapper.text()).toContain('example.com');
    });

    it('handles playback controls', async () => {
        const data = {
            screencast: [
                { data: 'frame1', wallTime: 100 },
                { data: 'frame2', wallTime: 200 },
                { data: 'frame3', wallTime: 300 }
            ],
            userEvents: []
        };
        const wrapper = mount(TimelineTab, { props: { data, isEditorMode: false } });
        
        expect(wrapper.find('img').exists()).toBe(true);
        expect(wrapper.find('.scrubber').exists()).toBe(true);
        
        // Test play button
        const playBtn = wrapper.find('.ctrl-btn');
        await playBtn.trigger('click');
        // Stop immediately
        await playBtn.trigger('click');
    });

    it('switches detail sub-tabs', async () => {
        const data = {
            userEvents: [{ type: 'click', timestamp: 1704067200100, target: { tagName: 'DIV' } }],
            consoleErrors: [{ level: 'error', text: 'Console err', timestamp: 1704067200000 }],
            har: { log: { entries: [{ startedDateTime: '2024-01-01T00:00:00Z', request: { method: 'GET', url: 'https://api.test/data' }, response: { status: 200 } }] } }
        };
        const wrapper = mount(TimelineTab, { props: { data, isEditorMode: false } });
        
        // Detail panel auto-opens for first event via watcher
        await wrapper.vm.$nextTick();
        
        const detailTabs = wrapper.findAll('.timeline-tab');
        await detailTabs[1].trigger('click'); // Console sub-tab
        expect(wrapper.text()).toContain('Console err');
        
        await detailTabs[2].trigger('click'); // Network sub-tab
        expect(wrapper.text()).toContain('data');
    });

    it('closes detail panel', async () => {
        const data = {
            userEvents: [{ type: 'click', timestamp: 100, target: { tagName: 'BUTTON' } }]
        };
        const wrapper = mount(TimelineTab, { props: { data, isEditorMode: false } });
        await wrapper.vm.$nextTick();

        expect(wrapper.find('.timeline-detail-panel').exists()).toBe(true);
        await wrapper.find('.close-icon').trigger('click');
        expect(wrapper.find('.timeline-detail-panel').exists()).toBe(false);
    });

    it('shows issue event details', async () => {
        const data = {
            userEvents: [],
            issues: [{ type: 'screenshot', timestamp: 100, comment: 'Bug on this page' }]
        };
        const wrapper = mount(TimelineTab, { props: { data, isEditorMode: false } });
        expect(wrapper.text()).toContain('ISSUE');
        expect(wrapper.text()).toContain('Bug on this page');
    });

    it('shows editor mode delete buttons', async () => {
        const data = {
            userEvents: [{ type: 'click', timestamp: 100, target: { tagName: 'BUTTON' } }]
        };
        const wrapper = mount(TimelineTab, { props: { data, isEditorMode: true } });
        expect(wrapper.find('.delete-btn').exists()).toBe(true);
    });

    it('navigates scrubber to a frame', async () => {
        const data = {
            screencast: [
                { data: 'frame1', wallTime: 100 },
                { data: 'frame2', wallTime: 200 },
                { data: 'frame3', wallTime: 300 },
                { data: 'frame4', wallTime: 400 },
                { data: 'frame5', wallTime: 500 },
            ],
            userEvents: []
        };
        const wrapper = mount(TimelineTab, { props: { data, isEditorMode: false } });
        
        const scrubber = wrapper.find('.scrubber input[type="range"]');
        if (scrubber.exists()) {
            await scrubber.setValue('3');
        }
    });

    it('renders scroll events', () => {
        const data = {
            userEvents: [
                { type: 'scroll', timestamp: 100, scrollX: 0, scrollY: 500, url: 'https://example.com' }
            ]
        };
        const wrapper = mount(TimelineTab, { props: { data, isEditorMode: false } });
        expect(wrapper.text()).toContain('scroll');
    });


    it('shows event detail with target info', async () => {
        const data = {
            userEvents: [{
                type: 'click',
                timestamp: 100,
                target: {
                    tagName: 'BUTTON',
                    id: 'submitBtn',
                    innerText: 'Submit',
                    xpath: '/html/body/form/button',
                    selectors: ['#submitBtn', '.submit-button']
                }
            }]
        };
        const wrapper = mount(TimelineTab, { props: { data, isEditorMode: false } });
        await wrapper.find('tbody tr').trigger('click');
        const detail = wrapper.find('.timeline-detail-panel');
        expect(detail.exists()).toBe(true);
        expect(detail.text()).toContain('submitBtn');
    });


    it('renders multiple frame indicators on scrubber', () => {
        const frames = [];
        for (let i = 0; i < 10; i++) {
            frames.push({ data: `frame${i}`, wallTime: 100 * i });
        }
        const data = { screencast: frames, userEvents: [] };
        const wrapper = mount(TimelineTab, { props: { data, isEditorMode: false } });
        expect(wrapper.findAll('img').length).toBeGreaterThan(0);
    });
});
