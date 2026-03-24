<template>
  <div class="console-container">
    <!-- Filter Bar -->
    <div class="filters-bar">
      <input class="search-input" placeholder="Filter console logs..." v-model="searchQuery" />
      <span v-for="l in levels" :key="l" :class="['filter-chip', { active: activeLevel === l }]"
        @click="activeLevel = l">{{ l === 'all' ? 'All' : l }}</span>
    </div>

    <div class="split-view">
      <!-- Table -->
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th class="sortable" @click="toggleSort('time')">Time {{ sortIcon('time') }}</th>
              <th class="sortable" @click="toggleSort('level')">Level {{ sortIcon('level') }}</th>
              <th class="sortable" @click="toggleSort('source')">Source {{ sortIcon('source') }}</th>
              <th class="sortable" @click="toggleSort('text')">Message {{ sortIcon('text') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(err, i) in filtered" :key="i" :class="{ selected: selectedIndex === i }" @click="selectEntry(err, i)">
              <td class="time-cell">{{ formatTime(err.timestamp) }}</td>
              <td><span :class="'badge badge-' + levelClass(err.level)">{{ (err.level || 'log').toUpperCase() }}</span></td>
              <td class="source-cell">{{ err.source || 'console' }}</td>
              <td :class="['msg-cell', err.level === 'error' ? 'msg-error' : '']">
                <span v-if="err.count > 1" class="count-badge">{{ err.count }}</span>
                {{ err.text || err.message || '' }}
              </td>
            </tr>
            <tr v-if="filtered.length === 0" class="empty-row">
              <td colspan="4" class="empty-cell">
                <div class="empty-state-small">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3">
                    <polyline points="4 17 10 11 4 5"></polyline>
                    <line x1="12" y1="19" x2="20" y2="19"></line>
                  </svg>
                  <span>No console errors match filter</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Details Panel -->
      <div v-if="selectedEntry" class="detail-panel">
        <div class="detail-header">
          <span :style="{ color: levelColor(selectedEntry.level) }">Console {{ (selectedEntry.level || 'log').toUpperCase() }}</span>
          <span class="close-btn" @click="selectedEntry = null; selectedIndex = -1">✕</span>
        </div>
        <div class="detail-body">
          <div class="kv-row"><span class="kv-key">Time</span><span class="kv-val mono">{{ formatTime(selectedEntry.timestamp) }}</span></div>
          <div class="kv-row"><span class="kv-key">Level</span><span class="kv-val"><span :class="'badge badge-' + levelClass(selectedEntry.level)">{{ (selectedEntry.level || 'log').toUpperCase() }}</span></span></div>
          <div class="kv-row" v-if="selectedEntry.source"><span class="kv-key">Source</span><span class="kv-val mono">{{ selectedEntry.source }}</span></div>

          <div v-if="selectedEntry.text || selectedEntry.message" class="msg-section">
            <div class="section-label">
              Message
              <CopyButton :content="selectedEntry.text || selectedEntry.message" />
            </div>
            <div class="code-block" :style="{ borderLeft: '3px solid ' + levelColor(selectedEntry.level) }">{{ selectedEntry.text || selectedEntry.message }}</div>
          </div>

          <div v-if="selectedEntry.url" class="kv-row" style="margin-top:10px;">
            <span class="kv-key">Source URL</span>
            <span class="kv-val mono" style="word-break:break-all;">{{ selectedEntry.url }}{{ selectedEntry.line ? ':' + selectedEntry.line : '' }}{{ selectedEntry.column ? ':' + selectedEntry.column : '' }}</span>
          </div>

          <div v-if="selectedEntry.stackTrace?.callFrames?.length" class="msg-section">
            <div class="section-label">Stack Trace</div>
            <div class="code-block stack-trace">
              <div v-for="(frame, fi) in selectedEntry.stackTrace.callFrames" :key="fi" class="frame-line">
                at {{ frame.functionName || '(anonymous)' }} <span class="frame-loc">({{ frame.url }}:{{ frame.lineNumber }}:{{ frame.columnNumber }})</span>
              </div>
            </div>
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
  errors: any[];
}>();

const searchQuery = ref('');
const activeLevel = ref('all');
const sortKey = ref('time');
const sortDir = ref<'asc'|'desc'>('asc');
const selectedIndex = ref(-1);
const selectedEntry = ref<any>(null);

const levels = ['all', 'error', 'warning', 'log'];

const { selectedConsoleEntry } = useViewerState();

watch(selectedConsoleEntry, (newVal) => {
  if (newVal) {
    if (activeLevel.value !== 'all') activeLevel.value = 'all';
    if (searchQuery.value) searchQuery.value = '';
    
    sortKey.value = 'time';
    sortDir.value = 'asc';

    nextTick(() => {
      const idx = filtered.value.findIndex((e: any) => 
        e === newVal || 
        (e.timestamp === newVal.timestamp && e.text === newVal.text && e.message === newVal.message)
      );
      if (idx !== -1) {
        selectEntry(filtered.value[idx], idx);
        nextTick(() => {
          const rows = document.querySelectorAll('.console-container tbody tr');
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
}

function toggleSort(key: string) {
  if (sortKey.value === key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  else { sortKey.value = key; sortDir.value = 'asc'; }
}
function sortIcon(key: string) { return sortKey.value !== key ? '' : sortDir.value === 'asc' ? '▲' : '▼'; }

function levelClass(level: string) {
  if (level === 'error') return 'error';
  if (level === 'warning') return 'warn';
  return 'info';
}

function levelColor(level: string) {
  if (level === 'error') return 'var(--danger)';
  if (level === 'warning') return 'var(--warning, #fcd34d)';
  return 'var(--primary)';
}

function formatTime(ts: number) {
  if (!ts) return '';
  try { let t = ts; if (t > 1000000000000) return new Date(t).toLocaleTimeString(); return new Date(t * 1000).toLocaleTimeString(); } catch { return ''; }
}

const filtered = computed(() => {
  let errors = [...(props.errors || [])];

  // Filter
  if (activeLevel.value !== 'all') {
    errors = errors.filter(e => {
      const lvl = (e.level || 'log').toLowerCase();
      if (activeLevel.value === 'error') return lvl === 'error';
      if (activeLevel.value === 'warning') return lvl === 'warning';
      if (activeLevel.value === 'log') return lvl !== 'error' && lvl !== 'warning';
      return true;
    });
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    errors = errors.filter(e => (e.text || e.message || '').toLowerCase().includes(q));
  }

  // Sort
  const severity: Record<string, number> = { error: 3, warning: 2, log: 1, info: 1 };
  errors.sort((a, b) => {
    let va: any, vb: any;
    if (sortKey.value === 'time') { va = a.timestamp || 0; vb = b.timestamp || 0; }
    else if (sortKey.value === 'level') { va = severity[(a.level || 'log').toLowerCase()] || 0; vb = severity[(b.level || 'log').toLowerCase()] || 0; }
    else if (sortKey.value === 'source') { va = a.source || ''; vb = b.source || ''; }
    else { va = a.text || a.message || ''; vb = b.text || b.message || ''; }
    if (va < vb) return sortDir.value === 'asc' ? -1 : 1;
    if (va > vb) return sortDir.value === 'asc' ? 1 : -1;
    return 0;
  });

  // Group identical consecutive
  const grouped: any[] = [];
  errors.forEach(err => {
    const last = grouped[grouped.length - 1];
    if (last && (last.text === err.text || last.message === err.message) && last.source === err.source && last.level === err.level) {
      last.count = (last.count || 1) + 1;
    } else {
      grouped.push({ ...err, count: 1 });
    }
  });
  return grouped;
});
</script>

<style scoped>
.console-container { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.filters-bar { padding: 10px 20px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--border-color); background: var(--bg-app); flex-shrink: 0; }
.search-input { background: var(--bg-header); border: 1px solid var(--border-color); color: var(--text-main); padding: 6px 12px; border-radius: 4px; width: 250px; outline: none; font-size: 13px; }
.search-input:focus { border-color: var(--primary); }
.filter-chip { padding: 4px 12px; border-radius: 12px; font-size: 12px; cursor: pointer; color: var(--text-secondary); border: 1px solid var(--border-color); transition: all 0.2s; background: var(--bg-header); }
.filter-chip.active { background: var(--primary); color: white; border-color: var(--primary); }

.split-view { flex: 1; display: flex; overflow: hidden; }
.table-container { flex: 1; overflow: auto; }
table { width: 100%; border-collapse: collapse; }
th { position: sticky; top: 0; background: var(--bg-header); padding: 10px 15px; text-align: left; font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; border-bottom: 1px solid var(--border-color); z-index: 10; cursor: pointer; }
td { padding: 10px 15px; border-bottom: 1px solid var(--border-color); font-size: 13px; color: var(--text-main); }
tbody tr:not(.empty-row) { cursor: pointer; transition: background 0.1s; }
tbody tr:not(.empty-row):hover { background: var(--bg-hover); }
tbody tr.empty-row td { border-bottom: none; }
tbody tr.selected { background: rgba(46,137,255,0.1); border-left: 2px solid var(--primary); }
.time-cell { font-family: monospace; color: var(--text-secondary); font-size: 12px; }
.source-cell { font-family: monospace; color: var(--text-secondary); font-size: 12px; }
.msg-cell { font-family: monospace; max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.msg-error { color: var(--danger); }
.count-badge { background: #555; color: white; font-size: 10px; font-weight: 700; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; margin-right: 6px; }
.badge { padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; display: inline-block; min-width: 30px; text-align: center; }
.badge-error { background: rgba(250,56,62,0.2); color: #f87171; }
.badge-warn { background: rgba(240,173,78,0.2); color: #fcd34d; }
.badge-info { background: rgba(46,137,255,0.2); color: #60a5fa; }

.empty-cell { text-align: center; padding: 40px !important; }
.empty-state-small { display: flex; flex-direction: column; align-items: center; gap: 10px; color: var(--text-secondary); font-size: 14px; }

/* Detail Panel */
.detail-panel { width: 400px; min-width: 300px; border-left: 1px solid var(--border-color); display: flex; flex-direction: column; background: var(--bg-card); flex-shrink: 0; }
.detail-header { padding: 12px 14px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: var(--bg-header); font-weight: 600; font-size: 14px; }
.close-btn { cursor: pointer; opacity: 0.6; font-size: 16px; }
.close-btn:hover { opacity: 1; }
.detail-body { flex: 1; overflow-y: auto; padding: 14px; }
.kv-row { display: flex; gap: 10px; padding: 5px 0; font-size: 13px; }
.kv-key { color: var(--text-secondary); min-width: 80px; flex-shrink: 0; }
.kv-val { color: var(--text-main); }
.mono { font-family: monospace; }
.msg-section { margin-top: 14px; }
.section-label { font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center; }
.code-block { font-family: monospace; font-size: 12px; background: var(--bg-input); padding: 10px; border-radius: 4px; white-space: pre-wrap; word-break: break-word; max-height: 200px; overflow-y: auto; }
.stack-trace { font-size: 11px; max-height: 200px; }
.frame-line { margin-bottom: 3px; }
.frame-loc { color: var(--text-secondary); }
</style>
