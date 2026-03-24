<template>
  <div class="timeline-outer">
    <!-- Video Section -->
    <div class="video-section" ref="videoSectionRef" :style="{ height: videoHeight + 'px' }">
      <div class="player-wrapper" ref="playerWrapperRef">
        <img v-if="currentFrameSrc" ref="playerRef" class="screen-player" :src="currentFrameSrc" alt="Screencast" />
        <div v-else class="player-placeholder">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
            <line x1="8" y1="21" x2="16" y2="21"></line>
            <line x1="12" y1="17" x2="12" y2="21"></line>
          </svg>
          <span>No screencast frames</span>
        </div>
      </div>
      <!-- Controls -->
      <div v-if="frames.length > 0" class="player-controls">
        <button class="ctrl-btn" @click="togglePlay" :title="isEnded ? 'Replay' : (isPlaying ? 'Pause' : 'Play')">
          <svg v-if="isEnded" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
          <svg v-else-if="!isPlaying" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
        </button>
        <input type="range" class="scrubber" min="0" :max="frames.length - 1" v-model.number="currentIndex" @input="onScrub" />
        <span class="time-display">{{ timeDisplay }}</span>
        <button class="ctrl-btn" @click="toggleFullscreen" title="Fullscreen">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline>
            <line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line>
          </svg>
        </button>
      </div>
    </div>

    <!-- Video Resize Handle -->
    <div class="video-resize-handle" @mousedown="startVideoResize"></div>

    <!-- Bottom: Event List + Detail Panel -->
    <div class="timeline-bottom">
      <!-- Event List -->
      <div class="event-list">
        <table>
          <thead>
            <tr>
              <th v-if="isEditorMode" style="width:50px;">Action</th>
              <th style="width:100px;">Time</th>
              <th style="width:80px;">Source</th>
              <th>Event Details</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(event, i) in tableEvents" :key="i"
              :class="{ selected: selectedIndex === i }"
              @click="selectEvent(event, i)">
              <td v-if="isEditorMode">
                <button v-if="event.source === 'user'" class="delete-btn" @click.stop="deleteEvent(event)" title="Remove Event">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </td>
              <td class="meta-cell">{{ formatTime(event.sortTime) }}</td>
              <td><span :class="'badge ' + sourceBadge(event)">{{ sourceLabel(event) }}</span></td>
              <td v-html="eventDetails(event)"></td>
            </tr>
            <tr v-if="tableEvents.length === 0">
              <td :colspan="isEditorMode ? 4 : 3" style="text-align:center; padding:30px; color:var(--text-secondary);">No user events recorded.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Details Side Panel -->
      <div class="timeline-detail-panel" v-if="selectedEvent">
        <div class="detail-header-bar">
          <span class="detail-title">{{ detailTitle }}</span>
          <span class="close-icon" @click="selectedEvent = null">✕</span>
        </div>

        <!-- Sub-tabs -->
        <div class="timeline-tabs">
          <div :class="['timeline-tab', { active: detailTab === 'details' }]" @click="detailTab = 'details'">Details</div>
          <div :class="['timeline-tab', { active: detailTab === 'console' }]" @click="detailTab = 'console'">Console</div>
          <div :class="['timeline-tab', { active: detailTab === 'network' }]" @click="detailTab = 'network'">Network</div>
        </div>

        <div class="detail-body">
          <!-- Details Tab -->
          <div v-if="detailTab === 'details'" class="detail-content" v-html="detailHtml"></div>

          <!-- Console Tab -->
          <div v-if="detailTab === 'console'" class="detail-content">
            <table class="sub-table">
              <thead><tr><th>Level</th><th>Message</th><th>Time</th></tr></thead>
              <tbody>
                <tr v-for="(log, j) in consoleAtTime" :key="j" @click="goToConsole(log)" style="cursor: pointer;">
                  <td><span :class="'badge badge-' + levelBadge(log.level)">{{ (log.level || 'log').toUpperCase() }}</span></td>
                  <td style="max-width:300px; font-family:monospace; font-size:12px;">{{ log.text || log.message }}</td>
                  <td class="meta-cell">{{ formatTime(log.sortTime) }}</td>
                </tr>
                <tr v-if="consoleAtTime.length === 0"><td colspan="3" style="text-align:center; padding:20px; color:var(--text-secondary);">No console logs at this point</td></tr>
              </tbody>
            </table>
          </div>

          <!-- Network Tab -->
          <div v-if="detailTab === 'network'" class="detail-content">
            <table class="sub-table">
              <thead><tr><th>Status</th><th>Method</th><th>URL</th><th>Time</th></tr></thead>
              <tbody>
                <tr v-for="(req, j) in networkAtTime" :key="j" @click="goToNetwork(req)" style="cursor: pointer;">
                  <td><span :class="'badge status-' + statusGroup(req.response?.status)">{{ req.response?.status || '—' }}</span></td>
                  <td style="font-weight:700;">{{ req.request?.method }}</td>
                  <td style="max-width:250px; font-family:monospace; font-size:11px;">{{ shortUrl(req.request?.url) }}</td>
                  <td class="meta-cell">{{ formatTime(req.sortTime) }}</td>
                </tr>
                <tr v-if="networkAtTime.length === 0"><td colspan="4" style="text-align:center; padding:20px; color:var(--text-secondary);">No network requests at this point</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { useViewerState } from '../composables/useViewerState';

