// sequence-viewer.js

export function renderSequenceViewer(containerId, sequence, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const { charsPerLine = 60, charsPerBlock = 10, type = 'DNA' } = options;

    let html = `<div class="sequence-viewer-wrapper" style="font-family: var(--font-mono); font-size: 14px; background: var(--bg-tertiary); padding: 1rem; border-radius: var(--radius-md); overflow-x: auto; white-space: pre-wrap; line-height: 1.6;">`;
    
    for (let i = 0; i < sequence.length; i += charsPerLine) {
        const lineStr = sequence.substring(i, Math.min(i + charsPerLine, sequence.length));
        const lineNum = String(i + 1).padStart(6, ' ') + '  ';
        
        let formattedLine = '';
        for (let j = 0; j < lineStr.length; j += charsPerBlock) {
            formattedLine += lineStr.substring(j, j + charsPerBlock) + ' ';
        }
        
        // Very basic coloring for specific chars
        if (type === 'DNA' || type === 'RNA') {
            formattedLine = formattedLine
                .replace(/A/g, '<span style="color: #ef4444">A</span>')
                .replace(/T/g, '<span style="color: #3b82f6">T</span>')
                .replace(/U/g, '<span style="color: #3b82f6">U</span>')
                .replace(/G/g, '<span style="color: #10b981">G</span>')
                .replace(/C/g, '<span style="color: #f59e0b">C</span>')
                .replace(/N/g, '<span style="color: #94a3b8">N</span>');
        }

        html += `<span style="color: var(--text-muted); user-select: none;">${lineNum}</span>${formattedLine}\n`;
    }

    html += `</div>`;
    container.innerHTML = html;
}
