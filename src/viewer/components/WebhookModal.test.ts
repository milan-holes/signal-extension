import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import WebhookModal from './WebhookModal.vue';

describe('WebhookModal.vue', () => {
    it('does not render when not visible', () => {
        const wrapper = mount(WebhookModal, { props: { visible: false, reportData: {} } });
        expect(wrapper.find('.modal-overlay').exists()).toBe(false);
    });

    it('renders and attempts to send webhook', async () => {
        global.fetch = vi.fn().mockResolvedValue({ ok: true });
        localStorage.setItem("signal_webhook_url", "http://test");

        const wrapper = mount(WebhookModal, { props: { visible: true, reportData: { test: 1 } } });
        expect(wrapper.find('.modal-overlay').exists()).toBe(true);

        const inputs = wrapper.findAll('input');
        await inputs[0].setValue('https://example.com/hook');

        const buttons = wrapper.findAll('button');
        const sendBtn = buttons.find(b => b.text().includes('Send'));
        await sendBtn?.trigger('click');

        expect(global.fetch).toHaveBeenCalled();
    });

    it('shows URL required error', async () => {
        const wrapper = mount(WebhookModal, { props: { visible: true, reportData: { test: 1 } } });
        
        // Clear URL
        const inputs = wrapper.findAll('input');
        await inputs[0].setValue('');
        
        const sendBtn = wrapper.findAll('button').find(b => b.text().includes('Send'));
        await sendBtn?.trigger('click');
        
        expect(wrapper.text()).toContain('URL is required');
    });

    it('shows no report data error', async () => {
        const wrapper = mount(WebhookModal, { props: { visible: true, reportData: null } });
        
        const inputs = wrapper.findAll('input');
        await inputs[0].setValue('https://test.com/hook');
        
        const sendBtn = wrapper.findAll('button').find(b => b.text().includes('Send'));
        await sendBtn?.trigger('click');
        
        expect(wrapper.text()).toContain('No report data');
    });

    it('shows invalid JSON error for payload', async () => {
        const wrapper = mount(WebhookModal, { props: { visible: true, reportData: { test: 1 } } });
        
        const inputs = wrapper.findAll('input');
        await inputs[0].setValue('https://test.com/hook');
        
        // Set invalid payload
        const textareas = wrapper.findAll('textarea');
        await textareas[1].setValue('not json');
        
        const sendBtn = wrapper.findAll('button').find(b => b.text().includes('Send'));
        await sendBtn?.trigger('click');
        
        expect(wrapper.text()).toContain('Invalid JSON');
    });

    it('emits close on cancel', async () => {
        const wrapper = mount(WebhookModal, { props: { visible: true, reportData: {} } });
        
        const cancelBtn = wrapper.findAll('button').find(b => b.text().includes('Cancel'));
        await cancelBtn?.trigger('click');
        
        expect(wrapper.emitted('close')).toBeTruthy();
    });
});
