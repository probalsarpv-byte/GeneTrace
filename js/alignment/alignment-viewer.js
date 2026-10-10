// alignment-viewer.js

export function renderAlignment(containerId, querySeq, referenceSeq) {
    const container = document.getElementById(containerId);
    if (!container || !querySeq || !referenceSeq) return;

    let matchLine = '';
    const length = Math.min(querySeq.length, referenceSeq.length);
    let matchCount = 0;

    for (let i = 0; i < length; i++) {
        if (querySeq[i] === referenceSeq[i]) {
            matchLine += '|';
            matchCount++;
        } else if (querySeq[i] === '-' || referenceSeq[i] === '-') {
            matchLine += ' ';
        } else {
            matchLine += '*'; // Mismatch
        }
    }

    const identity = ((matchCount / length) * 100).toFixed(1);

    const html = `
        <div class="card" style="font-family: var(--font-mono); font-size: 14px; overflow-x: auto; white-space: pre; background: var(--bg-tertiary);">
            <div style="margin-bottom: 1rem; color: var(--text-secondary); font-family: var(--font-sans);">
                <strong>Identity:</strong> ${identity}% (${matchCount} / ${length})
            </div>
            <div style="color: var(--accent-primary);">Query: ${querySeq}</div>
            <div style="color: var(--text-muted);">       ${matchLine}</div>
            <div style="color: var(--success);">Ref:   ${referenceSeq}</div>
        </div>
    `;

    container.innerHTML = html;
}
