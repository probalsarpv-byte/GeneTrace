// test-live-github-pages.js - Verification on the live deployed GitHub Pages site
import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const LIVE_URL = 'https://probalsarpv-byte.github.io/GeneTrace/';

const results = {
    urlTested: LIVE_URL,
    consoleErrors: [],
    network404s: [],
    homepageLoaded: false,
    cssLoaded: false,
    jsLoaded: false,
    swRegistered: false,
    dnaAnalysisWorked: false,
    orfWorked: false,
    mutationWorked: false,
    batchWorked: false,
    persistenceWorked: false,
    reportWorked: false,
    darkModeWorked: false,
    mobileWorked: false
};

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function testLiveSite() {
    console.log('==================================================');
    console.log('LAUNCHING GOOGLE CHROME FOR LIVE GITHUB PAGES TEST');
    console.log(`URL: ${LIVE_URL}`);
    console.log('==================================================\n');

    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--window-size=1366,768'
        ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });

    // Monitor Console
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.error('[Live Console Error]:', msg.text());
            results.consoleErrors.push(msg.text());
        } else {
            console.log('[Live Console Log]:', msg.text());
        }
    });

    page.on('pageerror', err => {
        console.error('[Live Page Error]:', err.message);
        results.consoleErrors.push(err.message);
    });

    // Monitor Network
    page.on('response', response => {
        const status = response.status();
        const url = response.url();
        if (status >= 400) {
            console.error(`[Live Network Error ${status}]: ${url}`);
            results.network404s.push(`${status}: ${url}`);
        }
    });

    page.on('dialog', async dialog => {
        console.log(`[Live Dialog]: ${dialog.type()} -> "${dialog.message().substring(0, 80)}"`);
        await dialog.accept();
    });

    // 1. Navigate to Live URL
    console.log('Navigating to live GitHub Pages...');
    const response = await page.goto(LIVE_URL, { waitUntil: 'networkidle2' });
    console.log(`HTTP Status: ${response.status()}`);
    results.homepageLoaded = response.status() === 200;

    await sleep(1000);

    // 2. Check CSS & JS
    const brandTitle = await page.$eval('#top-bar .brand h1', el => el.textContent);
    console.log(`Brand Title: ${brandTitle}`);
    results.jsLoaded = brandTitle.includes('GeneTrace');

    const heroColor = await page.evaluate(() => {
        return window.getComputedStyle(document.body).backgroundColor;
    });
    console.log(`Body Background: ${heroColor}`);
    results.cssLoaded = !!heroColor;

    // 3. Check Service Worker
    const swScope = await page.evaluate(async () => {
        if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            return regs.length > 0 ? regs[0].scope : null;
        }
        return null;
    });
    console.log(`Service Worker Registered Scope: ${swScope}`);
    results.swRegistered = !!swScope;

    // 4. Test DNA Analysis on Live Site
    console.log('\nTesting DNA Sequence Analysis on Live Site...');
    const gfpFasta = `>GFP_Green_Fluorescent_Protein
ATGAAGAGCAACGGCGAGGAGCTGTTCACCGGGGTGGTGCCCATCCTGGTCGAGCTGGAC
GGCGACGTAAACGGCCACAAGTTCAGCGTGTCCGGCGAGGGCGAGGGCGATGCCACCTAC
GGCAAGCTGACCCTGAAGTTCATCTGCACCACCGGCAAGCTGCCCGTGCCCTGGCCCACC
CTCGTGACCACCCTGACCTACGGCGTGCAGTGCTTCAGCCGCTACCCCGACCACATGAAG
CAGCACGACTTCTTCAAGTCCGCCATGCCCGAAGGCTACGTCCAGGAGCGCACCATCTTC
TTCAAGGACGACGGCAACTACAAGACCCGCGCCGAGGTGAAGTTCGAGGGCGACACCCTG
GTGAACCGCATCGAGCTGAAGGGCATCGACTTCAAGGAGGACGGCAACATCCTGGGGCAC
AAGCTGGAGTACAACTACAACAGCCACAACGTCTATATCATGGCCGACAAGCAGAAGAAC
GGCATCAAGGTGAACTTCAAGATCCGCCACAACATCGAGGACGGCAGCGTGCAGCTCGCC
GACCACTACCAGCAGAACACCCCCATCGGCGACGGCCCCGTGCTGCTGCCCGACAACCAC
TACCTGAGCACCCAGTCCGCCCTGAGCAAAGACCCCAACGAGAAGCGCGATCACATGGTC
CTGCTGGAGTTCGTGACCGCCGCCGGGATCACTCTCGGCATGGACGAGCTGTACAAGTAA`;

    await page.$eval('#main-sequence-input', (el, val) => el.value = val, gfpFasta);
    await page.click('#btn-analyze-sequence');
    await sleep(800);

    const evidenceText = await page.$eval('#evidence-board', el => el.textContent);
    console.log(`Live Evidence Board: ${evidenceText.replace(/\s+/g, ' ')}`);
    results.dnaAnalysisWorked = evidenceText.includes('GFP_Green_Fluorescent_Protein') && evidenceText.includes('720 bp');

    // 5. Test ORF Finder
    console.log('\nTesting ORF Finder on Live Site...');
    await page.click('#btn-find-orfs');
    await sleep(500);
    const orfsText = await page.$eval('#orf-results-container', el => el.textContent);
    console.log(`Live ORFs: ${orfsText.includes('Open Reading Frames')}`);
    results.orfWorked = orfsText.includes('Open Reading Frames');

    // 6. Test Mutation Explorer
    console.log('\nTesting Mutation Explorer on Live Site...');
    await page.click('.nav-menu li[data-view="tools-mutation"]');
    await sleep(400);
    await page.$eval('#mutation-ref', el => el.value = 'ATG-CGACTGATC');
    await page.$eval('#mutation-alt', el => el.value = 'ATGCCGACTG-AC');
    await page.click('#btn-find-mutations');
    await sleep(400);
    const mutText = await page.$eval('#mutation-results', el => el.textContent);
    console.log(`Live Mutations: ${mutText.replace(/\s+/g, ' ')}`);
    results.mutationWorked = mutText.includes('Detected 3 Mutations') && mutText.includes('1-based');

    // 7. Test Batch Analysis
    console.log('\nTesting Batch Analysis on Live Site...');
    await page.click('.nav-menu li[data-view="tools-batch"]');
    await sleep(400);
    await page.click('#btn-load-sample-batch');
    await sleep(200);
    await page.click('#btn-run-batch');
    await sleep(500);
    const batchText = await page.$eval('#batch-results', el => el.textContent);
    console.log(`Live Batch: ${batchText.replace(/\s+/g, ' ').substring(0, 80)}`);
    results.batchWorked = batchText.includes('Total Sequences in Batch: 3');

    // 8. Test Project Persistence
    console.log('\nTesting Project Persistence on Live Site...');
    await page.click('.nav-menu li[data-view="projects"]');
    await sleep(400);
    await page.$eval('#new-project-name', el => el.value = 'Live GitHub Project');
    await page.click('#btn-create-project');
    await sleep(500);

    // Save sample from nucleotide analysis
    await page.click('.nav-menu li[data-view="analyze-nucleotide"]');
    await sleep(400);
    await page.click('#btn-save-sample-nuc');
    await sleep(500);

    // Reload live site to test persistence across sessions
    console.log('Reloading live site...');
    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(1000);

    const currentProj = await page.$eval('#current-project', el => el.textContent);
    console.log(`Active Project after reload: "${currentProj}"`);
    await page.click('.nav-menu li[data-view="projects"]');
    await sleep(400);
    const samplesText = await page.$eval('#project-samples-container', el => el.textContent);
    console.log(`Persisted samples: ${samplesText.replace(/\s+/g, ' ')}`);
    results.persistenceWorked = currentProj.includes('Live GitHub Project') && samplesText.includes('GFP_Green_Fluorescent_Protein');

    // 9. Test Report Generation
    console.log('\nTesting Report Generation on Live Site...');
    // Click 'Open in Workbench' on the persisted sample to load it into memory
    await page.click('.btn-load-samp');
    await sleep(500);
    // Now click Export / Report in top bar
    await page.click('#btn-export');
    await sleep(500);
    const reportHtml = await page.$eval('#report-live-container', el => el.innerHTML);
    results.reportWorked = reportHtml.includes('iframe');
    console.log(`Report rendered: ${results.reportWorked}`);

    // 10. Test Dark Mode
    console.log('\nTesting Dark Mode on Live Site...');
    await page.click('#btn-theme-toggle');
    await sleep(200);
    const isDark = await page.$eval('body', b => b.classList.contains('theme-dark'));
    console.log(`Theme is Dark: ${isDark}`);
    results.darkModeWorked = isDark;
    await page.click('#btn-theme-toggle'); // toggle back

    // 11. Test Mobile Layout
    console.log('\nTesting Mobile Layout on Live Site (390x844)...');
    await page.setViewport({ width: 390, height: 844 });
    await sleep(300);
    const mobileOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth + 2;
    });
    console.log(`Mobile horizontal overflow detected: ${mobileOverflow}`);
    results.mobileWorked = !mobileOverflow;

    // Capture screenshot of live site
    const liveScreenshotPath = path.join(__dirname, '../screenshots/screenshot-live-deployment.png');
    await page.screenshot({ path: liveScreenshotPath });
    console.log(`📸 Captured live deployment screenshot: ${liveScreenshotPath}`);

    await browser.close();

    console.log('\n==================================================');
    console.log('LIVE GITHUB PAGES TEST COMPLETE');
    console.log('==================================================');
    console.log(JSON.stringify(results, null, 2));

    fs.writeFileSync(
        path.join(__dirname, 'live-test-results.json'),
        JSON.stringify(results, null, 2)
    );
}

testLiveSite().catch(err => {
    console.error('Live site test failed with exception:', err);
    process.exit(1);
});
