<template>
  <div class="app-layout">
    <!-- SIDEBAR -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <img src="/icons/icon48.png" width="24" height="24" alt="Signal Logo" style="margin-right:8px; border-radius: 4px;" />
        Signal Report
      </div>

      <nav class="sidebar-nav">
        <div v-for="tab in tabs" :key="tab.id"
          :class="['nav-item', { active: activeTab === tab.id, 'nav-item-primary': tab.primary }]"
          @click="activeTab = tab.id">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" v-html="tab.icon"></svg>
          {{ tab.label }}
        </div>
      </nav>
    </aside>

    <!-- MAIN CONTENT -->
    <main class="main-wrapper">
      <header class="top-header">
        <div class="header-left">
          <button id="importBtn" class="action-btn" @click="triggerImport">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            Import
          </button>
          <span class="report-title">{{ reportDate }}</span>
        </div>

        <div class="header-center">
          <button class="action-btn" :class="{ active: isEditorMode }" @click="isEditorMode = !isEditorMode"
            :title="isEditorMode ? 'Exit Edit Mode' : 'Edit Report'"
            :style="isEditorMode
              ? 'border: 1px solid var(--success); color: var(--success); background: rgba(49,162,76,0.15);'
              : 'border: 1px solid var(--primary); color: var(--primary); background: rgba(46, 137, 255, 0.1);'">
            <svg v-if="!isEditorMode" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            {{ isEditorMode ? 'Editing' : 'Edit Report' }}
          </button>
        </div>

        <div class="header-right">
          <button class="action-btn" @click="toggleTheme" title="Toggle Dark Mode">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          </button>

          <!-- Share Dropdown -->
          <div style="position:relative; display:inline-block;">
            <button class="action-btn" @click.stop="showShareMenu = !showShareMenu" title="Share Options">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
              </svg>
              Share ▾
            </button>
            <div v-if="showShareMenu" class="share-dropdown"
              style="position:absolute; top:100%; right:0; background:var(--bg-card); border:1px solid var(--border-color); border-radius:8px; min-width:200px; z-index:100; box-shadow: 0 10px 25px rgba(0,0,0,0.4); padding: 4px 0;">
              <div class="dropdown-item" @click="handleShareAction('export')">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                <span>Export Recording</span>
              </div>
              <div class="dropdown-item" @click="handleShareAction('har')">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                <span>Download HAR</span>
              </div>
              <div class="dropdown-item" @click="handleShareAction('webhook')">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                <span>Send via Webhook</span>
              </div>
              <div class="dropdown-divider"></div>
              <div class="dropdown-item" @click="handleShareAction('llm')">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
                <span>LLM Context</span>
              </div>
              <div class="dropdown-item" @click="handleShareAction('playwright')">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                <span>Playwright Script</span>
              </div>
              <div class="dropdown-item" @click="handleShareAction('puppeteer')">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                <span>Puppeteer Script</span>
              </div>
            </div>
          </div>

          <button v-if="jiraConfigured" class="action-btn" @click="openJira" title="Send to JIRA">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="8" y1="12" x2="16" y2="12"></line>
              <line x1="12" y1="8" x2="12" y2="16"></line>
            </svg>
            JIRA
          </button>

          <button class="action-btn primary" @click="openReplayModal" title="Replay Events">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            Replay
          </button>
        </div>
      </header>

      <!-- CONTENT AREA -->
      <div class="content-area">
        <!-- Empty State -->
        <div v-if="!hasData" class="empty-state">
          <svg class="empty-icon" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="12" y1="18" x2="12" y2="12"></line>
            <line x1="9" y1="15" x2="15" y2="15"></line>
          </svg>
          <h2 style="margin-top:0; color:var(--text-main); font-size:20px; font-weight:600;">No Report Loaded</h2>
          <p style="margin:10px 0 25px; max-width:400px; line-height:1.5; color:var(--text-secondary);">Import a JSON or ZIP bug report file to start debugging.</p>
          <button class="action-btn primary" style="padding:10px 24px; font-size:15px;" @click="triggerImport">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:8px;">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            Import Report
          </button>
        </div>

        <!-- Tab Content -->
        <template v-if="hasData">
          <div v-show="activeTab === 'timeline'" class="tab-content active-tab">
            <TimelineTab ref="timelineRef" :data="reportData!" :is-editor-mode="isEditorMode" @delete-event="onDeleteEvent" />
          </div>
          <div v-show="activeTab === 'environment'" class="tab-content active-tab">
            <EnvironmentTab :environment="reportData!.environment" />
          </div>
          <div v-show="activeTab === 'console'" class="tab-content active-tab">
            <ConsoleTab :errors="reportData!.consoleErrors" />
          </div>
          <div v-show="activeTab === 'network'" class="tab-content active-tab">
            <NetworkTab :har="reportData!.har" :is-editor-mode="isEditorMode" />
          </div>
          <div v-show="activeTab === 'storage'" class="tab-content active-tab">
            <StorageTab :storage="reportData!.storage" :is-editor-mode="isEditorMode" />
          </div>
          <div v-show="activeTab === 'issues'" class="tab-content active-tab">
            <IssuesTab :issues="reportData!.issues" :screencast="reportData!.screencast" :events="reportData!.userEvents" :environment="reportData!.environment" />
          </div>
        </template>
      </div>
    </main>

    <!-- Modals -->
    <ReplayModal :visible="showReplayModal" :report-data="reportData" @close="showReplayModal = false" />
    <ScriptModal :visible="showScriptModal" :title="scriptModalTitle" :content="scriptModalContent" @close="showScriptModal = false" />
    <WebhookModal :visible="showWebhookModal" :report-data="reportData" :screenshot="currentScreenshot" @close="showWebhookModal = false" />

    <!-- Hidden file input -->
    <input ref="fileInputRef" type="file" accept=".json,.zip" style="display:none" @change="onFileImport" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useTheme } from './composables/useTheme';
