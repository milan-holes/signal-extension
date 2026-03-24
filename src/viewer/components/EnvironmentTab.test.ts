import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import EnvironmentTab from './EnvironmentTab.vue';

describe('EnvironmentTab.vue', () => {
    it('renders empty state if no environment provided', () => {
        const wrapper = mount(EnvironmentTab, { props: { environment: null } });
        expect(wrapper.text()).toContain('No environment data available');
    });

    it('renders environment cards when provided', () => {
        const environment = { userAgent: 'Chrome', platform: 'Win32' };
        const wrapper = mount(EnvironmentTab, { props: { environment } });

        expect(wrapper.text()).not.toContain('No environment data available');
        expect(wrapper.text()).toContain('Browser');
        expect(wrapper.text()).toContain('Display');
        expect(wrapper.text()).toContain('Chrome');
    });

    it('always shows comparison headers for browser/display/hardware cards', () => {
        const environment = { userAgent: 'Chrome120', url: 'http://test' };
        const wrapper = mount(EnvironmentTab, { props: { environment } });

        // Comparison is always on — no toggle checkbox
        expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false);
        expect(wrapper.find('.compare-header').exists()).toBe(true);
        expect(wrapper.text()).toContain('Recorded');
        expect(wrapper.text()).toContain('Current (You)');
    });

    it('displays Info card with creation date, url, and timezone merged', () => {
        const environment = {
            userAgent: 'Chrome',
            platform: 'Win32',
            generatedAt: '2024-03-15T10:30:45.000Z',
            url: 'https://example.com',
            timezone: 'America/New_York',
        };
        const wrapper = mount(EnvironmentTab, { props: { environment } });

        expect(wrapper.text()).toContain('Info');
        expect(wrapper.text()).toContain('Created At');
        expect(wrapper.text()).toContain('URL');
        expect(wrapper.text()).toContain('Timezone');
        // Date is formatted
        expect(wrapper.text()).toContain('Mar');
        expect(wrapper.text()).toContain('2024');
        // Old separate cards are gone
        expect(wrapper.text()).not.toContain('Recording Info');
        expect(wrapper.text()).not.toContain('Page');
    });

    it('does not show Info card when no info fields are present', () => {
        const environment = { userAgent: 'Chrome', platform: 'Win32' };
        const wrapper = mount(EnvironmentTab, { props: { environment } });

        expect(wrapper.text()).not.toContain('Created At');
    });

    it('Info card does not show comparison columns', () => {
        const environment = {
            userAgent: 'Chrome',
            generatedAt: '2024-03-15T10:30:45.000Z',
            url: 'https://example.com',
        };
        const wrapper = mount(EnvironmentTab, { props: { environment } });

        // The Info card (.env-card:first-child) should have no compare-header
        const cards = wrapper.findAll('.env-card');
        const infoCard = cards[0];
        expect(infoCard.find('.compare-header').exists()).toBe(false);
        expect(infoCard.find('.env-values').exists()).toBe(false);
    });
});
