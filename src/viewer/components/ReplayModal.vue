<template>
  <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content" style="max-height:90vh; width:800px;">
      <div class="modal-header">
        <span class="modal-title"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -2px; margin-right: 4px;"><polyline points="1 4 1 10 7 10"></polyline><polyline points="23 20 23 14 17 14"></polyline><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path></svg> Replay Configuration</span>
        <span class="close-icon" @click="$emit('close')">✕</span>
      </div>
      <div class="modal-body">
        <!-- URL -->
        <div class="form-group">
          <label class="field-label">Start URL</label>
          <input class="form-input" v-model="replayUrl" placeholder="https://example.com" />
        </div>

        <!-- Options Row -->
        <div style="display:flex; gap:16px; margin-bottom:16px; flex-wrap:wrap;">
          <label class="option-check"><input type="checkbox" v-model="autoStart" /> Auto-start</label>
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="field-label" style="margin:0;">Delay:</span>
            <select class="form-select" v-model="defaultDelay" style="width:100px;">
              <option value="auto">Auto</option>
              <option value="500">500ms</option>
              <option value="1000">1s</option>
              <option value="2000">2s</option>
              <option value="3000">3s</option>
            </select>
          </div>
        </div>

        <!-- Clear Options -->
        <div class="section-title">Clear before replay</div>
        <div style="display:flex; gap:16px; margin-bottom:16px;">
          <label class="option-check"><input type="checkbox" v-model="clearLocal" /> Local/Session Storage</label>
          <label class="option-check"><input type="checkbox" v-model="clearCookies" /> Cookies</label>
          <label class="option-check"><input type="checkbox" v-model="clearIndexedDB" /> IndexedDB</label>
        </div>

        <!-- Storage Builder -->
        <div class="section-title">Storage Context</div>
        <div v-for="section in storageSections" :key="section.key" class="storage-builder">
          <div class="storage-builder-header" @click="section.open = !section.open" style="display:flex; align-items:center;">
            <span style="min-width:14px; margin-right:6px;">{{ section.open ? '▾' : '▸' }}</span>
            <span style="display:flex; align-items:center; gap:6px;" v-html="section.icon + ' ' + section.title"></span>
            <span style="margin-left:6px;">({{ section.items.length }})</span>
            <button class="action-btn" style="padding:2px 8px; font-size:11px; margin-left:auto;" @click.stop="section.items.push({ key: '', value: '' })">+ Add</button>
          </div>
          <div v-if="section.open" class="storage-builder-body">
            <div v-for="(item, i) in section.items" :key="i" class="storage-item">
              <div class="storage-inputs">
                <input class="form-input" v-model="item.key" placeholder="Key" style="font-family:monospace; font-size:12px;" />
                <textarea class="form-input" v-model="item.value" placeholder="Value" rows="2" style="font-family:monospace; font-size:12px; resize:vertical;"></textarea>
              </div>
              <button class="remove-btn" @click="section.items.splice(i, 1)" title="Remove">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Pre-Replay Requests -->
        <div class="section-title" style="margin-top:16px;">Pre-Replay Requests</div>
        <div class="requests-builder">
          <div v-for="(req, i) in requests" :key="i" class="request-item">
            <div class="request-inputs">
              <div style="display:flex; gap:8px;">
                <select class="form-select" v-model="req.method" style="width:80px;">
                  <option v-for="m in ['GET','POST','PUT','DELETE','PATCH']" :key="m">{{ m }}</option>
                </select>
                <input class="form-input" v-model="req.url" placeholder="https://api.example.com/..." style="flex:1;" />
              </div>
              <div style="display:flex; gap:8px;">
                <textarea class="form-input" v-model="req.headers" placeholder="Headers (Key: Value)" rows="2" style="flex:1; font-family:monospace; font-size:12px;"></textarea>
                <textarea class="form-input" v-model="req.body" placeholder="Body (JSON)" rows="2" style="flex:1; font-family:monospace; font-size:12px;"></textarea>
              </div>
            </div>
            <button class="remove-btn" @click="requests.splice(i, 1)" title="Remove">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
          <button class="action-btn" style="font-size:12px;" @click="requests.push({ method:'GET', url:'', headers:'', body:'' })">+ Add Request</button>
        </div>
      </div>
      <div class="modal-footer">
        <button class="action-btn" @click="$emit('close')">Cancel</button>
        <button class="action-btn primary" @click="startReplay"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Start Replay</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue';

const props = defineProps<{
  visible: boolean;
  reportData: any;
}>();

const emit = defineEmits(['close']);

const replayUrl = ref('');
const autoStart = ref(false);
const defaultDelay = ref('auto');
const clearLocal = ref(false);
const clearCookies = ref(false);
const clearIndexedDB = ref(false);