const props = defineProps<{
  data: any;
  isEditorMode: boolean;
}>();

const emit = defineEmits<{
  (e: 'delete-event', index: number): void;
}>();

const { activeTab, selectedNetworkEntry, selectedConsoleEntry } = useViewerState();

// ── State ──
const selectedIndex = ref(-1);
const selectedEvent = ref<any>(null);
const detailTab = ref('details');
const currentIndex = ref(0);
const isPlaying = ref(false);
const isEnded = ref(false);
const videoHeight = ref(300);
const videoSectionRef = ref<HTMLElement | null>(null);
const playerWrapperRef = ref<HTMLElement | null>(null);
const playerRef = ref<HTMLImageElement | null>(null);
let playTimer: any = null;

// ── Computed ──
const frames = computed(() => props.data?.screencast || []);
const allEvents = computed(() => {
  const events: any[] = [];
  (props.data?.userEvents || []).forEach((e: any, i: number) => events.push({ ...e, source: 'user', sortTime: e.timestamp, originalIndex: i }));
  (props.data?.consoleErrors || []).forEach((e: any) => events.push({ ...e, source: 'console', sortTime: e.timestamp }));
  const harEntries = props.data?.har?.entries || props.data?.har?.log?.entries || [];
  harEntries.forEach((e: any) => events.push({ ...e, source: 'network', sortTime: new Date(e.startedDateTime).getTime() }));
  (props.data?.issues || []).forEach((e: any) => events.push({ ...e, source: 'issue', sortTime: e.timestamp }));
  events.sort((a, b) => a.sortTime - b.sortTime);
  return events;
});

const tableEvents = computed(() => allEvents.value.filter(e => e.source === 'user' || e.source === 'issue'));

const currentFrameSrc = computed(() => {
  const f = frames.value[currentIndex.value];
  return f ? 'data:image/jpeg;base64,' + f.data : '';
});

const timeDisplay = computed(() => {
  if (frames.value.length === 0) return '00:00:00';
  const f = frames.value[currentIndex.value];
  const start = frames.value[0]?.wallTime || 0;
  const elapsed = (f?.wallTime || 0) - start;
  return new Date(Math.max(0, elapsed)).toISOString().substr(11, 8);
});

const consoleAtTime = computed(() => {
  if (!selectedEvent.value) return [];
  const ts = selectedEvent.value.sortTime;
  return allEvents.value.filter(e => e.source === 'console' && e.sortTime <= ts).reverse().slice(0, 50);
});

const networkAtTime = computed(() => {
  if (!selectedEvent.value) return [];
  const ts = selectedEvent.value.sortTime;
  return allEvents.value.filter(e => e.source === 'network' && e.sortTime <= ts).reverse().slice(0, 50);
});

const detailTitle = computed(() => {
  const e = selectedEvent.value;
  if (!e) return '';
  if (e.source === 'user') return `${(e.type || 'event').toUpperCase()} on ${e.target?.tagName || 'ELEMENT'}`;
  if (e.source === 'issue') return 'Reported Issue';
  return 'Event Details';
});

