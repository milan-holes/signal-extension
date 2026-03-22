<template>
  <div class="env-container">
    <div v-if="!environment" class="empty-state-small">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3">
        <line x1="12" y1="20" x2="12" y2="10"></line>
        <line x1="18" y1="20" x2="18" y2="4"></line>
        <line x1="6" y1="20" x2="6" y2="16"></line>
      </svg>
      <span>No environment data available.</span>
    </div>
    <template v-else>
      <!-- Toggle -->
      <div class="env-toolbar">
        <label class="toggle-label">
          <input type="checkbox" v-model="showComparison" />
          <span>Compare with current environment</span>
        </label>
      </div>

      <div class="env-cards">
        <div v-for="(card, idx) in cards" :key="idx" class="env-card">
          <div class="env-card-title" style="display: flex; align-items: center; gap: 8px;" v-html="card.title"></div>
          <!-- Comparison Header -->
          <div v-if="showComparison" class="compare-header">
            <span>Recorded</span>
            <span>Current (You)</span>
          </div>
          <div class="env-card-body">
            <div v-for="(item, i) in card.items" :key="i" class="env-row">
              <span class="env-key">{{ item.key }}</span>
              <div class="env-values" v-if="showComparison">
                <span class="env-val recorded">{{ item.value }}</span>
                <span :class="['env-val', 'current', item.matches ? 'match' : 'diff']">
                  {{ item.currentValue }}
                  <svg v-if="item.matches" class="match-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  <svg v-else class="match-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </span>
              </div>
              <span v-else class="env-val">{{ item.value }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

const props = defineProps<{
  environment: Record<string, any> | null;
}>();

const showComparison = ref(false);
const currentEnv = ref<Record<string, string>>({});

onMounted(() => {
  // Collect current browser environment
  try {
    const nav = navigator as any;
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
    currentEnv.value = {
      userAgent: nav.userAgent || 'N/A',
      language: nav.language || 'N/A',
      platform: nav.platform || 'N/A',
      cookieEnabled: nav.cookieEnabled ? 'Yes' : 'No',
      screenSize: `${screen.width}x${screen.height}`,
      windowSize: `${window.innerWidth}x${window.innerHeight}`,
      devicePixelRatio: String(window.devicePixelRatio || 'N/A'),
      hardwareConcurrency: String(nav.hardwareConcurrency || 'N/A'),
      deviceMemory: nav.deviceMemory ? nav.deviceMemory + ' GB' : 'N/A',
      connectionType: conn?.effectiveType || 'N/A',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'N/A',
    };
  } catch { /* ignore in SSR */ }
});

// Map from display keys to their env property names and where to find current values
const envMapping: Record<string, { envKey: string; currentKey: string; format?: (v: any) => string }> = {
  'User Agent': { envKey: 'userAgent', currentKey: 'userAgent' },
  'Language': { envKey: 'language', currentKey: 'language' },
  'Platform': { envKey: 'platform', currentKey: 'platform' },
  'Cookies Enabled': { envKey: 'cookieEnabled', currentKey: 'cookieEnabled', format: (v: any) => typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v) },
  'Screen Size': { envKey: 'screenSize', currentKey: 'screenSize' },
  'Window Size': { envKey: 'windowSize', currentKey: 'windowSize' },
  'Device Pixel Ratio': { envKey: 'devicePixelRatio', currentKey: 'devicePixelRatio' },
  'CPU Cores': { envKey: 'hardwareConcurrency', currentKey: 'hardwareConcurrency' },
  'Device Memory': { envKey: 'deviceMemory', currentKey: 'deviceMemory', format: (v: any) => v ? v + ' GB' : 'N/A' },
  'Connection': { envKey: 'connectionType', currentKey: 'connectionType' },
  'Timezone': { envKey: 'timezone', currentKey: 'timezone' },
};

function getRecordedValue(key: string): string {
  const env = props.environment;
  if (!env) return 'N/A';
  const mapping = envMapping[key];
  if (!mapping) return 'N/A';
  const raw = env[mapping.envKey];
  if (raw === undefined || raw === null) return 'N/A';
  if (mapping.format) return mapping.format(raw);
  return String(raw);
}

function getCurrentValue(key: string): string {
  const mapping = envMapping[key];
  if (!mapping) return 'N/A';
  return currentEnv.value[mapping.currentKey] || 'N/A';
}

function valuesMatch(key: string): boolean {
  const rec = getRecordedValue(key).toLowerCase().trim();
  const cur = getCurrentValue(key).toLowerCase().trim();
  return rec === cur;
}

interface EnvItem { key: string; value: string; currentValue: string; matches: boolean; }

const cards = computed(() => {
  const env = props.environment;
  if (!env) return [];

  function makeItems(keys: string[]): EnvItem[] {
    return keys.map(k => ({
      key: k,
      value: getRecordedValue(k),
      currentValue: getCurrentValue(k),
      matches: valuesMatch(k),
    }));
  }

  return [
    { title: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> Browser', items: makeItems(['User Agent', 'Language', 'Platform', 'Cookies Enabled']) },
    { title: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> Display', items: makeItems(['Screen Size', 'Window Size', 'Device Pixel Ratio']) },
    { title: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg> Hardware', items: makeItems(['CPU Cores', 'Device Memory', 'Connection']) },
    { title: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> Page', items: [
      { key: 'URL', value: env.url || 'N/A', currentValue: window.location.href, matches: false },
      { key: 'Timezone', value: env.timezone || 'N/A', currentValue: Intl.DateTimeFormat().resolvedOptions().timeZone || 'N/A', matches: (env.timezone || '') === (Intl.DateTimeFormat().resolvedOptions().timeZone || '') },
    ]},
  ];
});
</script>

<style scoped>
.env-container { flex: 1; overflow-y: auto; padding: 20px; }
.env-toolbar { margin-bottom: 16px; display: flex; align-items: center; }
.toggle-label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; color: var(--text-secondary); }
.toggle-label input { accent-color: var(--primary); }
.env-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 16px; }
.env-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; }
.env-card-title { padding: 12px 16px; font-weight: 600; font-size: 14px; border-bottom: 1px solid var(--border-color); background: var(--bg-header); }
.compare-header { display: flex; justify-content: flex-end; padding: 6px 16px; font-size: 10px; text-transform: uppercase; color: var(--text-secondary); gap: 10px; border-bottom: 1px solid var(--border-color); background: var(--bg-header); }
.compare-header span { width: 48%; text-align: left; }
.env-card-body { padding: 0; }
.env-row { display: flex; padding: 8px 16px; border-bottom: 1px solid var(--border-color); font-size: 13px; align-items: flex-start; }
.env-row:last-child { border-bottom: none; }
.env-key { color: var(--text-secondary); min-width: 120px; flex-shrink: 0; font-size: 11px; text-transform: uppercase; padding-top: 2px; }
.env-val { color: var(--text-main); font-family: monospace; font-size: 12px; word-break: break-word; flex: 1; }
.env-values { display: flex; gap: 10px; flex: 1; }
.env-values .env-val { width: 48%; position: relative; }
.env-val.recorded { color: var(--text-main); }
.env-val.current.match { color: var(--text-secondary); }
.env-val.current.diff { color: #f87171; }
.match-icon { position: absolute; right: 0; top: 0; opacity: 0.7; }

.empty-state-small { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: var(--text-secondary); padding: 60px 20px; font-size: 14px; }
</style>
