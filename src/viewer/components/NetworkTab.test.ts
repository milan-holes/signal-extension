import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import NetworkTab from './NetworkTab.vue';

describe('NetworkTab.vue', () => {
    it('renders empty state when no entries', () => {
        const wrapper = mount(NetworkTab, { props: { har: null } });
        expect(wrapper.text()).toContain('No network requests');
    });

    it('renders network list and selects an entry', async () => {
        const har = {
            log: {
                entries: [
                    {
                        startedDateTime: '2024-01-01T12:00:00.000Z',
                        time: 150,
                        request: { method: 'GET', url: 'https://example.com/api/data' },
                        response: { status: 200, content: { size: 1024, mimeType: 'application/json' } }
                    }
                ]
            }
        };

        const wrapper = mount(NetworkTab, { props: { har } });
        expect(wrapper.find('tbody').text()).toContain('GET');
        expect(wrapper.find('tbody').text()).toContain('200');
        expect(wrapper.find('tbody').text()).toContain('api/data');

        // Select the row
        await wrapper.find('tbody tr').trigger('click');
        expect(wrapper.find('.detail-panel').exists()).toBe(true);
        expect(wrapper.find('.detail-panel').text()).toContain('GET data');
    });

    it('renders multiple entries with different statuses', () => {
        const har = {
            log: {
                entries: [
                    { startedDateTime: '2024-01-01T12:00:00Z', time: 100, request: { method: 'GET', url: 'https://example.com/ok' }, response: { status: 200, content: { size: 100, mimeType: 'application/json' } } },
                    { startedDateTime: '2024-01-01T12:00:01Z', time: 50, request: { method: 'POST', url: 'https://example.com/created' }, response: { status: 201, content: { size: 50, mimeType: 'application/json' } } },
                    { startedDateTime: '2024-01-01T12:00:02Z', time: 200, request: { method: 'GET', url: 'https://example.com/missing' }, response: { status: 404, content: { size: 0, mimeType: 'text/html' } } },
                    { startedDateTime: '2024-01-01T12:00:03Z', time: 500, request: { method: 'GET', url: 'https://example.com/error' }, response: { status: 500, content: { size: 0, mimeType: 'text/html' } } }
                ]
            }
        };
        const wrapper = mount(NetworkTab, { props: { har } });
        const rows = wrapper.findAll('tbody tr');
        expect(rows.length).toBe(4);
        expect(wrapper.text()).toContain('200');
        expect(wrapper.text()).toContain('404');
        expect(wrapper.text()).toContain('500');
    });

    it('shows detail panel with request info', async () => {
        const har = {
            log: {
                entries: [{
                    startedDateTime: '2024-01-01T12:00:00Z',
                    time: 150,
                    request: {
                        method: 'POST',
                        url: 'https://example.com/api/submit',
                        headers: [{ name: 'Content-Type', value: 'application/json' }],
                        postData: { text: '{"key":"value"}' }
                    },
                    response: {
                        status: 200,
                        content: { size: 512, mimeType: 'application/json', text: '{"result":"ok"}' },
                        headers: [{ name: 'X-Custom', value: 'test' }]
                    },
                    timings: { send: 10, wait: 100, receive: 40 }
                }]
            }
        };
        const wrapper = mount(NetworkTab, { props: { har } });
        await wrapper.find('tbody tr').trigger('click');
        expect(wrapper.find('.detail-panel').exists()).toBe(true);
        expect(wrapper.find('.detail-panel').text()).toContain('POST');
    });

    it('closes detail panel', async () => {
        const har = {
            log: { entries: [{ startedDateTime: '2024-01-01T12:00:00Z', time: 150, request: { method: 'GET', url: 'https://example.com/x' }, response: { status: 200, content: { size: 0, mimeType: 'text/html' } } }] }
        };
        const wrapper = mount(NetworkTab, { props: { har } });
        await wrapper.find('tbody tr').trigger('click');
        expect(wrapper.find('.detail-panel').exists()).toBe(true);
        await wrapper.find('.close-btn').trigger('click');
        expect(wrapper.find('.detail-panel').exists()).toBe(false);
    });
});
