import puppeteer, { Browser, Page } from 'puppeteer';
import path from 'path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const extensionPath = path.resolve(__dirname, '../dist');

describe('Chrome Extension E2E (Puppeteer)', () => {
    let browser: Browser;
    let page: Page;

    beforeAll(async () => {
        browser = await puppeteer.launch({
            headless: false, // extensions only work in headful mode or new headless
            args: [
                `--disable-extensions-except=${extensionPath}`,
                `--load-extension=${extensionPath}`,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--headless=new' // Try new headless which supports extensions
            ]
        });
    });

    afterAll(async () => {
        if (browser) await browser.close();
    });

    it('Insects the signal-root widget onto a regular webpage', async () => {
        page = await browser.newPage();
        await page.goto('https://example.com');

        // Wait for the content script to inject the shadow dom root
        await page.waitForSelector('#signal-root', { timeout: 5000 });

        const rootHandle = await page.$('#signal-root');
        expect(rootHandle).toBeTruthy();

        // Dig into the shadow DOM to verify the widget rendered
        const hasWidgetBtn = await page.evaluate(() => {
            const root = document.querySelector('#signal-root');
            if (!root || !root.shadowRoot) return false;

            // Check if the generic Start button or idle state is in there
            // Note: The widget adds a .signal-widget class
            const widget = root.shadowRoot.querySelector('.signal-widget');
            return !!widget;
        });

        expect(hasWidgetBtn).toBe(true);
    }, 10000); // 10s timeout for browser launch buffer
});
