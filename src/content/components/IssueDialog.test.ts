import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import IssueDialog from './IssueDialog.vue';

// Mock document.elementsFromPoint for jsdom
beforeEach(() => {
    global.document.elementsFromPoint = vi.fn(() => []);
    global.window.getSelection = vi.fn(() => null as any);
});

describe('IssueDialog.vue', () => {
    it('does not render when not visible', () => {
        const wrapper = mount(IssueDialog);
        expect(wrapper.find('.issue-dialog-overlay').exists()).toBe(false);
    });

    it('renders when visible and emits cancel', async () => {
        const wrapper = mount(IssueDialog);
        (wrapper.vm as any).open({});
        await wrapper.vm.$nextTick();

        expect(wrapper.find('.issue-dialog-overlay').exists()).toBe(true);

        const cancelBtn = wrapper.find('.btn-cancel');
        await cancelBtn.trigger('click');
        expect(wrapper.emitted()).toHaveProperty('cancel');
    });

    it('emits submit with new data structure', async () => {
        const rect = { x: 10, y: 10, width: 100, height: 100 };
        const wrapper = mount(IssueDialog);
        (wrapper.vm as any).open(rect);
        await wrapper.vm.$nextTick();

        // Fill in current state (required field)
        const currentStateTextarea = wrapper.find('#current-state');
        await currentStateTextarea.setValue('Price shows $0.00');

        // Fill in desired state
        const desiredStateTextarea = wrapper.find('#desired-state');
        await desiredStateTextarea.setValue('Should show $29.99');

        // Fill in additional notes
        const notesTextarea = wrapper.find('#additional-notes');
        await notesTextarea.setValue('Bug occurred after login');

        const submitBtn = wrapper.find('.btn-submit');
        await submitBtn.trigger('click');

        expect(wrapper.emitted()).toHaveProperty('submit');
        const submitData = wrapper.emitted('submit')?.[0][0];

        expect(submitData).toMatchObject({
            currentState: 'Price shows $0.00',
            desiredState: 'Should show $29.99',
            comment: 'Bug occurred after login',
            rect,
            resolvedElements: [],
            primaryElement: null,
            selectedText: null
        });
    });

    it('disables submit button when no state is provided', async () => {
        const wrapper = mount(IssueDialog);
        (wrapper.vm as any).open({ x: 0, y: 0, width: 100, height: 100 });
        await wrapper.vm.$nextTick();

        const submitBtn = wrapper.find('.btn-submit');
        expect(submitBtn.attributes('disabled')).toBeDefined();
    });

    it('enables submit button when current state is provided', async () => {
        const wrapper = mount(IssueDialog);
        (wrapper.vm as any).open({ x: 0, y: 0, width: 100, height: 100 });
        await wrapper.vm.$nextTick();

        const currentStateTextarea = wrapper.find('#current-state');
        await currentStateTextarea.setValue('Something is broken');
        await wrapper.vm.$nextTick();

        const submitBtn = wrapper.find('.btn-submit');
        expect(submitBtn.attributes('disabled')).toBeUndefined();
    });
});
