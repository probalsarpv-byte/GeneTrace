import http from 'http';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 8085;
const BASE_URL = `http://localhost:${PORT}/`;
const ARTIFACT_DIR = 'C:\\Users\\HP\\.gemini\\antigravity\\brain\\086bc1d0-7c9f-4288-a60b-77beeceb4276';

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.jpg': 'image/jpeg',
    '.ab1': 'application/octet-stream',
    '.fastq': 'text/plain',
    '.fasta': 'text/plain',
    '.txt': 'text/plain',
    '.webmanifest': 'application/manifest+json'
};

function startServer() {
    const server = http.createServer((req, res) => {
        let reqPath = decodeURI(req.url.split('?')[0]);
        if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
        const filePath = path.join(ROOT_DIR, reqPath);

        if (!filePath.startsWith(ROOT_DIR)) {
            res.statusCode = 403;
            res.end('Forbidden');
            return;
        }

        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.statusCode = 404;
                res.end(`File not found: ${reqPath}`);
                return;
            }
            const ext = path.extname(filePath).toLowerCase();
            res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
            res.end(data);
        });
    });

    return new Promise((resolve, reject) => {
        server.listen(PORT, err => {
            if (err) reject(err);
            else resolve(server);
        });
    });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function captureScreenshot(page, filename) {
    const localPath = path.join(ROOT_DIR, 'screenshots', filename);
    await page.screenshot({ path: localPath });
    try {
        fs.copyFileSync(localPath, path.join(ARTIFACT_DIR, filename));
    } catch (e) {}
    console.log(`📸 Captured screenshot: ${filename}`);
}

