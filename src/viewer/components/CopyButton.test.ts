import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import CopyButton from './CopyButton.vue';

describe('CopyButton.vue', () => {
    const originalClipboard = navigator.clipboard;
    const writeTextMock = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        Object.assign(navigator, {
            clipboard: { writeText: writeTextMock }
        });
    });

    afterEach(() => {
        Object.assign(navigator, { clipboard: originalClipboard });
    });

    it('renders correctly with default props', () => {
        const wrapper = mount(CopyButton, { props: { content: 'test data' } });
        expect(wrapper.find('svg').exists()).toBe(true);
        expect(wrapper.text()).not.toContain('Copied!');
    });

    it('renders label when provided', () => {
        const wrapper = mount(CopyButton, { props: { content: 'test data', label: 'Copy Me' } });
        expect(wrapper.text()).toContain('Copy Me');
    });

    it('copies content on click via clipboard API', async () => {
        const wrapper = mount(CopyButton, { props: { content: 'hello world' } });
        await wrapper.trigger('click');
        expect(writeTextMock).toHaveBeenCalledWith('hello world');
        expect(wrapper.text()).toContain('Copied!');
    });

    it('uses fallback when clipboard API is missing', async () => {
        Object.assign(navigator, { clipboard: undefined });
        document.execCommand = vi.fn().mockReturnValue(true);
        const execCommandSpy = vi.spyOn(document, 'execCommand');

        const wrapper = mount(CopyButton, { props: { content: 'fallback copy' } });
        await wrapper.trigger('click');
        expect(execCommandSpy).toHaveBeenCalledWith('copy');
        expect(wrapper.text()).toContain('Copied!');

        execCommandSpy.mockRestore();
    });
});
