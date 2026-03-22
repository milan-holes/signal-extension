import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ReplayModal from './ReplayModal.vue';

describe('ReplayModal.vue', () => {
    it('does not render when not visible', () => {
        const wrapper = mount(ReplayModal, { props: { visible: false, reportData: {} } });
        expect(wrapper.find('.modal-overlay').exists()).toBe(false);
    });

    it('renders and triggers replay', async () => {
        // Mock chrome
        global.chrome = {
            runtime: { sendMessage: vi.fn() }
        } as any;

        const reportData = {
            userEvents: [{ type: 'navigation', url: 'https://test.com', timestamp: 1 }]
        };

        const wrapper = mount(ReplayModal, { props: { visible: false, reportData } });
        await wrapper.setProps({ visible: true }); // triggers watcher
        expect(wrapper.find('.modal-overlay').exists()).toBe(true);

        const startBtn = wrapper.findAll('button').find(b => b.text().includes('Start Replay'));
        await startBtn?.trigger('click');

        expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'replayEvents', url: 'https://test.com' })
        );
    });

    it('populates storage sections from report data', async () => {
        global.chrome = { runtime: { sendMessage: vi.fn() } } as any;
        
        const reportData = {
            userEvents: [{ type: 'navigation', url: 'https://test.com', timestamp: 1 }],
            storage: { localStorage: { key1: 'val1' }, sessionStorage: { skey: 'sval' }, cookies: { c1: 'cv1' } }
        };
        
        const wrapper = mount(ReplayModal, { props: { visible: true, reportData } });
        expect(wrapper.text()).toContain('Local Storage');
        expect(wrapper.text()).toContain('Session Storage');
        expect(wrapper.text()).toContain('Cookies');
    });

    it('renders configuration options', async () => {
        global.chrome = { runtime: { sendMessage: vi.fn() } } as any;
        
        const reportData = {
            userEvents: [{ type: 'navigation', url: 'https://example.com', timestamp: 1 }]
        };
        const wrapper = mount(ReplayModal, { props: { visible: true, reportData } });
        
        expect(wrapper.text()).toContain('Auto-start');
        expect(wrapper.text()).toContain('Delay');
        expect(wrapper.text()).toContain('Clear before replay');
    });

    it('adds and removes pre-replay requests', async () => {
        global.chrome = { runtime: { sendMessage: vi.fn() } } as any;
        const wrapper = mount(ReplayModal, { props: { visible: true, reportData: { userEvents: [] } } });
        
        const addBtn = wrapper.findAll('.action-btn').find(b => b.text().includes('Add Request'));
        await addBtn?.trigger('click');
        
        expect(wrapper.findAll('.request-item').length).toBe(1);
        
        await wrapper.find('.remove-btn').trigger('click');
        expect(wrapper.findAll('.request-item').length).toBe(0);
    });

    it('emits close on cancel', async () => {
        global.chrome = { runtime: { sendMessage: vi.fn() } } as any;
        const wrapper = mount(ReplayModal, { props: { visible: true, reportData: {} } });
        
        const cancelBtn = wrapper.findAll('.action-btn').find(b => b.text().includes('Cancel'));
        await cancelBtn?.trigger('click');
        expect(wrapper.emitted('close')).toBeTruthy();
    });

    it('alerts when URL is empty', async () => {
        global.chrome = { runtime: { sendMessage: vi.fn() } } as any;
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
        
        const wrapper = mount(ReplayModal, { props: { visible: true, reportData: { userEvents: [{ type: 'click' }] } } });
        
        // Clear URL and try to start
        const urlInput = wrapper.find('.form-input');
        await urlInput.setValue('');
        
        const startBtn = wrapper.findAll('.action-btn').find(b => b.text().includes('Start Replay'));
        await startBtn?.trigger('click');
        
        expect(alertSpy).toHaveBeenCalledWith('URL is required');
        alertSpy.mockRestore();
    });
});
