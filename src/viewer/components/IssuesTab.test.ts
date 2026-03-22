import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import IssuesTab from './IssuesTab.vue';

describe('IssuesTab.vue', () => {
    it('renders empty state', () => {
        const wrapper = mount(IssuesTab, { props: { issues: [], screencast: [], events: [] } });
        expect(wrapper.text()).toContain('No issues reported.');
    });

    it('renders issues list', () => {
        const issues = [
            { type: 'error', timestamp: 1600000000, description: 'Test error description' }
        ];
        const wrapper = mount(IssuesTab, { props: { issues, screencast: [], events: [] } });

        expect(wrapper.text()).not.toContain('No issues reported.');
        expect(wrapper.text()).toContain('error');
        expect(wrapper.text()).toContain('Test error description');
    });

    it('renders issue with closest screencast frame', () => {
        const issues = [{ type: 'error', timestamp: 500, comment: 'Bug here' }];
        const screencast = [
            { data: 'frameA', wallTime: 100 },
            { data: 'frameB', wallTime: 490 },
            { data: 'frameC', wallTime: 800 }
        ];
        const wrapper = mount(IssuesTab, { props: { issues, screencast, events: [] } });
        const img = wrapper.find('.issue-screenshot');
        expect(img.exists()).toBe(true);
        expect(img.attributes('src')).toContain('frameB');
    });

    it('renders highlight box with rect and environment', () => {
        const issues = [{ type: 'error', timestamp: 100, comment: 'X', rect: { x: 50, y: 50, width: 100, height: 100 } }];
        const screencast = [{ data: 'img', wallTime: 100 }];
        const environment = { windowSize: { width: 1000, height: 1000 } };
        const wrapper = mount(IssuesTab, { props: { issues, screencast, events: [], environment } });
        expect(wrapper.find('.issue-highlight-box').exists()).toBe(true);
    });

    it('shows no-screenshot message when no screencast', () => {
        const issues = [{ type: 'warning', timestamp: 100, comment: 'No ss' }];
        const wrapper = mount(IssuesTab, { props: { issues, screencast: [], events: [] } });
        expect(wrapper.text()).toContain('No screenshot available');
    });

    it('classifies severity correctly', () => {
        const issues = [
            { severity: 'critical', timestamp: 1, comment: 'A' },
            { severity: 'warning', timestamp: 2, comment: 'B' },
            { type: 'info', timestamp: 3, comment: 'C' }
        ];
        const wrapper = mount(IssuesTab, { props: { issues, screencast: [], events: [] } });
        const badges = wrapper.findAll('.badge');
        expect(badges[0].classes()).toContain('badge-error');
        expect(badges[1].classes()).toContain('badge-warn');
        expect(badges[2].classes()).toContain('badge-info');
    });
});
