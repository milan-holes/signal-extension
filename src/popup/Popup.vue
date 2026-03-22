<template>
  <!-- HEADER -->
  <header class="header">
    <div class="logo">
      <img src="/icons/icon48.png" width="20" height="20" alt="Signal Logo" style="border-radius: 4px;" />
      Signal
    </div>
    <div class="header-icons">
      <button class="icon-btn" @click="toggleTheme" title="Toggle Theme" v-html="themeIcon"></button>
      <button class="icon-btn" @click="showSettings = true" title="Settings">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </div>
  </header>

  <!-- MAIN LAYOUT -->
  <main v-show="!isRecording" class="main-container">
    <!-- RECORDING -->
    <div class="recording-section">
      <div class="section-label">
        Screen Recording
        <span class="tab-badge" title="Buffer Duration">Buffer: {{ bufferMinutes }}m</span>
      </div>
      <button ref="startBtnRef" class="action-btn" @click="startRecording" :disabled="isRestricted"
        :style="isRestricted ? { opacity: '0.5', cursor: 'not-allowed' } : {}"
        :title="isRestricted ? 'Recording is not allowed on system pages' : ''">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <circle cx="12" cy="12" r="3" fill="white"></circle>
        </svg>
        {{ startBtnText }}
      </button>
    </div>

    <!-- SCREENSHOTS -->
    <div style="display:flex; flex-direction:column; gap:8px;">
      <div class="section-label">Screen Capture</div>
      <div class="screenshot-grid">
        <div class="tool-card" @click="screenshot('visible')" :style="isRestricted ? { opacity: '0.5', pointerEvents: 'none' } : {}">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          <div class="tool-label">Visible View</div>
        </div>
        <div class="tool-card" @click="screenshot('region')" :style="isRestricted ? { opacity: '0.5', pointerEvents: 'none' } : {}">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 2v14a2 2 0 0 0 2 2h14"></path>
            <path d="M18 22V8a2 2 0 0 0-2-2H2"></path>
          </svg>
          <div class="tool-label">Selected Area</div>
        </div>
        <div class="tool-card full-width" @click="screenshot('full')" :style="isRestricted ? { opacity: '0.5', pointerEvents: 'none' } : {}">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
            <circle cx="12" cy="13" r="4"></circle>
          </svg>
          <div class="tool-label">Entire Page</div>
        </div>
      </div>
    </div>

    <div class="error-msg">{{ errorMsg }}</div>
  </main>

  <!-- ACTIVE RECORDING OVERLAY -->
  <div v-show="isRecording" class="recording-overlay">
    <div class="recording-pulse"></div>
    <div style="font-size:12px; font-weight:600; color:var(--text-secondary); text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">
      Recording</div>
    <div class="timer">REC</div>

    <div class="controls-row">
      <button class="action-btn btn-secondary" @click="togglePause">
        <span v-if="isPaused" v-html="resumeIcon" style="display:flex;align-items:center;gap:8px;color:#00cf95;"></span>
        <span v-else v-html="pauseIcon" style="display:flex;align-items:center;gap:8px;"></span>
      </button>
      <button class="action-btn btn-danger" @click="stopRecording" :disabled="stopDisabled">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="6" y="6" width="12" height="12" fill="currentColor"></rect>
        </svg>
        {{ stopBtnText }}
      </button>
    </div>
  </div>

  <!-- SETTINGS OVERLAY -->
  <div v-if="showSettings" class="settings-view">
    <div class="settings-header">
      <div style="display:flex; align-items:center;">
        <button class="icon-btn" @click="showSettings = false" style="margin-right:8px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </button>
        Settings
      </div>
      <button class="action-btn" @click="saveSettings"
        style="width:auto; padding:8px; margin-left:auto; display:flex; align-items:center; justify-content:center;"
        title="Save Settings" v-html="saveIcon">
      </button>
    </div>

    <div class="settings-tabs" style="display:flex; border-bottom:1px solid var(--border); background:var(--bg-card);">
      <button :class="['setting-tab', { active: settingsTab === 'general' }]" @click="settingsTab = 'general'">General</button>
      <button :class="['setting-tab', { active: settingsTab === 'security' }]" @click="settingsTab = 'security'">Security</button>
      <button :class="['setting-tab', { active: settingsTab === 'integrations' }]" @click="settingsTab = 'integrations'">Integrations</button>
    </div>

    <div class="settings-body">
      <!-- GENERAL TAB -->
      <div v-show="settingsTab === 'general'" class="settings-content active">
        <div class="setting-item">
          <label class="setting-label" style="display:flex; justify-content:space-between; align-items:center;">
            Show Widget
            <label class="switch"><input type="checkbox" v-model="settings.showWidget"><span class="slider"></span></label>
          </label>
        </div>

        <div class="setting-item">
          <label class="setting-label" style="display:flex; justify-content:space-between; align-items:center;">
            Show Clicks
            <label class="switch"><input type="checkbox" v-model="settings.showClicks"><span class="slider"></span></label>
          </label>
        </div>

        <div class="setting-item" :style="{ opacity: settings.showClicks ? '1' : '0.5', pointerEvents: settings.showClicks ? 'auto' : 'none' }">
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <div>
              <label class="setting-label">Click Size</label>
              <select v-model="settings.clickSize">
                <option value="10">Small</option>
                <option value="20">Medium</option>
                <option value="40">Large</option>
                <option value="60">Huge</option>
              </select>
            </div>
            <div>
              <label class="setting-label">Click Color</label>
              <div style="display:flex; align-items:center; gap:8px;">
                <input type="color" v-model="settings.clickColor"
                  style="width:100%; height:32px; padding:0; border:var(--border); border-radius:4px; cursor:pointer;">
              </div>
            </div>
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label">Buffer Duration (mins)</label>
          <input type="number" v-model.number="settings.bufferMinutes" min="1" max="10">
        </div>

        <div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-secondary); margin-bottom:8px; margin-top:4px;">Toast Notifications</div>

        <div class="setting-item">
          <label class="setting-label" style="display:flex; justify-content:space-between; align-items:center;">
            Console Error Toasts
            <label class="switch"><input type="checkbox" v-model="settings.toastConsole"><span class="slider"></span></label>
          </label>
        </div>

        <div class="setting-item">
          <label class="setting-label" style="display:flex; justify-content:space-between; align-items:center;">
            Network Error Toasts
            <label class="switch"><input type="checkbox" v-model="settings.toastNetwork"><span class="slider"></span></label>
          </label>
        </div>
      </div>

      <!-- SECURITY TAB -->
      <div v-show="settingsTab === 'security'" class="settings-content active">
        <div class="setting-item">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <label class="setting-label" style="margin-bottom:0;">Headers to Anonymize</label>
            <button class="action-btn" @click="loadDefaults" style="width:auto; padding:4px 8px; font-size:10px;">Load Defaults</button>
          </div>
          <textarea v-model="settings.securityHeaders" placeholder="Content-Type, Authorization, etc." style="height:60px;"></textarea>
          <div style="font-size:10px; color:var(--text-secondary); margin-top:4px;">Comma separated keys to REDACT (values will be hidden).</div>
        </div>

        <div class="setting-item">
          <label class="setting-label">Anonymize LocalStorage Keys</label>
          <textarea v-model="settings.securityStorage" placeholder="token, auth, secret..." style="height:60px;"></textarea>
          <div style="font-size:10px; color:var(--text-secondary); margin-top:4px;">Comma separated keys to REDACT.</div>
        </div>

        <div class="setting-item">
          <label class="setting-label">Anonymize Cookies</label>
          <textarea v-model="settings.securityCookies" placeholder="session_id, token..." style="height:60px;"></textarea>
          <div style="font-size:10px; color:var(--text-secondary); margin-top:4px;">Comma separated keys to REDACT.</div>
        </div>
      </div>

      <!-- INTEGRATIONS TAB -->
      <div v-show="settingsTab === 'integrations'" class="settings-content active">
        <div style="font-size:12px; font-weight:700; color:var(--text-main); margin-bottom:12px;">Jira Integration</div>
        <div class="setting-item">
          <label class="setting-label">Domain</label>
          <input type="text" v-model="settings.jiraDomain" placeholder="company.atlassian.net">
        </div>
        <div class="setting-item">
          <label class="setting-label">Email</label>
          <input type="text" v-model="settings.jiraEmail" placeholder="email@example.com">
        </div>
        <div class="setting-item">
          <label class="setting-label">API Token</label>
          <input type="password" v-model="settings.jiraToken">
        </div>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <footer class="footer">
    <button class="icon-btn" @click="openDashboard" title="Open Dashboard">
      <span style="font-size:12px; font-weight:500; margin-right:6px;">Dashboard</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="7" height="7"></rect>
        <rect x="14" y="3" width="7" height="7"></rect>
        <rect x="14" y="14" width="7" height="7"></rect>
        <rect x="3" y="14" width="7" height="7"></rect>
      </svg>
    </button>
  </footer>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';

