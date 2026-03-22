// ── Type Definitions for Background Service Worker ────────────────────

export interface TabData {
    mode: 'standard' | 'buffer' | 'manual_edit';
    isRecording: boolean;
    isPaused?: boolean;
    logs: LogEntry[];
    network: Record<string, NetworkEntry>;
    userEvents: UserEvent[];
    screencast: ScreencastFrame[];
    issues: Issue[];
    contentChanges: ContentChange[];
    environment?: EnvironmentData | null;
    storage?: StorageData | null;
    startTime: string;
}

export interface LogEntry {
    type: 'log' | 'console' | 'exception' | 'network';
    source?: string;
    level: string;
    text: string;
    timestamp: number;
    url?: string;
    stackTrace?: unknown;
    [key: string]: unknown;
}

export interface NetworkEntry {
    requestId: string;
    request: {
        method: string;
        url: string;
        headers: Record<string, string>;
        postData?: string;
    };
    response?: {
        status: number;
        statusText: string;
        headers: Record<string, string>;
        mimeType: string;
        protocol?: string;
    };
    responseBody?: {
        body: string;
        base64Encoded: boolean;
    };
    startTime: number;
    endTime?: number;
    wallTime: number;
    initiator?: unknown;
    type?: string;
    encodedDataLength?: number;
    errorText?: string;
}

export interface UserEvent {
    type: string;
    timestamp: number;
    url?: string;
    target?: {
        tagName: string;
        id: string;
        className: string;
        innerText?: string;
        [key: string]: unknown;
    };
    x?: number;
    y?: number;
    key?: string;
    code?: string;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
    value?: string;
    [key: string]: unknown;
}

export interface ScreencastFrame {
    data: string;
    timestamp: number;
    wallTime: number;
    sessionId: number;
}

export interface Issue {
    timestamp: number;
    [key: string]: unknown;
}

export interface ContentChange {
    timestamp: number;
    [key: string]: unknown;
}

export interface EnvironmentData {
    userAgent: string;
    language: string;
    platform: string;
    cookieEnabled: boolean;
    screenSize: string;
    windowSize?: string;
    windowInnerSize?: string;
    windowOuterSize?: string;
    screenAvailSize?: string;
    devicePixelRatio: number;
    timezone: string;
    hardwareConcurrency: string | number;
    deviceMemory: string | number;
    connectionType: string;
    url: string;
}

export interface StorageData {
    localStorage: Record<string, string>;
    sessionStorage: Record<string, string>;
    cookies: Record<string, string>;
}

export interface Settings {
    autoRecord: boolean;
    domains: string[];
    bufferMinutes: number;
    showWidget?: boolean;
    showClicks?: boolean;
    clickSize?: number;
    clickColor?: string;
    securityHeaders?: string[];
    securityStorage?: string[];
    securityCookies?: string[];
    toastConsole?: boolean;
    toastNetwork?: boolean;
}

export interface ReplayState {
    isPaused: boolean;
    isCancelled: boolean;
    skipWait: boolean;
    skipFailed?: boolean;
    customDelay: number | null;
    events: UserEvent[];
    originalUrl: string;
    originalContext: unknown;
    originalAutoStart: boolean;
    isFinished: boolean;
    isStarted: boolean;
}

export interface Report {
    generatedAt: string;
    environment: EnvironmentData | Record<string, never>;
    storage: {
        localStorage: Record<string, string>;
        sessionStorage: Record<string, string>;
        cookies: Record<string, string>;
    };
    consoleErrors: LogEntry[];
    userEvents: UserEvent[];
    screencast: ScreencastFrame[];
    issues: Issue[];
    contentChanges: ContentChange[];
    har: HarLog;
}

export interface HarLog {
    log: {
        version: string;
        creator: { name: string; version: string };
        pages: Array<{
            startedDateTime: string;
            id: string;
            title: string;
            pageTimings: Record<string, never>;
        }>;
        entries: HarEntry[];
    };
}

export interface HarEntry {
    _resourceType?: string;
    startedDateTime: string;
    time: number;
    request: {
        method: string;
        url: string;
        httpVersion: string;
        headers: Array<{ name: string; value: string }>;
        queryString: never[];
        cookies: never[];
        headersSize: number;
        bodySize: number;
        postData?: { mimeType: string; text: string };
    };
    response: {
        status: number;
        statusText: string;
        httpVersion: string;
        headers: Array<{ name: string; value: string }>;
        cookies?: never[];
        content: {
            size?: number;
            mimeType?: string;
            text?: string;
            encoding?: string;
        };
        redirectURL: string;
        headersSize: number;
        bodySize: number;
    };
    cache: Record<string, never>;
    timings: { send: number; wait: number; receive: number };
    _initiator?: unknown;
}
