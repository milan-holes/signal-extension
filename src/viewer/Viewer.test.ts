import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import Viewer from './Viewer.vue';

// Mock composables
const mockToggleTheme = vi.fn();
vi.mock('./composables/useTheme', () => ({
    useTheme: () => ({
        toggleTheme: mockToggleTheme,
    })
}));

const mockViewerState = {
    reportData: ref(null),
    reportDate: ref('2024-01-01'),
    activeTab: ref('timeline'),
    hasData: ref(false),
    importFromFile: vi.fn(),
    loadFromStorage: vi.fn()
};

vi.mock('./composables/useViewerState', () => ({
    useViewerState: () => mockViewerState
}));

vi.mock('./composables/useScriptGenerator', () => ({
    generatePlaywrightScript: vi.fn(() => 'playwright script'),
    generatePuppeteerScript: vi.fn(() => 'puppeteer script'),
    generateLLMContext: vi.fn(() => 'llm context')
}));

describe('Viewer.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockViewerState.hasData.value = false;
        mockViewerState.reportData.value = null;
    });

    it('renders empty state when no data is loaded', () => {
        const wrapper = mount(Viewer);
        expect(wrapper.find('.empty-state').exists()).toBe(true);
        expect(wrapper.text()).toContain('No Report Loaded');
    });

    it('renders tabs and content when data is loaded', () => {
        mockViewerState.hasData.value = true;
        (mockViewerState as any).reportData.value = { environment: {} } as any;

        const wrapper = mount(Viewer, {
            global: {
                stubs: {
                    TimelineTab: true,
                    EnvironmentTab: true,
                    ConsoleTab: true,
                    NetworkTab: true,
                    StorageTab: true,
                    IssuesTab: true,
                    ReplayModal: true,
                    ScriptModal: true,
                    WebhookModal: true
                }
            }
        });

        expect(wrapper.find('.empty-state').exists()).toBe(false);
        expect(wrapper.find('.sidebar').exists()).toBe(true);
    });

    it('changes tabs on click', async () => {
        mockViewerState.hasData.value = true;
        (mockViewerState as any).reportData.value = { environment: {} } as any;

        const wrapper = mount(Viewer, {
            global: { stubs: { TimelineTab: true, EnvironmentTab: true, ConsoleTab: true, NetworkTab: true, StorageTab: true, IssuesTab: true, ReplayModal: true, ScriptModal: true, WebhookModal: true } }
        });
        
        const navItems = wrapper.findAll('.nav-item');
        await navItems[2].trigger('click'); // Console tab
        expect(mockViewerState.activeTab.value).toBe('console');
    });

    it('toggles edit mode', async () => {
        mockViewerState.hasData.value = true;
        (mockViewerState as any).reportData.value = { environment: {} } as any;
        const wrapper = mount(Viewer, {
            global: { stubs: { TimelineTab: true, EnvironmentTab: true, ConsoleTab: true, NetworkTab: true, StorageTab: true, IssuesTab: true, ReplayModal: true, ScriptModal: true, WebhookModal: true } }
        });
        
        let editBtn = wrapper.findAll('.action-btn').find(btn => btn.text().includes('Edit Report'));
        expect(editBtn.exists()).toBe(true);
        await editBtn.trigger('click');
        
        editBtn = wrapper.findAll('.action-btn').find(btn => btn.text().includes('Editing'));
        expect(editBtn.exists()).toBe(true);
    });

    it('handles share dropdown actions', async () => {
        mockViewerState.hasData.value = true;
        (mockViewerState as any).reportData.value = { environment: {} } as any;
        const wrapper = mount(Viewer, {
            global: { stubs: { TimelineTab: true, EnvironmentTab: true, ConsoleTab: true, NetworkTab: true, StorageTab: true, IssuesTab: true, ReplayModal: true, ScriptModal: true, WebhookModal: true } }
        });
        
        const shareBtn = wrapper.findAll('.action-btn').find(btn => btn.text().includes('Share'));
        await shareBtn.trigger('click');
        
        const dropdownItems = wrapper.findAll('.dropdown-item');
        expect(dropdownItems.length).toBeGreaterThan(0);
        
        // Test script generation triggers
        await dropdownItems[3].trigger('click'); // LLM Context
        expect(wrapper.html()).toContain('LLM Context'); // Script modal title should be passed down
    });

    it('triggers import dialog', async () => {
        const wrapper = mount(Viewer, {
            global: { stubs: { TimelineTab: true, EnvironmentTab: true, ConsoleTab: true, NetworkTab: true, StorageTab: true, IssuesTab: true, ReplayModal: true, ScriptModal: true, WebhookModal: true } }
        });
        
        const importBtn = wrapper.find('#importBtn');
        const fileInput = wrapper.find('input[type="file"]');
        
        fileInput.element.click = vi.fn();
        await importBtn.trigger('click');
        expect(fileInput.element.click).toHaveBeenCalled();
    });

    it('toggles theme', async () => {
        const wrapper = mount(Viewer, {
            global: { stubs: { TimelineTab: true, EnvironmentTab: true, ConsoleTab: true, NetworkTab: true, StorageTab: true, IssuesTab: true, ReplayModal: true, ScriptModal: true, WebhookModal: true } }
        });
        const themeBtn = wrapper.findAll('.action-btn').find(btn => btn.attributes('title') === 'Toggle Dark Mode');
        await themeBtn?.trigger('click');
        expect(mockToggleTheme).toHaveBeenCalled();
    });

    it('handles all share dropdown actions', async () => {
        mockViewerState.hasData.value = true;
        (mockViewerState as any).reportData.value = { environment: {}, userEvents: [], har: { log: { entries: [] } } } as any;
        const wrapper = mount(Viewer, {
            global: { stubs: { TimelineTab: true, EnvironmentTab: true, ConsoleTab: true, NetworkTab: true, StorageTab: true, IssuesTab: true, ReplayModal: true, ScriptModal: true, WebhookModal: true } }
        });
        
        const shareBtn = wrapper.findAll('.action-btn').find(btn => btn.text().includes('Share'));
        
        // Test Playwright script action
        await shareBtn.trigger('click');
        let items = wrapper.findAll('.dropdown-item');
        await items[4].trigger('click'); // Playwright
        
        // Test Puppeteer script action
        await shareBtn.trigger('click');
        items = wrapper.findAll('.dropdown-item');
        await items[5].trigger('click'); // Puppeteer
    });

    it('triggers export recording action', async () => {
        mockViewerState.hasData.value = true;
        (mockViewerState as any).reportData.value = { test: true } as any;
        
        // Mock URL.createObjectURL to prevent JSDOM errors
        const origURL = window.URL;
        window.URL = { ...origURL, createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() } as any;
        
        const wrapper = mount(Viewer, {
            global: { stubs: { TimelineTab: true, EnvironmentTab: true, ConsoleTab: true, NetworkTab: true, StorageTab: true, IssuesTab: true, ReplayModal: true, ScriptModal: true, WebhookModal: true } }
        });
        
        const shareBtn = wrapper.findAll('.action-btn').find(btn => btn.text().includes('Share'));
        await shareBtn.trigger('click');
        const items = wrapper.findAll('.dropdown-item');
        await items[0].trigger('click'); // Export
        
        expect(window.URL.createObjectURL).toHaveBeenCalled();
        window.URL = origURL;
    });

    it('triggers export HAR action', async () => {
        mockViewerState.hasData.value = true;
        (mockViewerState as any).reportData.value = {
            har: { log: { entries: [{ startedDateTime: '2024-01-01T00:00:00Z', time: 100, request: { method: 'GET', url: 'https://test.com' }, response: { status: 200, content: { size: 0, mimeType: 'text/html' } }, timings: { send: 1, wait: 50, receive: 49 } }], pages: [] } }
        } as any;
        
        const origURL = window.URL;
        window.URL = { ...origURL, createObjectURL: vi.fn(() => 'blob:har'), revokeObjectURL: vi.fn() } as any;
        
        const wrapper = mount(Viewer, {
            global: { stubs: { TimelineTab: true, EnvironmentTab: true, ConsoleTab: true, NetworkTab: true, StorageTab: true, IssuesTab: true, ReplayModal: true, ScriptModal: true, WebhookModal: true } }
        });
        
        const shareBtn = wrapper.findAll('.action-btn').find(btn => btn.text().includes('Share'));
        await shareBtn.trigger('click');
        const items = wrapper.findAll('.dropdown-item');
        await items[1].trigger('click'); // HAR
        
        expect(window.URL.createObjectURL).toHaveBeenCalled();
        window.URL = origURL;
    });

    it('opens replay modal only with events', async () => {
        mockViewerState.hasData.value = true;
        (mockViewerState as any).reportData.value = { userEvents: [{ type: 'click' }] } as any;
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
        
        const wrapper = mount(Viewer, {
            global: { stubs: { TimelineTab: true, EnvironmentTab: true, ConsoleTab: true, NetworkTab: true, StorageTab: true, IssuesTab: true, ReplayModal: true, ScriptModal: true, WebhookModal: true } }
        });
        
        const replayBtn = wrapper.findAll('.action-btn').find(btn => btn.text().includes('Replay'));
        await replayBtn?.trigger('click');
        // Should open modal, not show alert since there are events
        expect(alertSpy).not.toHaveBeenCalled();
        alertSpy.mockRestore();
    });

    it('alerts when opening replay without events', async () => {
        mockViewerState.hasData.value = true;
        (mockViewerState as any).reportData.value = { userEvents: [] } as any;
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
        
        const wrapper = mount(Viewer, {
            global: { stubs: { TimelineTab: true, EnvironmentTab: true, ConsoleTab: true, NetworkTab: true, StorageTab: true, IssuesTab: true, ReplayModal: true, ScriptModal: true, WebhookModal: true } }
        });
        
        const replayBtn = wrapper.findAll('.action-btn').find(btn => btn.text().includes('Replay'));
        await replayBtn?.trigger('click');
        expect(alertSpy).toHaveBeenCalledWith('No events to replay');
        alertSpy.mockRestore();
    });

    it('handles webhook share action', async () => {
        mockViewerState.hasData.value = true;
        (mockViewerState as any).reportData.value = { environment: {} } as any;
        const wrapper = mount(Viewer, {
            global: { stubs: { TimelineTab: true, EnvironmentTab: true, ConsoleTab: true, NetworkTab: true, StorageTab: true, IssuesTab: true, ReplayModal: true, ScriptModal: true, WebhookModal: true } }
        });
        
        const shareBtn = wrapper.findAll('.action-btn').find(btn => btn.text().includes('Share'));
        await shareBtn.trigger('click');
        const items = wrapper.findAll('.dropdown-item');
        await items[2].trigger('click'); // Webhook
        // Webhook modal should now be visible (prop passed to stubbed component)
    });
});