const detailHtml = computed(() => {
  const event = selectedEvent.value;
  if (!event) return '';
  let html = '';

  if (event.source === 'user') {
    const target = event.target || {};
    html = `<div class="detail-section-title">${esc(event.type?.toUpperCase() || 'EVENT')} on ${esc(target.tagName || 'ELEMENT')}</div>`;
    html += detailRow('Tag Name', `<span style="color:var(--primary); font-family:monospace;">${esc(target.tagName || '')}</span>`);
    if (target.id) html += detailRow('ID', `<span style="font-family:monospace;">${esc(target.id)}</span>`);
    if (target.innerText) html += detailRow('Inner Text', `<div class="code-snippet">${esc(target.innerText)}</div>`);
    if (event.type === 'input' && event.value !== undefined) html += detailRow('Input Value', `<div class="code-snippet">${esc(event.value)}</div>`);
    if (event.type === 'keydown' && event.key) html += detailRow('Key', `<span style="font-family:monospace; font-size:16px; font-weight:600;">${esc(event.key)}</span>`);
    if (event.type === 'navigation' && event.url) html += detailRow('URL', `<a href="${esc(event.url)}" target="_blank" style="color:var(--primary); word-break:break-all;">${esc(event.url)}</a>`);
    if (target.xpath) html += `<div style="margin-top:10px;"><div class="detail-label">XPATH</div><div class="code-snippet" style="word-break:break-all;">${esc(target.xpath)}</div></div>`;
    if (target.selectors?.length > 0) html += `<div style="margin-top:10px;"><div class="detail-label">Selectors</div>${target.selectors.map((s: string) => `<div class="code-snippet" style="margin-bottom:4px;">${esc(s)}</div>`).join('')}</div>`;
    if (target.nearestHeading) html += `<div style="margin-top:10px;"><div class="detail-label">Nearest Heading</div><div style="font-style:italic; padding:4px 8px; border-left:3px solid var(--primary); background:var(--bg-input);">${esc(target.nearestHeading)}</div></div>`;
  } else if (event.source === 'issue') {
    html = `<div class="detail-section-title" style="color:var(--danger);">Reported Issue</div>`;
    html += detailRow('Time', formatTime(event.timestamp || event.sortTime));

    // Current / Expected state
    if (event.currentState || event.desiredState) {
      if (event.currentState) {
        html += `<div style="margin-top:10px;"><div class="detail-label">Current State</div><div class="code-snippet" style="border-left:3px solid var(--danger);">${esc(event.currentState)}</div></div>`;
      }
      if (event.desiredState) {
        html += `<div style="margin-top:10px;"><div class="detail-label">Expected State</div><div class="code-snippet" style="border-left:3px solid var(--success, #4ade80);">${esc(event.desiredState)}</div></div>`;
      }
    }

    // Comment / notes
    if (event.comment) html += `<div style="margin-top:10px;"><div class="detail-label">Comment</div><div class="code-snippet" style="border-left:3px solid var(--danger);">${esc(event.comment)}</div></div>`;

    // Identified elements
    if (event.primaryElement || (event.resolvedElements && event.resolvedElements.length > 0)) {
      html += `<div style="margin-top:10px;"><div class="detail-label">Identified Elements</div>`;
      if (event.primaryElement) {
        const pe = event.primaryElement;
        html += `<div style="padding:8px; background:var(--bg-input); border-radius:4px; margin-top:4px; font-family:monospace; font-size:12px;">`;
        html += `<span style="color:var(--primary);">&lt;${esc(pe.tagName)}&gt;</span> `;
        html += `<span style="color:var(--text-secondary);">${esc(pe.selector)}</span>`;
        if (pe.score != null) html += ` <span style="font-size:10px; color:var(--text-secondary);">score: ${Number(pe.score).toFixed(1)}</span>`;
        if (pe.textContent) html += `<div style="margin-top:4px; color:var(--text-main);">"${esc(pe.textContent)}"</div>`;
        const attrs = pe.dataAttributes ? Object.entries(pe.dataAttributes) : [];
        if (attrs.length > 0) {
          html += `<div style="margin-top:4px; display:flex; flex-wrap:wrap; gap:4px;">`;
          attrs.forEach(([k, v]) => { html += `<span style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:3px; padding:1px 5px; font-size:10px;">${esc(k)}="${esc(v as string)}"</span>`; });
          html += `</div>`;
        }
        html += `</div>`;
      }
      if (event.resolvedElements && event.resolvedElements.length > 1) {
        html += `<div style="margin-top:4px; font-size:12px; color:var(--text-secondary);">${event.resolvedElements.length - 1} more element(s)</div>`;
      }
      html += `</div>`;
    }

    // Selected text
    if (event.selectedText) {
      html += `<div style="margin-top:10px;"><div class="detail-label">Selected Text</div><div class="code-snippet" style="font-style:italic;">"${esc(event.selectedText)}"</div></div>`;
    }

    // Nearest screencast frame + Highlight
    let closestFrame = null;
    let minDiff = Infinity;
    for (const frame of frames.value) {
      if (frame.wallTime) {
        const diff = Math.abs(frame.wallTime - event.sortTime);
        if (diff < minDiff) {
          minDiff = diff;
          closestFrame = frame;
        }
      }
    }
    
    if (closestFrame) {
      const envWindow = props.data?.environment?.windowSize;
      let boxStyle = '';
      if (event.rect && envWindow && envWindow.width && envWindow.height) {
        const left = (event.rect.x / envWindow.width) * 100;
        const top = (event.rect.y / envWindow.height) * 100;
        const width = (event.rect.width / envWindow.width) * 100;
        const height = (event.rect.height / envWindow.height) * 100;
        boxStyle = `position:absolute; left:${left}%; top:${top}%; width:${width}%; height:${height}%; border: 2px dashed var(--danger); background: rgba(250,56,62,0.15); box-sizing: border-box; pointer-events: none;`;
      }
      
      html += `<div style="margin-top:10px;"><div class="detail-label">Screenshot</div>
        <div style="position:relative; display:inline-block; max-width:100%; border-radius:4px; border:1px solid var(--border-color); overflow:hidden; background:#000;">
          <img src="data:image/jpeg;base64,${closestFrame.data}" style="max-width:100%; display:block;" />
          ${boxStyle ? `<div style="${boxStyle}"></div>` : ''}
        </div>
      </div>`;
    } else if (event.screenshot) {
      html += `<div style="margin-top:10px;"><div class="detail-label">Screenshot</div><img src="${event.screenshot}" style="max-width:100%; border-radius:4px; border:1px solid var(--border-color);" /></div>`;
    }
  }
  return html;
});