async function runLocalValidation() {
    console.log('====================================================');
    console.log('GENETRACE REAL GOOGLE CHROME BROWSER VALIDATION');
    console.log('Testing Reference Search & Identification Engine');
    console.log('====================================================\n');

    let server;
    try {
        server = await startServer();
        console.log(`[HTTP Server] Listening on ${BASE_URL}`);
    } catch (e) {
        console.error('Failed to start server:', e);
        process.exit(1);
    }

    const consoleErrors = [];
    const networkErrors = [];

    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1440, height: 900 });

        page.on('dialog', async dialog => {
            console.log(`  [Dialog Alert]: "${dialog.message()}"`);
            await dialog.accept();
        });

        page.on('pageerror', err => {
            consoleErrors.push(err.message);
            console.error(`  [Browser PageError]: ${err.message}`);
        });

        page.on('console', msg => {
            console.log(`  [Browser ${msg.type()}]: ${msg.text()}`);
            if (msg.type() === 'error') {
                const text = msg.text();
                if (!text.includes('favicon') && !text.includes('ERR_NAME_NOT_RESOLVED')) {
                    consoleErrors.push(text);
                }
            }
        });

        page.on('response', resp => {
            if (resp.status() >= 400 && !resp.url().includes('favicon')) {
                networkErrors.push(`${resp.status()}: ${resp.url()}`);
                console.error(`  [Network 4xx/5xx]: ${resp.status()} ${resp.url()}`);
            }
        });

        // 1. Load Application
        console.log('\n--- Step 1: Navigating to GeneTrace Home ---');
        await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
        const appStatus = await page.evaluate(() => ({ hasGeneTrace: !!window.GeneTrace, readyState: document.readyState }));
        console.log('App Status:', appStatus);

        // 2. Identify Sequence from Home
        console.log('\n--- Step 2: Testing "IDENTIFY MY SEQUENCE" Button ---');
        await page.evaluate(() => {
            const input = document.getElementById('main-sequence-input');
            if (input) {
                input.value = `>Escherichia_coli_K12_16S NR_024570.1
AGAGTTTGATCCTGGCTCAGATTGAACGCTGGCGGCAGGCCTAACACATGCAAGTCGAACGGTAACAGGAAGAAGCTTGCTTCTTTGCTGACGAGTGGCGGACGGGTGAGTAATGTCTGGGAAACTGCCTGATGGAGGGGGATAACTACTGGAAACGGTAGCTAATACCGCATAACGTCGCAAGACCAAAGAGGGGGACCTTCGGGCCTCTTGCCATCGGATGTGCCCAGATGGGATTAGCTAGTAGGTGGGGTAACGGCTCACCTAGGCGACGATCCCTAGCTGGTCTGAGAGGATGACCAGCCACACTGGAACTGAGACACGGTCCAGACTCCTACGGGAGGCAGCAGTGGGGAATATTGCACAATGGGCGCAAGCCTGATGCAGCCATGCCGCGTGTATGAAGAAGGCCTTCGGGTTGTAAAGTACTTTCAGCGGGGAGGAAGGGAGTAAAGTTAATACCTTTGCTCATTGACGTTACCCGCAGAAGAAGCACCGGCTAACTCCGTGCCAGCAGCCGCGGTAATACGGAGGGTGCAAGCGTTAATCGGAATTACTGGGCGTAAAGCGCACGCAGGCGGTTTGTTAAGTCAGATGTGAAATCCCCGGGCTCAACCTGGGAACTGCATCTGATACTGGCAAGCTTGAGTCTCGTAGAGGGGGGTAGAATTCCAGGTGTAGCGGTGAAATGCGTAGAGATCTGGAGGAATACCGGTGGCGAAGGCGGCCCCCTGGACGAAGACTGACGCTCAGGTGCGAAAGCGTGGGGAGCAAACAGGATTAGATACCCTGGTAGTCCACGCCGTAAACGATGTCGACTTGGAGGTTGTGCCCTTGAGGCGTGGCTTCCGGAGCTAACGCGTTAAGTCGACCGCCTGGGGAGTACGGCCGCAAGGTTAAAACTCAAATGAATTGACGGGGGCCCGCACAAGCGGTGGAGCATGTGGTTTAATTCGATGCAACGCGAAGAACCTTACCTGGTCTTGACATCCACGGAAGTTTTCAGAGATGAGAATGTGCCTTCGGGAACCGTGAGACAGGTGCTGCATGGCTGTCGTCAGCTCGTGTTGTGAAATGTTGGGTTAAGTCCCGCAACGAGCGCAACCCTTATCCTTTGTTGCCAGCGGTCCGGCCGGGAACTCAAAGGAGACTGCCAGTGATAAACTGGAGGAAGGTGGGGATGACGTCAAGTCATCATGGCCCTTACGACCAGGGCTACACACGTGCTACAATGGCGCATACAAAGAGAAGCGACCTCGCGAGAGCAAGCGGACCTCATAAAGTGCGTCGTAGTCCGGATTGGAGTCTGCAACTCGACTCCATGAAGTCGGAATCGCTAGTAATCGTGGATCAGAATGCCACGGTGAATACGTTCCCGGGCCTTGTACACACCGCCCGTCACACCATGGGAGTGGGTTGCAAAAGAAGTAGGTAGCTTAACCTTCGGGAGGGCGCTTACCACTTTGTGATTCATGACTGGGGTGAAGTCGTAACAAGGTAACCGTAGGGGAACCTGCGGTTGGATCACCTCCTT`;
            }
        });
        await sleep(300);

        const diag = await page.evaluate(() => {
            const btn = document.getElementById('btn-identify-sequence');
            const act = document.querySelector('.view-section.active');
            const seqInput = document.getElementById('main-sequence-input');
            return {
                btnExists: !!btn,
                activeView: act ? act.id : 'none',
                inputValLength: seqInput ? seqInput.value.length : -1
            };
        });
        console.log('Diagnostic before click:', diag);

        // Click IDENTIFY MY SEQUENCE
        console.log('Clicking #btn-identify-sequence...');
        await page.evaluate(() => {
            const btn = document.getElementById('btn-identify-sequence');
            if (btn) btn.click();
        });
        await sleep(3000); // Allow DP alignment & reference search to execute

        const diagAfter = await page.evaluate(() => {
            const act = document.querySelector('.view-section.active');
            const hub = document.getElementById('view-analyze-identify');
            return {
                activeView: act ? act.id : 'none',
                hubClasses: hub ? hub.className : 'missing'
            };
        });
        console.log('Diagnostic after click:', diagAfter);

        // Verify Identification Hub is active
        const isHubVisible = await page.evaluate(() => {
            const el = document.getElementById('view-analyze-identify');
            return el && el.classList.contains('active');
        });
        console.log(`Identification Hub View Active: ${isHubVisible}`);
        if (!isHubVisible) throw new Error('Identification Hub view not activated!');

        // Check Candidates Table
        const candidateRows = await page.evaluate(() => {
            const rows = document.querySelectorAll('.id-candidates-table tbody tr');
            return Array.from(rows).map(r => r.innerText.trim().replace(/\s+/g, ' '));
        });
        console.log(`Found ${candidateRows.length} candidates in reference match table:`);
        candidateRows.forEach(c => console.log(`  Candidate: ${c}`));
        if (candidateRows.length === 0) throw new Error('No candidates found in reference search table!');

        // Verify Probable Identification Card
        const topOrg = await page.evaluate(() => {
            const h3 = document.querySelector('#id-probable-content h3');
            return h3 ? h3.textContent.trim() : 'Unknown';
        });
        console.log(`Top Identification: ${topOrg}`);

        // Verify Pairwise Alignment with biological coordinates
        const alignmentText = await page.evaluate(() => {
            const viewer = document.getElementById('id-alignment-viewer');
            return viewer ? viewer.textContent.trim() : '';
        });
        console.log(`Alignment Block Snippet:\n${alignmentText.substring(0, 200)}...`);
        if (!alignmentText.includes('Query') || !alignmentText.includes('Sbjct')) {
            throw new Error('Biological pairwise alignment coordinates missing or invalid!');
        }

        // Verify Taxonomic Lineage Ladder
        const lineageRanks = await page.evaluate(() => {
            const ranks = document.querySelectorAll('#id-taxonomy-container div');
            return ranks.length;
        });
        console.log(`Taxonomic Lineage elements count: ${lineageRanks}`);

        // Verify Scientific Confidence Assessment
        const confidenceLevel = await page.evaluate(() => {
            const badge = document.getElementById('id-confidence-badge');
            return badge ? badge.textContent.trim() : 'N/A';
        });
        console.log(`Scientific Confidence Level: ${confidenceLevel}`);

        await captureScreenshot(page, 'test_01_flagship_identification.png');

        // 3. Test In-App Phylogeny Placement
        console.log('\n--- Step 3: Testing "USE TOP REFERENCES FOR PHYLOGENY" ---');
        await page.click('#btn-id-build-tree');
        await sleep(1500);

        const treeRendered = await page.evaluate(() => {
            const svg = document.querySelector('#id-tree-container svg');
            const texts = Array.from(document.querySelectorAll('#id-tree-container text')).map(t => t.textContent.trim());
            const hasQueryHighlight = texts.some(t => t.includes('Query') || t.includes('⭐') || t.includes('Escherichia'));
            return { hasSvg: !!svg, texts, hasHighlight: hasQueryHighlight };
        });
        console.log(`Phylogeny Tree SVG Rendered: ${treeRendered.hasSvg}, Leaves:`, treeRendered.texts);
        if (!treeRendered.hasSvg) throw new Error('Phylogeny SVG tree failed to render in Identification Hub!');

        await captureScreenshot(page, 'test_02_phylogeny_placement.png');

        // 4. Test Raw Sequence Lab Handoff
        console.log('\n--- Step 4: Testing Raw Sequence Lab Handoff (AB1 Sanger -> Identification) ---');
        await page.evaluate(() => window.navigateTo('raw-lab'));
        await sleep(500);

        await page.click('#btn-load-demo-ab1');
        await sleep(500);

        // Click "Identify Sanger Read ➔"
        console.log('Clicking #btn-ab1-identify...');
        await page.click('#btn-ab1-identify');
        await sleep(2500);

        const ab1CandidatesCount = await page.evaluate(() => {
            return document.querySelectorAll('.id-candidates-table tbody tr').length;
        });
        console.log(`Sanger Read Identification Candidates Count: ${ab1CandidatesCount}`);
        if (ab1CandidatesCount === 0) throw new Error('Sanger trace identification yielded 0 candidates!');

        await captureScreenshot(page, 'test_03_sanger_handoff.png');

        // 5. Test Dedicated Archaea & Fungal ITS Views
        console.log('\n--- Step 5: Testing Dedicated Archaea & ITS Identification Workflows ---');
        await page.evaluate(() => window.navigateTo('id-archaea'));
        await sleep(500);
        await page.click('#btn-archaea-load-demo');
        await sleep(2500);

        const archaeaTopMatch = await page.evaluate(() => {
            const h3 = document.querySelector('#id-probable-content h3');
            return h3 ? h3.textContent.trim() : '';
        });
        console.log(`Archaea Identification Top Match: "${archaeaTopMatch}"`);

        await captureScreenshot(page, 'test_04_archaea_identification.png');

        // 6. Verify Absence of External Analysis Links
        console.log('\n--- Step 6: Verifying Zero External Analysis CTAs ---');
        const externalLinksFound = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a, button'));
            const disallowed = ['Open in NCBI BLAST', 'Open External BLAST', 'Go to InterPro', 'EzBioCloud', 'SILVA SINA', 'MycoBank'];
            return links
                .map(l => (l.innerText || '').trim())
                .filter(t => disallowed.some(d => t.toLowerCase().includes(d.toLowerCase())));
        });
        console.log(`Disallowed external links found: ${JSON.stringify(externalLinksFound)}`);
        if (externalLinksFound.length > 0) throw new Error(`Disallowed external links present: ${externalLinksFound.join(', ')}`);

        // Check console and network errors
        console.log('\n--- Summary of Errors ---');
        console.log(`Console Errors: ${consoleErrors.length}`);
        console.log(`Network Errors: ${networkErrors.length}`);

        if (consoleErrors.length > 0) {
            console.error('Console errors detected:', consoleErrors);
        }
        if (networkErrors.length > 0) {
            console.error('Network errors detected:', networkErrors);
        }

        const success = consoleErrors.length === 0 && networkErrors.length === 0;
        console.log(`\n====================================================`);
        console.log(`LOCAL BROWSER VALIDATION RESULT: ${success ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`====================================================\n`);

        if (!success) {
            process.exit(1);
        }
    } finally {
        await browser.close();
        if (server) {
            server.close();
            console.log('[HTTP Server] Stopped.');
        }
    }
}

runLocalValidation().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
});
