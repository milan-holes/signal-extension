import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import ReplayWidget from './ReplayWidget.vue';

describe('ReplayWidget.vue', () => {
    beforeEach(() => {
        global.chrome = {
            runtime: { sendMessage: vi.fn() }
        } as any;
    });

    it('renders widget when there are events', () => {
        const wrapper = mount(ReplayWidget, {
            props: { events: [{ type: 'click' }], tabId: 1, readyMode: true, defaultDelay: null }
        });
        expect(wrapper.find('#signal-replay-widget').exists()).toBe(true);
    });

    it('renders events and sends start message', async () => {
        const events = [
            { type: 'click', target: { tagName: 'BUTTON' } }
        ];
        const wrapper = mount(ReplayWidget, {
            props: { events, tabId: 1, readyMode: true, defaultDelay: null }
        });

        expect(wrapper.findAll('.sr-event-row').length).toBe(1);

        const startBtn = wrapper.find('.sr-primary-btn');
        await startBtn.trigger('click');

        expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'replayStart', tabId: 1 });
    });

    it('sends skip message in executing mode', async () => {
        const wrapper = mount(ReplayWidget, {
            props: { events: [{ type: 'click' }], tabId: 1, readyMode: false, defaultDelay: null }
        });

        const skipBtn = wrapper.find('.sr-action-btn-skip');
        expect(skipBtn.exists()).toBe(true);
        await skipBtn.trigger('click');
        expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'replaySkip', tabId: 1 });
    });

    it('renders stop button in toolbar', () => {
        const wrapper = mount(ReplayWidget, {
            props: { events: [{ type: 'click' }], tabId: 1, readyMode: false, defaultDelay: null }
        });
        // Stop button exists in DOM even if hidden via v-show
        expect(wrapper.find('.sr-action-btn-stop').exists()).toBe(true);
    });

    it('renders multiple events', () => {
        const events = [
            { type: 'click', target: { tagName: 'BUTTON', innerText: 'Submit' } },
            { type: 'input', value: 'test', target: { tagName: 'INPUT' } },
            { type: 'keydown', key: 'Enter', target: { tagName: 'INPUT' } },
            { type: 'navigation', url: 'https://example.com/page' }
        ];
        const wrapper = mount(ReplayWidget, {
            props: { events, tabId: 1, readyMode: true, defaultDelay: null }
        });

        expect(wrapper.findAll('.sr-event-row').length).toBe(4);
    });

    it('renders navigation events', () => {
        const events = [{ type: 'navigation', url: 'https://example.com/test' }];
        const wrapper = mount(ReplayWidget, {
            props: { events, tabId: 1, readyMode: true, defaultDelay: null }
        });
        // Check navigation event row rendered
        expect(wrapper.findAll('.sr-event-row').length).toBe(1);
        expect(wrapper.text()).toContain('navigation');
    });

    it('renders with defaultDelay prop', () => {
        const wrapper = mount(ReplayWidget, {
            props: { events: [{ type: 'click' }], tabId: 1, readyMode: true, defaultDelay: 2000 }
        });
        expect(wrapper.find('#signal-replay-widget').exists()).toBe(true);
    });

    it('shows ready mode UI with start button', () => {
        const wrapper = mount(ReplayWidget, {
            props: { events: [{ type: 'click' }], tabId: 1, readyMode: true, defaultDelay: null }
        });
        expect(wrapper.find('.sr-primary-btn').exists()).toBe(true);
        expect(wrapper.text()).toContain('Start');
    });

    it('shows toolbar in non-ready mode', () => {
        const wrapper = mount(ReplayWidget, {
            props: { events: [{ type: 'click' }], tabId: 1, readyMode: false, defaultDelay: null }
        });
        expect(wrapper.find('.sr-toolbar').exists()).toBe(true);
    });

    it('renders click event with aria-label', () => {
        const events = [{ type: 'click', target: { tagName: 'BUTTON', attributes: { 'aria-label': 'Submit Form' } } }];
        const wrapper = mount(ReplayWidget, {
            props: { events, tabId: 1, readyMode: true, defaultDelay: null }
        });
        // getEventLabel returns 'Click "Submit Form"'
        expect(wrapper.text()).toContain('Submit Form');
    });

    it('renders input event with selectors and value', () => {
        const events = [{ type: 'input', value: 'Hello World', target: { tagName: 'INPUT', id: 'username', selectors: ['#username'] } }];
        const wrapper = mount(ReplayWidget, {
            props: { events, tabId: 1, readyMode: true, defaultDelay: null }
        });
        expect(wrapper.text()).toContain('Hello World');
        expect(wrapper.text()).toContain('#username');
    });

    it('renders keydown event type badge', () => {
        const events = [{ type: 'keydown', key: 'Enter', target: { tagName: 'INPUT' } }];
        const wrapper = mount(ReplayWidget, {
            props: { events, tabId: 1, readyMode: true, defaultDelay: null }
        });
        const badge = wrapper.find('.sr-event-type-badge');
        expect(badge.classes()).toContain('bg-emerald');
    });

    it('renders click event type badge', () => {
        const events = [{ type: 'click', target: { tagName: 'BUTTON' } }];
        const wrapper = mount(ReplayWidget, {
            props: { events, tabId: 1, readyMode: true, defaultDelay: null }
        });
        const badge = wrapper.find('.sr-event-type-badge');
        expect(badge.classes()).toContain('bg-purple');
    });

    it('renders input event type badge', () => {
        const events = [{ type: 'input', target: { tagName: 'INPUT' } }];
        const wrapper = mount(ReplayWidget, {
            props: { events, tabId: 1, readyMode: true, defaultDelay: null }
        });
        const badge = wrapper.find('.sr-event-type-badge');
        expect(badge.classes()).toContain('bg-blue');
    });

    it('renders event with xpath in description', () => {
        const events = [{ type: 'click', target: { tagName: 'SPAN', xpath: '/html/body/div/span' } }];
        const wrapper = mount(ReplayWidget, {
            props: { events, tabId: 1, readyMode: true, defaultDelay: null }
        });
        expect(wrapper.text()).toContain('/html/body/div/span');
    });

    it('renders event with testAttr selector', () => {
        const events = [{ type: 'click', target: { tagName: 'BUTTON', testAttr: { selector: '[data-testid="btn"]' } } }];
        const wrapper = mount(ReplayWidget, {
            props: { events, tabId: 1, readyMode: true, defaultDelay: null }
        });
        expect(wrapper.text()).toContain('[data-testid');
    });

    it('renders event with long inner text truncated', () => {
        const events = [{ type: 'click', target: { tagName: 'A', innerText: 'This is a very long button label that should be truncated after thirty characters' } }];
        const wrapper = mount(ReplayWidget, {
            props: { events, tabId: 1, readyMode: true, defaultDelay: null }
        });
        expect(wrapper.text()).toContain('...');
    });

    it('shows delay select with options', () => {
        const wrapper = mount(ReplayWidget, {
            props: { events: [{ type: 'click' }], tabId: 1, readyMode: true, defaultDelay: null }
        });
        const select = wrapper.find('.sr-delay-select');
        expect(select.exists()).toBe(true);
    });

    it('renders counter badge', () => {
        const events = [{ type: 'click' }, { type: 'click' }, { type: 'click' }];
        const wrapper = mount(ReplayWidget, {
            props: { events, tabId: 1, readyMode: true, defaultDelay: null }
        });
        expect(wrapper.find('.sr-counter-badge').text()).toContain('0 / 3');
    });

    it('renders progress bar', () => {
        const wrapper = mount(ReplayWidget, {
            props: { events: [{ type: 'click' }], tabId: 1, readyMode: true, defaultDelay: null }
        });
        expect(wrapper.find('.sr-progress-track').exists()).toBe(true);
    });

    it('starts replay and switches to executing mode', async () => {
        const wrapper = mount(ReplayWidget, {
            props: { events: [{ type: 'click' }], tabId: 1, readyMode: true, defaultDelay: null }
        });
        await wrapper.find('.sr-primary-btn').trigger('click');
        expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'replayStart', tabId: 1 });
        // After starting, the widget shows executing state
        expect(wrapper.text()).toContain('Executing');
    });
});
