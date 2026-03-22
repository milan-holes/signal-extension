import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ScriptModal from './ScriptModal.vue';

describe('ScriptModal.vue', () => {
    it('does not render when not visible', () => {
        const wrapper = mount(ScriptModal, { props: { visible: false, title: 'T', content: 'C' } });
        expect(wrapper.find('.modal-overlay').exists()).toBe(false);
    });

    it('renders and emits close on click', async () => {
        const wrapper = mount(ScriptModal, { props: { visible: true, title: 'My Script', content: 'test content' } });
        expect(wrapper.find('.modal-overlay').exists()).toBe(true);
        expect(wrapper.text()).toContain('My Script');
        expect(wrapper.find('textarea').element.value).toBe('test content');

        await wrapper.find('.close-icon').trigger('click');
        expect(wrapper.emitted()).toHaveProperty('close');
    });
});