import { useViewerState } from './composables/useViewerState';
import { generatePlaywrightScript, generatePuppeteerScript, generateLLMContext } from './composables/useScriptGenerator';
import TimelineTab from './components/TimelineTab.vue';
import EnvironmentTab from './components/EnvironmentTab.vue';
import ConsoleTab from './components/ConsoleTab.vue';
import NetworkTab from './components/NetworkTab.vue';
import StorageTab from './components/StorageTab.vue';
import IssuesTab from './components/IssuesTab.vue';
import ReplayModal from './components/ReplayModal.vue';
import ScriptModal from './components/ScriptModal.vue';
import WebhookModal from './components/WebhookModal.vue';

const { toggleTheme } = useTheme();
const { reportData, reportDate, activeTab, hasData, importFromFile, loadFromStorage } = useViewerState();

const fileInputRef = ref<HTMLInputElement | null>(null);
const timelineRef = ref<any>(null);
const showShareMenu = ref(false);
const isEditorMode = ref(false);
const showReplayModal = ref(false);
const showScriptModal = ref(false);
const showWebhookModal = ref(false);
const scriptModalTitle = ref('');
const scriptModalContent = ref('');
const jiraConfigured = ref(false);

const currentScreenshot = computed(() => timelineRef.value?.currentFrameSrc || '');

const tabs = [
  { id: 'timeline', label: 'Timeline', primary: true, icon: '<path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"></path><path d="M13 13l6 6"></path>' },
  { id: 'environment', label: 'Details', primary: false, icon: '<line x1="12" y1="20" x2="12" y2="10"></line><line x1="18" y1="20" x2="18" y2="4"></line><line x1="6" y1="20" x2="6" y2="16"></line>' },
  { id: 'console', label: 'Console Errors', primary: false, icon: '<polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line>' },
  { id: 'network', label: 'Network (HAR)', primary: false, icon: '<path d="M5 12.55a11 11 0 0 1 14.08 0"></path><path d="M1.42 9a16 16 0 0 1 21.16 0"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line>' },
  { id: 'storage', label: 'Storage', primary: false, icon: '<ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>' },
  { id: 'issues', label: 'Issues', primary: false, icon: '<polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>' },
];

function triggerImport() {
  fileInputRef.value?.click();
}

async function onFileImport(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    await importFromFile(file);
  } catch (err: any) {
    alert(err.message);
  }
  input.value = '';
}

function handleShareAction(action: string) {
  showShareMenu.value = false;
  if (!reportData.value) { alert('No report loaded'); return; }
  if (action === 'export') exportRecording();
  else if (action === 'har') exportHar();
  else if (action === 'webhook') showWebhookModal.value = true;
  else if (action === 'llm') {
    scriptModalTitle.value = 'LLM Context';
    scriptModalContent.value = generateLLMContext(reportData.value);
    showScriptModal.value = true;
  } else if (action === 'playwright') {
    scriptModalTitle.value = 'Playwright Script';
    scriptModalContent.value = generatePlaywrightScript(reportData.value);
    showScriptModal.value = true;
  } else if (action === 'puppeteer') {
    scriptModalTitle.value = 'Puppeteer Script';
    scriptModalContent.value = generatePuppeteerScript(reportData.value);
    showScriptModal.value = true;
  }
}

function onDeleteEvent(index: number) {
  if (reportData.value?.userEvents && index >= 0 && index < reportData.value.userEvents.length) {
    reportData.value.userEvents.splice(index, 1);
    reportData.value = { ...reportData.value };
  }
}