// ── Methods ──
function esc(s: any) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function detailRow(key: string, val: string) {
  return `<div style="display:grid; grid-template-columns: 120px 1fr; gap:10px; margin-bottom:5px;"><div style="color:var(--text-secondary);">${key}</div><div>${val}</div></div>`;
}

function formatTime(ts: number) {
  if (!ts) return '';
  try { let t = ts; if (t < 100000000000) t *= 1000; return new Date(t).toLocaleTimeString(); } catch { return ''; }
}

function sourceBadge(e: any) {
  if (e.source === 'user') return 'badge-info';
  if (e.source === 'issue') return 'badge-error';
  if (e.source === 'console') {
    const l = (e.level || 'log').toLowerCase();
    return l === 'error' ? 'badge-error' : l === 'warning' ? 'badge-warn' : 'badge-info';
  }
  return 'badge-info';
}

function sourceLabel(e: any) {
  if (e.source === 'user') return 'USER';
  if (e.source === 'issue') return 'ISSUE';
  if (e.source === 'console') return (e.level || 'LOG').toUpperCase();
  return 'NET';
}

function levelBadge(level: string) {
  if (level === 'error') return 'error';
  if (level === 'warning') return 'warn';
  return 'info';
}

function statusGroup(status: number | undefined) {
  if (!status) return 'failed';
  if (status < 200) return '100'; if (status < 300) return '200';
  if (status < 400) return '300'; if (status < 500) return '400'; return '500';
}

function shortUrl(url: string | undefined) {
  if (!url) return ''; try { const u = new URL(url); return u.pathname + u.search; } catch { return url; }
}

function eventDetails(event: any): string {
  if (event.source === 'user') {
    const t = event.target || {};
    if (event.type === 'click') {
      let s = `Clicked <b>${esc(t.tagName || 'ELEMENT')}</b>`;
      if (t.id) s += ` #${esc(t.id)}`;
      if (t.innerText) s += ` ("${esc(t.innerText)}")`;
      return s;
    }
    if (event.type === 'keydown') return `Key: <b>${esc(event.key)}</b>`;
    if (event.type === 'input') return `Input: "<b>${esc(event.value)}</b>" on <span style="font-family:monospace;">${esc(t.tagName || 'ELEMENT')}${t.id ? '#' + esc(t.id) : ''}</span>`;
    if (event.type === 'navigation') return `Navigated to <a href="${esc(event.url)}" target="_blank" style="color:var(--primary); word-break:break-word;">${esc(event.url)}</a>`;
    return esc(event.type);
  }
  if (event.source === 'issue') {
    const summary = event.comment || event.currentState || event.desiredState || '';
    return `<b>Reported:</b> ${esc(summary)}`;
  }
  return '';
}

