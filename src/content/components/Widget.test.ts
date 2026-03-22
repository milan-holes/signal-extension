import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import Widget from './Widget.vue';

const { mockContentState } = vi.hoisted(() => ({
    mockContentState: {
        isRecording: false,
        isPaused: false,
        currentMode: 'standard',
        showWidget: true
    }
}));

vi.mock('../composables/useContentState', () => ({
    contentState: mockContentState
}));

describe('Widget.vue', () => {
    beforeEach(() => {
        mockContentState.isRecording = false;
        mockContentState.isPaused = false;
        mockContentState.showWidget = true;
        vi.clearAllMocks();
    });

    it('renders idle state and dispatches start event', async () => {
        const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');
        const wrapper = mount(Widget);

        expect(wrapper.find('.signal-widget.idle').exists()).toBe(true);

        const startBtn = wrapper.find('.start-btn');
        await startBtn.trigger('click');

        expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(CustomEvent));
        expect(dispatchEventSpy.mock.calls[0][0].type).toBe('signal-start-recording');
    });

    it('renders recording state and dispatches stop event', async () => {
        mockContentState.isRecording = true;

        const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');
        const wrapper = mount(Widget);

        expect(wrapper.find('.signal-widget.recording').exists()).toBe(true);

        const stopBtn = wrapper.find('.stop-btn');
        await stopBtn.trigger('click');

        expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(CustomEvent));
        expect(dispatchEventSpy.mock.calls[0][0].type).toBe('signal-stop-recording');
    });
});
