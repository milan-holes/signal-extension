import { ref, watch } from 'vue';

const theme = ref<'dark' | 'light'>('dark');
let initialized = false;

export function useTheme() {
    if (!initialized) {
        initialized = true;
        chrome.storage.local.get(['theme'], (result) => {
            theme.value = (result.theme as 'dark' | 'light') || 'dark';
            applyTheme(theme.value);
        });
    }

    function applyTheme(t: 'dark' | 'light') {
        if (t === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }

    function toggleTheme() {
        theme.value = theme.value === 'dark' ? 'light' : 'dark';
        applyTheme(theme.value);
        chrome.storage.local.set({ theme: theme.value });
    }

    watch(theme, applyTheme);

    return { theme, toggleTheme };
}