function selectEvent(event: any, i: number) {
  selectedIndex.value = i;
  selectedEvent.value = event;
  detailTab.value = 'details';
  // Sync screencast to event time
  if (frames.value.length > 0) {
    let closestIdx = 0, minDiff = Infinity;
    frames.value.forEach((f: any, fi: number) => {
      if (f.wallTime) { const d = Math.abs(f.wallTime - event.sortTime); if (d < minDiff) { minDiff = d; closestIdx = fi; } }
    });
    currentIndex.value = closestIdx;
  }
}

function deleteEvent(event: any) {
  if (!confirm('Delete this user event?')) return;
  if (event.originalIndex !== undefined) {
    emit('delete-event', event.originalIndex);
    selectedEvent.value = null;
    selectedIndex.value = -1;
  }
}

function goToConsole(log: any) {
  selectedConsoleEntry.value = log;
  activeTab.value = 'console';
}

function goToNetwork(req: any) {
  selectedNetworkEntry.value = req;
  activeTab.value = 'network';
}

// ── Playback ──
function togglePlay() {
  if (isEnded.value) {
    // Replay from start
    isEnded.value = false;
    currentIndex.value = 0;
    startPlay();
  } else if (isPlaying.value) {
    stopPlay();
  } else {
    startPlay();
  }
}

function startPlay() {
  if (frames.value.length === 0) return;
  isPlaying.value = true;
  isEnded.value = false;
  playNextFrame();
}

function stopPlay() {
  isPlaying.value = false;
  if (playTimer) { clearTimeout(playTimer); playTimer = null; }
}

function playNextFrame() {
  if (!isPlaying.value || currentIndex.value >= frames.value.length - 1) {
    isPlaying.value = false;
    if (currentIndex.value >= frames.value.length - 1) isEnded.value = true;
    if (playTimer) { clearTimeout(playTimer); playTimer = null; }
    return;
  }
  const curr = frames.value[currentIndex.value];
  const next = frames.value[currentIndex.value + 1];
  const delay = next?.wallTime && curr?.wallTime ? Math.min(Math.max(next.wallTime - curr.wallTime, 16), 2000) : 100;
  playTimer = setTimeout(() => { currentIndex.value++; playNextFrame(); }, delay);
}

function onScrub() {
  if (isPlaying.value) stopPlay();
  isEnded.value = false;
}

function toggleFullscreen() {
  const el = videoSectionRef.value;
  if (!el) return;
  if (document.fullscreenElement) document.exitFullscreen();
  else el.requestFullscreen?.();
}