const storageSections = reactive([
  { key: 'localStorage', title: 'Local Storage', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>', items: [] as { key: string; value: string }[], open: false },
  { key: 'sessionStorage', title: 'Session Storage', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>', items: [] as { key: string; value: string }[], open: false },
  { key: 'cookies', title: 'Cookies', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/></svg>', items: [] as { key: string; value: string }[], open: false },
]);

const requests = reactive<{ method: string; url: string; headers: string; body: string }[]>([]);

watch(() => props.visible, (v) => {
  if (!v || !props.reportData) return;
  const data = props.reportData;

  // Find start URL from navigation events
  const events = [...(data.userEvents || [])].sort((a: any, b: any) => a.timestamp - b.timestamp);
  const nav = events.find((e: any) => e.type === 'navigation');
  replayUrl.value = nav?.url || '';

  // Pre-fill storage
  const storage = data.storage || {};
  storageSections[0].items = Object.entries(storage.localStorage || {}).map(([k, v]) => ({ key: k, value: typeof v === 'string' ? v : JSON.stringify(v) }));
  storageSections[1].items = Object.entries(storage.sessionStorage || {}).map(([k, v]) => ({ key: k, value: typeof v === 'string' ? v : JSON.stringify(v) }));
  storageSections[2].items = Object.entries(storage.cookies || {}).map(([k, v]) => ({ key: k, value: typeof v === 'string' ? v : JSON.stringify(v) }));
  requests.length = 0;
});

function startReplay() {
  if (!replayUrl.value.trim()) { alert('URL is required'); return; }
  if (!props.reportData?.userEvents) return;

  const events = [...props.reportData.userEvents].sort((a: any, b: any) => a.timestamp - b.timestamp);

  const gatherStorage = (items: { key: string; value: string }[]) => {
    const data: Record<string, string> = {};
    items.forEach(i => { if (i.key.trim()) data[i.key.trim()] = i.value; });
    return data;
  };

  const parsedRequests = requests.filter(r => r.url.trim()).map(r => {
    const headers: Record<string, string> = {};
    if (r.headers.trim()) {
      r.headers.split('\n').forEach(line => {
        const parts = line.split(':');
        if (parts.length >= 2) headers[parts[0].trim()] = parts.slice(1).join(':').trim();
      });
    }
    return { method: r.method, url: r.url.trim(), headers, body: r.body.trim() };
  });

  chrome.runtime.sendMessage({
    action: 'replayEvents',
    url: replayUrl.value.trim(),
    events,
    autoStart: autoStart.value,
    defaultDelay: defaultDelay.value === 'auto' ? null : parseInt(defaultDelay.value),
    context: {
      clearLocalSession: clearLocal.value,
      clearCookies: clearCookies.value,
      clearIndexedDB: clearIndexedDB.value,
      localStorage: gatherStorage(storageSections[0].items),
      sessionStorage: gatherStorage(storageSections[1].items),
      cookies: gatherStorage(storageSections[2].items),
      requests: parsedRequests,
    },
  });

  emit('close');
}
</script>

<style scoped>
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal-content { background: var(--bg-card); display: flex; flex-direction: column; border-radius: 8px; border: 1px solid var(--border-color); box-shadow: 0 10px 40px rgba(0,0,0,0.5); max-width: 90%; }
.modal-header { padding: 15px 20px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: var(--bg-header); border-radius: 8px 8px 0 0; }
.modal-title { font-weight: 600; color: var(--text-main); }
.close-icon { cursor: pointer; opacity: 0.6; font-size: 18px; }
.close-icon:hover { opacity: 1; }
.modal-body { flex: 1; padding: 20px; overflow-y: auto; }
.modal-footer { padding: 15px 20px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 10px; }

.form-group { margin-bottom: 16px; }
.field-label { font-size: 12px; color: var(--text-secondary); margin-bottom: 5px; font-weight: 600; display: block; }
.form-input { background: var(--bg-input); color: var(--text-main); border: 1px solid var(--border-color); padding: 8px 12px; border-radius: 4px; outline: none; width: 100%; font-family: inherit; font-size: 13px; }
.form-input:focus { border-color: var(--primary); }
.form-select { background: var(--bg-input); color: var(--text-main); border: 1px solid var(--border-color); padding: 6px 8px; border-radius: 4px; font-size: 13px; }
.section-title { font-size: 11px; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; margin-bottom: 8px; letter-spacing: 0.5px; }

.option-check { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-main); cursor: pointer; }

.storage-builder { border: 1px solid var(--border-color); border-radius: 6px; margin-bottom: 10px; overflow: hidden; }
.storage-builder-header { padding: 8px 12px; background: var(--bg-header); font-size: 13px; font-weight: 500; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
.storage-builder-body { padding: 8px; }
.storage-item { display: flex; gap: 8px; align-items: flex-start; margin-bottom: 8px; padding: 8px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 4px; }
.storage-inputs { flex: 1; display: flex; flex-direction: column; gap: 6px; }
.remove-btn { background: none; border: 1px solid var(--border-color); color: var(--text-secondary); padding: 6px; border-radius: 4px; cursor: pointer; flex-shrink: 0; display: flex; align-items: center; }
.remove-btn:hover { color: var(--danger); border-color: var(--danger); background: rgba(250,56,62,0.1); }

.request-item { display: flex; gap: 8px; align-items: flex-start; margin-bottom: 10px; padding: 10px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-card); }
.request-inputs { flex: 1; display: flex; flex-direction: column; gap: 8px; }

.action-btn { background: transparent; border: 1px solid var(--border-color); color: var(--text-main); padding: 6px 12px; border-radius: 4px; font-size: 13px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s; font-family: inherit; }
.action-btn:hover { background: var(--bg-hover); }
.action-btn.primary { background: var(--primary); border-color: var(--primary); color: white; }
.action-btn.primary:hover { background: var(--primary-hover); }
</style>
