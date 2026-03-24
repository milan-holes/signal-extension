<template>
  <div class="changes-container">
    <div v-if="!changes || changes.length === 0" style="padding:20px; color:var(--text-secondary);">No content changes recorded.</div>
    <div v-else class="changes-list">
      <div v-for="(change, i) in changes" :key="i" class="change-card">
        <div class="change-header">
          <span class="change-type badge badge-info">{{ change.type || 'edit' }}</span>
          <span class="change-selector" :title="change.selector">{{ change.selector || 'unknown' }}</span>
          <span class="change-time">{{ formatTime(change.timestamp) }}</span>
        </div>
        <div v-if="change.oldValue || change.newValue" class="change-diff">
          <div v-if="change.oldValue" class="diff-line diff-remove">- {{ truncate(change.oldValue) }}</div>
          <div v-if="change.newValue" class="diff-line diff-add">+ {{ truncate(change.newValue) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  changes: any[];
  screencast: any[];
}>();

function formatTime(ts: number) {
  if (!ts) return '';
  try {
    let t = ts;
    if (t < 100000000000) t *= 1000;
    return new Date(t).toLocaleTimeString();
  } catch { return ''; }
}

function truncate(val: string, max = 200) {
  return val && val.length > max ? val.substring(0, max) + '…' : val || '';
}
</script>

<style scoped>
.changes-container { flex: 1; overflow-y: auto; padding: 20px; }
.changes-list { display: flex; flex-direction: column; gap: 12px; }
.change-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; }
.change-header { padding: 10px 14px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid var(--border-color); background: var(--bg-header); }
.change-selector { font-family: monospace; font-size: 12px; color: var(--text-main); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.change-time { color: var(--text-secondary); font-size: 12px; flex-shrink: 0; }
.change-diff { padding: 10px 14px; font-family: monospace; font-size: 12px; }
.diff-line { padding: 2px 0; white-space: pre-wrap; word-break: break-word; }
.diff-remove { color: #f87171; background: rgba(250,56,62,0.05); }
.diff-add { color: #4ade80; background: rgba(49,162,76,0.05); }
.badge { padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
.badge-info { background: rgba(46,137,255,0.2); color: #60a5fa; }
</style>