// ── Video Resize ──
function startVideoResize(e: MouseEvent) {
  e.preventDefault();
  const startY = e.clientY;
  const startH = videoHeight.value;
  const onMove = (ev: MouseEvent) => { videoHeight.value = Math.max(100, Math.min(startH + (ev.clientY - startY), 600)); };
  const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

// Auto-select first event
watch(tableEvents, (events) => {
  if (events.length > 0 && selectedIndex.value === -1) selectEvent(events[0], 0);
}, { immediate: true });

defineExpose({
  currentFrameSrc
});

onBeforeUnmount(() => { stopPlay(); });
</script>

<style scoped>
.timeline-outer { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.video-section { flex-shrink: 0; background: #000; display: flex; flex-direction: column; position: relative; }
.video-section:fullscreen { height: 100vh !important; }
.video-section:fullscreen .player-wrapper { flex: 1; }
.video-section:fullscreen .screen-player { max-height: calc(100vh - 40px); }
.player-wrapper { flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative; min-height: 0; background: #000; }
.screen-player { max-width: 100%; max-height: 100%; object-fit: contain; }
.player-placeholder { display: flex; flex-direction: column; align-items: center; gap: 10px; color: var(--text-secondary); font-size: 13px; }
.player-controls { height: 36px; background: var(--bg-header); display: flex; align-items: center; gap: 8px; padding: 0 12px; border-top: 1px solid var(--border-color); }
.ctrl-btn { background: none; border: none; color: var(--text-main); cursor: pointer; padding: 4px; display: flex; align-items: center; border-radius: 4px; }
.ctrl-btn:hover { background: var(--bg-hover); }
.scrubber { flex: 1; height: 4px; accent-color: var(--primary); }
.time-display { font-family: monospace; font-size: 12px; color: var(--text-secondary); min-width: 65px; }
.video-resize-handle { height: 6px; width: 100%; cursor: row-resize; background: transparent; transition: background 0.15s; flex-shrink: 0; }
.video-resize-handle:hover { background: var(--primary); }

.timeline-bottom { flex: 1; display: flex; overflow: hidden; min-height: 0; }
.event-list { flex: 1; overflow: auto; }
.event-list table { width: 100%; border-collapse: collapse; }
.event-list th { position: sticky; top: 0; background: var(--bg-header); padding: 8px 12px; text-align: left; font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; border-bottom: 1px solid var(--border-color); z-index: 10; }
.event-list td { padding: 8px 12px; border-bottom: 1px solid var(--border-color); font-size: 13px; color: var(--text-main); }
.event-list tbody tr { cursor: pointer; transition: background 0.1s; }
.event-list tbody tr:hover { background: var(--bg-hover); }
.event-list tbody tr.selected { background: rgba(46,137,255,0.1); border-left: 2px solid var(--primary); }
.meta-cell { font-family: monospace; color: var(--text-secondary); font-size: 12px; }
.delete-btn { background: none; border: 1px solid var(--danger); color: var(--danger); padding: 4px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; }

.timeline-detail-panel { width: 380px; min-width: 280px; border-left: 1px solid var(--border-color); display: flex; flex-direction: column; flex-shrink: 0; background: var(--bg-card); }
.detail-header-bar { height: 42px; padding: 0 12px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-color); background: var(--bg-header); }
.detail-title { font-weight: 600; font-size: 13px; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.close-icon { cursor: pointer; opacity: 0.6; transition: opacity 0.2s; font-size: 16px; }
.close-icon:hover { opacity: 1; }

.timeline-tabs { display: flex; background: var(--bg-card); border-bottom: 1px solid var(--border-color); }
.timeline-tab { padding: 8px 14px; cursor: pointer; font-size: 13px; color: var(--text-secondary); border-bottom: 2px solid transparent; transition: all 0.15s; }
.timeline-tab:hover { background: var(--bg-hover); color: var(--text-main); }
.timeline-tab.active { color: var(--primary); border-bottom-color: var(--primary); font-weight: 500; }
.detail-body { flex: 1; overflow-y: auto; }
.detail-content { padding: 12px; }

.sub-table { width: 100%; border-collapse: collapse; }
.sub-table th { padding: 6px 10px; text-align: left; font-size: 11px; font-weight: 600; color: var(--text-secondary); background: var(--bg-card); border-bottom: 1px solid var(--border-color); position: sticky; top: 0; z-index: 5; }
.sub-table td { padding: 6px 10px; border-bottom: 1px solid var(--border-color); font-size: 12px; color: var(--text-main); }
.sub-table tr:hover { background: var(--bg-hover); }

.badge { padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; display: inline-block; min-width: 30px; text-align: center; }
.badge-info { background: rgba(46,137,255,0.2); color: #60a5fa; }
.badge-error { background: rgba(250,56,62,0.2); color: #f87171; }
.badge-warn { background: rgba(240,173,78,0.2); color: #fcd34d; }
.status-200 { background: rgba(49,162,76,0.2); color: #4ade80; }
.status-300, .status-400 { background: rgba(240,173,78,0.2); color: #fcd34d; }
.status-500, .status-failed { background: rgba(250,56,62,0.2); color: #f87171; }
.status-100 { background: rgba(46,137,255,0.2); color: #60a5fa; }

:deep(.detail-section-title) { font-weight: 600; font-size: 14px; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--border-color); }
:deep(.detail-label) { color: var(--text-secondary); margin-bottom: 4px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
:deep(.code-snippet) { font-family: monospace; font-size: 12px; background: var(--bg-input); padding: 8px; border-radius: 4px; white-space: pre-wrap; word-break: break-word; max-height: 120px; overflow-y: auto; }
</style>
