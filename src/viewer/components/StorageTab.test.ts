import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import StorageTab from './StorageTab.vue';

describe('StorageTab.vue', () => {
    it('renders correctly with empty data', () => {
        const wrapper = mount(StorageTab, { props: { storage: null } });
        expect(wrapper.text()).toContain('Local Storage (0)');
        expect(wrapper.text()).toContain('No local storage data');
    });

    it('renders storage tabs and content', async () => {
        const storage = {
            localStorage: { theme: 'dark' },
            sessionStorage: { token: 'xyz' },
            cookies: { session_id: '123' }
        };

        const wrapper = mount(StorageTab, { props: { storage } });

        // Default is Local Storage
        expect(wrapper.text()).toContain('Local Storage (1)');
        expect(wrapper.find('tbody').text()).toContain('theme');
        expect(wrapper.find('tbody').text()).toContain('dark');

        // Switch to Session Storage
        const tabs = wrapper.findAll('.stab');
        await tabs[1].trigger('click');
        expect(wrapper.find('tbody').text()).toContain('token');

        // Switch to Cookies
        await tabs[2].trigger('click');
        expect(wrapper.find('tbody').text()).toContain('session_id');
    });

    it('renders with isEditorMode prop', () => {
        const storage = { localStorage: { key1: 'val1' } };
        const wrapper = mount(StorageTab, { props: { storage, isEditorMode: true } });
        expect(wrapper.text()).toContain('Local Storage');
    });

    it('renders with empty storage objects', () => {
        const storage = { localStorage: {}, sessionStorage: {}, cookies: {} };
        const wrapper = mount(StorageTab, { props: { storage } });
        expect(wrapper.text()).toContain('Local Storage (0)');
    });

    it('handles storage with many entries', () => {
        const localStorage: Record<string, string> = {};
        for (let i = 0; i < 10; i++) localStorage[`key${i}`] = `val${i}`;
        const storage = { localStorage };
        const wrapper = mount(StorageTab, { props: { storage } });
        expect(wrapper.text()).toContain('Local Storage (10)');
    });

    it('shows redact and delete buttons in editor mode', () => {
        const storage = { localStorage: { secret: 'pass123' } };
        const wrapper = mount(StorageTab, { props: { storage, isEditorMode: true } });
        expect(wrapper.find('.edit-action-btn.redact').exists()).toBe(true);
        expect(wrapper.find('.edit-action-btn.delete').exists()).toBe(true);
    });

    it('redacts storage value', async () => {
        const storage = { localStorage: { token: 'abc123' } };
        const wrapper = mount(StorageTab, { props: { storage, isEditorMode: true } });
        
        await wrapper.find('.edit-action-btn.redact').trigger('click');
        expect(wrapper.text()).toContain('[REDACTED]');
    });

    it('deletes storage entry', async () => {
        const storage = { localStorage: { key1: 'val1', key2: 'val2' } };
        const wrapper = mount(StorageTab, { props: { storage, isEditorMode: true } });
        expect(wrapper.findAll('tbody tr').length).toBe(2);
        
        await wrapper.findAll('.edit-action-btn.delete')[0].trigger('click');
        expect(wrapper.findAll('tbody tr').length).toBe(1);
    });

    it('selects row on click', async () => {
        const storage = { localStorage: { key1: 'val1' } };
        const wrapper = mount(StorageTab, { props: { storage } });
        
        await wrapper.find('tbody tr').trigger('click');
        expect(wrapper.find('tbody tr').classes()).toContain('selected');
    });

    it('starts edit on double click', async () => {
        const storage = { localStorage: { key1: 'val1' } };
        const wrapper = mount(StorageTab, { props: { storage } });
        
        await wrapper.find('.val-content').trigger('dblclick');
        expect(wrapper.find('.edit-area').exists()).toBe(true);
        expect(wrapper.find('.edit-input').exists()).toBe(true);
    });
});
