<template>
  <div class="issues-container">
    <div v-if="!issues || issues.length === 0" class="empty-state-container">
      <div class="empty-state-small">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <span>No issues reported.</span>
      </div>
    </div>
    <div v-else class="issues-list">
      <div v-for="(issue, i) in issues" :key="i" class="issue-card">
        <div class="issue-header">
          <span :class="'badge badge-' + severityClass(issue.severity || issue.type)">{{ issue.severity || issue.type || 'info' }}</span>
          <span class="issue-time">{{ formatTime(issue.timestamp) }}</span>
        </div>
        <div class="issue-body">
          <p style="margin: 0 0 12px; font-weight: 500; font-size: 14px;">{{ issue.comment || issue.description || issue.text || issue.message || 'No comment provided.' }}</p>
          
          <div v-if="closestFrame(issue)" class="issue-screenshot-wrapper">
             <img :src="'data:image/jpeg;base64,' + closestFrame(issue).data" class="issue-screenshot" />
             <div v-if="issue.rect && environment?.windowSize" class="issue-highlight-box" :style="getHighlightStyle(issue.rect)"></div>
          </div>
          <div v-else class="no-screenshot-msg">No screenshot available</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  issues: any[];
  screencast: any[];
  events: any[];
  environment?: any;
}>();

function closestFrame(issue: any) {
  if (!props.screencast || props.screencast.length === 0) return null;
  let closest = props.screencast[0];
  let minDiff = Infinity;
  for (const frame of props.screencast) {
    if (frame.wallTime) {
      const diff = Math.abs(frame.wallTime - (issue.timestamp || 0));
      if (diff < minDiff) {
        minDiff = diff;
        closest = frame;
      }
    }
  }
  return closest;
}

function getHighlightStyle(rect: any) {
  if (!rect || !props.environment?.windowSize) return {};
  const vw = props.environment.windowSize.width;
  const vh = props.environment.windowSize.height;
  
  if (!vw || !vh) return {};

  return {
    left: `${(rect.x / vw) * 100}%`,
    top: `${(rect.y / vh) * 100}%`,
    width: `${(rect.width / vw) * 100}%`,
    height: `${(rect.height / vh) * 100}%`
  };
}

function severityClass(s: string) {
  if (!s) return 'info';
  const sl = s.toLowerCase();
  if (sl.includes('error') || sl.includes('critical')) return 'error';
  if (sl.includes('warn')) return 'warn';
  return 'info';
}

function formatTime(ts: number) {
  if (!ts) return '';
  try {
    let t = ts;
    if (t < 100000000000) t *= 1000;
    return new Date(t).toLocaleTimeString();
  } catch { return ''; }
}
</script>

<style scoped>
.issues-container { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; }
.issues-list { display: flex; flex-direction: column; gap: 12px; }
.empty-state-container { flex: 1; display: flex; justify-content: center; align-items: center; padding: 40px; }
.empty-state-small { display: flex; flex-direction: column; align-items: center; gap: 10px; color: var(--text-secondary); font-size: 14px; }
.issue-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 14px; }
.issue-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.issue-time { color: var(--text-secondary); font-size: 12px; }
.issue-body { font-size: 13px; color: var(--text-main); line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
.badge { padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
.badge-error { background: rgba(250,56,62,0.2); color: #f87171; }
.badge-warn { background: rgba(240,173,78,0.2); color: #fcd34d; }
.badge-info { background: rgba(46,137,255,0.2); color: #60a5fa; }

.issue-screenshot-wrapper { position: relative; display: inline-block; max-width: 100%; border-radius: 6px; border: 1px solid var(--border-color); overflow: hidden; background: #000; margin-top: 8px; }
.issue-screenshot { max-width: 100%; display: block; }
.issue-highlight-box { position: absolute; border: 3px dashed var(--danger); background: rgba(250,56,62,0.15); box-sizing: border-box; pointer-events: none; }
.no-screenshot-msg { padding: 10px; background: var(--bg-input); color: var(--text-secondary); border-radius: 6px; font-size: 12px; }
</style>