const DEFAULT_SENSITIVE_HEADERS = ['Authorization', 'Cookie', 'Set-Cookie', 'X-Auth-Token', 'Proxy-Authorization'];
const DEFAULT_SENSITIVE_STORAGE = ['token', 'auth', 'session', 'secret', 'key', 'password', 'user', 'account'];
const DEFAULT_SENSITIVE_COOKIES = ['JSESSIONID', 'PHPSESSID', 'connect.sid', 'token', 'auth'];

const showSettings = ref(false);
const settingsTab = ref('general');
const isRecording = ref(false);
const isPaused = ref(false);
const isRestricted = ref(false);
const errorMsg = ref('');
const startBtnText = ref('Start Recording');
const stopBtnText = ref('Stop');
const stopDisabled = ref(false);
const startBtnRef = ref<HTMLButtonElement | null>(null);
const currentTabId = ref<number | undefined>(undefined);
const theme = ref('light');

const settings = reactive({
  showWidget: true,
  showClicks: true,
  clickSize: '20',
  clickColor: '#fa383e',
  bufferMinutes: 2,
  toastConsole: true,
  toastNetwork: true,
  jiraDomain: '',
  jiraEmail: '',
  jiraToken: '',
  securityHeaders: DEFAULT_SENSITIVE_HEADERS.join(', '),
  securityStorage: DEFAULT_SENSITIVE_STORAGE.join(', '),
  securityCookies: DEFAULT_SENSITIVE_COOKIES.join(', '),
});

