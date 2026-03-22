import type { TabData, Settings, Report, HarEntry } from './types';

const REDACTED_VAL = '[REDACTED]';

function shouldRedact(key: string, list: string[]): boolean {
    return list.some(item => key.toLowerCase().includes(item));
}

export function generateReport(data: TabData, settings: Settings): Report {
    const redactHeaders = (settings.securityHeaders || ['Authorization', 'Cookie', 'Set-Cookie', 'X-Auth-Token', 'Proxy-Authorization']).map(s => s.toLowerCase());
    const redactStorage = (settings.securityStorage || ['token', 'auth', 'session', 'secret', 'key', 'password', 'user', 'account']).map(s => s.toLowerCase());
    const redactCookies = (settings.securityCookies || ['JSESSIONID', 'PHPSESSID', 'connect.sid', 'token', 'auth']).map(s => s.toLowerCase());

    const anonymizeStorage = (storageObj: Record<string, string> | undefined): Record<string, string> => {
        if (!storageObj) return {};
        const clean: Record<string, string> = {};
        for (const [k, v] of Object.entries(storageObj)) {
            clean[k] = shouldRedact(k, redactStorage) ? REDACTED_VAL : v;
        }
        return clean;
    };

    const cleanStorage = {
        localStorage: anonymizeStorage(data.storage?.localStorage),
        sessionStorage: anonymizeStorage(data.storage?.sessionStorage),
        cookies: {} as Record<string, string>
    };

    if (data.storage?.cookies) {
        for (const [k, v] of Object.entries(data.storage.cookies)) {
            cleanStorage.cookies[k] = shouldRedact(k, redactCookies) ? REDACTED_VAL : v;
        }
    }

    const entries: HarEntry[] = Object.values(data.network).map(entry => {
        const rawTime = (entry.endTime && entry.startTime) ? (entry.endTime - entry.startTime) * 1000 : 0;
        const time = isFinite(rawTime) ? rawTime : 0;

        const wallTimeMs = (entry.wallTime && isFinite(entry.wallTime)) ? entry.wallTime * 1000 : Date.now();
        const startedDateTime = new Date(wallTimeMs).toISOString();

        const requestHeaders = Object.entries(entry.request.headers || {}).map(([k, v]) => ({
            name: k,
            value: shouldRedact(k, redactHeaders) ? REDACTED_VAL : (v ?? '')
        }));

        const responseHeaders = Object.entries((entry.response?.headers) || {}).map(([k, v]) => ({
            name: k,
            value: shouldRedact(k, redactHeaders) ? REDACTED_VAL : (v ?? '')
        }));

        const safeStatus = (entry.response?.status != null && isFinite(entry.response.status)) ? entry.response.status : 0;
        const safeSize = (entry.encodedDataLength != null && isFinite(entry.encodedDataLength)) ? entry.encodedDataLength : 0;

        return {
            _resourceType: entry.type || 'other',
            startedDateTime,
            time,
            request: {
                method: entry.request.method || 'GET',
                url: entry.request.url || '',
                httpVersion: 'HTTP/1.1',
                headers: requestHeaders,
                queryString: [] as never[],
                cookies: [] as never[],
                headersSize: -1,
                bodySize: entry.request.postData ? entry.request.postData.length : -1,
                postData: entry.request.postData ? {
                    mimeType: entry.request.headers['Content-Type'] || 'application/octet-stream',
                    text: entry.request.postData
                } : undefined
            },
            response: entry.response ? {
                status: safeStatus,
                statusText: entry.response.statusText || '',
                httpVersion: entry.response.protocol || 'HTTP/1.1',
                headers: responseHeaders,
                cookies: [] as never[],
                content: {
                    size: safeSize,
                    mimeType: entry.response.mimeType || 'application/octet-stream',
                    text: entry.responseBody?.body,
                    encoding: entry.responseBody?.base64Encoded ? 'base64' : undefined
                },
                redirectURL: '',
                headersSize: -1,
                bodySize: safeSize
            } : {
                status: 0,
                statusText: '',
                httpVersion: 'HTTP/1.1',
                headers: [] as Array<{ name: string; value: string }>,
                cookies: [] as never[],
                content: { size: 0, mimeType: 'application/octet-stream' } as { size?: number; mimeType?: string; text?: string; encoding?: string },
                redirectURL: '',
                headersSize: -1,
                bodySize: -1
            },
            cache: {} as Record<string, never>,
            timings: { send: 0, wait: time, receive: 0 },
            _initiator: entry.initiator || null
        } as HarEntry;
    });

    const har = {
        log: {
            version: '1.2',
            creator: { name: 'Signal', version: '1.0' },
            pages: [{
                startedDateTime: data.startTime,
                id: 'page_1',
                title: 'Recorded Session',
                pageTimings: {} as Record<string, never>
            }],
            entries
        }
    };

    return {
        generatedAt: new Date().toISOString(),
        environment: data.environment || ({} as Record<string, never>),
        storage: cleanStorage,
        consoleErrors: data.logs,
        userEvents: data.userEvents || [],
        screencast: data.screencast || [],
        issues: data.issues || [],
        contentChanges: data.contentChanges || [],
        har
    };
}
