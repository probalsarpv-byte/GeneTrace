// report.js - Scientific Sequence Analysis Report Generator
import { APP_RELEASE } from '../version.js';
export const GENETRACE_VERSION = APP_RELEASE;

export function generateReport(sequenceObj, validation, stats, orfs = []) {
    const timestamp = new Date().toISOString();
    const formattedDate = new Date().toLocaleString();
    
    let statsSection = '';
    if (stats) {
        if (validation.type === 'DNA' || validation.type === 'RNA') {
            statsSection = `
                <tr><th>Sequence Length</th><td>${stats.length.toLocaleString()} bp</td></tr>
                <tr><th>GC Content</th><td><strong>${stats.gcPercentage.toFixed(2)}%</strong></td></tr>
                <tr><th>AT Content</th><td>${stats.atPercentage.toFixed(2)}%</td></tr>
                <tr><th>A / T / G / C Counts</th><td>A: ${stats.counts.A} | T/U: ${stats.counts.T || stats.counts.U || 0} | G: ${stats.counts.G} | C: ${stats.counts.C}</td></tr>
                <tr><th>Molecular Weight (ssDNA est.)</th><td>${(stats.mwEstimateDa / 1000).toFixed(2)} kDa</td></tr>
            `;
        } else if (validation.type === 'Protein') {
            statsSection = `
                <tr><th>Protein Length</th><td>${stats.length.toLocaleString()} aa</td></tr>
                <tr><th>Hydrophobic Fraction</th><td><strong>${(stats.hydrophobicFraction * 100).toFixed(2)}%</strong></td></tr>
                <tr><th>Estimated MW</th><td>${(stats.mwEstimateDa / 1000).toFixed(2)} kDa</td></tr>
            `;
        }
    }

    let orfSection = '';
    if (orfs && orfs.length > 0) {
        orfSection = `
            <div class="report-section">
                <h3>Open Reading Frames (ORFs Detected: ${orfs.length})</h3>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>ORF ID</th>
                            <th>Strand</th>
                            <th>Frame</th>
                            <th>Start - End (1-based)</th>
                            <th>Length (aa)</th>
                            <th>First 10 AA</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${orfs.slice(0, 10).map(o => `
                            <tr>
                                <td>${o.id}</td>
                                <td>${o.strand}</td>
                                <td>${o.frame > 0 ? '+' + o.frame : o.frame}</td>
                                <td>${o.start} - ${o.end}</td>
                                <td>${o.lengthAa}</td>
                                <td style="font-family: monospace;">${o.translation.substring(0, 10)}...</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${orfs.length > 10 ? `<p style="font-size:0.85rem; color:#64748b;">Showing top 10 of ${orfs.length} detected ORFs.</p>` : ''}
            </div>
        `;
    } else {
        orfSection = `
            <div class="report-section">
                <h3>Open Reading Frames</h3>
                <p>No open reading frames exceeding the threshold (min 50 aa) were detected, or sequence is non-coding.</p>
            </div>
        `;
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>GeneTrace Analysis Report — ${sequenceObj.name || 'Sample'}</title>
    <style>
        :root {
            --primary: #2563eb;
            --text-dark: #0f172a;
            --text-muted: #64748b;
            --bg-card: #f8fafc;
            --border: #e2e8f0;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: var(--text-dark);
            max-width: 900px;
            margin: 0 auto;
            padding: 2rem 1.5rem;
            background: #ffffff;
        }
        .header {
            border-bottom: 3px solid var(--primary);
            padding-bottom: 1rem;
            margin-bottom: 2rem;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }
        .header h1 {
            margin: 0 0 0.5rem 0;
            font-size: 1.8rem;
            color: #1e3a8a;
        }
        .header .meta {
            font-size: 0.9rem;
            color: var(--text-muted);
        }
        .badge {
            display: inline-block;
            background: #dbeafe;
            color: #1e40af;
            font-weight: 600;
            padding: 0.2rem 0.6rem;
            border-radius: 4px;
            font-size: 0.8rem;
        }
        .report-section {
            margin-bottom: 2rem;
        }
        .report-section h3 {
            font-size: 1.2rem;
            color: #1e293b;
            border-bottom: 1px solid var(--border);
            padding-bottom: 0.4rem;
            margin-bottom: 1rem;
        }
        .report-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.95rem;
            margin-bottom: 1rem;
        }
        .report-table th, .report-table td {
            text-align: left;
            padding: 0.6rem 0.8rem;
            border: 1px solid var(--border);
        }
        .report-table th {
            background: var(--bg-card);
            font-weight: 600;
        }
        .params-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
            background: var(--bg-card);
            padding: 1rem;
            border-radius: 6px;
            border: 1px solid var(--border);
            font-size: 0.9rem;
        }
        .disclaimer-box {
            background: #fffbeb;
            border-left: 4px solid #f59e0b;
            padding: 1rem;
            border-radius: 4px;
            font-size: 0.85rem;
            color: #92400e;
            margin-top: 2rem;
        }
        .no-print {
            margin-bottom: 1.5rem;
            display: flex;
            gap: 1rem;
        }
        .btn-action {
            background: var(--primary);
            color: white;
            border: none;
            padding: 0.5rem 1.2rem;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
        }
        @media print {
            .no-print { display: none !important; }
            body { padding: 0; max-width: 100%; }
        }
    </style>
</head>
<body>
    <div class="no-print">
        <button class="btn-action" onclick="window.print()">🖨️ Print / Save as PDF</button>
    </div>

    <div class="header">
        <div>
            <h1>🧬 GeneTrace Sequence Analysis Report</h1>
            <div class="meta">
                Generated: ${formattedDate} | GeneTrace Workbench <span class="badge">${GENETRACE_VERSION}</span>
            </div>
        </div>
        <div style="text-align: right;">
            <span class="badge">${validation.type} SEQUENCE</span>
        </div>
    </div>

    <div class="report-section">
        <h3>Sample Overview</h3>
        <table class="report-table">
            <tr><th style="width:30%">Sample Identifier</th><td><strong>${escapeHtml(sequenceObj.name || 'Unnamed')}</strong></td></tr>
            <tr><th>Validation Integrity</th><td><span style="color:#16a34a; font-weight:600;">${validation.label}</span> (${validation.warnings.length > 0 ? validation.warnings.join(', ') : 'Zero invalid characters'})</td></tr>
            <tr><th>Analysis Engine</th><td>GeneTrace Client-Side Bioinformatics Engine (${GENETRACE_VERSION})</td></tr>
        </table>
    </div>

    <div class="report-section">
        <h3>Sequence Properties & Composition</h3>
        <table class="report-table">
            <tbody>
                ${statsSection}
            </tbody>
        </table>
    </div>

    ${orfSection}

    <div class="report-section">
        <h3>Analysis Parameters</h3>
        <div class="params-grid">
            <div><strong>Genetic Code:</strong> Standard (NCBI Code Table 1)</div>
            <div><strong>Minimum ORF Threshold:</strong> 50 amino acids</div>
            <div><strong>Window Size for GC Profile:</strong> 50 bp (Step: 10 bp)</div>
            <div><strong>Coordinates:</strong> 1-based biological numbering</div>
        </div>
    </div>

    <div class="report-section">
        <h3>Identification & Taxonomy Notes</h3>
        <p style="font-size:0.95rem; color:#475569;">
            This client-side report presents calculated deterministic sequence metrics. Molecular identification against public databases (e.g. NCBI BLAST, BOLD Systems, UNITE) can be launched directly via the NCBI BLAST export utility. No simulated or mock taxonomic classifications have been inserted.
        </p>
    </div>

    <div class="disclaimer-box">
        <strong>Scientific Limitations & Disclaimer:</strong>
        This analysis was performed client-side using GeneTrace ${GENETRACE_VERSION}. Algorithms are optimized for research, education, and preliminary screening. This output is not certified for clinical diagnosis, medical treatment, or regulatory filings without independent molecular confirmation.
    </div>
</body>
</html>`;

    return html;
}

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function exportHtml(htmlString, filename = 'genetrace-report.html') {
    const blob = new Blob([htmlString], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
