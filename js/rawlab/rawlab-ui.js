import { parseAB1 } from './ab1-parser.js';
import { createChromatogramViewer } from './chromatogram-viewer.js';
import { analyzeAB1Quality } from './ab1-qc.js';
import { parseFastqAsync } from './fastq-parser.js';
import { calculateFastqQC } from './fastq-qc.js';
import { filterReads, exportFilteredFastq, exportFilteredFasta } from './fastq-filter.js';
import { convertAb1ToFasta, convertFastqToFasta } from './format-converter.js';

export class RawLabUI {
  constructor() {
    this.state = {
      currentAB1: null,
      currentFASTQ: null,
      chromatogramViewer: null,
      trimStart: 0,
      trimEnd: 0
    };
  }

  initAB1Tab() {
    const input = document.getElementById('ab1-file-input');
    if (!input) return;
    
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          this.state.currentAB1 = parseAB1(evt.target.result);
          this.renderAB1Viewer();
        } catch (err) {
          alert('Error parsing AB1: ' + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  renderAB1Viewer() {
    const qc = analyzeAB1Quality(this.state.currentAB1);
    this.renderQCPanel(qc);
    
    this.state.chromatogramViewer = createChromatogramViewer('chromatogram-container', this.state.currentAB1);
    this.state.chromatogramViewer.setTrimBoundaries(qc.suggestedTrimStart, qc.suggestedTrimEnd);
    
    const autoTrimBtn = document.getElementById('ab1-auto-trim');
    if (autoTrimBtn) {
      autoTrimBtn.onclick = () => {
        this.state.chromatogramViewer.setTrimBoundaries(qc.suggestedTrimStart, qc.suggestedTrimEnd);
      };
    }
    
    const analyzeBtn = document.getElementById('ab1-send-analysis');
    if (analyzeBtn) {
      analyzeBtn.onclick = () => {
        const bounds = this.state.chromatogramViewer.getTrimBoundaries();
        const fasta = convertAb1ToFasta(this.state.currentAB1, bounds.start, bounds.end, 'Sequence_1');
        window.geneTraceState = window.geneTraceState || {};
        window.geneTraceState.pendingSequence = fasta;
        // Navigation logic would go here
        alert('Sequence sent to analysis!');
      };
    }
  }

  renderQCPanel(qcReport) {
    const panel = document.getElementById('ab1-qc-panel');
    if (!panel) return;
    panel.innerHTML = `
      <h3>Quality Report</h3>
      <p>Length: ${qcReport.sequenceLength} bp</p>
      <p>Mean Quality (Phred): ${qcReport.meanQuality.toFixed(2)}</p>
      <p>Status: ${qcReport.interpretation}</p>
    `;
  }

  initFASTQTab() {
    const input = document.getElementById('fastq-file-input');
    if (!input) return;
    
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      try {
        const reads = await parseFastqAsync(file, (pct) => {
          console.log(`Parsing: ${pct}%`);
        });
        this.state.currentFASTQ = reads;
        const qc = calculateFastqQC(reads);
        this.renderFASTQQCCharts(qc);
      } catch (err) {
        alert('Error parsing FASTQ: ' + err.message);
      }
    });

    const filterBtn = document.getElementById('fastq-filter-btn');
    if (filterBtn) {
      filterBtn.onclick = () => {
        if (!this.state.currentFASTQ) return;
        const result = filterReads(this.state.currentFASTQ, {
          minMeanQuality: 20,
          minLength: 50
        });
        alert(`Retained ${result.stats.percentRetained.toFixed(2)}% of reads.`);
        this.state.currentFASTQ = result.retained;
        this.renderFASTQQCCharts(calculateFastqQC(result.retained));
      };
    }
    
    const exportBtn = document.getElementById('fastq-export-fasta');
    if (exportBtn) {
      exportBtn.onclick = () => {
        if (!this.state.currentFASTQ) return;
        const fasta = exportFilteredFasta(this.state.currentFASTQ);
        console.log("Exported FASTA length: ", fasta.length);
        alert('FASTA Exported (Check console)');
      };
    }
  }

  renderFASTQQCCharts(qcData) {
    const container = document.getElementById('fastq-qc-charts');
    if (!container) return;
    if (!qcData) {
      container.innerHTML = `<p style="color:var(--text-muted); padding:2rem; text-align:center;">No valid FASTQ reads available.</p>`;
      return;
    }
    container.innerHTML = `
      <div class="card" style="margin:0; background:var(--bg-secondary);">
        <h4>FASTQ Quality Metrics Overview</h4>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:1rem; margin-top:1rem;">
          <div style="background:var(--bg-primary); padding:0.75rem; border-radius:var(--radius-md); border:1px solid var(--border-color);">
            <div style="font-size:0.8rem; color:var(--text-muted);">Total Reads</div>
            <strong style="font-size:1.2rem;">${qcData.totalReads}</strong>
          </div>
          <div style="background:var(--bg-primary); padding:0.75rem; border-radius:var(--radius-md); border:1px solid var(--border-color);">
            <div style="font-size:0.8rem; color:var(--text-muted);">Mean Length</div>
            <strong style="font-size:1.2rem;">${qcData.meanReadLength.toFixed(1)} bp</strong>
          </div>
          <div style="background:var(--bg-primary); padding:0.75rem; border-radius:var(--radius-md); border:1px solid var(--border-color);">
            <div style="font-size:0.8rem; color:var(--text-muted);">Mean Quality (Q)</div>
            <strong style="font-size:1.2rem; color:${qcData.meanQuality >= 30 ? 'var(--success)' : 'var(--warning)'};">${qcData.meanQuality.toFixed(1)}</strong>
          </div>
          <div style="background:var(--bg-primary); padding:0.75rem; border-radius:var(--radius-md); border:1px solid var(--border-color);">
            <div style="font-size:0.8rem; color:var(--text-muted);">GC Content</div>
            <strong style="font-size:1.2rem;">${qcData.gcPercent.toFixed(1)}%</strong>
          </div>
        </div>
      </div>
    `;
  }

  initConverterTab() {
    // Basic converter UI logic
  }
}
