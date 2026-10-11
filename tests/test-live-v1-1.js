// test-live-v1-1.js
import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const LIVE_URL = 'https://probalsarpv-byte.github.io/GeneTrace/';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
    let browser = null;
    try {
        browser = await puppeteer.launch({
            executablePath: CHROME_PATH,
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1440, height: 900 });

        page.on('dialog', async dialog => await dialog.accept());
        page.on('console', msg => {
            if (msg.type() === 'error') console.error('[Live Error]:', msg.text());
        });

        console.log('Navigating to Live GitHub Pages...');
        await page.goto(LIVE_URL, { waitUntil: 'networkidle2' });

        const title = await page.title();
        console.log('Page Title:', title);

        const versionBadge = await page.evaluate(() => {
            const badge = document.querySelector('#top-bar .brand .badge');
            return badge ? badge.textContent.trim() : 'none';
        });
        console.log('Detected Live Version Badge:', versionBadge);

        return versionBadge === 'v1.1';
    } finally {
        if (browser) await browser.close();
    }
}

async function poll() {
    for (let i = 0; i < 10; i++) {
        console.log(`Poll attempt ${i + 1}/10...`);
        const isV1_1 = await run();
        if (isV1_1) {
            console.log('🎉 LIVE GITHUB PAGES DEPLOYMENT DETECTED v1.1!');
            process.exit(0);
        }
        console.log('GitHub Pages build in progress, waiting 15s...');
        await sleep(15000);
    }
    console.log('Timeout waiting for live GitHub Pages build update.');
    process.exit(0);
}

poll();
