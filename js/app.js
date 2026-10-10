// app.js - Main GeneTrace Application Controller
import { initRouter, navigateTo } from './router.js';
import { parseFasta } from './core/fasta-parser.js';
import { validateSequence } from './core/sequence-validator.js';
import { calculateNucleotideStats, calculateProteinStats } from './core/sequence-stats.js';
import { detectSequenceType } from './core/sequence-type.js';
import { reverseComplement } from './nucleotide/reverse-complement.js';
import { translateSequence } from './nucleotide/translation.js';
import { findORFs } from './nucleotide/orf.js';
import { calculateSlidingGC } from './nucleotide/gc-profile.js';
import { findMotifs } from './nucleotide/motif.js';
import { compareAlignedSequences } from './nucleotide/mutation.js';
import { analyzePrimer } from './nucleotide/primer.js';
import { findRestrictionSites } from './nucleotide/restriction.js';
import { calculateIdentity } from './alignment/identity.js';
import { renderAlignment } from './alignment/alignment-viewer.js';
import { parseNewick } from './phylogeny/newick.js';
import { renderSVGTree } from './phylogeny/tree-viewer.js';
import { processBatch } from './identification/batch.js';
import { generateReport, exportHtml, GENETRACE_VERSION } from './reports/report.js';
import { renderSequenceViewer } from './ui/sequence-viewer.js';
import { renderCompositionDonut, renderGCProfileChart } from './ui/charts.js';
import { APP_VERSION, APP_RELEASE, APP_TAGLINE, APP_DISCLAIMER } from './version.js';
import { 
    createProject, 
    getAllProjects, 
    getProject, 
    deleteProject, 
    saveSample, 
    getSamples, 
    deleteSample, 
    exportProject, 
    importProject 
} from './storage/projects.js';

