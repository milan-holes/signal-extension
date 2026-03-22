import { mount } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ErrorToast from './ErrorToast.vue';
import { contentState, removeToast } from '../composables/useContentState';

vi.mock('../composables/useContentState', () => ({
  contentState: {
    toasts: []
  },
  removeToast: vi.fn()
}));

describe('ErrorToast.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contentState.toasts = [];
  });

  it('renders nothing when there are no toasts', () => {
    const wrapper = mount(ErrorToast);
    expect(wrapper.findAll('.toast-item').length).toBe(0);
  });

  it('renders toasts', async () => {
    contentState.toasts = [
      { id: 1, type: 'console', message: 'Console error msg' },
      { id: 2, type: 'network', message: 'Network error msg' }
    ];
    
    const wrapper = mount(ErrorToast);
    const toasts = wrapper.findAll('.toast-item');
    expect(toasts.length).toBe(2);
    
    expect(toasts[0].text()).toContain('Console Error');
    expect(toasts[0].text()).toContain('Console error msg');
    
    expect(toasts[1].text()).toContain('Network Error');
    expect(toasts[1].text()).toContain('Network error msg');
  });

  it('calls removeToast when dismiss button is clicked', async () => {
    contentState.toasts = [
      { id: 1, type: 'console', message: 'Console error msg' }
    ];
    
    const wrapper = mount(ErrorToast);
    const dismissBtn = wrapper.find('.toast-dismiss');
    
    await dismissBtn.trigger('click');
    expect(removeToast).toHaveBeenCalledWith(1);
  });

  it('truncates long text messages', async () => {
    const longMsg = 'a'.repeat(150);
    contentState.toasts = [
      { id: 1, type: 'console', message: longMsg }
    ];
    
    const wrapper = mount(ErrorToast);
    const messageEl = wrapper.find('.toast-message');
    expect(messageEl.text().length).toBeLessThan(130);
    expect(messageEl.text()).toContain('…');
  });
});
