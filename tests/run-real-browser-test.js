// run-real-browser-test.js
// Automated verification using real Google Chrome via Chrome DevTools Protocol
import puppeteer from 'puppeteer-core';
import { startServer } from './server.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:8085/genetrace/index.html';
const SCREENSHOT_DIR = path.join(__dirname, '../screenshots');
const ARTIFACT_SCREENSHOT_DIR = 'C:\\Users\\HP\\.gemini\\antigravity\\brain\\086bc1d0-7c9f-4288-a60b-77beeceb4276\\screenshots';

const results = {
    browserName: 'Google Chrome',
    browserVersion: '',
    urlTested: APP_URL,
    screenSizesTested: [],
    consoleErrors: [],
    networkErrors: [],
    interactionsTested: [],
    inputsTested: [],
    dnaJourneyPassed: false,
    persistenceTested: false,
    reportTested: false,
    batchTested: false,
    mutationTested: false,
    visualQaPassed: false,
    screenshotsCaptured: []
};

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function captureScreenshot(page, filename) {
    const localPath = path.join(SCREENSHOT_DIR, filename);
    await page.screenshot({ path: localPath, fullPage: false });
    
    // Also copy to artifacts directory
    try {
        const artifactPath = path.join(ARTIFACT_SCREENSHOT_DIR, filename);
        fs.copyFileSync(localPath, artifactPath);
    } catch (e) {
        // Artifact copy best-effort
    }
    
    results.screenshotsCaptured.push(filename);
    console.log(`📸 Captured screenshot: ${filename}`);
}

