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
          <!-- Current/Desired State (new format) -->
          <div v-if="issue.currentState || issue.desiredState" class="issue-states">
            <div v-if="issue.currentState" class="state-block current">
              <div class="state-label">Current State</div>
              <div class="state-content">{{ issue.currentState }}</div>
            </div>
            <div v-if="issue.desiredState" class="state-block desired">
              <div class="state-label">Expected State</div>
              <div class="state-content">{{ issue.desiredState }}</div>
            </div>
          </div>

          <!-- Legacy comment or additional notes -->
          <p v-if="issue.comment" class="issue-comment">
            <strong>Notes:</strong> {{ issue.comment }}
          </p>

          <!-- Fallback for old format -->
          <p v-else-if="!issue.currentState && !issue.desiredState" class="issue-comment-legacy">
            {{ issue.description || issue.text || issue.message || 'No comment provided.' }}
          </p>

          <!-- Resolved Elements Info -->
          <div v-if="issue.primaryElement || (issue.resolvedElements && issue.resolvedElements.length > 0)" class="resolved-elements-section">
            <div class="section-title">Identified Elements</div>
            <div v-if="issue.primaryElement" class="primary-element">
              <div class="element-header">
                <code class="element-tag">&lt;{{ issue.primaryElement.tagName }}&gt;</code>
                <span class="element-selector">{{ issue.primaryElement.selector }}</span>
                <span class="element-score">Score: {{ issue.primaryElement.score.toFixed(1) }}</span>
              </div>
              <div v-if="issue.primaryElement.textContent" class="element-text">
                "{{ issue.primaryElement.textContent }}"
              </div>
              <div v-if="Object.keys(issue.primaryElement.dataAttributes || {}).length > 0" class="element-attrs">
                <span v-for="(val, key) in issue.primaryElement.dataAttributes" :key="key" class="attr-badge">
                  {{ key }}="{{ val }}"
                </span>
              </div>
            </div>
            <div v-if="issue.resolvedElements && issue.resolvedElements.length > 1" class="additional-elements">
              <details>
                <summary>{{ issue.resolvedElements.length - 1 }} more element(s)</summary>
                <div v-for="(el, idx) in issue.resolvedElements.slice(1)" :key="idx" class="secondary-element">
                  <code class="element-tag">&lt;{{ el.tagName }}&gt;</code>
                  <span class="element-selector-small">{{ el.selector }}</span>
                  <span class="element-score-small">{{ el.score.toFixed(1) }}</span>
                </div>
              </details>
            </div>
          </div>

          <!-- Selected Text -->
          <div v-if="issue.selectedText" class="selected-text-section">
            <div class="section-title">Selected Text</div>
            <div class="selected-text-content">"{{ issue.selectedText }}"</div>
          </div>

          <!-- Screenshot with Highlight -->
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
.issues-list { display: flex; flex-direction: column; gap: 16px; }
.empty-state-container { flex: 1; display: flex; justify-content: center; align-items: center; padding: 40px; }
.empty-state-small { display: flex; flex-direction: column; align-items: center; gap: 10px; color: var(--text-secondary); font-size: 14px; }
.issue-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; }
.issue-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.issue-time { color: var(--text-secondary); font-size: 12px; }
.issue-body { font-size: 13px; color: var(--text-main); line-height: 1.6; display: flex; flex-direction: column; gap: 12px; }
.badge { padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
.badge-error { background: rgba(250,56,62,0.2); color: #f87171; }
.badge-warn { background: rgba(240,173,78,0.2); color: #fcd34d; }
.badge-info { background: rgba(46,137,255,0.2); color: #60a5fa; }

/* State Blocks */
.issue-states { display: flex; flex-direction: column; gap: 10px; }
.state-block { padding: 10px 12px; border-radius: 6px; border-left: 3px solid; }
.state-block.current { background: rgba(250,56,62,0.08); border-color: var(--danger); }
.state-block.desired { background: rgba(46,137,255,0.08); border-color: var(--primary); }
.state-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; opacity: 0.7; }
.state-content { font-size: 13px; font-weight: 500; line-height: 1.4; }

/* Comments */
.issue-comment { margin: 0; font-size: 13px; line-height: 1.5; color: var(--text-secondary); }
.issue-comment strong { color: var(--text-main); }
.issue-comment-legacy { margin: 0; font-size: 14px; font-weight: 500; }

/* Resolved Elements */
.resolved-elements-section { background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; padding: 12px; }
.section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); margin-bottom: 8px; }
.primary-element { display: flex; flex-direction: column; gap: 6px; }
.element-header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.element-tag { background: rgba(46,137,255,0.15); color: var(--primary); padding: 2px 6px; border-radius: 4px; font-size: 11px; font-family: 'Consolas', 'Monaco', monospace; font-weight: 600; }
.element-selector { font-family: 'Consolas', 'Monaco', monospace; font-size: 11px; color: var(--text-secondary); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.element-score { font-size: 10px; font-weight: 600; color: var(--success); background: rgba(34,197,94,0.1); padding: 2px 6px; border-radius: 4px; }
.element-text { font-size: 12px; font-style: italic; color: var(--text-secondary); padding-left: 4px; }
.element-attrs { display: flex; gap: 4px; flex-wrap: wrap; }
.attr-badge { background: rgba(168,85,247,0.1); color: #c084fc; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-family: 'Consolas', 'Monaco', monospace; }

/* Additional Elements */
.additional-elements { margin-top: 8px; }
.additional-elements details { cursor: pointer; }
.additional-elements summary { font-size: 12px; color: var(--primary); font-weight: 500; padding: 4px 0; list-style: none; }
.additional-elements summary::-webkit-details-marker { display: none; }
.additional-elements summary::before { content: '▶ '; display: inline-block; transition: transform 0.2s; }
.additional-elements details[open] summary::before { transform: rotate(90deg); }
.secondary-element { display: flex; align-items: center; gap: 6px; padding: 6px 0; border-top: 1px solid var(--border-color); }
.element-selector-small { font-family: 'Consolas', 'Monaco', monospace; font-size: 10px; color: var(--text-secondary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.element-score-small { font-size: 9px; font-weight: 600; color: var(--success); }

/* Selected Text */
.selected-text-section { background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; padding: 12px; }
.selected-text-content { font-size: 13px; font-style: italic; color: var(--text-main); line-height: 1.5; padding: 8px; background: var(--bg-main); border-radius: 4px; }

/* Screenshot */
.issue-screenshot-wrapper { position: relative; display: inline-block; max-width: 100%; border-radius: 6px; border: 1px solid var(--border-color); overflow: hidden; background: #000; }
.issue-screenshot { max-width: 100%; display: block; }
.issue-highlight-box { position: absolute; border: 3px dashed var(--danger); background: rgba(250,56,62,0.15); box-sizing: border-box; pointer-events: none; }
.no-screenshot-msg { padding: 10px; background: var(--bg-input); color: var(--text-secondary); border-radius: 6px; font-size: 12px; }
</style>
