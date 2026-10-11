// test-live-e2e.js - End-to-end verification of live GitHub Pages deployment
import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const LIVE_URL = 'https://probalsarpv-byte.github.io/GeneTrace/';
const SCREENSHOT_DIR = path.join(__dirname, '../screenshots');
const ARTIFACT_DIR = 'C:\\Users\\HP\\.gemini\\antigravity\\brain\\086bc1d0-7c9f-4288-a60b-77beeceb4276';

const results = {
    testedAt: new Date().toISOString(),
    target: LIVE_URL,
    browser: 'Google Chrome (Live Production)',
    passed: false,
    consoleErrors: [],
    networkErrors: [],
    tests: []
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function capture(page, name) {
    const filename = `live_v1_1_${name}.png`;
    const localPath = path.join(SCREENSHOT_DIR, filename);
    await page.screenshot({ path: localPath });
    try {
        fs.copyFileSync(localPath, path.join(ARTIFACT_DIR, filename));
    } catch (e) {}
    console.log(`📸 Screenshot: ${filename}`);
}

async function runTest(name, fn) {
    try {
        await fn();
        results.tests.push({ name, status: 'PASS' });
        console.log(`✅ [PASS] ${name}`);
    } catch (err) {
        results.tests.push({ name, status: 'FAIL', error: err.message });
        console.error(`❌ [FAIL] ${name}:`, err.message);
    }
}

async function main() {
    console.log('==================================================');
    console.log('GENETRACE v1.1 LIVE PRODUCTION TEST (GITHUB PAGES)');
    console.log(`Target URL: ${LIVE_URL}`);
    console.log('==================================================\n');

    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1440, height: 900 });

        page.on('dialog', async dialog => {
            console.log(`[LIVE DIALOG]: ${dialog.message()}`);
            await dialog.accept();
        });

        page.on('console', msg => {
            const type = msg.type();
            const text = msg.text();
            if (type === 'error' && !text.includes('ERR_NAME_NOT_RESOLVED') && !text.includes('favicon')) {
                results.consoleErrors.push(text);
                console.error(`[LIVE CONSOLE ERROR]: ${text}`);
            }
        });

        page.on('response', resp => {
            if (resp.status() >= 400 && !resp.url().includes('favicon')) {
                results.networkErrors.push(`${resp.status()}: ${resp.url()}`);
                console.error(`[LIVE HTTP ERROR ${resp.status()}]: ${resp.url()}`);
            }
        });

        // 1. Initial Page Load
        await runTest('Live Home Page Load & Header', async () => {
            const resp = await page.goto(LIVE_URL, { waitUntil: 'networkidle0' });
            if (resp.status() !== 200) throw new Error(`HTTP ${resp.status()}`);
            await sleep(1000);
            const title = await page.title();
            if (!title.includes('GeneTrace v1.1')) throw new Error('Incorrect title: ' + title);
            await capture(page, '01_live_home');
        });

        // 2. DNA Sequence Analysis & ORF Finder
        await runTest('Live DNA FASTA Analysis & ORFs', async () => {
            await page.click('.input-tabs .tab-btn[data-tab="example"]');
            await sleep(300);
            await page.click('.btn-example-seq[data-example="dna-fasta"]');
            await sleep(300);
            await page.click('#btn-analyze-sequence');
            await sleep(1000);

            const activeView = await page.$eval('.view-section.active', el => el.id);
            if (activeView !== 'view-analyze-nucleotide') throw new Error(`Expected view-analyze-nucleotide, got ${activeView}`);

            await page.click('#btn-find-orfs');
            await sleep(500);
            const orfRows = await page.$$eval('#orf-results-container table tbody tr', rows => rows.length);
            if (orfRows === 0) throw new Error('No ORFs detected');
            await capture(page, '02_live_nucleotide_orfs');
        });

        // 3. Smart Workflow Router
        await runTest('Live Smart Workflow Router', async () => {
            await page.click('.nav-item[data-view="analyze-identify"]');
            await sleep(800);
            const recTitle = await page.$eval('#router-recommendation-container h3', el => el.textContent);
            if (!recTitle || recTitle.length === 0) throw new Error('Missing top recommendation');
            await capture(page, '03_live_smart_router');
        });

        // 4. Raw Lab AB1 & FASTQ
        await runTest('Live Raw Sequence Lab (AB1 & FASTQ)', async () => {
            await page.click('.nav-item[data-view="raw-lab"]');
            await sleep(500);

            await page.click('#btn-load-demo-ab1');
            await sleep(800);
            const ab1Text = await page.$eval('#ab1-qc-panel', el => el.textContent);
            if (!ab1Text.includes('Quality Report')) throw new Error('AB1 QC panel missing');

            await page.click('#tab-btn-fastq');
            await sleep(300);
            await page.click('#btn-load-demo-fastq');
            await sleep(800);
            const fastqText = await page.$eval('#fastq-qc-charts', el => el.textContent);
            if (!fastqText.includes('FASTQ Quality Metrics')) throw new Error('FASTQ QC metrics missing');
            await capture(page, '04_live_raw_lab');
        });

        // 5. 16S Identification Pipeline
        await runTest('Live 16S Identification Pipeline', async () => {
            await page.click('.nav-item[data-view="id-16s"]');
            await sleep(500);
            await page.click('#btn-16s-load-candidate-demo');
            await sleep(200);
            await page.click('#btn-16s-eval-candidate');
            await sleep(500);
            const evalText = await page.$eval('#sixteen-s-eval-result', el => el.textContent);
            if (!evalText.includes('Taxonomic Assignment Assessment')) throw new Error('16S evaluation failed');
            await page.click('#btn-16s-add-evidence');
            await sleep(300);
            await capture(page, '05_live_16s');
        });

        // 6. 3D Organism WebGL Viewer & Taxonomy Lineage
        await runTest('Live 3D Organism & Taxonomy Viewer', async () => {
            await page.click('.nav-item[data-view="vis-3d"]');
            await sleep(1500);
            await page.click('.btn-tax-preset[data-preset="yeast"]');
            await sleep(500);
            const taxText = await page.$eval('#taxonomy-path-container', el => el.textContent);
            if (!taxText.includes('Saccharomyces')) throw new Error('Taxonomy path missing Yeast');
            await page.click('.btn-3d-model[data-type="yeast"]');
            await sleep(500);
            await capture(page, '06_live_3d_organism');
        });

        // 7. User Dashboard & Entitlements
        await runTest('Live User Dashboard', async () => {
            await page.click('.nav-item[data-view="dashboard"]');
            await sleep(800);
            const dashText = await page.$eval('#user-dashboard-container', el => el.textContent);
            if (!dashText.includes('Tier & Entitlement Comparison')) throw new Error('Dashboard missing tier table');
            await capture(page, '07_live_dashboard');
        });

        // 8. Admin Feature Management Console
        await runTest('Live Admin Console', async () => {
            await page.click('.nav-item[data-view="admin"]');
            await sleep(800);
            const adminText = await page.$eval('#admin-dashboard-container', el => el.textContent);
            if (!adminText.includes('Feature Registry')) throw new Error('Admin registry missing');
            await capture(page, '08_live_admin');
        });

        const totalTests = results.tests.length;
        const failedTests = results.tests.filter(t => t.status === 'FAIL').length;
        results.passed = failedTests === 0 && results.consoleErrors.length === 0 && results.networkErrors.length === 0;

        console.log('\n==================================================');
        console.log(`LIVE PRODUCTION TEST SUMMARY: ${totalTests - failedTests}/${totalTests} PASSED`);
        console.log(`CONSOLE ERRORS: ${results.consoleErrors.length}`);
        console.log(`NETWORK ERRORS: ${results.networkErrors.length}`);
        console.log(`OVERALL STATUS: ${results.passed ? 'ALL CHECKS PASSED ✅' : 'FAILURES DETECTED ❌'}`);
        console.log('==================================================\n');

        fs.writeFileSync(path.join(ARTIFACT_DIR, 'live_v1_1_test_results.json'), JSON.stringify(results, null, 2));

    } finally {
        await browser.close();
    }

    if (!results.passed) process.exit(1);
}

main().catch(err => {
    console.error('Fatal live runner error:', err);
    process.exit(1);
});
