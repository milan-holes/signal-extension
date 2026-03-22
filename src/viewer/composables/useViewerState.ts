import { ref, computed, shallowRef } from 'vue';

export interface ReportData {
    userEvents: any[];
    consoleErrors: any[];
    har: { entries: any[] };
    environment: Record<string, any> | null;
    storage: Record<string, any> | null;
    screencast: any[];
    issues: any[];
    contentChanges: any[];
    startTime: string;
    recordingMode: string;
    [key: string]: any;
}

const reportData = shallowRef<ReportData | null>(null);
const reportDate = ref('');
const isLoading = ref(false);
const activeTab = ref('timeline');
const selectedNetworkEntry = shallowRef<any>(null);
const selectedConsoleEntry = shallowRef<any>(null);

export function useViewerState() {
    function loadReport(data: ReportData) {
        reportData.value = data;
        if (data.startTime) {
            try {
                reportDate.value = new Date(data.startTime).toLocaleString();
            } catch { reportDate.value = data.startTime; }
        }
    }

    function importFromFile(file: File): Promise<void> {
        return new Promise((resolve, reject) => {
            isLoading.value = true;

            if ((file.name.endsWith('.zip') || file.type.includes('zip')) && typeof (window as any).JSZip !== 'undefined') {
                new (window as any).JSZip().loadAsync(file).then((zip: any) => {
                    const jsonFile = Object.keys(zip.files).find((n: string) => n.endsWith('.json'));
                    if (jsonFile) {
                        zip.file(jsonFile).async('text').then((text: string) => {
                            try {
                                loadReport(JSON.parse(text));
                                resolve();
                            } catch (e: any) {
                                reject(new Error('Invalid JSON in ZIP: ' + e.message));
                            } finally { isLoading.value = false; }
                        });
                    } else {
                        isLoading.value = false;
                        reject(new Error('No JSON file found in ZIP'));
                    }
                }).catch((e: any) => {
                    isLoading.value = false;
                    reject(new Error('Error reading ZIP: ' + e.message));
                });
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    loadReport(JSON.parse(event.target!.result as string));
                    resolve();
                } catch (e: any) {
                    reject(new Error('Invalid JSON: ' + e.message));
                } finally { isLoading.value = false; }
            };
            reader.onerror = () => {
                isLoading.value = false;
                reject(new Error('Failed to read file'));
            };
            reader.readAsText(file);
        });
    }

    function loadFromStorage(): Promise<boolean> {
        return new Promise((resolve) => {
            chrome.storage.local.get(['viewerData'], (result) => {
                if (result.viewerData) {
                    loadReport(result.viewerData as ReportData);
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
        });
    }

    const hasData = computed(() => reportData.value !== null);

    return {
        reportData,
        reportDate,
        isLoading,
        activeTab,
        hasData,
        selectedNetworkEntry,
        selectedConsoleEntry,
        loadReport,
        importFromFile,
        loadFromStorage,
    };
}