const bufferMinutes = computed(() => settings.bufferMinutes || 2);

const saveIconDefault = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>`;
const saveIconCheck = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--success);"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
const saveIcon = ref(saveIconDefault);

const sunIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
const moonIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

const themeIcon = computed(() => theme.value === 'dark' ? sunIcon : moonIcon);

const pauseIcon = `<svg class="icon-sm" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause`;
const resumeIcon = `<svg class="icon-sm" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Resume`;

function applyTheme(t: string) {
  theme.value = t;
  document.documentElement.setAttribute('data-theme', t);
}

function toggleTheme() {
  chrome.storage.local.get(['theme'], (result) => {
    const current = result.theme || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    chrome.storage.local.set({ theme: next });
    applyTheme(next);
  });
}

function checkStatus() {
  chrome.runtime.sendMessage({ action: 'checkStatus', tabId: currentTabId.value }, (response) => {
    if (chrome.runtime.lastError) return;
    if (response && response.isRecording) {
      isRecording.value = true;
      isPaused.value = !!response.isPaused;
    } else {
      isRecording.value = false;
      isPaused.value = false;
    }
  });
}

function startRecording() {
  startBtnText.value = 'Starting...';
  if (startBtnRef.value) startBtnRef.value.disabled = true;

  chrome.runtime.sendMessage({ action: 'start', tabId: currentTabId.value }, (response) => {
    if (response && response.status === 'started') {
      isRecording.value = true;
      errorMsg.value = '';
    } else {
      startBtnText.value = 'Start Recording';
      if (startBtnRef.value) startBtnRef.value.disabled = false;
      errorMsg.value = 'Error: ' + (response ? response.message : 'Unknown error');
    }
  });
}

function stopRecording() {
  stopDisabled.value = true;
  stopBtnText.value = 'Processing...';

  chrome.runtime.sendMessage({ action: 'stop', tabId: currentTabId.value }, () => {
    chrome.runtime.sendMessage({ action: 'saveReport', tabId: currentTabId.value }, (res) => {
      if (res && res.status === 'saved') {
        chrome.tabs.create({ url: 'src/viewer/index.html' });
        window.close();
      } else {
        stopDisabled.value = false;
        stopBtnText.value = 'Stop';
        if (res && res.error) {
          errorMsg.value = 'Error saving report: ' + res.error;
          isRecording.value = false;
        }
      }
    });
  });
}

function togglePause() {
  chrome.runtime.sendMessage({ action: 'togglePause', tabId: currentTabId.value }, () => {
    setTimeout(checkStatus, 100);
  });
}

function screenshot(type: string) {
  chrome.runtime.sendMessage({ action: 'initiateScreenshot', type, tabId: currentTabId.value });
  window.close();
}

function openDashboard() {
  chrome.tabs.create({ url: 'src/viewer/index.html' });
}

function loadDefaults() {
  settings.securityHeaders = DEFAULT_SENSITIVE_HEADERS.join(', ');
  settings.securityStorage = DEFAULT_SENSITIVE_STORAGE.join(', ');
  settings.securityCookies = DEFAULT_SENSITIVE_COOKIES.join(', ');
}

function saveSettings() {
  const data = {
    autoRecord: false,
    showWidget: settings.showWidget,
    showClicks: settings.showClicks,
    clickSize: parseInt(settings.clickSize) || 20,
    clickColor: settings.clickColor,
    domains: [],
    bufferMinutes: settings.bufferMinutes || 2,
    toastConsole: settings.toastConsole,
    toastNetwork: settings.toastNetwork,
    jiraType: 'server',
    jiraDomain: settings.jiraDomain.trim(),
    jiraEmail: settings.jiraEmail.trim(),
    jiraToken: settings.jiraToken.trim(),
    securityHeaders: settings.securityHeaders.split(',').map((s: string) => s.trim()).filter((s: string) => s),
    securityStorage: settings.securityStorage.split(',').map((s: string) => s.trim()).filter((s: string) => s),
    securityCookies: settings.securityCookies.split(',').map((s: string) => s.trim()).filter((s: string) => s),
  };

  chrome.storage.local.set({ settings: data }, () => {
    saveIcon.value = saveIconCheck;
    setTimeout(() => { saveIcon.value = saveIconDefault; }, 1000);
    setTimeout(() => { showSettings.value = false; }, 500);
  });
}

onMounted(async () => {
  // Load theme
  chrome.storage.local.get(['theme'], (result) => {
    applyTheme((result.theme as string) || 'light');
  });

  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const restrictedProtocols = ['chrome:', 'edge:', 'about:', 'view-source:', 'chrome-extension:', 'https://chrome.google.com/webstore'];
  if (tab) {
    currentTabId.value = tab.id;
    if (tab.url && restrictedProtocols.some((p: string) => (tab.url as string).startsWith(p))) {
      isRestricted.value = true;
      errorMsg.value = 'Recording is disabled on this page.';
    }
    checkStatus();
  }

  // Load settings
  chrome.storage.local.get(['settings'], (result) => {
    if (result.settings) {
      const s = result.settings as any;
      settings.showWidget = s.showWidget !== false;
      settings.showClicks = s.showClicks !== false;
      if (s.bufferMinutes) settings.bufferMinutes = s.bufferMinutes;
      if (s.jiraDomain) settings.jiraDomain = s.jiraDomain;
      if (s.jiraEmail) settings.jiraEmail = s.jiraEmail;
      if (s.jiraToken) settings.jiraToken = s.jiraToken;
      if (s.clickSize) settings.clickSize = String(s.clickSize);
      if (s.clickColor) settings.clickColor = String(s.clickColor);
      settings.toastConsole = s.toastConsole !== false;
      settings.toastNetwork = s.toastNetwork !== false;
      settings.securityHeaders = Array.isArray(s.securityHeaders) ? s.securityHeaders.join(', ') : String(s.securityHeaders || DEFAULT_SENSITIVE_HEADERS.join(', '));
      settings.securityStorage = Array.isArray(s.securityStorage) ? s.securityStorage.join(', ') : String(s.securityStorage || DEFAULT_SENSITIVE_STORAGE.join(', '));
      settings.securityCookies = Array.isArray(s.securityCookies) ? s.securityCookies.join(', ') : String(s.securityCookies || DEFAULT_SENSITIVE_COOKIES.join(', '));
    }
  });
});
</script>

<style>
:root {
  /* Shared Palette */
  --primary: #2e89ff;
  --primary-hover: #1877f2;
  --danger: #fa383e;
  --success: #31a24c;

  /* Light Theme (Default) */
  --bg-main: #ffffff;
  --bg-card: #f8fafc;
  --bg-hover: #f1f5f9;
  --text-main: #0f172a;
  --text-secondary: #64748b;
  --border: #e2e8f0;
  --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);

  --font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

[data-theme="dark"] {
  --bg-main: #121212;
  --bg-card: #18191a;
  --bg-hover: #2d2e30;
  --text-main: #e4e6eb;
  --text-secondary: #b0b3b8;
  --border: #3e4042;
  --shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

body {
  width: 320px;
  margin: 0;
  padding: 0;
  font-family: var(--font-family);
  background-color: var(--bg-main);
  color: var(--text-main);
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
  min-height: auto;
}

/* Header */
.header {
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border);
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 16px;
  color: var(--text-main);
}

.logo svg {
  color: var(--primary);
}

.header-icons {
  display: flex;
  gap: 8px;
}

.icon-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-btn:hover {
  background: var(--bg-hover);
  color: var(--primary);
  transform: translateY(-1px);
}

/* Main Container */
.main-container {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Section Labels */
.section-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Recording Section */
.recording-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.action-btn {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 8px;
  background: var(--primary);
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);
}

.action-btn:hover {
  background: var(--primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
}

.action-btn:active {
  transform: translateY(0);
}

/* Screenshot Grid */
.screenshot-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.tool-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.tool-card:hover {
  border-color: var(--primary);
  background: var(--bg-hover);
  transform: translateY(-2px);
  box-shadow: var(--shadow);
}

.tool-card svg {
  color: var(--text-secondary);
  transition: color 0.2s;
}

.tool-card:hover svg {
  color: var(--primary);
}

.tool-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-main);
}

.full-width {
  grid-column: span 2;
}

/* Footer */
.footer {
  padding: 10px 16px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  background: var(--bg-card);
}

/* Active Recording State */
.recording-overlay {
  background: var(--bg-main);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px;
  flex: 1;
  min-height: 140px;
}

.recording-pulse {
  width: 10px;
  height: 10px;
  background-color: var(--danger);
  border-radius: 50%;
  margin-bottom: 8px;
  box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
  animation: pulse-red 2s infinite;
}

@keyframes pulse-red {
  0% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
  }

  70% {
    transform: scale(1);
    box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
  }

  100% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
  }
}

.timer {
  font-size: 24px;
  font-weight: 700;
  font-family: monospace;
  color: var(--text-main);
  margin-bottom: 20px;
}

.controls-row {
  display: flex;
  gap: 12px;
  width: 100%;
}

.btn-secondary {
  background: var(--bg-card);
  color: var(--text-main);
  border: 1px solid var(--border);
  box-shadow: none;
}

.btn-secondary:hover {
  background: var(--bg-hover);
  border-color: var(--text-secondary);
  box-shadow: none;
}

.btn-danger {
  background: var(--danger);
  color: white;
}

.btn-danger:hover {
  background: #dc2626;
  box-shadow: 0 4px 8px rgba(239, 68, 68, 0.3);
}

.recording-overlay .action-btn {
  padding: 8px 16px;
  font-size: 13px;
  height: auto;
}

/* Toggle Switch */
.switch {
  position: relative;
  display: inline-block;
  width: 32px;
  height: 18px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--border);
  transition: .3s;
  border-radius: 20px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 14px;
  width: 14px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: .3s;
  border-radius: 50%;
}

input:checked+.slider {
  background-color: var(--primary);
}

input:checked+.slider:before {
  transform: translateX(14px);
}

/* Settings Overlay */
.settings-view {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--bg-main);
  z-index: 100;
  display: flex;
  flex-direction: column;
}

.settings-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 10px;
}

.settings-body {
  padding: 16px;
  flex: 1;
  overflow-y: auto;
}

.setting-item {
  margin-bottom: 16px;
}

.setting-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 6px;
  display: block;
}

input[type="text"],
input[type="number"],
input[type="password"],
select,
textarea {
  width: 100%;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text-main);
  font-size: 13px;
  box-sizing: border-box;
}

input:focus,
select:focus,
textarea:focus {
  outline: none;
  border-color: var(--primary);
}

/* Tab Badge */
.tab-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--primary);
  background: rgba(59, 130, 246, 0.1);
  padding: 2px 8px;
  border-radius: 12px;
  margin-left: auto;
}

/* Settings Tabs */
.setting-tab {
  flex: 1;
  background: transparent;
  border: none;
  padding: 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.setting-tab.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
  background: var(--bg-hover);
}

.settings-content {
  padding-top: 10px;
}

.icon-sm {
  width: 16px;
  height: 16px;
}

.error-msg {
  color: var(--danger);
  font-size: 11px;
  text-align: center;
}
</style>
