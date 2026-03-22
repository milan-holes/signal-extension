<template>
  <div class="storage-container">
    <!-- Tabs -->
    <div class="storage-tabs">
      <div :class="['stab', { active: activeTab === 'local' }]" @click="activeTab = 'local'" style="display: flex; align-items: center; gap: 6px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
        Local Storage ({{ localCount }})
      </div>
      <div :class="['stab', { active: activeTab === 'session' }]" @click="activeTab = 'session'" style="display: flex; align-items: center; gap: 6px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        Session Storage ({{ sessionCount }})
      </div>
      <div :class="['stab', { active: activeTab === 'cookies' }]" @click="activeTab = 'cookie'" style="display: flex; align-items: center; gap: 6px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/></svg>
        Cookies ({{ cookieCount }})
      </div>
    </div>

    <!-- Content -->
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th style="width: 250px;">Key</th>
            <th>Value</th>
            <th style="width: 50px;">Copy</th>
            <th v-if="isEditorMode" style="width: 100px;">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, i) in activeData" :key="i" @click="selectedIndex = i" :class="{ selected: selectedIndex === i }">
            <td class="key-cell">
              <span class="key-text" :title="item.key">{{ item.key }}</span>
            </td>
            <td class="val-cell">
              <div v-if="editingIndex === i" class="edit-area">
                <textarea v-model="editValue" class="edit-input" rows="3"></textarea>
                <div class="edit-actions">
                  <button class="action-btn" @click="editingIndex = -1">Cancel</button>
                  <button class="action-btn primary" @click="saveEdit(item)">Save</button>
                </div>
              </div>
              <div v-else class="val-content" @dblclick="startEdit(i, item.value)">
                <span class="val-text" :title="item.value">{{ item.value }}</span>
              </div>
            </td>
            <td>
              <CopyButton :content="item.value" title="Copy value" />
            </td>
            <td v-if="isEditorMode">
              <div style="display:flex; gap:4px;">
                <button class="edit-action-btn redact" @click.stop="redactItem(item)" title="Redact value">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"></path><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                </button>
                <button class="edit-action-btn delete" @click.stop="deleteItem(item)" title="Remove entry">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="activeData.length === 0" class="empty-row">
            <td :colspan="isEditorMode ? 4 : 3" class="empty-cell">
              <div class="empty-state-small">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3">
                  <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                  <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
                </svg>
                <span>No {{ activeTab === 'cookie' ? 'cookies' : activeTab + ' storage' }} data</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import CopyButton from './CopyButton.vue';

const props = defineProps<{
  storage: any;
  isEditorMode: boolean;
}>();

const activeTab = ref('local');
const selectedIndex = ref(-1);
const editingIndex = ref(-1);
const editValue = ref('');

const updateTrigger = ref(0);

const localData = computed(() => { updateTrigger.value; return toArray(props.storage?.localStorage); });
const sessionData = computed(() => { updateTrigger.value; return toArray(props.storage?.sessionStorage); });
const cookieData = computed(() => { updateTrigger.value; return toArray(props.storage?.cookies); });

const localCount = computed(() => localData.value.length);
const sessionCount = computed(() => sessionData.value.length);
const cookieCount = computed(() => cookieData.value.length);

const activeData = computed(() => {
  if (activeTab.value === 'local') return localData.value;
  if (activeTab.value === 'session') return sessionData.value;
  return cookieData.value;
});

function toArray(obj: any): { key: string; value: string }[] {
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj).map(([k, v]) => ({ key: k, value: typeof v === 'string' ? v : JSON.stringify(v) }));
}

function startEdit(i: number, value: string) {
  editingIndex.value = i;
  editValue.value = value;
}

function saveEdit(item: { key: string; value: string }) {
  // Write back to source storage object
  const store = getActiveStore();
  if (store && item.key in store) {
    store[item.key] = editValue.value;
  }
  item.value = editValue.value;
  editingIndex.value = -1;
  updateTrigger.value++;
}

function redactItem(item: { key: string; value: string }) {
  const store = getActiveStore();
  if (store && item.key in store) {
    store[item.key] = '[REDACTED]';
  }
  item.value = '[REDACTED]';
  updateTrigger.value++;
}

function deleteItem(item: { key: string; value: string }) {
  const store = getActiveStore();
  if (store && item.key in store) {
    delete store[item.key];
  }
  updateTrigger.value++;
}

function getActiveStore(): Record<string, any> | null {
  if (!props.storage) return null;
  if (activeTab.value === 'local') return props.storage.localStorage;
  if (activeTab.value === 'session') return props.storage.sessionStorage;
  return props.storage.cookies;
}
</script>

<style scoped>
.storage-container { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.storage-tabs { display: flex; border-bottom: 1px solid var(--border-color); background: var(--bg-app); flex-shrink: 0; }
.stab { padding: 10px 20px; cursor: pointer; font-size: 13px; color: var(--text-secondary); border-bottom: 2px solid transparent; transition: all 0.15s; }
.stab:hover { color: var(--text-main); background: var(--bg-hover); }
.stab.active { color: var(--primary); border-bottom-color: var(--primary); font-weight: 500; }

.table-container { flex: 1; overflow: auto; }
table { width: 100%; border-collapse: collapse; }
th { position: sticky; top: 0; background: var(--bg-header); padding: 10px 15px; text-align: left; font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; border-bottom: 1px solid var(--border-color); z-index: 10; }
td { padding: 10px 15px; border-bottom: 1px solid var(--border-color); font-size: 13px; color: var(--text-main); }
tbody tr:not(.empty-row) { cursor: pointer; transition: background 0.1s; }
tbody tr:not(.empty-row):hover { background: var(--bg-hover); }
tbody tr.empty-row td { border-bottom: none; }
tbody tr.selected { background: rgba(46,137,255,0.1); }

.key-cell { vertical-align: middle; }
.key-text { font-family: monospace; font-weight: 600; color: var(--primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 220px; display: inline-block; vertical-align: middle; }
.val-cell { max-width: 500px; }
.val-content { vertical-align: middle; }
.val-text { font-family: monospace; font-size: 12px; color: var(--text-main); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 480px; display: inline-block; vertical-align: middle; }

.edit-area { display: flex; flex-direction: column; gap: 6px; }
.edit-input { background: var(--bg-input); color: var(--text-main); border: 1px solid var(--primary); padding: 8px; border-radius: 4px; font-family: monospace; font-size: 12px; resize: vertical; width: 100%; }
.edit-actions { display: flex; gap: 6px; justify-content: flex-end; }
.action-btn { background: transparent; border: 1px solid var(--border-color); color: var(--text-main); padding: 4px 10px; border-radius: 4px; font-size: 12px; cursor: pointer; }
.action-btn.primary { background: var(--primary); color: white; border-color: var(--primary); }

.empty-cell { text-align: center; padding: 40px !important; }
.empty-state-small { display: flex; flex-direction: column; align-items: center; gap: 10px; color: var(--text-secondary); font-size: 14px; }

.edit-action-btn { background: none; border: 1px solid var(--border-color); color: var(--text-secondary); padding: 4px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; transition: all 0.15s; }
.edit-action-btn.redact:hover { color: #f59e0b; border-color: #f59e0b; background: rgba(245,158,11,0.1); }
.edit-action-btn.delete:hover { color: var(--danger); border-color: var(--danger); background: rgba(250,56,62,0.1); }
</style>
