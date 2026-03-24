<template>
  <div class="network-container">
    <!-- Filter Bar -->
    <div class="filters-bar">
      <input class="search-input" placeholder="Filter requests..." v-model="searchQuery" />
      <span v-for="t in types" :key="t" :class="['filter-chip', { active: activeType === t }]"
        @click="activeType = t">{{ t === 'all' ? 'All' : t }}</span>
    </div>

    <div class="split-view">
      <!-- Table -->
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th class="sortable" @click="toggleSort('start')">Time {{ sortIcon('start') }}</th>
              <th class="sortable" @click="toggleSort('method')">Method {{ sortIcon('method') }}</th>
              <th class="sortable" @click="toggleSort('status')">Status {{ sortIcon('status') }}</th>
              <th class="sortable" @click="toggleSort('time')">Duration {{ sortIcon('time') }}</th>
              <th class="sortable" @click="toggleSort('size')">Size {{ sortIcon('size') }}</th>
              <th class="sortable" @click="toggleSort('url')">URL {{ sortIcon('url') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(entry, i) in filtered" :key="i" :class="{ selected: selectedIndex === i }" @click="selectEntry(entry, i)">
              <td class="time-cell">{{ formatStartTime(entry.startedDateTime) }}</td>
              <td :style="{ fontWeight: 700, color: methodColor(entry.request?.method) }">{{ entry.request?.method }}</td>
              <td><span :class="'badge status-' + statusGroup(entry.response?.status)">{{ entry.response?.status || '—' }}</span></td>
              <td><span :style="durationStyle(entry.time)">{{ formatDuration(entry.time) }}</span></td>
              <td class="size-cell">{{ formatSize(entry.response?.content?.size) }}</td>
              <td class="url-cell" :title="entry.request?.url">
                <div class="url-name">{{ urlName(entry.request?.url) }}</div>
                <div class="url-full">{{ entry.request?.url }}</div>
              </td>
            </tr>
            <tr v-if="filtered.length === 0" class="empty-row">
              <td colspan="6" class="empty-cell">
                <div class="empty-state-small">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3">
                    <path d="M5 12.55a11 11 0 0 1 14.08 0"></path>
                    <path d="M1.42 9a16 16 0 0 1 21.16 0"></path>
                    <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
                    <line x1="12" y1="20" x2="12.01" y2="20"></line>
                  </svg>
                  <span>{{ searchQuery || activeType !== 'all' ? 'No network requests match filters' : 'No network requests recorded' }}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Details Panel -->
      <div v-if="selectedEntry" class="detail-panel">
        <div class="detail-header">
          <span>{{ selectedEntry.request?.method }} {{ urlName(selectedEntry.request?.url) }}</span>
          <span class="close-btn" @click="selectedEntry = null; selectedIndex = -1">✕</span>
        </div>
        <div class="detail-tabs">
          <span :class="['dtab', { active: detailTab === 'headers' }]" @click="detailTab = 'headers'">Headers</span>
          <span :class="['dtab', { active: detailTab === 'request' }]" @click="detailTab = 'request'">Request</span>
          <span :class="['dtab', { active: detailTab === 'response' }]" @click="detailTab = 'response'">Response</span>
          <span :class="['dtab', { active: detailTab === 'timing' }]" @click="detailTab = 'timing'">Timing</span>
        </div>
        <div class="detail-body">
          <!-- Headers -->
          <div v-if="detailTab === 'headers'">
            <div class="detail-section">
              <div class="section-label" style="display:flex; justify-content:space-between; align-items:center;">
                <span>General</span>
                <div style="display:flex; gap:6px;">
                  <CopyButton :content="selectedEntry.request?.url" label="URL" />
                  <CopyButton :content="generateFetch(selectedEntry)" label="Fetch" />
                  <CopyButton :content="generateCurl(selectedEntry)" label="cURL" />
                </div>
              </div>
              <div class="kv-row"><span class="kv-key">URL</span><span class="kv-val url-wrap">{{ selectedEntry.request?.url }}</span></div>
              <div class="kv-row"><span class="kv-key">Method</span><span class="kv-val">{{ selectedEntry.request?.method }}</span></div>
              <div class="kv-row"><span class="kv-key">Status</span><span class="kv-val">{{ selectedEntry.response?.status }} {{ selectedEntry.response?.statusText }}</span></div>
            </div>
            <div class="detail-section" v-if="selectedEntry.response?.headers?.length">
              <div class="section-label">Response Headers</div>
              <div v-for="(h, hi) in selectedEntry.response.headers" :key="'rh-'+hi" class="kv-row">
                <span class="kv-key">{{ h.name }}</span>
                <span class="kv-val">{{ h.value }}</span>
                <button v-if="isEditorMode" :style="{ visibility: h.value === '[REDACTED]' ? 'hidden' : 'visible' }" class="redact-btn" @click="redactHeader(h)" title="Redact this header">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"></path><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                </button>
              </div>
            </div>
            <div class="detail-section" v-if="selectedEntry.request?.headers?.length">
              <div class="section-label">Request Headers</div>
              <div v-for="(h, hi) in selectedEntry.request.headers" :key="'qh-'+hi" class="kv-row">
                <span class="kv-key">{{ h.name }}</span>
                <span class="kv-val">{{ h.value }}</span>
                <button v-if="isEditorMode" :style="{ visibility: h.value === '[REDACTED]' ? 'hidden' : 'visible' }" class="redact-btn" @click="redactHeader(h)" title="Redact this header">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"></path><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                </button>
              </div>
            </div>
          </div>
          <!-- Request Body -->
          <div v-if="detailTab === 'request'">
            <div v-if="selectedEntry.request?.postData?.text" style="display:flex; flex-direction:column; gap:8px;">
              <div style="display:flex; justify-content:flex-end;">
                <CopyButton :content="selectedEntry.request.postData.text" label="Copy Body" />
              </div>
              <div class="code-block">{{ selectedEntry.request.postData.text }}</div>
            </div>
            <div v-else class="empty-detail">No request body</div>
          </div>
          <!-- Response Body -->
          <div v-if="detailTab === 'response'">
            <div v-if="selectedEntry.response?.content?.text" style="display:flex; flex-direction:column; gap:8px;">
              <div style="display:flex; justify-content:flex-end;">
                <CopyButton :content="selectedEntry.response.content.text" label="Copy Body" />
              </div>
              <div class="code-block">{{ selectedEntry.response.content.text }}</div>
            </div>
            <div v-else class="empty-detail">No response body captured</div>
          </div>
          <!-- Timing -->
          <div v-if="detailTab === 'timing'">
            <div class="timing-row" v-if="selectedEntry.timings">
              <div class="timing-item"><span class="timing-label">Send</span><span>{{ selectedEntry.timings.send }}ms</span></div>
              <div class="timing-item"><span class="timing-label">Wait</span><span>{{ selectedEntry.timings.wait }}ms</span></div>
              <div class="timing-item"><span class="timing-label">Receive</span><span>{{ selectedEntry.timings.receive }}ms</span></div>
              <div class="timing-item total"><span class="timing-label">Total</span><span>{{ formatDuration(selectedEntry.time) }}</span></div>
            </div>
            <div v-else class="empty-detail">No timing data</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useViewerState } from '../composables/useViewerState';
import CopyButton from './CopyButton.vue';

const props = defineProps<{
  har: any;
  isEditorMode: boolean;
}>();

const searchQuery = ref('');
const activeType = ref('all');
const sortKey = ref('start');
const sortDir = ref<'asc'|'desc'>('asc');
const selectedIndex = ref(-1);
const selectedEntry = ref<any>(null);
const detailTab = ref('headers');

const types = ['all', 'XHR', 'JS', 'CSS', 'Img', 'Doc', 'Font', 'Other'];

const { selectedNetworkEntry } = useViewerState();

watch(selectedNetworkEntry, (newVal) => {
  if (newVal) {
    if (activeType.value !== 'all') activeType.value = 'all';
    if (searchQuery.value) searchQuery.value = '';
    
    // reset sorting to default to ensure we don't hide it due to sort
    sortKey.value = 'start';
    sortDir.value = 'asc';

    nextTick(() => {
      const idx = filtered.value.findIndex((e: any) => 
        e === newVal || 
        (e.startedDateTime === newVal.startedDateTime && e.request?.url === newVal.request?.url)
      );
      if (idx !== -1) {
        selectEntry(filtered.value[idx], idx);
        nextTick(() => {
          const rows = document.querySelectorAll('.network-container tbody tr');
          if (rows[idx]) {
            rows[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        });
      }
    });
  }
}, { immediate: true });

function selectEntry(entry: any, i: number) {
  selectedEntry.value = entry;
  selectedIndex.value = i;
  detailTab.value = 'headers';
}

function toggleSort(key: string) {
  if (sortKey.value === key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  else { sortKey.value = key; sortDir.value = 'asc'; }
}

function sortIcon(key: string) {
  if (sortKey.value !== key) return '';
  return sortDir.value === 'asc' ? '▲' : '▼';
}

function statusGroup(status: number | undefined) {
  if (!status) return 'failed';
  if (status < 200) return '100';
  if (status < 300) return '200';
  if (status < 400) return '300';
  if (status < 500) return '400';
  return '500';
}

function methodColor(method: string | undefined) {
  if (!method) return 'var(--text-main)';
  if (method === 'POST') return '#a855f7';
  if (method === 'DELETE') return '#ef4444';
  if (method === 'PUT') return '#f59e0b';
  return '#2e89ff';
}

function urlName(url: string | undefined) {
  if (!url) return '';
  try { const u = new URL(url); const name = u.pathname.split('/').filter(Boolean).pop() || u.hostname; return name + u.search; } catch { return url; }
}

function formatSize(bytes: number | undefined) {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function formatDuration(ms: number | undefined) {
  if (ms === 0 || ms === null || ms === undefined) return 'Pending';
  if (ms < 1) return '<1ms';
  if (ms < 1000) return Math.round(ms) + 'ms';
  return (ms / 1000).toFixed(2) + 's';
}

function durationStyle(ms: number | undefined) {
  let color = 'var(--text-secondary, #6b7280)';
  let bg = 'rgba(107, 114, 128, 0.1)';
  if (ms && ms > 0 && ms < 200) { color = 'var(--success, #15803d)'; bg = 'rgba(49,162,76,0.15)'; }
  else if (ms && ms >= 200 && ms < 1000) { color = 'var(--warning-text, #b45309)'; bg = 'rgba(240,173,78,0.15)'; }
  else if (ms && ms >= 1000) { color = 'var(--danger, #b91c1c)'; bg = 'rgba(250,56,62,0.15)'; }
  return { fontSize: '11px', fontWeight: 600, fontFamily: 'monospace', color, background: bg, padding: '2px 6px', borderRadius: '4px' };
}

function formatStartTime(dt: string | undefined) {
  if (!dt) return '';
  try { return new Date(dt).toLocaleTimeString('en-GB', { hour12: false }); } catch { return ''; }
}

function inferType(entry: any): string {
  const type = (entry._resourceType || '').toLowerCase();
  const mime = entry.response?.content?.mimeType || '';
  if (type === 'xhr' || type === 'fetch' || mime.includes('json')) return 'XHR';
  if (type === 'script' || mime.includes('javascript')) return 'JS';
  if (type === 'stylesheet' || mime.includes('css')) return 'CSS';
  if (type === 'image' || mime.includes('image')) return 'Img';
  if (type === 'document' || mime.includes('html')) return 'Doc';
  if (type === 'font' || mime.includes('font')) return 'Font';
  return 'Other';
}

// Extract entries from either har.log.entries or har.entries (handle both shapes)
const rawEntries = computed(() => {
  if (!props.har) return [];
  if (props.har.log?.entries) return props.har.log.entries;
  if (props.har.entries) return props.har.entries;
  return [];
});

const filtered = computed(() => {
  let entries = [...rawEntries.value];
  if (activeType.value !== 'all') entries = entries.filter(e => inferType(e) === activeType.value);
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    entries = entries.filter(e => (e.request?.url || '').toLowerCase().includes(q));
  }
  entries.sort((a, b) => {
    let va: any, vb: any;
    if (sortKey.value === 'status') { va = a.response?.status || 0; vb = b.response?.status || 0; }
    else if (sortKey.value === 'method') { va = a.request?.method; vb = b.request?.method; }
    else if (sortKey.value === 'url') { va = a.request?.url; vb = b.request?.url; }
    else if (sortKey.value === 'type') { va = inferType(a); vb = inferType(b); }
    else if (sortKey.value === 'size') { va = a.response?.content?.size || 0; vb = b.response?.content?.size || 0; }
    else if (sortKey.value === 'time') { va = a.time || 0; vb = b.time || 0; }
    else { va = new Date(a.startedDateTime || 0).getTime(); vb = new Date(b.startedDateTime || 0).getTime(); }
    if (va < vb) return sortDir.value === 'asc' ? -1 : 1;
    if (va > vb) return sortDir.value === 'asc' ? 1 : -1;
    return 0;
  });
  return entries;
});

function generateFetch(entry: any) {
  if (!entry || !entry.request) return '';
  const method = entry.request.method;
  const url = entry.request.url;
  const headers: Record<string, string> = {};
  if (entry.request.headers) {
    entry.request.headers.forEach((h: any) => headers[h.name] = h.value);
  }

  let body = undefined;
  if (entry.request.postData && entry.request.postData.text) {
    body = entry.request.postData.text;
  }

  const options: any = { method, headers };
  if (body) options.body = body;

  return `fetch("${url}", ${JSON.stringify(options, null, 2)});`;
}

function generateCurl(entry: any) {
  if (!entry || !entry.request) return '';
  let curl = `curl '${entry.request.url}'`;
  curl += ` \\\n  -X '${entry.request.method}'`;

  if (entry.request.headers) {
    entry.request.headers.forEach((h: any) => {
      curl += ` \\\n  -H '${h.name}: ${h.value}'`;
    });
  }

  if (entry.request.postData && entry.request.postData.text) {
    const body = entry.request.postData.text.replace(/'/g, "'\\''");
    curl += ` \\\n  --data-raw '${body}'`;
  }
  return curl;
}

function redactHeader(header: { name: string; value: string }) {
  header.value = '[REDACTED]';
}
</script>

<style scoped>
.network-container { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.filters-bar { padding: 10px 20px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--border-color); background: var(--bg-app); flex-shrink: 0; }
.search-input { background: var(--bg-header); border: 1px solid var(--border-color); color: var(--text-main); padding: 6px 12px; border-radius: 4px; width: 250px; outline: none; font-size: 13px; }
.search-input:focus { border-color: var(--primary); }
.filter-chip { padding: 4px 12px; border-radius: 12px; font-size: 12px; cursor: pointer; color: var(--text-secondary); border: 1px solid var(--border-color); transition: all 0.2s; background: var(--bg-header); }
.filter-chip.active { background: var(--primary); color: white; border-color: var(--primary); }
.redact-btn { background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 2px; border-radius: 3px; display: flex; align-items: center; flex-shrink: 0; opacity: 0.5; transition: all 0.15s; }
.redact-btn:hover { color: #f59e0b; opacity: 1; }
.split-view { flex: 1; display: flex; overflow: hidden; }
.table-container { flex: 1; overflow: auto; }
table { width: 100%; border-collapse: collapse; }
th { position: sticky; top: 0; background: var(--bg-header); padding: 10px 15px; text-align: left; font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; border-bottom: 1px solid var(--border-color); z-index: 10; cursor: pointer; }
td { padding: 10px 15px; border-bottom: 1px solid var(--border-color); font-size: 13px; color: var(--text-main); }
tbody tr:not(.empty-row) { transition: background 0.1s; cursor: pointer; }
tbody tr:not(.empty-row):hover { background: var(--bg-hover); }
tbody tr.empty-row td { border-bottom: none; }
tbody tr.selected { background: rgba(46,137,255,0.1); border-left: 2px solid var(--primary); }
.time-cell { font-family: monospace; color: var(--text-secondary); font-size: 12px; }
.size-cell { font-family: monospace; font-size: 11px; color: var(--text-secondary); }
.url-cell { max-width: 280px; }
.url-name { font-weight: 600; color: var(--text-main); margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.url-full { font-size: 11px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.badge { padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; display: inline-block; min-width: 30px; text-align: center; }
.status-200 { background: rgba(49,162,76,0.2); color: var(--success, #15803d); }
.status-300, .status-400 { background: rgba(240,173,78,0.2); color: var(--warning-text, #b45309); }
.status-500, .status-failed { background: rgba(250,56,62,0.2); color: var(--danger, #b91c1c); }
.status-100 { background: rgba(46,137,255,0.2); color: var(--primary, #1d4ed8); }

.empty-cell { text-align: center; padding: 40px !important; }
.empty-state-small { display: flex; flex-direction: column; align-items: center; gap: 10px; color: var(--text-secondary); font-size: 14px; }

/* Detail Panel */
.detail-panel { width: 400px; min-width: 300px; border-left: 1px solid var(--border-color); display: flex; flex-direction: column; background: var(--bg-card); flex-shrink: 0; }
.detail-header { padding: 10px 14px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: var(--bg-header); font-weight: 600; font-size: 13px; }
.close-btn { cursor: pointer; opacity: 0.6; }
.close-btn:hover { opacity: 1; }
.detail-tabs { display: flex; border-bottom: 1px solid var(--border-color); }
.dtab { padding: 8px 14px; cursor: pointer; font-size: 12px; color: var(--text-secondary); border-bottom: 2px solid transparent; transition: 0.15s; }
.dtab:hover { color: var(--text-main); background: var(--bg-hover); }
.dtab.active { color: var(--primary); border-bottom-color: var(--primary); }
.detail-body { flex: 1; overflow-y: auto; padding: 12px; }
.detail-section { margin-bottom: 16px; }
.section-label { font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid var(--border-color); }
.kv-row { display: flex; gap: 10px; padding: 4px 0; font-size: 12px; border-bottom: 1px solid rgba(255,255,255,0.03); }
.kv-key { color: var(--text-secondary); flex: 1; min-width: 0; font-weight: 500; overflow-wrap: anywhere; }
.kv-val { color: var(--text-main); font-family: monospace; flex: 1; min-width: 0; overflow-wrap: anywhere; }
.url-wrap { word-break: break-all; }
.code-block { font-family: monospace; font-size: 12px; background: var(--bg-input); padding: 12px; border-radius: 4px; white-space: pre-wrap; word-break: break-word; max-height: 400px; overflow-y: auto; }
.empty-detail { padding: 30px; text-align: center; color: var(--text-secondary); font-size: 13px; }
.timing-row { display: flex; flex-direction: column; gap: 8px; }
.timing-item { display: flex; justify-content: space-between; padding: 8px 10px; background: var(--bg-input); border-radius: 4px; font-size: 13px; font-family: monospace; }
.timing-item.total { background: var(--primary); color: white; font-weight: 700; border-radius: 4px; }
.timing-label { font-weight: 600; color: var(--text-secondary); }
.timing-item.total .timing-label { color: rgba(255,255,255,0.8); }
</style>
