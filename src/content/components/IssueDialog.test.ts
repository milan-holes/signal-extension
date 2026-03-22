import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import IssueDialog from './IssueDialog.vue';

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

    it('emits submit with comment', async () => {
        const rect = { x: 10, y: 10, width: 100, height: 100 };
        const wrapper = mount(IssueDialog);
        (wrapper.vm as any).open(rect);
        await wrapper.vm.$nextTick();

        const textarea = wrapper.find('textarea');
        await textarea.setValue('Test issue');

        const submitBtn = wrapper.find('.btn-submit');
        await submitBtn.trigger('click');

        expect(wrapper.emitted()).toHaveProperty('submit');
        expect(wrapper.emitted('submit')?.[0]).toEqual([{ comment: 'Test issue', rect }]);
    });
});
