// test-v1-1-real-browser.js
// Automated verification of GeneTrace v1.1 in Google Chrome using Puppeteer-core
import puppeteer from 'puppeteer-core';
import { startServer } from './server.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 8089;
const APP_URL = `http://localhost:${PORT}/genetrace/index.html`;
const SCREENSHOT_DIR = path.join(__dirname, '../screenshots');
const ARTIFACT_DIR = 'C:\\Users\\HP\\.gemini\\antigravity\\brain\\086bc1d0-7c9f-4288-a60b-77beeceb4276';

const results = {
    testedAt: new Date().toISOString(),
    browser: 'Google Chrome',
    passed: false,
    consoleErrors: [],
    tests: [],
    screenshots: []
};

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function capture(page, name) {
    const filename = `v1_1_${name}.png`;
    const localPath = path.join(SCREENSHOT_DIR, filename);
    await page.screenshot({ path: localPath });
    try {
        fs.copyFileSync(localPath, path.join(ARTIFACT_DIR, filename));
    } catch (e) {}
    results.screenshots.push(filename);
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
    console.log('GENETRACE v1.1 REAL BROWSER TESTING (GOOGLE CHROME)');
    console.log('==================================================\n');

    const server = await startServer(PORT);
    let browser = null;

    try {
        browser = await puppeteer.launch({
            executablePath: CHROME_PATH,
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1440, height: 900 });

        page.on('dialog', async dialog => {
            console.log(`[BROWSER DIALOG]: ${dialog.message()}`);
            await dialog.accept();
        });

        page.on('console', msg => {
            const type = msg.type();
            const text = msg.text();
            if (type === 'error' && !text.includes('Failed to load resource: net::ERR_NAME_NOT_RESOLVED')) {
                results.consoleErrors.push(text);
                console.error(`[BROWSER ERROR]: ${text}`);
            }
        });

        page.on('pageerror', err => {
            results.consoleErrors.push(err.message);
            console.error(`[UNHANDLED PAGE ERROR]: ${err.message}`);
        });

        // 1. Initial Page Load
        await runTest('Load GeneTrace v1.1 Home View', async () => {
            await page.goto(APP_URL, { waitUntil: 'networkidle0' });
            await sleep(1000);
            const title = await page.title();
            if (!title.includes('GeneTrace')) throw new Error('Title mismatch: ' + title);
            await capture(page, '01_home_loaded');
        });

        // 2. DNA Sequence Analysis Journey
        await runTest('Analyze Standard DNA FASTA (GFP)', async () => {
            await page.click('.input-tabs .tab-btn[data-tab="example"]');
            await sleep(300);
            await page.click('.btn-example-seq[data-example="dna-fasta"]');
            await sleep(300);
            await page.click('#btn-analyze-sequence');
            await sleep(1000);

            // Check nucleotide view active
            const activeView = await page.$eval('.view-section.active', el => el.id);
            if (activeView !== 'view-analyze-nucleotide') throw new Error(`Expected view-analyze-nucleotide, got ${activeView}`);

            // Find ORFs
            await page.click('#btn-find-orfs');
            await sleep(500);
            const orfRows = await page.$$eval('#orf-results-container table tbody tr', rows => rows.length);
            if (orfRows === 0) throw new Error('No ORFs detected');

            await capture(page, '02_nucleotide_orf_analysis');
        });

        // 3. Smart Workflow Router
        await runTest('Smart Workflow Router Evaluation', async () => {
            await page.click('.nav-item[data-view="analyze-identify"]');
            await sleep(800);
            const recTitle = await page.$eval('#router-recommendation-container h3', el => el.textContent);
            if (!recTitle || recTitle.length === 0) throw new Error('Missing top recommendation');
            await capture(page, '03_smart_router');
        });

        // 4. Raw Sequence Lab: AB1 Chromatogram & FASTQ
        await runTest('Raw Sequence Lab (AB1 Sanger Trace & FASTQ QC)', async () => {
            await page.click('.nav-item[data-view="raw-lab"]');
            await sleep(500);

            // Click demo AB1
            await page.click('#btn-load-demo-ab1');
            await sleep(800);
            const ab1Text = await page.$eval('#ab1-qc-panel', el => el.textContent);
            if (!ab1Text.includes('Quality Report')) throw new Error('AB1 QC panel did not render');

            // Switch to FASTQ
            await page.click('#tab-btn-fastq');
            await sleep(300);
            await page.click('#btn-load-demo-fastq');
            await sleep(800);
            const fastqText = await page.$eval('#fastq-qc-charts', el => el.textContent);
            if (!fastqText.includes('FASTQ Quality Metrics')) throw new Error('FASTQ QC did not render');

            await capture(page, '04_raw_lab_ab1_fastq');
        });

        // 5. 16S rRNA Identification Workflow
        await runTest('16S rRNA Identification Pipeline', async () => {
            await page.click('.nav-item[data-view="id-16s"]');
            await sleep(500);
            await page.click('#btn-16s-load-candidate-demo');
            await sleep(200);
            await page.click('#btn-16s-eval-candidate');
            await sleep(500);
            const evalText = await page.$eval('#sixteen-s-eval-result', el => el.textContent);
            if (!evalText.includes('Taxonomic Assignment Assessment')) throw new Error('16S evaluation failed');

            // Add to evidence
            await page.click('#btn-16s-add-evidence');
            await sleep(300);
            await capture(page, '05_16s_identification');
        });

        // 6. 3D Organism & Taxonomy Viewer
        await runTest('3D Organism WebGL Model & Taxonomy Lineage', async () => {
            await page.click('.nav-item[data-view="vis-3d"]');
            await sleep(1500);
            // Click yeast preset
            await page.click('.btn-tax-preset[data-preset="yeast"]');
            await sleep(500);
            const taxPill = await page.$eval('#taxonomy-path-container', el => el.textContent);
            if (!taxPill.includes('Saccharomyces')) throw new Error('Taxonomy path did not render Yeast');

            // Switch 3D model to yeast
            await page.click('.btn-3d-model[data-type="yeast"]');
            await sleep(500);
            await capture(page, '06_3d_organism_taxonomy');
        });

        // 7. User Dashboard
        await runTest('User Dashboard & Entitlements', async () => {
            await page.click('.nav-item[data-view="dashboard"]');
            await sleep(800);
            const dashText = await page.$eval('#user-dashboard-container', el => el.textContent);
            if (!dashText.includes('Tier & Entitlement Comparison')) throw new Error('User dashboard did not render');
            await capture(page, '07_user_dashboard');
        });

        // 8. Admin Console
        await runTest('Admin Feature Management Console', async () => {
            await page.click('.nav-item[data-view="admin"]');
            await sleep(800);
            const adminText = await page.$eval('#admin-dashboard-container', el => el.textContent);
            if (!adminText.includes('Feature Registry')) throw new Error('Admin feature registry did not render');
            await capture(page, '08_admin_console');
        });

        // 9. Mobile Responsive Layout Check (390px)
        await runTest('Mobile Responsive Layout Viewport (390x844)', async () => {
            await page.setViewport({ width: 390, height: 844 });
            await page.click('.nav-item[data-view="home"]');
            await sleep(800);
            await capture(page, '09_mobile_viewport');
        });

        const totalTests = results.tests.length;
        const failedTests = results.tests.filter(t => t.status === 'FAIL').length;
        results.passed = failedTests === 0 && results.consoleErrors.length === 0;

        console.log('\n==================================================');
        console.log(`TEST SUMMARY: ${totalTests - failedTests}/${totalTests} PASSED`);
        console.log(`CONSOLE ERRORS: ${results.consoleErrors.length}`);
        console.log(`STATUS: ${results.passed ? 'ALL CHECKS PASSED ✅' : 'FAILURES DETECTED ❌'}`);
        console.log('==================================================\n');

        fs.writeFileSync(path.join(ARTIFACT_DIR, 'v1_1_browser_test_results.json'), JSON.stringify(results, null, 2));

    } finally {
        if (browser) await browser.close();
        server.close();
    }

    if (!results.passed) {
        process.exit(1);
    }
}

main().catch(err => {
    console.error('Fatal test runner error:', err);
    process.exit(1);
});