class GeneTraceApp {
    constructor() {
        this.theme = localStorage.getItem('genetrace_theme') || 'light';
        this.mode = localStorage.getItem('genetrace_mode') || 'research';
        this.minOrfLen = parseInt(localStorage.getItem('genetrace_min_orf') || '50', 10);
        
        this.currentSequence = null;
        this.currentValidation = null;
        this.currentStats = null;
        this.currentOrfs = [];
        this.activeProject = null;
        this.batchResults = [];

        this.initUI();
        this.bindEvents();
        this.initDefaultProject();
        this.registerServiceWorker();
        initRouter();
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('sw.js').then(reg => {
                    console.log('ServiceWorker registered with scope:', reg.scope);

                    reg.addEventListener('updatefound', () => {
                        const newWorker = reg.installing;
                        if (!newWorker) return;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                this.showUpdateBanner(newWorker);
                            }
                        });
                    });
                }).catch(err => {
                    console.warn('ServiceWorker registration optional notice:', err);
                });
            });
        }
    }

    showUpdateBanner(worker) {
        if (document.getElementById('update-notification-banner')) return;
        const banner = document.createElement('div');
        banner.id = 'update-notification-banner';
        banner.style.cssText = 'position:fixed; bottom:20px; right:20px; background:#1e293b; color:#ffffff; padding:0.75rem 1.25rem; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.3); z-index:9999; display:flex; align-items:center; gap:1rem; font-size:0.875rem; border-left:4px solid #2563eb;';
        banner.innerHTML = `
            <span>🧬 GeneTrace update available.</span>
            <button id="btn-sw-reload" style="background:#2563eb; color:#ffffff; border:none; padding:0.35rem 0.75rem; border-radius:4px; cursor:pointer; font-size:0.8rem; font-weight:600;">Reload</button>
            <button id="btn-sw-dismiss" style="background:transparent; color:#94a3b8; border:none; cursor:pointer; font-size:1rem;">✕</button>
        `;
        document.body.appendChild(banner);

        document.getElementById('btn-sw-reload').addEventListener('click', () => {
            worker.postMessage({ action: 'SKIP_WAITING' });
            window.location.reload();
        });

        document.getElementById('btn-sw-dismiss').addEventListener('click', () => {
            banner.remove();
        });
    }

    initUI() {
        this.applyTheme(this.theme);
        this.applyMode(this.mode);
        const orfInput = document.getElementById('setting-min-orf');
        if (orfInput) orfInput.value = this.minOrfLen;
    }

    async initDefaultProject() {
        try {
            const projects = await getAllProjects();
            const savedProjId = localStorage.getItem('genetrace_active_project_id');
            let matched = null;
            if (savedProjId) {
                matched = projects.find(p => p.id === savedProjId);
            }
            if (matched) {
                this.activeProject = matched;
            } else if (projects.length > 0) {
                this.activeProject = projects[projects.length - 1];
            } else {
                this.activeProject = await createProject('Default Workspace', 'Standard analysis workspace');
            }
            localStorage.setItem('genetrace_active_project_id', this.activeProject.id);
            this.updateProjectHeader();
            this.loadProjectsList();
            this.loadProjectSamples();
        } catch (e) {
            console.error('Failed to initialize projects:', e);
            this.activeProject = { id: 'default', name: 'Default Workspace' };
            this.updateProjectHeader();
        }
    }

    updateProjectHeader() {
        const el = document.getElementById('current-project');
        if (el && this.activeProject) {
            el.textContent = this.activeProject.name;
        }
    }

    updateSampleHeader(name) {
        const el = document.getElementById('current-sample');
        if (el) {
            el.textContent = name || 'No Sample';
        }
    }

    bindEvents() {
        // Theme & Mode toggles
        const themeToggle = document.getElementById('btn-theme-toggle');
        if (themeToggle) themeToggle.addEventListener('click', () => this.toggleTheme());

        const modeStudent = document.getElementById('btn-mode-student');
        const modeResearch = document.getElementById('btn-mode-research');
        if (modeStudent && modeResearch) {
            modeStudent.addEventListener('click', () => this.applyMode('student'));
            modeResearch.addEventListener('click', () => this.applyMode('research'));
        }

        // Top bar buttons
        const topProject = document.getElementById('current-project');
        if (topProject) {
            topProject.addEventListener('click', () => navigateTo('projects'));
        }

        const btnExport = document.getElementById('btn-export');
        if (btnExport) {
            btnExport.addEventListener('click', () => {
                this.renderLiveReport();
                navigateTo('reports');
            });
        }

        const btnSettings = document.getElementById('btn-settings');
        if (btnSettings) {
            btnSettings.addEventListener('click', () => navigateTo('settings'));
        }

        // Home tabs (Paste, Upload, Example)
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                tabButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const targetTab = btn.getAttribute('data-tab');
                document.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');
                const pane = document.getElementById(`tab-content-${targetTab}`);
                if (pane) pane.style.display = 'block';
            });
        });

        // File upload input
        const fileInput = document.getElementById('file-sequence-input');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                    const text = event.target.result;
                    const mainInput = document.getElementById('main-sequence-input');
                    if (mainInput) mainInput.value = text;
                    // Switch back to paste tab to view
                    tabButtons[0].click();
                };
                reader.readAsText(file);
            });
        }

        // Example sequence buttons
        document.querySelectorAll('.btn-example-seq').forEach(btn => {
            btn.addEventListener('click', () => {
                const exType = btn.getAttribute('data-example');
                this.loadExampleSequence(exType);
                tabButtons[0].click();
            });
        });

        // Home Analyze & Identify buttons
        const btnAnalyze = document.getElementById('btn-analyze-sequence');
        if (btnAnalyze) {
            btnAnalyze.addEventListener('click', () => this.handleSequenceInput());
        }

        const btnIdentify = document.getElementById('btn-identify-sequence');
        if (btnIdentify) {
            btnIdentify.addEventListener('click', () => this.handleIdentifySequence());
        }

        // Nucleotide buttons
        const btnFindOrfs = document.getElementById('btn-find-orfs');
        if (btnFindOrfs) {
            btnFindOrfs.addEventListener('click', () => this.handleFindORFs());
        }

        const btnRevComp = document.getElementById('btn-reverse-complement');
        if (btnRevComp) {
            btnRevComp.addEventListener('click', () => {
                if (!this.currentSequence) return alert('Please load a sequence first.');
                const rc = reverseComplement(this.currentSequence.sequence);
                alert(`Reverse Complement (${rc.length} bp):\n\n5' - ${rc.substring(0, 100)}${rc.length > 100 ? '...' : ''} - 3'`);
            });
        }

        const btnJumpTrans = document.getElementById('btn-jump-translation');
        if (btnJumpTrans) {
            btnJumpTrans.addEventListener('click', () => {
                navigateTo('tools-translation');
                this.handleSixFrameTranslation();
            });
        }

        const btnJumpRest = document.getElementById('btn-jump-restriction');
        if (btnJumpRest) {
            btnJumpRest.addEventListener('click', () => {
                navigateTo('tools-restriction');
                this.handleRestrictionMap();
            });
        }

        const btnSaveNuc = document.getElementById('btn-save-sample-nuc');
        if (btnSaveNuc) {
            btnSaveNuc.addEventListener('click', () => this.handleSaveCurrentSample());
        }

        const btnSaveProt = document.getElementById('btn-save-sample-prot');
        if (btnSaveProt) {
            btnSaveProt.addEventListener('click', () => this.handleSaveCurrentSample());
        }

        // NCBI BLAST buttons
        const btnNucBlast = document.getElementById('btn-nuc-blast');
        if (btnNucBlast) {
            btnNucBlast.addEventListener('click', async () => {
                if (!this.currentSequence) return;
                const { createBlastForm } = await import('./external/blast.js');
                const submit = createBlastForm('ncbi-blast-form-container-nuc', this.currentSequence.sequence, 'blastn');
                if (submit) submit();
            });
        }

        const btnProtBlast = document.getElementById('btn-prot-blast');
        if (btnProtBlast) {
            btnProtBlast.addEventListener('click', async () => {
                if (!this.currentSequence) return;
                const { createBlastForm } = await import('./external/blast.js');
                const submit = createBlastForm('ncbi-blast-form-container-prot', this.currentSequence.sequence, 'blastp');
                if (submit) submit();
            });
        }

        // Tools: Motif Finder
        const btnMotif = document.getElementById('btn-find-motif');
        if (btnMotif) {
            btnMotif.addEventListener('click', () => this.handleFindMotif());
        }

        const btnMotifUseCurrent = document.getElementById('btn-motif-use-current');
        if (btnMotifUseCurrent) {
            btnMotifUseCurrent.addEventListener('click', () => {
                if (!this.currentSequence) return alert('No sequence is currently loaded.');
                alert(`Using active sequence: ${this.currentSequence.name} (${this.currentSequence.sequence.length} bp)`);
            });
        }

        // Tools: Mutation Explorer
        const btnMutation = document.getElementById('btn-find-mutations');
        if (btnMutation) {
            btnMutation.addEventListener('click', () => this.handleFindMutations());
        }

        const btnLoadMutEx = document.getElementById('btn-load-mutation-example');
        if (btnLoadMutEx) {
            btnLoadMutEx.addEventListener('click', () => {
                // Known biological sequences with 1 substitution, 1 insertion, 1 deletion
                // Ref: ATG-CGATCGATC (12 bases)
                // Alt: ATGCCGATC-ATC (12 bases aligned)
                // Pos 4: Ref '-' vs Alt 'C' (Insertion)
                // Pos 6: Ref 'A' vs Alt 'A'
                // Pos 10: Ref 'G' vs Alt '-' (Deletion)
                // Pos 12: Ref 'T' vs Alt 'C' (Substitution)
                document.getElementById('mutation-ref').value = 'ATG-CGACTGATC';
                document.getElementById('mutation-alt').value = 'ATGCCGACTGACC';
            });
        }

        // Tools: Primer Utilities
        const btnPrimer = document.getElementById('btn-analyze-primer');
        if (btnPrimer) {
            btnPrimer.addEventListener('click', () => this.handleAnalyzePrimer());
        }

        // Tools: Restriction Map
        const btnRestriction = document.getElementById('btn-run-restriction');
        if (btnRestriction) {
            btnRestriction.addEventListener('click', () => this.handleRestrictionMap());
        }

        // Tools: Translation
        const btnTrans = document.getElementById('btn-run-translation');
        if (btnTrans) {
            btnTrans.addEventListener('click', () => this.handleSixFrameTranslation());
        }

        // Tools: Compare
        const btnCompare = document.getElementById('btn-compare-seqs');
        if (btnCompare) {
            btnCompare.addEventListener('click', () => this.handleCompareSequences());
        }

        // Tools: Batch Analysis
        const btnBatch = document.getElementById('btn-run-batch');
        if (btnBatch) {
            btnBatch.addEventListener('click', () => this.handleRunBatch());
        }

        const btnBatchSample = document.getElementById('btn-load-sample-batch');
        if (btnBatchSample) {
            btnBatchSample.addEventListener('click', () => {
                document.getElementById('batch-input').value = 
`>Seq1_GFP_fragment
ATGAAGAGCAACGGCGAGGAGCTGTTCACCGGGGTGGTGCCCATCCTGGTCGAGCTGGAC
>Seq2_LacZ_promoter
CGTTACCCAACTTAATCGCCTTGCAGCACATCCCCCTTTCGCCAGCTGGCGTAATAGCGA
>Seq3_16S_amplicon
AGAGTTTGATCCTGGCTCAGGACGAACGCTGGCGGCGTGCCTAATACATGCAAGTCGAAC`;
            });
        }

        const batchFileInput = document.getElementById('batch-file-input');
        if (batchFileInput) {
            batchFileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const r = new FileReader();
                r.onload = (ev) => {
                    document.getElementById('batch-input').value = ev.target.result;
                };
                r.readAsText(file);
            });
        }

        const btnExportBatchCsv = document.getElementById('btn-export-batch-csv');
        if (btnExportBatchCsv) {
            btnExportBatchCsv.addEventListener('click', () => this.handleExportBatchCsv());
        }

        const batchFilter = document.getElementById('batch-filter');
        if (batchFilter) {
            batchFilter.addEventListener('input', (e) => this.filterBatchTable(e.target.value));
        }

        // Phylogeny: Alignment
        const btnAlign = document.getElementById('btn-run-alignment');
        if (btnAlign) {
            btnAlign.addEventListener('click', () => this.handleRunAlignment());
        }

        // Phylogeny: Tree
        const btnRenderTree = document.getElementById('btn-render-tree');
        if (btnRenderTree) {
            btnRenderTree.addEventListener('click', () => this.handleRenderTree());
        }

        document.querySelectorAll('.btn-newick-preset').forEach(btn => {
            btn.addEventListener('click', () => {
                const newick = btn.getAttribute('data-tree');
                document.getElementById('newick-input').value = newick;
                this.handleRenderTree();
            });
        });

        // Learn: Challenges
        document.querySelectorAll('.btn-reveal-hint').forEach(btn => {
            btn.addEventListener('click', () => {
                const sol = btn.nextElementSibling;
                if (sol) {
                    sol.style.display = sol.style.display === 'none' ? 'block' : 'none';
                    btn.textContent = sol.style.display === 'none' ? 'Show Solution' : 'Hide Solution';
                }
            });
        });

        // Projects view events
        const btnCreateProj = document.getElementById('btn-create-project');
        if (btnCreateProj) {
            btnCreateProj.addEventListener('click', () => this.handleCreateProject());
        }

        const btnExportProj = document.getElementById('btn-export-project-json');
        if (btnExportProj) {
            btnExportProj.addEventListener('click', () => this.handleExportProjectJson());
        }

        const inputImportProj = document.getElementById('input-import-project');
        if (inputImportProj) {
            inputImportProj.addEventListener('change', (e) => this.handleImportProjectJson(e));
        }

        // Reports view events
        const btnPrintRep = document.getElementById('btn-print-report');
        if (btnPrintRep) {
            btnPrintRep.addEventListener('click', () => window.print());
        }

        const btnDownloadRep = document.getElementById('btn-download-report-html');
        if (btnDownloadRep) {
            btnDownloadRep.addEventListener('click', () => {
                if (!this.currentSequence || !this.currentValidation) {
                    alert('Please analyze a sequence first.');
                    return;
                }
                const html = generateReport(this.currentSequence, this.currentValidation, this.currentStats, this.currentOrfs);
                exportHtml(html, `GeneTrace_Report_${this.currentSequence.name.replace(/\s+/g, '_')}.html`);
            });
        }

        // Settings view events
        const btnSetStudent = document.getElementById('btn-settings-student');
        const btnSetResearch = document.getElementById('btn-settings-research');
        if (btnSetStudent && btnSetResearch) {
            btnSetStudent.addEventListener('click', () => this.applyMode('student'));
            btnSetResearch.addEventListener('click', () => this.applyMode('research'));
        }

        const btnSetTheme = document.getElementById('btn-settings-theme');
        if (btnSetTheme) {
            btnSetTheme.addEventListener('click', () => this.toggleTheme());
        }

        const minOrfInput = document.getElementById('setting-min-orf');
        if (minOrfInput) {
            minOrfInput.addEventListener('change', (e) => {
                const val = parseInt(e.target.value, 10);
                if (val && val > 0) {
                    this.minOrfLen = val;
                    localStorage.setItem('genetrace_min_orf', String(val));
                }
            });
        }

        const btnClearData = document.getElementById('btn-clear-all-data');
        if (btnClearData) {
            btnClearData.addEventListener('click', async () => {
                if (confirm('Clear all local projects and samples?')) {
                    const req = indexedDB.deleteDatabase('GeneTraceDB');
                    req.onsuccess = () => {
                        alert('Local data cleared. Reloading...');
                        location.reload();
                    };
                }
            });
        }
    }

    loadExampleSequence(type) {
        const input = document.getElementById('main-sequence-input');
        if (!input) return;

        if (type === 'dna-fasta') {
            input.value = `>GFP_Aequorea_victoria_green_fluorescent_protein
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
        } else if (type === 'dna-plain') {
            input.value = `ATGAAGAGCAACGGCGAGGAGCTGTTCACCGGGGTGGTGCCCATCCTGGTCGAGCTGGACGGCGACGTAAACGGCCACAAGTTCAGCGTGTCCGGCGAGGGCGAGGGCGATGCCACCTACGGCAAGCTGACCCTGAAGTTCATCTGCACCACCGGCAAGCTGCCCGTGCCCTGGCCCACCCTCGTGACCACCCTGACCTACGGCGTGCAGTGCTTCAGCCGCTACCCCGACCACATGAAGCAGCACGACTTCTTCAAGTCCGCCATGCCCGAAGGCTACGTCCAGGAGCGCACCATCTTCTTCAAGGACGACGGCAACTACAAGACCCGCGCCGAGGTGAAGTTCGAGGGCGACACCCTGGTGAACCGCATCGAGCTGAAGGGCATCGACTTCAAGGAGGACGGCAACATCCTGGGGCACAAGCTGGAGTACAACTACAACAGCCACAACGTCTATATCATGGCCGACAAGCAGAAGAACGGCATCAAGGTGAACTTCAAGATCCGCCACAACATCGAGGACGGCAGCGTGCAGCTCGCCGACCACTACCAGCAGAACACCCCCATCGGCGACGGCCCCGTGCTGCTGCCCGACAACCACTACCTGAGCACCCAGTCCGCCCTGAGCAAAGACCCCAACGAGAAGCGCGATCACATGGTCCTGCTGGAGTTCGTGACCGCCGCCGGGATCACTCTCGGCATGGACGAGCTGTACAAGTAA`;
        } else if (type === 'rna') {
            input.value = `>16S_rRNA_partial
AUGCAAGUCGAACGGUAACAGGAAGAAGCUUGCUUCUUUGCUGACGAGUGGCGGACGGGUGAGUAAUGUCUGGGAAACUGCCUGAUGGAGGGGGAUAACUACUGGAAACGGUAGCUAAUACCGCAUAACGUCGCAAGACCAAAGAGGGGGACCUUCGGGCCUCUUGCCAUCGGAUGUGCCCAGAUGGGAUUAGCUAGUAGGUGGGGUAACGGCUCACCUAGGCGACGAUCCCUAGCUGGUCUGAGAGGAUGACCAGCCACACUGGGACUGAGACACGGCCCAGACUCCUACGGGAGGCAGCAGUGGG`;
        } else if (type === 'protein') {
            input.value = `>Hemoglobin_Subunit_Alpha
MVLSPADKTNVKAAWGKVGAHAGEYGAEALERMFLSFPTTKTYFPHFDLSHGSAQVKGHGKKVADALTNAVAHVDDMPNALSALSDLHAHKLRVDPVNFKLLSHCLLVTLAAHLPAEFTPAVHASLDKFLASVSTVLTSKYR`;
        } else if (type === 'ambiguous') {
            input.value = `>Ambiguous_IUPAC_Fragment
ATGCGNATCRYTGWSKMBDHVNATCGATCG`;
        } else if (type === 'invalid') {
            input.value = `123456789!@#$%^&*()_+XYZ123456789`;
        }
    }

    async handleSequenceInput() {
        const input = document.getElementById('main-sequence-input').value;
        if (!input.trim()) {
            alert('Please enter a sequence.');
            return;
        }

        try {
            const parsedSequences = parseFasta(input);
            if (parsedSequences.length === 0) {
                alert('No valid sequences found in input.');
                return;
            }

            const primarySequence = parsedSequences[0];
            const validation = validateSequence(primarySequence);
            
            let stats = null;
            if (validation.type === 'DNA' || validation.type === 'RNA') {
                stats = calculateNucleotideStats(primarySequence.sequence);
            } else if (validation.type === 'Protein') {
                stats = calculateProteinStats(primarySequence.sequence);
            }
            
            this.currentSequence = primarySequence;
            this.currentValidation = validation;
            this.currentStats = stats;
            this.currentOrfs = [];

            this.updateSampleHeader(primarySequence.name);
            this.updateEvidenceBoard(primarySequence, validation, stats);
            
            if (validation.type === 'Protein') {
                navigateTo('analyze-protein');
                renderSequenceViewer('prot-sequence-viewer-container', primarySequence.sequence, { type: 'Protein' });
                
                const protStats = document.getElementById('prot-stats-container');
                if (protStats && stats) {
                    protStats.innerHTML = `
                        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:1rem; margin-bottom:1.5rem;">
                            <div class="card" style="margin:0; background:var(--bg-tertiary);">
                                <strong>Length:</strong> ${stats.length} aa
                            </div>
                            <div class="card" style="margin:0; background:var(--bg-tertiary);">
                                <strong>Hydrophobic:</strong> ${(stats.hydrophobicFraction * 100).toFixed(1)}%
                            </div>
                            <div class="card" style="margin:0; background:var(--bg-tertiary);">
                                <strong>Est. MW:</strong> ${(stats.mwEstimateDa / 1000).toFixed(1)} kDa
                            </div>
                        </div>
                    `;
                }
            } else {
                navigateTo('analyze-nucleotide');
                renderSequenceViewer('nuc-sequence-viewer-container', primarySequence.sequence, { type: validation.type });
                
                const nucStatsContainer = document.getElementById('nuc-stats-container');
                if (nucStatsContainer && stats) {
                    nucStatsContainer.innerHTML = `
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
                            <div class="chart-box card" style="margin:0;">
                                <h3 style="font-size: 1rem; margin-bottom: 1rem;">Base Composition (GC: ${stats.gcPercentage.toFixed(1)}%)</h3>
                                <div id="composition-chart"></div>
                            </div>
                            <div class="chart-box card" style="margin:0;">
                                <h3 style="font-size: 1rem; margin-bottom: 1rem;">GC Profile (50bp window)</h3>
                                <div id="gc-profile-chart"></div>
                            </div>
                        </div>
                    `;
                    
                    renderCompositionDonut('composition-chart', stats.counts);
                    const gcProfile = calculateSlidingGC(primarySequence.sequence, 50, 10);
                    renderGCProfileChart('gc-profile-chart', gcProfile);
                }

                // Reset ORF container
                const orfContainer = document.getElementById('orf-results-container');
                if (orfContainer) orfContainer.innerHTML = '';
            }

        } catch (error) {
            console.error('Sequence parse error:', error);
            alert('Error parsing sequence: ' + error.message);
        }
    }

    async handleIdentifySequence() {
        await this.handleSequenceInput();
        if (!this.currentSequence) return;
        navigateTo('analyze-identify');
        
        const container = document.getElementById('identify-content-container');
        if (!container) return;

        const seq = this.currentSequence.sequence;
        const len = seq.length;
        const gc = this.currentStats ? this.currentStats.gcPercentage.toFixed(1) : 'N/A';
        
        let markerAssessment = 'Standard genomic / coding locus';
        if (len >= 400 && len <= 1600 && seq.toUpperCase().includes('AGAGTTTGAT')) {
            markerAssessment = 'High match to bacterial 16S rRNA gene (V1-V9 primers detected)';
        } else if (len >= 500 && len <= 800) {
            markerAssessment = 'Potential mitochondrial COI (cytochrome c oxidase) barcode or ribosomal ITS fragment';
        }

        container.innerHTML = `
            <div class="card" style="background:var(--bg-secondary);">
                <h3>Automated Sequence Classification</h3>
                <table class="data-table" style="margin-top:1rem; margin-bottom:1.5rem;">
                    <tr><th>Sample Name</th><td><strong>${this.currentSequence.name}</strong></td></tr>
                    <tr><th>Sequence Type</th><td>${this.currentValidation.type}</td></tr>
                    <tr><th>Length</th><td>${len} bp</td></tr>
                    <tr><th>GC Content</th><td>${gc}%</td></tr>
                    <tr><th>Diagnostic Marker Assessment</th><td><span style="color:var(--accent-primary); font-weight:600;">${markerAssessment}</span></td></tr>
                </table>

                <div style="background:var(--bg-tertiary); padding:1rem; border-radius:var(--radius-md); border-left:4px solid var(--accent-primary); margin-bottom:1.5rem;">
                    <p style="margin:0; font-size:0.9rem;">
                        <strong>Scientific Verification Protocol:</strong> GeneTrace calculates deterministic client-side metrics and diagnostic markers. To obtain certified taxonomic classification down to species level without simulated data, submit directly to the NCBI BLAST public repository below.
                    </p>
                </div>

                <button id="btn-identify-launch-blast" class="primary large">Launch NCBI BLASTn for Verified Taxonomic Hit ↗</button>
            </div>
        `;

        const blastBtn = document.getElementById('btn-identify-launch-blast');
        if (blastBtn) {
            blastBtn.addEventListener('click', async () => {
                const { createBlastForm } = await import('./external/blast.js');
                const submit = createBlastForm('identify-content-container', this.currentSequence.sequence, 'blastn');
                if (submit) submit();
            });
        }
    }

    handleFindORFs() {
        if (!this.currentSequence || (this.currentValidation.type !== 'DNA' && this.currentValidation.type !== 'RNA')) {
            alert('Please load a valid nucleotide sequence first.');
            return;
        }

        try {
            const orfs = findORFs(this.currentSequence.sequence, this.minOrfLen);
            this.currentOrfs = orfs;
            
            const container = document.getElementById('orf-results-container');
            if (!container) return;

            if (orfs.length === 0) {
                container.innerHTML = `<p>No ORFs found longer than ${this.minOrfLen} amino acids.</p>`;
                return;
            }

            let html = `<h3>Found ${orfs.length} Open Reading Frames (ORFs >= ${this.minOrfLen} aa)</h3>`;
            html += `<div style="max-height: 450px; overflow-y: auto;">`;
            
            orfs.forEach(orf => {
                html += `
                    <div class="card" style="margin-bottom: 1rem; padding: 1rem; background: var(--bg-primary);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                            <strong>${orf.id}</strong>
                            <span class="badge" style="background: var(--bg-tertiary); padding: 0.2rem 0.5rem; border-radius: var(--radius-sm); font-size: 0.8rem;">
                                Length: ${orf.lengthAa} AA
                            </span>
                        </div>
                        <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
                            Strand: ${orf.strand} | Frame: ${orf.frame > 0 ? '+' + orf.frame : orf.frame} | Biological Pos: ${orf.start} - ${orf.end} (1-based)
                        </div>
                        <div style="font-family: var(--font-mono); font-size: 0.8rem; background: var(--bg-secondary); padding: 0.5rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); max-height: 100px; overflow-y: auto; word-break: break-all;">
                            ${orf.translation}
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
            container.innerHTML = html;
        } catch (error) {
            console.error('Error finding ORFs:', error);
            alert('Error finding ORFs: ' + error.message);
        }
    }

    async handleSaveCurrentSample() {
        if (!this.currentSequence) {
            alert('No sequence currently analyzed to save.');
            return;
        }
        if (!this.activeProject) {
            this.activeProject = await createProject('Default Workspace');
        }

        try {
            const saved = await saveSample(this.activeProject.id, {
                name: this.currentSequence.name,
                sequence: this.currentSequence.sequence,
                type: this.currentValidation ? this.currentValidation.type : 'DNA',
                stats: this.currentStats,
                validation: this.currentValidation
            });
            alert(`Sample "${saved.name}" saved to project "${this.activeProject.name}" in IndexedDB.`);
            this.loadProjectSamples();
        } catch (e) {
            console.error('Failed to save sample:', e);
            alert('Failed to save sample: ' + e.message);
        }
    }

    handleFindMotif() {
        const pattern = document.getElementById('motif-input').value.trim();
        const isRegex = document.getElementById('motif-regex').checked;
        const container = document.getElementById('motif-results');
        
        let seq = this.currentSequence ? this.currentSequence.sequence : '';
        if (!seq) {
            alert('Please load an active sequence first.');
            return;
        }
        if (!pattern) {
            alert('Please enter a motif to search.');
            return;
        }

        const results = findMotifs(seq, pattern, isRegex);
        container.innerHTML = `<h4>Found ${results.length} matches for "${pattern}"</h4>`;
        if (results.length > 0) {
            let table = '<table class="data-table"><tr><th>#</th><th>Motif Found</th><th>Start (1-based)</th><th>End (1-based)</th><th>Strand</th></tr>';
            results.slice(0, 50).forEach((m, idx) => {
                table += `<tr><td>${idx + 1}</td><td style="font-family:var(--font-mono); font-weight:600;">${m.motif}</td><td>${m.start}</td><td>${m.end}</td><td>${m.strand}</td></tr>`;
            });
            table += '</table>';
            container.innerHTML += table;
            if (results.length > 50) container.innerHTML += `<p style="font-size:0.85rem; color:var(--text-muted);">Showing first 50 of ${results.length} matches.</p>`;
        }
    }

    handleFindMutations() {
        const ref = document.getElementById('mutation-ref').value.replace(/\s+/g, '');
        const alt = document.getElementById('mutation-alt').value.replace(/\s+/g, '');
        const container = document.getElementById('mutation-results');

        if (!ref || !alt) {
            alert('Please provide both reference and alternative sequences.');
            return;
        }

        const res = compareAlignedSequences(ref, alt);
        if (res.error) {
            container.innerHTML = `<span style="color:#ef4444; font-weight:600;">${res.error}</span>`;
            return;
        }

        let html = `<h4>Detected ${res.mutations.length} Mutations (Ref length: ${res.referenceBases} bp)</h4>`;
        if (res.mutations.length === 0) {
            html += '<p>Sequences are 100% identical. Zero mutations detected.</p>';
        } else {
            html += '<table class="data-table"><tr><th>Biological Pos (1-based)</th><th>Ref</th><th>Alt</th><th>Mutation Type</th><th>Consequence / Codon</th></tr>';
            res.mutations.forEach(m => {
                let codonDetail = '-';
                if (m.codonInfo) {
                    if (m.codonInfo.codonNumber) {
                        codonDetail = `Codon ${m.codonInfo.codonNumber}: ${m.codonInfo.refCodon}(${m.codonInfo.refAa}) -> ${m.codonInfo.altCodon}(${m.codonInfo.altAa}) [${m.codonInfo.consequence}]`;
                    } else {
                        codonDetail = m.codonInfo.consequence;
                    }
                }
                html += `<tr><td><strong>${m.biologicalPosition}</strong></td><td style="font-family:var(--font-mono); color:#ef4444;">${m.reference}</td><td style="font-family:var(--font-mono); color:#16a34a; font-weight:600;">${m.alternative}</td><td><span class="badge">${m.type}</span></td><td>${codonDetail}</td></tr>`;
            });
            html += '</table>';
        }
        container.innerHTML = html;
    }

    handleAnalyzePrimer() {
        const seq = document.getElementById('primer-input').value.trim();
        const container = document.getElementById('primer-results');
        if (!seq) {
            alert('Please enter a primer sequence.');
            return;
        }

        const res = analyzePrimer(seq);
        if (!res) {
            container.innerHTML = '<span style="color:#ef4444;">Invalid primer sequence. Must contain valid nucleotides.</span>';
            return;
        }

        container.innerHTML = `
            <table class="data-table" style="max-width:500px;">
                <tr><th>Length</th><td>${res.length} bp</td></tr>
                <tr><th>GC Content</th><td>${res.gcPercent.toFixed(1)}%</td></tr>
                <tr><th>Estimated Tm</th><td>${res.tmEstimate.toFixed(1)} °C</td></tr>
                <tr><th>GC Clamp (3' end)</th><td>${res.hasGcClamp ? '✅ Present' : '❌ Absent'}</td></tr>
            </table>
        `;
    }

    async handleRestrictionMap() {
        const seq = this.currentSequence ? this.currentSequence.sequence : '';
        const container = document.getElementById('restriction-results');
        if (!seq) {
            alert('Please load a nucleotide sequence first.');
            return;
        }

        const singleOnly = document.getElementById('chk-single-cutters').checked;
        const sites = await findRestrictionSites(seq);
        
        // Group by enzyme
        const counts = {};
        sites.forEach(s => counts[s.enzyme] = (counts[s.enzyme] || 0) + 1);

        const filtered = singleOnly ? sites.filter(s => counts[s.enzyme] === 1) : sites;

        container.innerHTML = `<h4>Found ${filtered.length} Restriction Sites (${sites.length} total across all enzymes)</h4>`;
        if (filtered.length > 0) {
            let table = '<table class="data-table"><tr><th>Enzyme</th><th>Recognition</th><th>Cut Position (1-based)</th><th>Cut Frequency</th></tr>';
            filtered.forEach(s => {
                table += `<tr><td><strong>${s.enzyme}</strong></td><td style="font-family:var(--font-mono);">${s.recognition}</td><td>${s.cutSite} bp</td><td>${counts[s.enzyme]} cut(s)</td></tr>`;
            });
            table += '</table>';
            container.innerHTML += table;
        } else {
            container.innerHTML += '<p>No matching restriction sites found.</p>';
        }
    }

    handleSixFrameTranslation() {
        const seq = this.currentSequence ? this.currentSequence.sequence : '';
        const container = document.getElementById('translation-results');
        if (!seq) {
            alert('Please load a nucleotide sequence first.');
            return;
        }

        const rc = reverseComplement(seq);
        const frames = [
            { name: 'Frame +1', seq: translateSequence(seq, 1) },
            { name: 'Frame +2', seq: translateSequence(seq, 2) },
            { name: 'Frame +3', seq: translateSequence(seq, 3) },
            { name: 'Frame -1', seq: translateSequence(rc, 1) },
            { name: 'Frame -2', seq: translateSequence(rc, 2) },
            { name: 'Frame -3', seq: translateSequence(rc, 3) }
        ];

        let html = '<div style="display:flex; flex-direction:column; gap:1rem;">';
        frames.forEach(f => {
            html += `
                <div class="card" style="margin:0; padding:1rem; background:var(--bg-secondary);">
                    <strong>${f.name}</strong> (${f.seq.length} aa)
                    <div style="font-family:var(--font-mono); font-size:0.8rem; background:var(--bg-primary); padding:0.5rem; border-radius:var(--radius-sm); border:1px solid var(--border-color); margin-top:0.5rem; max-height:80px; overflow-y:auto; word-break:break-all;">
                        ${f.seq}
                    </div>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    }

    handleCompareSequences() {
        const s1 = document.getElementById('compare-1').value.replace(/\s+/g, '');
        const s2 = document.getElementById('compare-2').value.replace(/\s+/g, '');
        const container = document.getElementById('compare-results');

        if (!s1 || !s2) {
            alert('Please provide both sequences to compare.');
            return;
        }

        const res = calculateIdentity(s1, s2);
        if (!res) {
            container.innerHTML = '<span style="color:#ef4444;">Comparison error.</span>';
            return;
        }

        container.innerHTML = `
            <table class="data-table" style="max-width:500px;">
                <tr><th>Pairwise Identity</th><td><strong style="color:var(--accent-primary); font-size:1.1rem;">${res.identityPercent.toFixed(2)}%</strong></td></tr>
                <tr><th>Exact Matches</th><td>${res.matches}</td></tr>
                <tr><th>Mismatches</th><td>${res.mismatches}</td></tr>
                <tr><th>Gaps</th><td>${res.gaps}</td></tr>
                <tr><th>Aligned Length</th><td>${res.alignmentLength}</td></tr>
            </table>
        `;
    }

    handleRunBatch() {
        const raw = document.getElementById('batch-input').value;
        if (!raw.trim()) {
            alert('Please enter or upload Multi-FASTA sequences.');
            return;
        }

        const seqs = parseFasta(raw);
        if (seqs.length === 0) {
            alert('No valid sequences found in Multi-FASTA.');
            return;
        }

        this.batchResults = processBatch(seqs, calculateNucleotideStats, detectSequenceType, validateSequence);
        this.renderBatchTable(this.batchResults);

        const filterInput = document.getElementById('batch-filter');
        const csvBtn = document.getElementById('btn-export-batch-csv');
        if (filterInput) filterInput.style.display = 'inline-block';
        if (csvBtn) csvBtn.style.display = 'inline-block';
    }

    renderBatchTable(items) {
        const container = document.getElementById('batch-results');
        if (!container) return;

        let tableHtml = `
            <p><strong>Total Sequences in Batch:</strong> ${items.length}</p>
            <table class="data-table" style="width:100%">
                <thead>
                    <tr>
                        <th style="cursor:pointer;" id="th-batch-name">Name ⬍</th>
                        <th>Type</th>
                        <th style="cursor:pointer;" id="th-batch-length">Length ⬍</th>
                        <th style="cursor:pointer;" id="th-batch-gc">GC% ⬍</th>
                        <th>Status</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
        `;

        items.forEach((r, idx) => {
            tableHtml += `
                <tr>
                    <td><strong>${r.name}</strong></td>
                    <td><span class="badge">${r.type}</span></td>
                    <td>${r.length}</td>
                    <td>${r.gcPercent ? r.gcPercent.toFixed(1) + '%' : '-'}</td>
                    <td>${r.status}</td>
                    <td><button class="btn-load-batch-item secondary small" data-idx="${idx}">Inspect</button></td>
                </tr>
            `;
        });
        tableHtml += '</tbody></table>';
        container.innerHTML = tableHtml;

        // Bind inspection buttons
        document.querySelectorAll('.btn-load-batch-item').forEach(b => {
            b.addEventListener('click', () => {
                const idx = parseInt(b.getAttribute('data-idx'), 10);
                const item = items[idx];
                const mainInput = document.getElementById('main-sequence-input');
                if (mainInput && item) {
                    mainInput.value = `>${item.name}\n${item.sequence}`;
                    this.handleSequenceInput();
                }
            });
        });

        // Sorting
        const thLen = document.getElementById('th-batch-length');
        if (thLen) {
            thLen.addEventListener('click', () => {
                items.sort((a, b) => b.length - a.length);
                this.renderBatchTable(items);
            });
        }
        const thGc = document.getElementById('th-batch-gc');
        if (thGc) {
            thGc.addEventListener('click', () => {
                items.sort((a, b) => (b.gcPercent || 0) - (a.gcPercent || 0));
                this.renderBatchTable(items);
            });
        }
    }

    filterBatchTable(term) {
        if (!this.batchResults) return;
        const filtered = this.batchResults.filter(r => r.name.toLowerCase().includes(term.toLowerCase()));
        this.renderBatchTable(filtered);
    }

    handleExportBatchCsv() {
        if (!this.batchResults || this.batchResults.length === 0) return;
        let csv = 'Name,Type,Length,GC_Percent,Status\n';
        this.batchResults.forEach(r => {
            csv += `"${r.name.replace(/"/g, '""')}",${r.type},${r.length},${r.gcPercent || ''},${r.status}\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'genetrace_batch_summary.csv';
        a.click();
        URL.revokeObjectURL(url);
    }

    handleRunAlignment() {
        const query = document.getElementById('align-query').value.replace(/\s+/g, '').toUpperCase();
        const ref = document.getElementById('align-ref').value.replace(/\s+/g, '').toUpperCase();
        if (!query || !ref) {
            alert('Please provide both query and reference sequences.');
            return;
        }
        renderAlignment('alignment-results-container', query, ref);
    }

    handleRenderTree() {
        const newick = document.getElementById('newick-input').value.trim();
        if (!newick) {
            alert('Please provide a Newick string.');
            return;
        }
        try {
            const treeData = parseNewick(newick);
            renderSVGTree('tree-viewer-container', treeData);
        } catch (e) {
            console.error('Tree render error:', e);
            alert('Failed to parse Newick tree: ' + e.message);
        }
    }

    async handleCreateProject() {
        const nameInput = document.getElementById('new-project-name');
        const descInput = document.getElementById('new-project-desc');
        const name = nameInput.value.trim();
        if (!name) {
            alert('Please enter a project name.');
            return;
        }

        const proj = await createProject(name, descInput.value.trim());
        this.activeProject = proj;
        localStorage.setItem('genetrace_active_project_id', proj.id);
        this.updateProjectHeader();
        nameInput.value = '';
        descInput.value = '';
        alert(`Project "${proj.name}" created and set as active.`);
        this.loadProjectsList();
        this.loadProjectSamples();
    }

    async loadProjectsList() {
        const container = document.getElementById('projects-list-container');
        if (!container) return;

        const projects = await getAllProjects();
        if (projects.length === 0) {
            container.innerHTML = '<p class="text-muted">No saved projects found.</p>';
            return;
        }

        let html = '<table class="data-table"><tr><th>Project Name</th><th>Created</th><th>Status</th><th>Actions</th></tr>';
        projects.forEach(p => {
            const isActive = this.activeProject && this.activeProject.id === p.id;
            html += `
                <tr>
                    <td><strong>${p.name}</strong></td>
                    <td>${new Date(p.createdAt).toLocaleDateString()}</td>
                    <td>${isActive ? '<span class="badge" style="background:var(--accent-light); color:var(--accent-primary);">Active</span>' : 'Inactive'}</td>
                    <td>
                        <button class="btn-select-proj secondary small" data-id="${p.id}">Select</button>
                        <button class="btn-delete-proj secondary small" data-id="${p.id}" style="color:#ef4444;">Delete</button>
                    </td>
                </tr>
            `;
        });
        html += '</table>';
        container.innerHTML = html;

        container.querySelectorAll('.btn-select-proj').forEach(b => {
            b.addEventListener('click', async () => {
                const id = b.getAttribute('data-id');
                this.activeProject = await getProject(id);
                localStorage.setItem('genetrace_active_project_id', id);
                this.updateProjectHeader();
                this.loadProjectsList();
                this.loadProjectSamples();
            });
        });

        container.querySelectorAll('.btn-delete-proj').forEach(b => {
            b.addEventListener('click', async () => {
                const id = b.getAttribute('data-id');
                if (confirm('Delete this project and all its samples?')) {
                    await deleteProject(id);
                    const projs = await getAllProjects();
                    this.activeProject = projs.length > 0 ? projs[0] : null;
                    this.updateProjectHeader();
                    this.loadProjectsList();
                    this.loadProjectSamples();
                }
            });
        });
    }

    async loadProjectSamples() {
        const container = document.getElementById('project-samples-container');
        if (!container) return;
        if (!this.activeProject) {
            container.innerHTML = '<p class="text-muted">No active project selected.</p>';
            return;
        }

        const samples = await getSamples(this.activeProject.id);
        if (samples.length === 0) {
            container.innerHTML = '<p class="text-muted">No samples saved in this project yet.</p>';
            return;
        }

        let html = '<table class="data-table"><tr><th>Sample Name</th><th>Type</th><th>Length</th><th>Saved At</th><th>Action</th></tr>';
        samples.forEach(s => {
            html += `
                <tr>
                    <td><strong>${s.name}</strong></td>
                    <td><span class="badge">${s.type}</span></td>
                    <td>${s.sequence ? s.sequence.length : '-'} bp</td>
                    <td>${new Date(s.savedAt).toLocaleTimeString()}</td>
                    <td>
                        <button class="btn-load-samp primary small" data-id="${s.id}">Open in Workbench</button>
                        <button class="btn-del-samp secondary small" data-id="${s.id}" style="color:#ef4444;">Delete</button>
                    </td>
                </tr>
            `;
        });
        html += '</table>';
        container.innerHTML = html;

        container.querySelectorAll('.btn-load-samp').forEach(b => {
            b.addEventListener('click', () => {
                const id = b.getAttribute('data-id');
                const sample = samples.find(s => s.id === id);
                if (sample) {
                    const input = document.getElementById('main-sequence-input');
                    if (input) input.value = `>${sample.name}\n${sample.sequence}`;
                    this.handleSequenceInput();
                }
            });
        });

        container.querySelectorAll('.btn-del-samp').forEach(b => {
            b.addEventListener('click', async () => {
                const id = b.getAttribute('data-id');
                await deleteSample(id);
                this.loadProjectSamples();
            });
        });
    }

    async handleExportProjectJson() {
        if (!this.activeProject) {
            alert('No active project to export.');
            return;
        }
        const data = await exportProject(this.activeProject.id);
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `GeneTrace_Project_${this.activeProject.name.replace(/\s+/g, '_')}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    handleImportProjectJson(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const parsed = JSON.parse(ev.target.result);
                const res = await importProject(parsed);
                this.activeProject = res.project;
                this.updateProjectHeader();
                alert(`Successfully imported project "${res.project.name}" with ${res.count} samples into IndexedDB.`);
                this.loadProjectsList();
                this.loadProjectSamples();
            } catch (err) {
                console.error('Import error:', err);
                alert('Failed to import project JSON: ' + err.message);
            }
        };
        reader.readAsText(file);
    }

    renderLiveReport() {
        const container = document.getElementById('report-live-container');
        if (!container) return;

        if (!this.currentSequence || !this.currentValidation) {
            container.innerHTML = '<p style="color:#64748b;">Please analyze a sequence first to generate an interactive report.</p>';
            return;
        }

        const html = generateReport(this.currentSequence, this.currentValidation, this.currentStats, this.currentOrfs);
        container.innerHTML = `<iframe srcdoc="${html.replace(/"/g, '&quot;')}" style="width:100%; height:600px; border:none;"></iframe>`;
    }

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        this.applyTheme(this.theme);
        localStorage.setItem('genetrace_theme', this.theme);
    }

    applyTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('theme-dark');
            document.body.classList.remove('theme-light');
        } else {
            document.body.classList.add('theme-light');
            document.body.classList.remove('theme-dark');
        }
    }

    applyMode(mode) {
        this.mode = mode;
        const modeStudent = document.getElementById('btn-mode-student');
        const modeResearch = document.getElementById('btn-mode-research');

        if (mode === 'student') {
            document.body.classList.add('mode-student');
            document.body.classList.remove('mode-research');
            if (modeStudent) modeStudent.classList.add('active');
            if (modeResearch) modeResearch.classList.remove('active');
        } else {
            document.body.classList.add('mode-research');
            document.body.classList.remove('mode-student');
            if (modeResearch) modeResearch.classList.add('active');
            if (modeStudent) modeStudent.classList.remove('active');
        }
        localStorage.setItem('genetrace_mode', mode);
    }

    updateEvidenceBoard(seqObj, validation, stats) {
        const board = document.getElementById('evidence-board');
        if (!board) return;

        let warningsHtml = '';
        if (validation.warnings && validation.warnings.length > 0) {
            warningsHtml = `
                <div class="evidence-item warning" style="background:#fef3c7; border-left:4px solid #f59e0b; padding:0.5rem; margin-top:0.5rem; font-size:0.85rem; color:#92400e;">
                    <strong>Warnings:</strong>
                    <ul style="margin:0; padding-left:1.2rem;">
                        ${validation.warnings.map(w => `<li>${w}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        let statsHtml = '';
        if (stats) {
            if (validation.type === 'DNA' || validation.type === 'RNA') {
                statsHtml = `
                    <div class="evidence-item" style="margin-top:0.5rem;">
                        <strong>GC Content:</strong> ${stats.gcPercentage.toFixed(1)}%<br>
                        <strong>Est. MW (ssDNA):</strong> ${(stats.mwEstimateDa / 1000).toFixed(1)} kDa
                    </div>
                `;
            } else if (validation.type === 'Protein') {
                statsHtml = `
                    <div class="evidence-item" style="margin-top:0.5rem;">
                        <strong>Hydrophobic:</strong> ${(stats.hydrophobicFraction * 100).toFixed(1)}%<br>
                        <strong>Est. MW:</strong> ${(stats.mwEstimateDa / 1000).toFixed(1)} kDa
                    </div>
                `;
            }
        }

        board.innerHTML = `
            <div class="evidence-item" style="margin-bottom:0.5rem;">
                <strong>Sample:</strong> ${seqObj.name || 'Unnamed'}
            </div>
            <div class="evidence-item" style="margin-bottom:0.5rem;">
                <strong>Integrity:</strong> <span style="color:#16a34a; font-weight:600;">${validation.label}</span>
            </div>
            <div class="evidence-item" style="margin-bottom:0.5rem;">
                <strong>Detected Type:</strong> ${validation.type}
            </div>
            <div class="evidence-item" style="margin-bottom:0.5rem;">
                <strong>Length:</strong> ${validation.length.toLocaleString()} ${validation.type === 'Protein' ? 'aa' : 'bp'}
            </div>
            ${statsHtml}
            ${warningsHtml}
            <div class="evidence-item" style="margin-top:0.75rem; padding-top:0.5rem; border-top:1px solid var(--border-color); font-size:0.75rem; color:var(--text-muted);">
                🔒 <strong>Local Analysis:</strong> 100% Client-Side. Zero sequence data transmitted.
            </div>
        `;
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.GeneTrace = new GeneTraceApp();
});
