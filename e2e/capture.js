import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionPath = path.resolve(__dirname, '../dist');
const screenshotsDir = path.resolve(__dirname, '../screenshots/app_flows');
const metadataPath = path.join(screenshotsDir, 'metadata.json');

if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
}

let metadata = [];
if (fs.existsSync(metadataPath)) {
    try { metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8')); } catch (e) { }
}

async function captureEnhancedScreenshot(page, route, viewSlug, state, components) {
    console.log(`Setting up for ${viewSlug}...`);
    await page.setViewport({ width: 1920, height: 1080 });
    try {
        await page.goto(route, { waitUntil: 'networkidle0', timeout: 10000 });
    } catch (e) {
        console.warn(`Wait warning for ${route}: ${e.message}`);
    }

    // Attempt to evaluate any necessary wait routines (e.g. for icons or shadow DOM)
    await new Promise(resolve => setTimeout(resolve, 2000));

    const timestamp = Date.now();
    const filename = `${viewSlug}_${timestamp}.png`;
    const filepath = path.join(screenshotsDir, filename);

    // Using CDP to force capture full page optimally
    const client = await page.target().createCDPSession();
    const metrics = await client.send('Page.getLayoutMetrics');

    const width = Math.ceil(metrics.contentSize.width);
    const height = Math.ceil(metrics.contentSize.height);

    await client.send('Emulation.setDeviceMetricsOverride', {
        mobile: false,
        width: 1920,
        height: Math.max(1080, height),
        deviceScaleFactor: 1,
    });

    console.log(`Capturing ${viewSlug}...`);
    await page.screenshot({
        path: filepath,
        captureBeyondViewport: true,
        fullPage: true,
    });

    metadata.push({
        image: filename,
        route,
        state,
        components,
        timestamp: new Date().toISOString()
    });
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    console.log(`Saved screenshot and metadata for ${viewSlug}.`);
}

(async () => {
    console.log('Launching browser with extension...');
    const browser = await puppeteer.launch({
        headless: false,
        args: [
            `--disable-extensions-except=${extensionPath}`,
            `--load-extension=${extensionPath}`,
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--headless=new'
        ]
    });

    console.log('Finding extension ID...');
    const workerTarget = await browser.waitForTarget(
        target => target.type() === 'service_worker' && target.url().includes('background.js'),
        { timeout: 10000 }
    ).catch(e => {
        console.log("Fallback finding target...");
        return browser.waitForTarget(t => t.url().startsWith('chrome-extension://'));
    });

    if (!workerTarget) {
        console.error("Could not find loaded extension.");
        await browser.close();
        process.exit(1);
    }

    const workerUrl = workerTarget.url();
    const extId = workerUrl.split('/')[2];
    console.log(`Extension ID: ${extId}`);

    const page = await browser.newPage();

    // 1. Popup capture
    await captureEnhancedScreenshot(
        page,
        `chrome-extension://${extId}/src/popup/index.html`,
        'popup',
        'Popup View - Default State',
        ['Popup']
    );

    // 2. Viewer capture
    await captureEnhancedScreenshot(
        page,
        `chrome-extension://${extId}/src/viewer/index.html`,
        'viewer',
        'Viewer Default State - Ready for Debug Context',
        ['Viewer', 'ReplayTimeline', 'NetworkTab']
    );

    // 3. Screenshot Editor capture
    await captureEnhancedScreenshot(
        page,
        `chrome-extension://${extId}/src/screenshot-editor/index.html`,
        'screenshot_editor',
        'Editor Loading / Blank State',
        ['ScreenshotEditor', 'DrawingTools']
    );

    // 4. Content Script Injected Widget capture
    console.log('Setting up for content_script...');
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto('https://example.com', { waitUntil: 'networkidle0' });
    try {
        await page.waitForSelector('#signal-root', { timeout: 5000 });
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Let's try to click the start button to capture an active state
        await page.evaluate(() => {
            const root = document.querySelector('#signal-root');
            if (root && root.shadowRoot) {
                const startBtn = root.shadowRoot.querySelector('button');
                if (startBtn) startBtn.click();
            }
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (e) {
        console.log('Signal root not fully injected or interactive in time.');
    }

    const ts = Date.now();
    const filename = `content_script_${ts}.png`;
    await page.screenshot({ path: path.join(screenshotsDir, filename), fullPage: true });
    metadata.push({
        image: filename,
        route: 'https://example.com',
        state: 'Content Script Shadow DOM injected on Host',
        components: ['IssueDialog', 'ReplayWidget'],
        timestamp: new Date().toISOString()
    });
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    console.log('Completed capturing workflows successfully!');
    await browser.close();
})();
