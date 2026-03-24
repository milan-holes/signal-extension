import { reactive } from 'vue';

export interface Toast {
    id: number;
    type: 'console' | 'network' | 'info';
    message: string;
}

export interface Issue {
    timestamp: number;
    comment: string;
    rect: { x: number; y: number; width: number; height: number };
}

let toastIdCounter = 0;
const toastTimers: Record<number, ReturnType<typeof setTimeout>> = {};
const MAX_TOASTS = 5;
const TOAST_DURATION_MS = 5000;

export const contentState = reactive({
    isRecording: false,
    isPaused: false,
    currentMode: 'standard',
    showWidget: true,
    minimized: false,
    bufferMinutes: 2,
    isReplaying: false,
    toasts: [] as Toast[],
    issues: [] as Issue[],
});

export function addToast(type: 'console' | 'network' | 'info', message: string) {
    const id = ++toastIdCounter;
    contentState.toasts.push({ id, type, message });

    // Cap at MAX_TOASTS — remove oldest
    while (contentState.toasts.length > MAX_TOASTS) {
        const oldest = contentState.toasts.shift();
        if (oldest && toastTimers[oldest.id]) {
            clearTimeout(toastTimers[oldest.id]);
            delete toastTimers[oldest.id];
        }
    }

    // Auto-dismiss after TOAST_DURATION_MS
    toastTimers[id] = setTimeout(() => {
        removeToast(id);
    }, TOAST_DURATION_MS);
}

export function removeToast(id: number) {
    const idx = contentState.toasts.findIndex(t => t.id === id);
    if (idx !== -1) contentState.toasts.splice(idx, 1);
    if (toastTimers[id]) {
        clearTimeout(toastTimers[id]);
        delete toastTimers[id];
    }
}

export function setRecordingState(isRecording: boolean, isPaused: boolean = false, mode: string = 'standard') {
    contentState.isRecording = isRecording;
    contentState.isPaused = isPaused;
    contentState.currentMode = mode;
}

export function setWidgetVisibility(visible: boolean) {
    contentState.showWidget = visible;
}

export function setMinimized(minimized: boolean) {
    contentState.minimized = minimized;
}

export function setReplayingState(isReplaying: boolean) {
    contentState.isReplaying = isReplaying;
}

export function addIssue(issue: Issue) {
    contentState.issues.push(issue);
}

export function clearIssues() {
    contentState.issues = [];
}
