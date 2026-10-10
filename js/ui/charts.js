// charts.js
// Minimal Vanilla JS charting using HTML/CSS for zero dependencies

export function renderGCProfileChart(containerId, profileData) {
    const container = document.getElementById(containerId);
    if (!container || !profileData || profileData.length === 0) return;

    let maxGC = 0;
    profileData.forEach(d => { if (d.gc > maxGC) maxGC = d.gc; });

    let barsHtml = '';
    profileData.forEach(d => {
        const heightPercent = maxGC > 0 ? (d.gc / 100) * 100 : 0;
        // Color gradient based on GC content
        const hue = 200 - (d.gc * 1.5); // High GC = lower hue (more red/yellow), low GC = higher hue (blue)
        const color = `hsl(${Math.max(0, hue)}, 70%, 50%)`;
        
        barsHtml += `
            <div class="bar-wrapper" style="flex: 1; display: flex; align-items: flex-end; position: relative; height: 100%; min-width: 2px; margin: 0 1px;" title="Pos: ${d.position}, GC: ${d.gc.toFixed(1)}%">
                <div class="bar" style="height: ${heightPercent}%; width: 100%; background-color: ${color}; border-radius: 2px 2px 0 0;"></div>
            </div>
        `;
    });

    const html = `
        <div class="chart-container" style="height: 150px; width: 100%; display: flex; flex-direction: column; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1rem; background: var(--bg-secondary);">
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem; display: flex; justify-content: space-between;">
                <span>0% GC</span>
                <span>GC Content Profile (Sliding Window)</span>
                <span>100% GC</span>
            </div>
            <div class="bars-container" style="display: flex; align-items: flex-end; flex: 1; border-bottom: 1px solid var(--border-color); height: 100%;">
                ${barsHtml}
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem; display: flex; justify-content: space-between;">
                <span>Start</span>
                <span>Position</span>
                <span>End</span>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

export function renderCompositionDonut(containerId, counts) {
    // A simple text/progress representation if a true donut is too complex in vanilla HTML without SVG
    const container = document.getElementById(containerId);
    if (!container || !counts) return;

    let total = 0;
    for (const k in counts) { total += counts[k]; }
    
    if (total === 0) return;

    let html = `<div style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.9rem;">`;
    
    for (const [base, count] of Object.entries(counts)) {
        if (count === 0 && base !== 'Other') continue;
        const pct = ((count / total) * 100).toFixed(1);
        
        let color = '#94a3b8'; // default
        if (base === 'A') color = '#ef4444';
        if (base === 'T' || base === 'U') color = '#3b82f6';
        if (base === 'G') color = '#10b981';
        if (base === 'C') color = '#f59e0b';

        html += `
            <div style="display: flex; align-items: center; gap: 1rem;">
                <div style="width: 20px; font-weight: bold; color: ${color};">${base}</div>
                <div style="flex: 1; background: var(--bg-tertiary); height: 8px; border-radius: 4px; overflow: hidden;">
                    <div style="width: ${pct}%; height: 100%; background: ${color};"></div>
                </div>
                <div style="width: 40px; text-align: right; color: var(--text-secondary);">${pct}%</div>
            </div>
        `;
    }
    html += `</div>`;
    container.innerHTML = html;
}
