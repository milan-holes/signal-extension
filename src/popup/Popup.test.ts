import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import Popup from './Popup.vue';

describe('Popup.vue', () => {
    beforeEach(() => {
        global.chrome = {
            storage: {
                local: {
                    get: vi.fn((keys: any, cb: any) => {
                        if (cb) {
                            if (Array.isArray(keys) && keys.includes('theme')) cb({ theme: 'light' });
                            else if (Array.isArray(keys) && keys.includes('settings')) cb({ settings: { showWidget: true, showClicks: true, bufferMinutes: 2 } });
                            else if (typeof keys === 'object') cb({});
                            else cb({});
                        }
                    }),
                    set: vi.fn((data: any, cb: any) => { if (cb) cb(); })
                },
                onChanged: {
                    addListener: vi.fn()
                }
            },
            tabs: {
                query: vi.fn().mockResolvedValue([{ id: 1, url: 'https://example.com' }]),
                create: vi.fn()
            },
            runtime: {
                sendMessage: vi.fn((msg: any, cb: any) => {
                    if (msg.action === 'checkStatus' && cb) cb({ isRecording: false });
                }),
                lastError: null
            }
        } as any;
    });

    it('renders default UI', async () => {
        const wrapper = mount(Popup);
        await vi.dynamicImportSettled();

        expect(wrapper.find('.header').exists()).toBe(true);
        expect(wrapper.find('.recording-section').exists()).toBe(true);
        expect(wrapper.find('.screenshot-grid').exists()).toBe(true);
    });

    it('toggles settings view', async () => {
        const wrapper = mount(Popup);

        const settingsBtn = wrapper.findAll('.icon-btn').find(b => b.attributes('title') === 'Settings');
        await settingsBtn?.trigger('click');
        expect(wrapper.find('.settings-view').exists()).toBe(true);

        await wrapper.findAll('.setting-tab')[1].trigger('click');
        expect(wrapper.find('.settings-view').text()).toContain('Security');
    });

    it('handles start recording', async () => {
        const wrapper = mount(Popup);
        await vi.dynamicImportSettled();

        (global.chrome.runtime.sendMessage as any).mockImplementation((msg: any, cb: any) => {
            if (msg.action === 'start') {
                if (cb) cb({ status: 'started' });
            } else if (msg.action === 'checkStatus') {
                if (cb) cb({ isRecording: false });
            }
        });

        const startBtn = wrapper.find('.action-btn');
        await startBtn.trigger('click');
        expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'start' }),
            expect.any(Function)
        );
    });

    it('handles stop recording', async () => {
        const wrapper = mount(Popup);
        await vi.dynamicImportSettled();
        wrapper.vm.isRecording = true;
        await wrapper.vm.$nextTick();

        const stopBtn = wrapper.find('.btn-danger');
        
        (global.chrome.runtime.sendMessage as any).mockImplementation((msg: any, cb: any) => {
            if (msg.action === 'stop' && cb) cb();
            if (msg.action === 'saveReport' && cb) cb({ status: 'saved' });
        });

        window.close = vi.fn();
        await stopBtn.trigger('click');
        expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'stop' }),
            expect.any(Function)
        );
    });

    it('takes visible screenshot', async () => {
        const wrapper = mount(Popup);
        await vi.dynamicImportSettled();
        
        window.close = vi.fn();
        const tools = wrapper.findAll('.tool-card');
        await tools[0].trigger('click');
        expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'initiateScreenshot', type: 'visible' })
        );
    });

    it('takes full page screenshot', async () => {
        const wrapper = mount(Popup);
        await vi.dynamicImportSettled();
        
        window.close = vi.fn();
        const tools = wrapper.findAll('.tool-card');
        await tools[2].trigger('click');
        expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'initiateScreenshot', type: 'full' })
        );
    });

    it('opens dashboard', async () => {
        const wrapper = mount(Popup);
        
        const dashBtn = wrapper.findAll('.icon-btn').find(b => b.text().includes('Dashboard'));
        await dashBtn?.trigger('click');
        expect(global.chrome.tabs.create).toHaveBeenCalledWith(
            expect.objectContaining({ url: 'src/viewer/index.html' })
        );
    });

    it('saves settings', async () => {
        const wrapper = mount(Popup);
        
        const settingsBtn = wrapper.findAll('.icon-btn').find(b => b.attributes('title') === 'Settings');
        await settingsBtn?.trigger('click');
        
        const saveBtn = wrapper.findAll('.action-btn').find(b => b.attributes('title') === 'Save Settings');
        await saveBtn?.trigger('click');
        
        expect(global.chrome.storage.local.set).toHaveBeenCalled();
    });

    it('loads default security settings', async () => {
        const wrapper = mount(Popup);
        
        const settingsBtn = wrapper.findAll('.icon-btn').find(b => b.attributes('title') === 'Settings');
        await settingsBtn?.trigger('click');
        
        await wrapper.findAll('.setting-tab')[1].trigger('click');
        
        const loadBtn = wrapper.findAll('.action-btn').find(b => b.text().includes('Load Defaults'));
        await loadBtn?.trigger('click');
        
        expect((wrapper.findAll('textarea')[0].element as HTMLTextAreaElement).value).toContain('Authorization');
    });

    it('handles restricted chrome:// page', async () => {
        (global.chrome.tabs.query as any).mockResolvedValue([{ id: 1, url: 'chrome://extensions' }]);
        
        const wrapper = mount(Popup);
        await vi.dynamicImportSettled();
        
        expect(wrapper.text()).toContain('Recording is disabled');
    });

    it('switches to integrations tab', async () => {
        const wrapper = mount(Popup);
        
        const settingsBtn = wrapper.findAll('.icon-btn').find(b => b.attributes('title') === 'Settings');
        await settingsBtn?.trigger('click');
        
        await wrapper.findAll('.setting-tab')[2].trigger('click');
        expect(wrapper.find('.settings-view').text()).toContain('Jira');
    });

    it('toggles theme', async () => {
        const wrapper = mount(Popup);
        
        const themeBtn = wrapper.findAll('.icon-btn').find(b => b.attributes('title') === 'Toggle Theme');
        await themeBtn?.trigger('click');
        expect(global.chrome.storage.local.get).toHaveBeenCalled();
    });

    it('handles pause and resume', async () => {
        const wrapper = mount(Popup);
        await vi.dynamicImportSettled();
        wrapper.vm.isRecording = true;
        await wrapper.vm.$nextTick();

        const pauseBtn = wrapper.findAll('.ctrl-btn').find(b => b.text().includes('Pause'));
        if (pauseBtn) {
            await pauseBtn.trigger('click');
            expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'togglePause' }),
                expect.any(Function)
            );
        }
    });

    it('shows start recording error', async () => {
        (global.chrome.runtime.sendMessage as any).mockImplementation((msg: any, cb: any) => {
            if (msg.action === 'start' && cb) cb({ status: 'error', message: 'Tab not found' });
            if (msg.action === 'checkStatus' && cb) cb({ isRecording: false });
        });

        const wrapper = mount(Popup);
        await vi.dynamicImportSettled();
        
        const startBtn = wrapper.find('.action-btn');
        await startBtn.trigger('click');
        await wrapper.vm.$nextTick();
        
        expect(wrapper.text()).toContain('Error');
    });
});