function exportRecording() {
  if (!reportData.value) return;
  const jsonStr = JSON.stringify(reportData.value, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `debug-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

function exportHar() {
  if (!reportData.value?.har) { alert('No HAR data available in this report'); return; }

  // Deep-clone and sanitize all numeric fields to prevent NaN errors in HAR viewers
  const har = JSON.parse(JSON.stringify(reportData.value.har));
  const safeNum = (v: unknown, fallback = 0): number => {
    const n = Number(v);
    return isFinite(n) ? n : fallback;
  };

  if (har.log?.entries) {
    for (const entry of har.log.entries) {
      entry.time = safeNum(entry.time);

      // Validate startedDateTime
      if (!entry.startedDateTime || isNaN(Date.parse(entry.startedDateTime))) {
        entry.startedDateTime = new Date().toISOString();
      }

      // Request
      if (entry.request) {
        entry.request.headersSize = safeNum(entry.request.headersSize, -1);
        entry.request.bodySize = safeNum(entry.request.bodySize, -1);
        if (!entry.request.httpVersion) entry.request.httpVersion = 'HTTP/1.1';
        if (!entry.request.cookies) entry.request.cookies = [];
        if (!entry.request.queryString) entry.request.queryString = [];
        if (!entry.request.headers) entry.request.headers = [];
      }

      // Response
      if (entry.response) {
        entry.response.status = safeNum(entry.response.status);
        entry.response.headersSize = safeNum(entry.response.headersSize, -1);
        entry.response.bodySize = safeNum(entry.response.bodySize, -1);
        if (!entry.response.statusText) entry.response.statusText = '';
        if (!entry.response.httpVersion) entry.response.httpVersion = 'HTTP/1.1';
        if (!entry.response.cookies) entry.response.cookies = [];
        if (!entry.response.headers) entry.response.headers = [];
        if (!entry.response.content) entry.response.content = {};
        entry.response.content.size = safeNum(entry.response.content.size);
        if (!entry.response.content.mimeType) entry.response.content.mimeType = 'application/octet-stream';
        if (entry.response.redirectURL == null) entry.response.redirectURL = '';
      } else {
        entry.response = {
          status: 0, statusText: '', httpVersion: 'HTTP/1.1',
          headers: [], cookies: [],
          content: { size: 0, mimeType: 'application/octet-stream' },
          redirectURL: '', headersSize: -1, bodySize: -1
        };
      }

      // Timings
      if (!entry.timings) entry.timings = { send: 0, wait: 0, receive: 0 };
      entry.timings.send = safeNum(entry.timings.send);
      entry.timings.wait = safeNum(entry.timings.wait);
      entry.timings.receive = safeNum(entry.timings.receive);

      if (!entry.cache) entry.cache = {};
    }
  }

  // Sanitize pages
  if (har.log?.pages) {
    for (const page of har.log.pages) {
      if (!page.startedDateTime || isNaN(Date.parse(page.startedDateTime))) {
        page.startedDateTime = new Date().toISOString();
      }
      if (!page.pageTimings) page.pageTimings = {};
    }
  }

  const jsonStr = JSON.stringify(har, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `network-${new Date().toISOString().replace(/[:.]/g, '-')}.har`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

function openJira() {
  if (!reportData.value) { alert('No report loaded'); return; }
  const blob = new Blob([JSON.stringify(reportData.value, null, 2)], { type: 'application/json' });
  const filename = `debug-report-${new Date().toISOString()}.json`;
  if ((window as any).jiraHelper) (window as any).jiraHelper.showModal(blob, filename);
  else alert('JIRA Helper not loaded.');
}

function openReplayModal() {
  if (!reportData.value?.userEvents?.length) { alert('No events to replay'); return; }
  showReplayModal.value = true;
}

// Close share menu on outside click
document.addEventListener('click', () => { showShareMenu.value = false; });

onMounted(() => {
  loadFromStorage();
  // Detect JIRA helper availability
  const jh = (window as any).jiraHelper;
  if (jh && jh.readyPromise) {
    jh.readyPromise.then(() => {
      if (jh.isConfigured && jh.isConfigured()) jiraConfigured.value = true;
    }).catch(() => {});
  } else if (jh && jh.isConfigured && jh.isConfigured()) {
    jiraConfigured.value = true;
  }
});
</script>

<style>
/* ──────────────────── Global Reset & CSS Variables ──────────────────── */
:root {
  --bg-app: #121212;
  --bg-sidebar: #18191a;
  --bg-header: #18191a;
  --bg-card: #242526;
  --bg-hover: #2d2e30;
  --bg-input: #3a3b3c;
  --border-color: #3e4042;
  --text-main: #e4e6eb;
  --text-secondary: #b0b3b8;
  --primary: #2e89ff;
  --primary-hover: #1877f2;
  --success: #31a24c;
  --danger: #fa383e;
  --warning: #f0ad4e;
  --info: #2e89ff;
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  --shadow: 0 4px 12px rgba(0,0,0,0.3);
}
[data-theme="light"] {
  --bg-app: #f0f2f5;
  --bg-sidebar: #ffffff;
  --bg-header: #ffffff;
  --bg-card: #ffffff;
  --bg-hover: #f2f2f2;
  --bg-input: #f0f2f5;
  --border-color: #dddfe2;
  --text-main: #050505;
  --text-secondary: #65676b;
  --primary: #1877f2;
  --shadow: 0 1px 2px rgba(0,0,0,0.2);
}
* { box-sizing: border-box; }
html, body, #app { margin:0; padding:0; height:100%; overflow:hidden; }
body {
  font-family: var(--font-family);
  background: var(--bg-app);
  color: var(--text-main);
}
</style>

<style scoped>
/* ──────────────────── Layout ──────────────────── */
.app-layout { display: flex; width: 100%; height: 100vh; }
.sidebar { width: 250px; background: var(--bg-sidebar); border-right: 1px solid var(--border-color); display: flex; flex-direction: column; flex-shrink: 0; z-index: 20; }
.sidebar-header { height: 55px; display: flex; align-items: center; padding: 0 20px; border-bottom: 1px solid var(--border-color); font-weight: 700; font-size: 16px; gap: 10px; color: var(--text-main); }
.sidebar-nav { flex: 1; padding: 15px 10px; overflow-y: auto; display: flex; flex-direction: column; gap: 5px; }
.nav-item { display: flex; align-items: center; padding: 10px 15px; color: var(--text-secondary); text-decoration: none; font-size: 14px; font-weight: 500; cursor: pointer; border-radius: 6px; transition: all 0.2s; }
.nav-item svg { margin-right: 12px; opacity: 0.7; }
.nav-item:hover { background: var(--bg-hover); color: var(--text-main); }
.nav-item.active { background: rgba(46,137,255,0.15); color: var(--primary); }
.nav-item.active svg { opacity: 1; stroke: var(--primary); }
.nav-item.nav-item-primary { border-left: 3px solid var(--primary); font-weight: 700; position: relative; }
.nav-item.nav-item-primary::after { content: ''; position: absolute; right: 12px; top: 50%; transform: translateY(-50%); width: 6px; height: 6px; border-radius: 50%; background: var(--primary); opacity: 0.6; }
.nav-item.nav-item-primary.active { border-left-color: var(--primary); background: rgba(46,137,255,0.2); }
.nav-item.nav-item-primary.active::after { opacity: 1; animation: pulse-dot 2s ease-in-out infinite; }
@keyframes pulse-dot { 0%, 100% { opacity: 1; transform: translateY(-50%) scale(1); } 50% { opacity: 0.5; transform: translateY(-50%) scale(0.7); } }

/* ──────────────────── Main Area ──────────────────── */
.main-wrapper { flex: 1; display: flex; flex-direction: column; min-width: 0; background: var(--bg-app); }
.top-header { height: 55px; padding: 0 20px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-color); background: var(--bg-header); }
.header-left, .header-center, .header-right { display: flex; align-items: center; gap: 12px; }
.header-center { justify-content: center; flex: 1; }
.report-title { font-weight: 600; font-size: 14px; color: var(--text-secondary); }

/* ──────────────────── Buttons ──────────────────── */
.action-btn { background: transparent; border: 1px solid var(--border-color); color: var(--text-main); padding: 6px 12px; border-radius: 4px; font-size: 13px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s; font-family: inherit; }
.action-btn:hover { background: var(--bg-hover); border-color: var(--text-secondary); }
.action-btn.primary { background: var(--primary); border-color: var(--primary); color: white; }
.action-btn.primary:hover { background: var(--primary-hover); }

.dropdown-item {
  padding: 10px 16px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-main);
  display: flex;
  align-items: center;
  gap: 12px;
  transition: all 0.1s ease;
}
.dropdown-item:hover {
  background: var(--bg-hover);
  color: var(--primary);
}
.dropdown-item svg {
  opacity: 0.7;
}
.dropdown-item:hover svg {
  opacity: 1;
}
.dropdown-divider {
  height: 1px;
  background: var(--border-color);
  margin: 4px 0;
}
.dropdown-item:active { opacity: 0.75; }

/* ──────────────────── Content Area ──────────────────── */
.content-area { flex: 1; overflow: hidden; display: flex; position: relative; }
.tab-content { display: none; flex: 1; flex-direction: column; height: 100%; overflow: hidden; }
.tab-content.active-tab { display: flex; }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; width: 100%; position: absolute; top: 0; left: 0; background: var(--bg-app); z-index: 50; text-align: center; color: var(--text-secondary); }
.empty-icon { margin-bottom: 20px; opacity: 0.2; color: var(--text-main); }
</style>
