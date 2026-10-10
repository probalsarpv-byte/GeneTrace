// blast.js - External NCBI BLAST Submission with Graceful Production Error Handling

export function generateBlastLink(sequence, program = 'blastn') {
    const encodedSeq = encodeURIComponent(sequence);
    const baseUrl = 'https://blast.ncbi.nlm.nih.gov/Blast.cgi';
    return `${baseUrl}?CMD=Web&PAGE_TYPE=BlastSearch&PROGRAM=${program}&QUERY=${encodedSeq}`;
}

export function createBlastForm(containerId, sequence, program = 'blastn') {
    const container = document.getElementById(containerId);
    if (!container) return null;

    try {
        const formId = `ncbi-blast-form-${Date.now()}`;
        const formHtml = `
            <div class="blast-status-card" style="margin-top:1rem; padding:1rem; background:var(--bg-tertiary); border-radius:var(--radius-md); border-left:4px solid var(--accent-primary);">
                <p style="margin:0 0 0.5rem 0; font-size:0.9rem;">
                    <strong>External Service Submission:</strong> Preparing to submit sequence (${sequence.length} bases) to NCBI ${program.toUpperCase()} in a secure new tab.
                </p>
                <form id="${formId}" action="https://blast.ncbi.nlm.nih.gov/Blast.cgi" method="POST" target="_blank" style="display:inline;">
                    <input type="hidden" name="CMD" value="Web">
                    <input type="hidden" name="PAGE_TYPE" value="BlastSearch">
                    <input type="hidden" name="PROGRAM" value="${program}">
                    <input type="hidden" name="QUERY" value="${sequence}">
                    <button type="submit" class="primary small" style="margin-top:0.25rem;">Open NCBI BLAST ↗</button>
                </form>
                <span style="font-size:0.8rem; color:var(--text-muted); margin-left:0.5rem;">
                    (If popup is blocked, your local sequence analysis remains fully intact.)
                </span>
            </div>
        `;

        container.innerHTML = formHtml;
        
        return () => {
            try {
                const form = document.getElementById(formId);
                if (form) form.submit();
            } catch (err) {
                console.warn('NCBI BLAST submission notice:', err);
                container.innerHTML = `
                    <div style="background:#fef2f2; border-left:4px solid #ef4444; padding:0.75rem; border-radius:4px; font-size:0.85rem; color:#991b1b; margin-top:1rem;">
                        <strong>NCBI BLAST Notice:</strong> Unable to auto-submit to external server. Your local sequence analysis is still available.
                    </div>
                `;
            }
        };
    } catch (e) {
        console.warn('External submission error:', e);
        container.innerHTML = `
            <div style="background:#fef2f2; border-left:4px solid #ef4444; padding:0.75rem; border-radius:4px; font-size:0.85rem; color:#991b1b; margin-top:1rem;">
                <strong>NCBI BLAST is currently unavailable.</strong> Your local sequence analysis is still available.
            </div>
        `;
        return null;
    }
}
