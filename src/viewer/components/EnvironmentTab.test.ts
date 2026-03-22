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

    it('can toggle comparison mode', async () => {
        const environment = { userAgent: 'Chrome120', url: 'http://test' };
        const wrapper = mount(EnvironmentTab, { props: { environment } });

        // Not comparing initially
        expect(wrapper.find('.compare-header').exists()).toBe(false);

        const checkbox = wrapper.find('input[type="checkbox"]');
        await checkbox.setValue(true);

        // Should see comparison header
        expect(wrapper.find('.compare-header').exists()).toBe(true);
        // Should see the text "Recorded" and "Current (You)"
        expect(wrapper.text()).toContain('Recorded');
        expect(wrapper.text()).toContain('Current (You)');
    });
});