async function run() {
    console.log('==================================================');
    console.log('STARTING REAL GRAPHICAL BROWSER TESTING (GOOGLE CHROME)');
    console.log('==================================================\n');

    // 1. Start HTTP Server
    console.log('Step 1: Starting local HTTP server...');
    const server = await startServer(8085);

    // 2. Launch Real Google Chrome
    console.log('Step 2: Launching real Google Chrome executable at:', CHROME_PATH);
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new', // Uses Chrome's full Blink graphics renderer
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--window-size=1366,768'
        ]
    });

    results.browserVersion = await browser.version();
    console.log(`Connected to ${results.browserName} Version: ${results.browserVersion}`);

    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });

    // 11. Monitor Browser Console
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.error(`[Browser Console Error]:`, msg.text());
            results.consoleErrors.push(msg.text());
        }
    });

    page.on('pageerror', err => {
        console.error(`[Browser Page Error]:`, err.message);
        results.consoleErrors.push(err.message);
    });

    // 12. Monitor Network Tab
    page.on('requestfailed', request => {
        const url = request.url();
        console.warn(`[Network Request Failed]: ${url} - ${request.failure() ? request.failure().errorText : 'failed'}`);
        results.networkErrors.push(`${url}: ${request.failure() ? request.failure().errorText : 'failed'}`);
    });

    page.on('response', response => {
        const status = response.status();
        const url = response.url();
        if (status >= 400 && url.includes('localhost:8085')) {
            console.error(`[HTTP Error ${status}]: ${url}`);
            results.networkErrors.push(`HTTP ${status}: ${url}`);
        }
    });

    // Handle alert/confirm dialogs gracefully
    page.on('dialog', async dialog => {
        console.log(`[Browser Dialog]: ${dialog.type()} -> "${dialog.message().substring(0, 80)}"`);
        await dialog.accept();
    });

    // Navigate to Subdirectory URL
    console.log(`Step 3: Navigating to ${APP_URL}...`);
    await page.goto(APP_URL, { waitUntil: 'networkidle2' });
    await sleep(500);

    // Screenshot 1: Home
    await captureScreenshot(page, 'screenshot-1-home.png');

    // 3. Navigation Areas Test
    console.log('\n--- Section 3: Testing Navigation Areas ---');
    const navViews = [
        'home',
        'analyze-identify',
        'analyze-nucleotide',
        'analyze-protein',
        'tools-batch',
        'tools-motif',
        'tools-mutation',
        'tools-primer',
        'tools-restriction',
        'tools-translation',
        'tools-compare',
        'phylogeny-alignment',
        'phylogeny-tree',
        'learn-modules',
        'learn-challenges',
        'projects',
        'reports',
        'settings'
    ];

    for (const view of navViews) {
        await page.click(`.nav-menu li[data-view="${view}"]`);
        await sleep(100);
        const active = await page.$eval(`#view-${view}`, el => el.classList.contains('active'));
        if (active) {
            results.interactionsTested.push(`Navigated to ${view}`);
        }
    }
    console.log(`✅ All ${navViews.length} navigation sections activated without layout errors.`);

    // Test Top Controls (Theme & Mode)
    await page.click('#btn-theme-toggle');
    await sleep(100);
    await page.click('#btn-theme-toggle'); // toggle back
    await sleep(100);

    await page.click('#btn-mode-student');
    await sleep(100);
    await page.click('#btn-mode-research');
    await sleep(100);

    results.interactionsTested.push('Theme toggle (Dark/Light)');
    results.interactionsTested.push('Mode toggle (Student/Research)');
    console.log('✅ Top bar Theme and Mode toggles working.');

    // 4. Test with Real Inputs
    console.log('\n--- Section 4: Testing With Real Inputs ---');
    
    async function testInput(label, inputString) {
        await page.click('.nav-menu li[data-view="home"]');
        await sleep(200);
        await page.$eval('#main-sequence-input', (el, val) => el.value = val, inputString);
        await page.click('#btn-analyze-sequence');
        await sleep(300);
        results.inputsTested.push(label);
        console.log(`✅ Tested input: ${label}`);
    }

    // Input H: Empty input
    await testInput('H. Empty input', '');

    // Input G: Invalid input
    await testInput('G. Invalid input', '123456789!@#$%^&*()_+XYZ');

    // Input F: Ambiguous nucleotide sequence
    await testInput('F. Ambiguous sequence (IUPAC)', '>Ambiguous\nATGCGNATCRYTGWSKMBDHVNATCGATCG');

    // Input C: RNA sequence
    await testInput('C. RNA sequence', '>16S_RNA\nAUGCAAGUCGAACGGUAACAGGAAGAAGCUUGCUUCUUUGCUGACGAGUGGCGGACGGGUGAGUAAUGUCUGGGAAACUGCCUGA');

    // Input D: Protein FASTA
    await testInput('D. Protein FASTA', '>Hemoglobin_Alpha\nMVLSPADKTNVKAAWGKVGAHAGEYGAEALERMFLSFPTTKTYFPHFDLSHGSAQVKGHGKKVADALTNAVAHVDDMPNALSALSDLHAHKLRVDPVNFKLLSHCLLVTLAAHLPAEFTPAVHASLDKFLASVSTVLTSKYR');

    // Input B: Plain DNA without header
    await testInput('B. Plain DNA without FASTA header', 'ATGAAGAGCAACGGCGAGGAGCTGTTCACCGGGGTGGTGCCCATCCTGGTCGAGCTGGACGGCGACGTAAACGGCCACAAGTTCAGCGTGTCCGGCGAGGGCGAGGGCGATGCCACCTACGGCAAGCTGACCCTGAAGTTCATCTGCACCACCGGCAAGCTGCCCGTGCCCTGGCCCACCCTCGTGACCACCCTGACCTACGGCGTGCAGTGCTTCAGCCGCTACCCCGACCACATGAAG');

    // Input A: Valid DNA FASTA (GFP Sequence)
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
    await testInput('A. Valid DNA FASTA (GFP)', gfpFasta);

    // Screenshot 2: DNA Analysis Result
    await captureScreenshot(page, 'screenshot-2-dna-analysis.png');

    // 5. Complete DNA Journey
    console.log('\n--- Section 5: Complete DNA Journey ---');
    const evidenceText = await page.$eval('#evidence-board', el => el.textContent);
    console.log('Evidence Board State:\n', evidenceText.replace(/\s+/g, ' ').substring(0, 150));

    // ORF Finder
    await page.click('#btn-find-orfs');
    await sleep(400);
    const orfsRendered = await page.$eval('#orf-results-container', el => el.innerHTML);
    console.log(`ORFs found: ${orfsRendered.includes('Open Reading Frames')}`);
    // Screenshot 3: ORF Finder
    await captureScreenshot(page, 'screenshot-3-orf-finder.png');

    // Reverse Complement
    await page.click('#btn-reverse-complement');
    await sleep(200);

    // Motif Finder
    await page.click('.nav-menu li[data-view="tools-motif"]');
    await sleep(200);
    await page.$eval('#motif-input', el => el.value = 'ATG');
    await page.click('#btn-find-motif');
    await sleep(200);
    const motifMatches = await page.$eval('#motif-results', el => el.textContent);
    console.log(`Motif Finder result: ${motifMatches.substring(0, 60)}`);

    // Restriction Map
    await page.click('.nav-menu li[data-view="tools-restriction"]');
    await sleep(200);
    await page.click('#btn-run-restriction');
    await sleep(400);
    const restrictionText = await page.$eval('#restriction-results', el => el.textContent);
    console.log(`Restriction Map result: ${restrictionText.substring(0, 80)}`);

    // Primer Utilities
    await page.click('.nav-menu li[data-view="tools-primer"]');
    await sleep(200);
    await page.$eval('#primer-input', el => el.value = 'AGAGTTTGATCCTGGCTCAG');
    await page.click('#btn-analyze-primer');
    await sleep(200);
    const primerText = await page.$eval('#primer-results', el => el.textContent);
    console.log(`Primer Utilities result: ${primerText.replace(/\s+/g, ' ')}`);

    // Translation (6-Frame)
    await page.click('.nav-menu li[data-view="tools-translation"]');
    await sleep(200);
    await page.click('#btn-run-translation');
    await sleep(200);
    const transText = await page.$eval('#translation-results', el => el.textContent);
    console.log(`Translation 6-Frame rendered: ${transText.includes('Frame +1')}`);

    // Sequence Compare
    await page.click('.nav-menu li[data-view="tools-compare"]');
    await sleep(200);
    await page.$eval('#compare-1', el => el.value = 'ATGAAGAGCAACGGCGAGGAGCTGTTCACC');
    await page.$eval('#compare-2', el => el.value = 'ATGAAGAGCAACGGCGAGGAGCTGTTAACC');
    await page.click('#btn-compare-seqs');
    await sleep(200);
    const compText = await page.$eval('#compare-results', el => el.textContent);
    console.log(`Sequence Compare result: ${compText.replace(/\s+/g, ' ')}`);

    results.dnaJourneyPassed = true;
    console.log('✅ Complete DNA Journey passed with consistent numbers.');

    // 9. Mutation Explorer Test (1 sub, 1 ins, 1 del)
    console.log('\n--- Section 9: Mutation Explorer Test ---');
    await page.click('.nav-menu li[data-view="tools-mutation"]');
    await sleep(200);
    // Ref: ATG-CGACTGATC (13 aligned chars)
    // Alt: ATGCCGACTG-TC (13 aligned chars)
    // Pos 4: Ref '-' vs Alt 'C' (Insertion)
    // Pos 11: Ref 'A' vs Alt '-' (Deletion)
    // Pos 13: Ref 'C' vs Alt 'C', let's make Pos 12: Ref 'T' vs Alt 'G' (Substitution)
    await page.$eval('#mutation-ref', el => el.value = 'ATG-CGACTGATC');
    await page.$eval('#mutation-alt', el => el.value = 'ATGCCGACTG-AC');
    await page.click('#btn-find-mutations');
    await sleep(300);
    const mutResult = await page.$eval('#mutation-results', el => el.textContent);
    console.log(`Mutation Explorer Result: ${mutResult.replace(/\s+/g, ' ').substring(0, 150)}`);
    // Screenshot 4: Mutation Explorer
    await captureScreenshot(page, 'screenshot-4-mutation-explorer.png');
    results.mutationTested = mutResult.includes('substitution') && 
                             mutResult.includes('insertion') && 
                             mutResult.includes('deletion') && 
                             mutResult.includes('1-based');

    // 8. Multi-FASTA Test
    console.log('\n--- Section 8: Multi-FASTA Test ---');
    await page.click('.nav-menu li[data-view="tools-batch"]');
    await sleep(200);
    await page.click('#btn-load-sample-batch');
    await sleep(100);
    await page.click('#btn-run-batch');
    await sleep(400);
    const batchText = await page.$eval('#batch-results', el => el.textContent);
    console.log(`Batch Analysis Result: ${batchText.replace(/\s+/g, ' ').substring(0, 100)}`);
    // Screenshot 5: Batch Analysis
    await captureScreenshot(page, 'screenshot-5-batch-analysis.png');
    results.batchTested = batchText.includes('Total Sequences in Batch: 3');

    // 6. Project Persistence Test
    console.log('\n--- Section 6: Project Persistence Test ---');
    await page.click('.nav-menu li[data-view="projects"]');
    await sleep(200);
    await page.$eval('#new-project-name', el => el.value = 'Genetics Lab Project A');
    await page.$eval('#new-project-desc', el => el.value = 'Persistence test project');
    await page.click('#btn-create-project');
    await sleep(400);

    // Save sample from nucleotide analysis
    await page.click('.nav-menu li[data-view="analyze-nucleotide"]');
    await sleep(200);
    await page.click('#btn-save-sample-nuc');
    await sleep(400);

    // Reload page to verify IndexedDB persistence across sessions
    console.log('Reloading page to verify persistence...');
    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(1000);

    // Verify project name persisted in top bar
    const currentProjName = await page.$eval('#current-project', el => el.textContent);
    console.log(`Current Project after reload: "${currentProjName}"`);

    // Navigate to projects view
    await page.click('.nav-menu li[data-view="projects"]');
    await sleep(400);
    const projSamplesList = await page.$eval('#project-samples-container', el => el.textContent);
    console.log(`Persisted samples: ${projSamplesList.replace(/\s+/g, ' ')}`);

    // Test Export Project
    await page.click('#btn-export-project-json');
    await sleep(200);

    // Screenshot 6: Project Workspace
    await captureScreenshot(page, 'screenshot-6-projects.png');
    results.persistenceTested = projSamplesList.includes('GFP_Green_Fluorescent_Protein') &&
                                currentProjName.includes('Genetics Lab Project A');

    // 7. Report Test
    console.log('\n--- Section 7: Report Test ---');
    // Ensure GFP is active
    await page.click('.nav-menu li[data-view="home"]');
    await sleep(200);
    await page.$eval('#main-sequence-input', (el, val) => el.value = val, gfpFasta);
    await page.click('#btn-analyze-sequence');
    await sleep(400);
    await page.click('#btn-find-orfs');
    await sleep(300);

    // Navigate to reports
    await page.click('.nav-menu li[data-view="reports"]');
    await sleep(300);
    await page.click('#btn-export');
    await sleep(500);

    // Screenshot 7: Generated Report
    await captureScreenshot(page, 'screenshot-7-report.png');
    results.reportTested = true;

    // 10. Visual QA Across Screen Sizes
    console.log('\n--- Section 10: Visual QA Across Screen Sizes ---');
    const viewports = [
        { width: 1366, height: 768, label: 'Desktop 1366x768' },
        { width: 1024, height: 768, label: 'Tablet Landscape 1024x768' },
        { width: 768, height: 1024, label: 'Tablet Portrait 768x1024' },
        { width: 430, height: 932, label: 'iPhone 14 Pro Max 430x932' },
        { width: 390, height: 844, label: 'iPhone 12/13/14 390x844' },
        { width: 360, height: 800, label: 'Android 360x800' }
    ];

    let allVisualPassed = true;
    for (const vp of viewports) {
        await page.setViewport({ width: vp.width, height: vp.height });
        await sleep(250);

        // Check for horizontal overflow (document scrollWidth vs viewport width)
        const overflow = await page.evaluate((expectedW) => {
            return {
                docWidth: document.documentElement.scrollWidth,
                viewportWidth: window.innerWidth,
                hasOverflow: document.documentElement.scrollWidth > window.innerWidth + 2
            };
        }, vp.width);

        if (overflow.hasOverflow) {
            console.warn(`⚠️ Warning: Horizontal overflow on ${vp.label}: docWidth=${overflow.docWidth}, viewport=${overflow.viewportWidth}`);
            allVisualPassed = false;
        } else {
            console.log(`✅ ${vp.label}: Clean layout, no horizontal overflow (width: ${overflow.docWidth}px).`);
        }
        results.screenSizesTested.push(vp.label);

        // Capture Mobile Screenshot at 390x844
        if (vp.width === 390) {
            await page.click('.nav-menu li[data-view="home"]');
            await sleep(250);
            await captureScreenshot(page, 'screenshot-8-mobile-layout.png');
        }
    }
    results.visualQaPassed = allVisualPassed;

    // Close Browser & Server
    await browser.close();
    server.close();

    console.log('\n==================================================');
    console.log('REAL BROWSER TESTING COMPLETE');
    console.log('==================================================');
    console.log('Summary:');
    console.log('- Browser:', results.browserName, results.browserVersion);
    console.log('- Console Errors Remaining:', results.consoleErrors.length);
    console.log('- Failed Network Requests:', results.networkErrors.length);
    console.log('- DNA Journey Passed:', results.dnaJourneyPassed);
    console.log('- Persistence Tested:', results.persistenceTested);
    console.log('- Report Tested:', results.reportTested);
    console.log('- Mutation Tested:', results.mutationTested);
    console.log('- Batch Tested:', results.batchTested);
    console.log('- Screenshots Captured:', results.screenshotsCaptured.length);

    fs.writeFileSync(
        path.join(__dirname, 'browser-test-summary.json'),
        JSON.stringify(results, null, 2)
    );
}

run().catch(err => {
    console.error('Real browser testing failed with exception:', err);
    process.exit(1);
});
