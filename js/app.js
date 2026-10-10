// app.js - Main GeneTrace v1.1 Application Controller
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
import { generateReport, exportHtml } from './reports/report.js';
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

// GeneTrace v1.1 Premium & Intelligence Modules
import { RawLabUI } from './rawlab/rawlab-ui.js';
import { parseAB1 } from './rawlab/ab1-parser.js';
import { createChromatogramViewer } from './rawlab/chromatogram-viewer.js';
import { analyzeAB1Quality } from './rawlab/ab1-qc.js';
import { parseFastq } from './rawlab/fastq-parser.js';
import { calculateFastqQC } from './rawlab/fastq-qc.js';
import { filterReads, exportFilteredFastq, exportFilteredFasta } from './rawlab/fastq-filter.js';
import { convertToPlainSequence, formatFastaOutput, convertAb1ToFasta } from './rawlab/format-converter.js';
import { createSyntheticAB1, createSyntheticFastq } from './rawlab/demo-generator.js';

import { analyzeAndRecommend, WORKFLOWS } from './smart-router/smart-router.js';
import { SixteenSWorkflow } from './identification/sixteen-s.js';
import { ITSWorkflow } from './identification/its.js';
import { EighteenSWorkflow } from './identification/eighteen-s.js';
import { VirusWorkflow } from './identification/virus.js';
import { UnknownSequenceInvestigator } from './identification/unknown.js';
import { EvidenceEngine } from './evidence/evidence-engine.js';

import { OrganismViewer } from './visualization/organism-3d.js';
import { TaxonomyPath } from './visualization/taxonomy-tree.js';

import { AuthUI } from './auth/auth-ui.js';
import { AdminDashboard } from './admin/admin.js';
import { UserDashboard } from './dashboard/user-dashboard.js';
import { initFeatureManager, canUseFeature, updateUserPlan } from './firebase/feature-manager.js';

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

        // User & Entitlement State
        const savedPlan = localStorage.getItem('genetrace_user_plan') || 'research_pro';
        this.userProfile = {
            uid: 'local_eval_user',
            displayName: 'Lead Researcher',
            email: 'researcher@genetrace.local',
            role: 'admin',
            plan: savedPlan,
            planStatus: 'active'
        };

        // Subsystems
        this.evidenceEngine = new EvidenceEngine();
        this.rawLabUI = new RawLabUI();
        this.authUI = new AuthUI();
        this.adminDashboard = new AdminDashboard();
        this.userDashboard = new UserDashboard();
        this.organismViewer = null;
        this.taxonomyPath = null;
        this.sixteenS = new SixteenSWorkflow();
        this.itsWorkflow = new ITSWorkflow();
        this.eighteenS = new EighteenSWorkflow();
        this.virusWorkflow = new VirusWorkflow();
        this.unknownInvestigator = new UnknownSequenceInvestigator();

        this.initUI();
        this.bindEvents();
        this.initDefaultProject();
        this.registerServiceWorker();
        initRouter();
        initFeatureManager(this.userProfile);
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('sw.js').then(reg => {
                    console.log('ServiceWorker registered with scope:', reg.scope);
                }).catch(err => {
                    console.warn('ServiceWorker registration optional notice:', err);
                });
            });
        }
    }

    initUI() {
        this.applyTheme(this.theme);
        this.applyMode(this.mode);
        this.updatePlanBadge();
        const orfInput = document.getElementById('setting-min-orf');
        if (orfInput) orfInput.value = this.minOrfLen;
    }

    updatePlanBadge() {
        const badge = document.getElementById('plan-badge');
        if (badge) {
            const plan = this.userProfile.plan || 'free';
            badge.textContent = plan.toUpperCase().replace('_', ' ');
            badge.className = `plan-badge ${plan.includes('pro') ? 'pro' : plan}`;
        }
    }

    updateUserPlan(newPlan) {
        this.userProfile.plan = newPlan;
        localStorage.setItem('genetrace_user_plan', newPlan);
        updateUserPlan(this.userProfile);
        this.updatePlanBadge();
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

        const planBadge = document.getElementById('plan-badge');
        if (planBadge) {
            planBadge.addEventListener('click', () => this.showPremiumModal('Unlock Full Workspace Features'));
        }

        const accountBtn = document.getElementById('account-btn');
        if (accountBtn) {
            accountBtn.addEventListener('click', () => navigateTo('dashboard'));
        }

        // Modal triggers
        const btnClosePrem = document.getElementById('btn-close-premium-modal');
        if (btnClosePrem) {
            btnClosePrem.addEventListener('click', () => this.hidePremiumModal());
        }

        const btnUpStudent = document.getElementById('btn-upgrade-student');
        if (btnUpStudent) {
            btnUpStudent.addEventListener('click', () => {
                this.updateUserPlan('student_pro');
                this.hidePremiumModal();
                alert('Plan updated to Student Pro!');
            });
        }

        const btnUpResearch = document.getElementById('btn-upgrade-research');
        if (btnUpResearch) {
            btnUpResearch.addEventListener('click', () => {
                this.updateUserPlan('research_pro');
                this.hidePremiumModal();
                alert('Plan updated to Research Pro!');
            });
        }

        // Clear evidence
        const btnClearEv = document.getElementById('btn-clear-evidence');
        if (btnClearEv) {
            btnClearEv.addEventListener('click', () => {
                this.evidenceEngine.clear();
                const b = document.getElementById('evidence-board');
                if (b) b.innerHTML = '<p class="empty-state">Evidence board reset.</p>';
            });
        }

        // Home tabs (Paste, Upload, Example)
        const tabButtons = document.querySelectorAll('.input-tabs .tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const parent = btn.closest('.input-tabs') || btn.parentElement;
                parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const targetTab = btn.getAttribute('data-tab');
                if (targetTab) {
                    document.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');
                    const pane = document.getElementById(`tab-content-${targetTab}`);
                    if (pane) pane.style.display = 'block';
                }
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
                    tabButtons[0]?.click();
                };
                reader.readAsText(file);
            });
        }

        // Example sequence buttons
        document.querySelectorAll('.btn-example-seq').forEach(btn => {
            btn.addEventListener('click', () => {
                const exType = btn.getAttribute('data-example');
                this.loadExampleSequence(exType);
                tabButtons[0]?.click();
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

        const btnJumpRec = document.getElementById('btn-jump-recommended');
        if (btnJumpRec) {
            btnJumpRec.addEventListener('click', () => {
                if (this.primaryRecommendedId) {
                    const target = this.getWorkflowViewId(this.primaryRecommendedId);
                    navigateTo(target);
                } else {
                    navigateTo('analyze-identify');
                }
            });
        }

        // Raw Lab sub-tabs
        const rawTabs = document.querySelectorAll('[data-rawtab]');
        rawTabs.forEach(btn => {
            btn.addEventListener('click', () => {
                rawTabs.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const t = btn.getAttribute('data-rawtab');
                ['ab1', 'fastq', 'conv'].forEach(id => {
                    const el = document.getElementById(`rawtab-${id}-content`);
                    if (el) el.style.display = (id === t) ? 'block' : 'none';
                });
            });
        });

        // Raw Lab AB1 & FASTQ
        this.rawLabUI.initAB1Tab();
        this.rawLabUI.initFASTQTab();

        const btnDemoAb1 = document.getElementById('btn-load-demo-ab1');
        if (btnDemoAb1) {
            btnDemoAb1.addEventListener('click', () => {
                const syntheticBuffer = createSyntheticAB1('ATGAAGAGCAACGGCGAGGAGCTGTTCACCGGGGTGGTGCCC', 'Demo_GFP_Sanger_1');
                this.rawLabUI.state.currentAB1 = parseAB1(syntheticBuffer);
                this.rawLabUI.renderAB1Viewer();
                const qcPanel = document.getElementById('ab1-qc-panel');
                if (qcPanel) qcPanel.style.display = 'block';
            });
        }

        const btnDemoFastq = document.getElementById('btn-load-demo-fastq');
        if (btnDemoFastq) {
            btnDemoFastq.addEventListener('click', () => {
                const demoFastqText = createSyntheticFastq();
                const reads = parseFastq(demoFastqText);
                this.rawLabUI.state.currentFASTQ = reads;
                const qc = calculateFastqQC(reads);
                this.rawLabUI.renderFASTQQCCharts(qc);
            });
        }

        const btnFastqUseFirst = document.getElementById('fastq-use-first');
        if (btnFastqUseFirst) {
            btnFastqUseFirst.addEventListener('click', () => {
                if (!this.rawLabUI.state.currentFASTQ || this.rawLabUI.state.currentFASTQ.length === 0) {
                    alert('Please load a FASTQ file first.');
                    return;
                }
                const firstRead = this.rawLabUI.state.currentFASTQ[0];
                const fasta = `>${firstRead.id} ${firstRead.description}\n${firstRead.sequence}`;
                const mainInput = document.getElementById('main-sequence-input');
                if (mainInput) mainInput.value = fasta;
                navigateTo('home');
                this.handleSequenceInput();
            });
        }

        // Converter Tab
        const btnConvStrip = document.getElementById('btn-conv-strip');
        if (btnConvStrip) {
            btnConvStrip.addEventListener('click', () => {
                const val = document.getElementById('conv-input')?.value || '';
                document.getElementById('conv-output').value = convertToPlainSequence(val);
            });
        }

        const btnConvWrap = document.getElementById('btn-conv-wrap60');
        if (btnConvWrap) {
            btnConvWrap.addEventListener('click', () => {
                const val = document.getElementById('conv-input')?.value || '';
                const plain = convertToPlainSequence(val);
                document.getElementById('conv-output').value = formatFastaOutput('Formatted_Sequence', plain, 60);
            });
        }

        const btnConvRevComp = document.getElementById('btn-conv-revcomp');
        if (btnConvRevComp) {
            btnConvRevComp.addEventListener('click', () => {
                const val = document.getElementById('conv-input')?.value || '';
                const plain = convertToPlainSequence(val);
                document.getElementById('conv-output').value = reverseComplement(plain);
            });
        }

        // Smart Router view
        const btnRouterRe = document.getElementById('btn-router-reanalyze');
        if (btnRouterRe) {
            btnRouterRe.addEventListener('click', () => this.runSmartRouter());
        }

        // 16S Identification Events
        this.bind16SEvents();
        // ITS Fungal Events
        this.bindITSEvents();
        // 18S Eukaryotic Events
        this.bind18SEvents();
        // Virus Events
        this.bindVirusEvents();
        // Unknown Sequence Events
        this.bindUnknownEvents();
        // 3D Visualization Events
        this.bind3DEvents();

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

        // Navigation listener to trigger views
        window.addEventListener('genetrace:navigated', (e) => {
            const viewId = e.detail?.viewId;
            if (viewId === 'dashboard') {
                this.userDashboard.render('user-dashboard-container', this.userProfile);
            } else if (viewId === 'admin') {
                this.adminDashboard.render('admin-dashboard-container');
            } else if (viewId === 'vis-3d') {
                this.initOrganism3D();
            } else if (viewId === 'analyze-identify') {
                this.runSmartRouter();
            }
        });
    }

    showPremiumModal(title = 'Unlock Full Features', desc = 'This feature requires a Student Pro or Research Pro plan.') {
        const modal = document.getElementById('premium-gate-modal');
        if (!modal) return;
        const titleEl = document.getElementById('premium-gate-title');
        const descEl = document.getElementById('premium-gate-desc');
        if (titleEl) titleEl.textContent = title;
        if (descEl) descEl.textContent = desc;
        modal.style.opacity = '1';
        modal.style.pointerEvents = 'auto';
    }

    hidePremiumModal() {
        const modal = document.getElementById('premium-gate-modal');
        if (modal) {
            modal.style.opacity = '0';
            modal.style.pointerEvents = 'none';
        }
    }

    getWorkflowViewId(recId) {
        const map = {
            '16S': 'id-16s',
            'ITS': 'id-its',
            '18S': 'id-18s',
            'virus': 'id-virus',
            'protein': 'analyze-protein',
            'unknown': 'id-unknown'
        };
        return map[recId] || 'analyze-identify';
    }

    // 16S rRNA Identification Workflow
    bind16SEvents() {
        const btnCopy = document.getElementById('btn-16s-copy-fasta');
        if (btnCopy) {
            btnCopy.onclick = () => {
                if (!this.currentSequence) return alert('No sequence loaded');
                navigator.clipboard.writeText(`>${this.currentSequence.name}\n${this.currentSequence.sequence}`);
                alert('16S FASTA copied to clipboard!');
            };
        }

        const btnOpenNcbi = document.getElementById('btn-16s-open-ncbi');
        if (btnOpenNcbi) {
            btnOpenNcbi.onclick = () => {
                const search = this.sixteenS.prepareSearch(this.currentSequence?.sequence || '');
                window.open(search.getNCBIBlast16SUrl(), '_blank');
            };
        }

        const btnDemo = document.getElementById('btn-16s-load-candidate-demo');
        if (btnDemo) {
            btnDemo.onclick = () => {
                document.getElementById('input-16s-acc').value = 'NR_024570.1';
                document.getElementById('input-16s-org').value = 'Escherichia coli strain K-12';
                document.getElementById('input-16s-ident').value = '99.8';
                document.getElementById('input-16s-cov').value = '100';
            };
        }

        const btnEval = document.getElementById('btn-16s-eval-candidate');
        if (btnEval) {
            btnEval.onclick = () => {
                const acc = document.getElementById('input-16s-acc')?.value || 'NR_UNKNOWN';
                const org = document.getElementById('input-16s-org')?.value || 'Unknown bacterium';
                const ident = parseFloat(document.getElementById('input-16s-ident')?.value || '0');
                const cov = parseFloat(document.getElementById('input-16s-cov')?.value || '0');

                const candidate = { accession: acc, organism: org, identity: ident, coverage: cov };
                const conf = this.sixteenS.assessConfidence([candidate]);

                const resDiv = document.getElementById('sixteen-s-eval-result');
                if (resDiv) {
                    resDiv.innerHTML = `
                        <div class="card" style="margin:0; background:var(--bg-secondary); border-left:4px solid var(--accent-primary);">
                            <h4>Taxonomic Assignment Assessment</h4>
                            <p><strong>Candidate:</strong> ${candidate.organism} (<em>${candidate.accession}</em>)</p>
                            <p><strong>Identity:</strong> ${candidate.identity}% | <strong>Coverage:</strong> ${candidate.coverage}%</p>
                            <p><strong>Confidence Tier:</strong> <span class="badge ${conf.level === 'MODERATE' ? 'badge-protein' : 'badge-beta'}">${conf.level}</span></p>
                            <p style="font-size:0.85rem; color:var(--text-secondary); margin-top:0.5rem;">${conf.note}</p>
                        </div>
                    `;
                }
            };
        }

        const btnAddEv = document.getElementById('btn-16s-add-evidence');
        if (btnAddEv) {
            btnAddEv.onclick = () => {
                const org = document.getElementById('input-16s-org')?.value || 'Escherichia coli';
                const ident = parseFloat(document.getElementById('input-16s-ident')?.value || '99.8');
                this.evidenceEngine.addEvidence(
                    'TAXONOMIC_CONSISTENCY',
                    `16S Alignment: ${org} (${ident}% ID)`,
                    '16S rRNA Marker',
                    ident >= 99.0 ? 'STRONG' : 'MODERATE',
                    'High identity to reference type strain.',
                    'Requires polyphasic validation for definitive species confirmation.'
                );
                this.evidenceEngine.renderEvidenceBoard('evidence-board');
                alert('Added to Evidence Board!');
            };
        }
    }

    // ITS Fungal Identification
    bindITSEvents() {
        const btnCopy = document.getElementById('btn-its-copy-fasta');
        if (btnCopy) {
            btnCopy.onclick = () => {
                if (!this.currentSequence) return alert('No sequence loaded');
                navigator.clipboard.writeText(`>${this.currentSequence.name}\n${this.currentSequence.sequence}`);
                alert('ITS FASTA copied!');
            };
        }

        const btnOpenNcbi = document.getElementById('btn-its-open-ncbi');
        if (btnOpenNcbi) {
            btnOpenNcbi.onclick = () => {
                window.open('https://blast.ncbi.nlm.nih.gov/Blast.cgi?PROGRAM=blastn&PAGE_TYPE=BlastSearch&DATABASE=ITS_RefSeq_Fungi', '_blank');
            };
        }

        const btnDemo = document.getElementById('btn-its-load-candidate-demo');
        if (btnDemo) {
            btnDemo.onclick = () => {
                document.getElementById('input-its-acc').value = 'NR_111007.1';
                document.getElementById('input-its-org').value = 'Saccharomyces cerevisiae';
                document.getElementById('input-its-ident').value = '99.5';
                document.getElementById('input-its-cov').value = '98.0';
            };
        }

        const btnEval = document.getElementById('btn-its-eval-candidate');
        if (btnEval) {
            btnEval.onclick = () => {
                const acc = document.getElementById('input-its-acc')?.value;
                const org = document.getElementById('input-its-org')?.value;
                const ident = parseFloat(document.getElementById('input-its-ident')?.value || '0');
                const cov = parseFloat(document.getElementById('input-its-cov')?.value || '0');

                const candidate = { accession: acc, organism: org, identity: ident, coverage: cov };
                const conf = this.itsWorkflow.assessConfidence([candidate]);

                const resDiv = document.getElementById('its-eval-result');
                if (resDiv) {
                    resDiv.innerHTML = `
                        <div class="card" style="margin:0; background:var(--bg-secondary); border-left:4px solid var(--accent-primary);">
                            <h4>Fungal Barcode Assessment</h4>
                            <p><strong>Candidate:</strong> ${candidate.organism} (${candidate.accession})</p>
                            <p><strong>Identity:</strong> ${candidate.identity}% | <strong>Coverage:</strong> ${candidate.coverage}%</p>
                            <p><strong>Confidence:</strong> <span class="badge badge-protein">${conf.level}</span></p>
                            <p style="font-size:0.85rem; color:var(--text-secondary);">${conf.reasoning || 'Fungal species delimitation requires morphological and multi-locus corroboration.'}</p>
                        </div>
                    `;
                }
            };
        }

        const btnAddEv = document.getElementById('btn-its-add-evidence');
        if (btnAddEv) {
            btnAddEv.onclick = () => {
                const org = document.getElementById('input-its-org')?.value || 'Saccharomyces cerevisiae';
                const ident = parseFloat(document.getElementById('input-its-ident')?.value || '99.5');
                this.evidenceEngine.addEvidence(
                    'TAXONOMIC_CONSISTENCY',
                    `ITS Fungal Match: ${org} (${ident}% ID)`,
                    'ITS Barcode',
                    ident >= 99.0 ? 'STRONG' : 'MODERATE',
                    'Fungal species identification supported by nuclear ribosomal ITS.',
                    'Species complexes may share identical ITS alleles.'
                );
                this.evidenceEngine.renderEvidenceBoard('evidence-board');
                alert('Added to Evidence Board!');
            };
        }
    }

    // 18S Eukaryotic Events
    bind18SEvents() {
        const btnDemo = document.getElementById('btn-18s-load-demo');
        if (btnDemo) {
            btnDemo.onclick = () => {
                document.getElementById('input-18s-acc').value = 'NR_044700.1';
                document.getElementById('input-18s-org').value = 'Tetrahymena thermophila';
                document.getElementById('input-18s-ident').value = '99.2';
                document.getElementById('input-18s-cov').value = '97.5';
            };
        }

        const btnEval = document.getElementById('btn-18s-eval');
        if (btnEval) {
            btnEval.onclick = () => {
                const org = document.getElementById('input-18s-org')?.value;
                const ident = parseFloat(document.getElementById('input-18s-ident')?.value || '0');
                const conf = this.eighteenS.assessConfidence([{ organism: org, identity: ident }]);

                const resDiv = document.getElementById('eighteen-s-eval-result');
                if (resDiv) {
                    resDiv.innerHTML = `
                        <div class="card" style="margin:0; background:var(--bg-secondary); border-left:4px solid var(--accent-primary);">
                            <h4>Eukaryotic 18S Assessment</h4>
                            <p><strong>Organism:</strong> ${org} (${ident}% Identity)</p>
                            <p><strong>Confidence:</strong> <span class="badge badge-protein">${conf.level}</span></p>
                            <p style="font-size:0.85rem; color:var(--text-secondary);">${conf.reasoning || 'Genus-level resolution supported.'}</p>
                        </div>
                    `;
                }
            };
        }

        const btnAddEv = document.getElementById('btn-18s-add-evidence');
        if (btnAddEv) {
            btnAddEv.onclick = () => {
                const org = document.getElementById('input-18s-org')?.value || 'Tetrahymena thermophila';
                const ident = parseFloat(document.getElementById('input-18s-ident')?.value || '99.2');
                this.evidenceEngine.addEvidence(
                    'TAXONOMIC_CONSISTENCY',
                    `18S Eukaryotic Match: ${org} (${ident}% ID)`,
                    '18S rRNA',
                    ident >= 99.0 ? 'MODERATE' : 'WEAK',
                    'Microeukaryotic placement determined.',
                    '18S provides lower species-level discrimination than ITS.'
                );
                this.evidenceEngine.renderEvidenceBoard('evidence-board');
                alert('Added to Evidence Board!');
            };
        }
    }

    // Virus Events
    bindVirusEvents() {
        const btnDemo = document.getElementById('btn-virus-load-demo');
        if (btnDemo) {
            btnDemo.onclick = () => {
                document.getElementById('input-virus-acc').value = 'NC_001416.1';
                document.getElementById('input-virus-org').value = 'Enterobacteria phage lambda';
                document.getElementById('input-virus-ident').value = '96.5';
                document.getElementById('input-virus-cov').value = '92.0';
            };
        }

        const btnEval = document.getElementById('btn-virus-eval');
        if (btnEval) {
            btnEval.onclick = () => {
                const org = document.getElementById('input-virus-org')?.value;
                const ident = parseFloat(document.getElementById('input-virus-ident')?.value || '0');
                const conf = this.virusWorkflow.assessConfidence([{ organism: org, identity: ident }]);

                const resDiv = document.getElementById('virus-eval-result');
                if (resDiv) {
                    resDiv.innerHTML = `
                        <div class="card" style="margin:0; background:var(--bg-secondary); border-left:4px solid var(--accent-primary);">
                            <h4>Viral Homology Evaluation</h4>
                            <p><strong>Viral Match:</strong> ${org} (${ident}% Identity)</p>
                            <p><strong>Confidence:</strong> <span class="badge badge-beta">${conf.level}</span></p>
                            <p style="font-size:0.85rem; color:var(--text-secondary);">${conf.reasoning || 'Family/genus viral classification suggested.'}</p>
                        </div>
                    `;
                }
            };
        }

        const btnAddEv = document.getElementById('btn-virus-add-evidence');
        if (btnAddEv) {
            btnAddEv.onclick = () => {
                const org = document.getElementById('input-virus-org')?.value || 'Enterobacteria phage lambda';
                const ident = parseFloat(document.getElementById('input-virus-ident')?.value || '96.5');
                this.evidenceEngine.addEvidence(
                    'TAXONOMIC_CONSISTENCY',
                    `Viral Match: ${org} (${ident}% ID)`,
                    'Viral Homology',
                    'MODERATE',
                    'High divergence typical in viral genomics; family-level placement supported.',
                    'Strictly non-clinical educational research screening.'
                );
                this.evidenceEngine.renderEvidenceBoard('evidence-board');
                alert('Added to Evidence Board!');
            };
        }
    }

    // Unknown Sequence Pipeline Events
    bindUnknownEvents() {
        const btnRun = document.getElementById('btn-run-unknown-investigate');
        if (btnRun) {
            btnRun.onclick = () => {
                if (!this.currentSequence) return alert('Please load a sequence in the Home tab first.');
                
                const report = this.unknownInvestigator.investigate(
                    this.currentSequence,
                    this.currentValidation,
                    this.currentStats,
                    { hasSubstantialOrfs: this.currentOrfs && this.currentOrfs.length > 0 }
                );

                const container = document.getElementById('unknown-pipeline-container');
                if (container) {
                    container.innerHTML = `
                        <div class="card" style="margin:0; background:var(--bg-secondary);">
                            <h3>Diagnostic Investigation Summary</h3>
                            
                            <h4 style="margin-top:1.5rem; color:var(--accent-primary);">1. Empirical Observations (Verified Facts)</h4>
                            <table class="data-table" style="width:100%; margin-top:0.5rem;">
                                <tr><th>Input Type</th><td>${report.observed.type}</td></tr>
                                <tr><th>Length</th><td>${report.observed.length} ${report.observed.type === 'Protein' ? 'aa' : 'bp'}</td></tr>
                                <tr><th>GC Content</th><td>${report.observed.gc}%</td></tr>
                                <tr><th>Coding Potential</th><td>${report.observed.codingTendency} (${report.observed.orfCount} detected ORFs)</td></tr>
                                <tr><th>Conserved Motifs</th><td>${report.observed.markerClues.length > 0 ? report.observed.markerClues.join(', ') : 'None detected'}</td></tr>
                            </table>

                            <h4 style="margin-top:1.5rem; color:var(--accent-primary);">2. Biological Interpretation (Hypothesis)</h4>
                            <div style="background:var(--bg-tertiary); padding:1rem; border-radius:var(--radius-md); margin-top:0.5rem;">
                                <p><strong>Most Likely Class:</strong> ${report.interpretation.likelyCategory}</p>
                                <p style="font-size:0.85rem; color:var(--text-secondary); margin-top:0.25rem;">${report.interpretation.reasoning}</p>
                            </div>

                            <h4 style="margin-top:1.5rem; color:var(--accent-primary);">3. Recommended Next Step</h4>
                            <p style="margin-top:0.5rem;">${report.recommendedNextStep.description}</p>

                            <h4 style="margin-top:1.5rem; color:var(--warning);">4. Scientific Limitations</h4>
                            <ul style="font-size:0.85rem; color:var(--text-secondary); padding-left:1.2rem; margin-top:0.5rem;">
                                ${report.limitations.map(l => `<li>${l}</li>`).join('')}
                            </ul>
                        </div>
                    `;
                }
            };
        }
    }

    // 3D Organism & Taxonomy Viewer
    bind3DEvents() {
        document.querySelectorAll('.btn-3d-model').forEach(btn => {
            btn.onclick = () => {
                const type = btn.getAttribute('data-type');
                if (this.organismViewer) {
                    this.organismViewer.showOrganism(type, btn.textContent, true);
                }
            };
        });

        document.querySelectorAll('.btn-tax-preset').forEach(btn => {
            btn.onclick = () => {
                const preset = btn.getAttribute('data-preset');
                this.renderTaxonomyPreset(preset);
            };
        });
    }

    async initOrganism3D() {
        if (!this.organismViewer) {
            try {
                this.organismViewer = new OrganismViewer('organism-viewer-container', { interactive: true, width: 380, height: 320 });
                await this.organismViewer.init();
                this.organismViewer.showOrganism('bacterium', 'Escherichia coli (Illustrative Model)', true);
            } catch (err) {
                console.warn('3D initialization fallback:', err);
            }
        }
        if (!this.taxonomyPath) {
            try {
                this.taxonomyPath = new TaxonomyPath('taxonomy-path-container');
                this.renderTaxonomyPreset('ecoli');
            } catch (err) {
                console.warn('Taxonomy path initialization error:', err);
            }
        }
    }

    renderTaxonomyPreset(preset) {
        if (!this.taxonomyPath) return;
        const presets = {
            'ecoli': {
                domain: 'Bacteria',
                phylum: 'Pseudomonadota',
                class: 'Gammaproteobacteria',
                order: 'Enterobacterales',
                family: 'Enterobacteriaceae',
                genus: 'Escherichia',
                species: 'coli'
            },
            'yeast': {
                domain: 'Eukaryota',
                kingdom: 'Fungi',
                phylum: 'Ascomycota',
                class: 'Saccharomycetes',
                order: 'Saccharomycetales',
                family: 'Saccharomycetaceae',
                genus: 'Saccharomyces',
                species: 'cerevisiae'
            },
            'lambda': {
                domain: 'Viruses',
                phylum: 'Uroviricota',
                class: 'Caudoviricetes',
                order: 'Crassvirales (tentative)',
                family: 'Siphoviridae',
                genus: 'Lambdavirus',
                species: 'Escherichia virus Lambda'
            }
        };
        const data = presets[preset] || presets['ecoli'];
        this.taxonomyPath.render(data);
    }

    runSmartRouter() {
        if (!this.currentSequence) return;
        
        const rec = analyzeAndRecommend(
            this.currentSequence,
            this.currentValidation,
            this.currentStats,
            { hasSubstantialOrfs: this.currentOrfs && this.currentOrfs.length > 0 }
        );

        this.primaryRecommendedId = rec.primaryWorkflow;

        // Update home quick banner
        const banner = document.getElementById('home-router-banner');
        const title = document.getElementById('home-router-title');
        const reason = document.getElementById('home-router-reason');
        if (banner && title && reason && rec.recommendations.length > 0) {
            banner.style.display = 'block';
            title.textContent = `${rec.recommendations[0].icon} ${rec.recommendations[0].name} (${rec.confidence} Confidence)`;
            reason.textContent = rec.reasoning.join('. ') || 'Recommended based on sequence composition and length.';
        }

        // Update Smart Router view
        const container = document.getElementById('router-recommendation-container');
        if (container) {
            container.innerHTML = `
                <div class="card" style="margin:0; background:var(--bg-secondary);">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
                        <div>
                            <span class="badge badge-pro">TOP RECOMMENDATION</span>
                            <h3 style="margin-top:0.5rem;">${rec.recommendations[0]?.icon || '🧭'} ${rec.recommendations[0]?.name}</h3>
                            <p style="font-size:0.9rem; color:var(--text-secondary); margin-top:0.25rem;">
                                ${rec.reasoning.join(' • ')}
                            </p>
                        </div>
                        <button class="btn primary" id="btn-router-launch-top">Launch Pipeline ➔</button>
                    </div>

                    <h4 style="margin-top:1.5rem; font-size:0.95rem;">All Evaluated Pathways</h4>
                    <div style="display:flex; flex-direction:column; gap:0.5rem; margin-top:0.75rem;">
                        ${rec.recommendations.map(r => `
                            <div style="display:flex; justify-content:space-between; align-items:center; padding:0.75rem; background:var(--bg-primary); border-radius:var(--radius-md); border:1px solid var(--border-color);">
                                <div style="display:flex; align-items:center; gap:0.75rem;">
                                    <span style="font-size:1.3rem;">${r.icon}</span>
                                    <div>
                                        <strong>${r.name}</strong>
                                        <div style="font-size:0.8rem; color:var(--text-muted);">${r.reasoning.join(', ')}</div>
                                    </div>
                                </div>
                                <span class="badge ${r.confidence === 'HIGH' ? 'badge-protein' : r.confidence === 'MODERATE' ? 'badge-dna' : 'badge-beta'}">${r.confidence}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;

            const btnLaunch = document.getElementById('btn-router-launch-top');
            if (btnLaunch) {
                btnLaunch.onclick = () => {
                    const target = this.getWorkflowViewId(rec.primaryWorkflow);
                    navigateTo(target);
                };
            }
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
            
            // Build evidence
            this.evidenceEngine = EvidenceEngine.fromSequenceAnalysis(primarySequence, validation, stats);
            this.evidenceEngine.renderEvidenceBoard('evidence-board');

            // Run Smart Router
            this.runSmartRouter();
            
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
    }

    async handleSaveCurrentSample() {
        if (!this.currentSequence) return alert('No sequence to save.');
        if (!this.activeProject) return alert('No active project found.');

        try {
            await saveSample(this.activeProject.id, {
                name: this.currentSequence.name || 'Sample_' + Date.now(),
                type: this.currentValidation ? this.currentValidation.type : 'DNA',
                sequence: this.currentSequence.sequence,
                stats: this.currentStats
            });
            alert(`Sample "${this.currentSequence.name}" saved to project "${this.activeProject.name}"!`);
            this.loadProjectSamples();
        } catch (err) {
            console.error('Save sample failed:', err);
            alert('Failed to save sample: ' + err.message);
        }
    }

    handleFindORFs() {
        if (!this.currentSequence) return alert('Please analyze a nucleotide sequence first.');
        const orfs = findORFs(this.currentSequence.sequence, this.minOrfLen);
        this.currentOrfs = orfs;

        const container = document.getElementById('orf-results-container');
        if (!container) return;

        if (orfs.length === 0) {
            container.innerHTML = `<div class="card" style="margin:0; background:var(--bg-secondary);"><p>No ORFs found meeting minimum length of ${this.minOrfLen} aa.</p></div>`;
            return;
        }

        container.innerHTML = `
            <h3>Detected Open Reading Frames (${orfs.length})</h3>
            <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:1rem;">Minimum length threshold: ${this.minOrfLen} codons.</p>
            <div style="overflow-x:auto;">
                <table class="data-table" style="width:100%;">
                    <thead>
                        <tr><th>Frame</th><th>Start (1-based)</th><th>Stop (1-based)</th><th>Length (bp)</th><th>Length (aa)</th><th>Peptide Translation</th></tr>
                    </thead>
                    <tbody>
                        ${orfs.map(o => `
                            <tr>
                                <td><span class="badge ${String(o.frame).startsWith('+') || o.frame > 0 ? 'badge-dna' : 'badge-rna'}">${o.frame}</span></td>
                                <td>${o.start + 1}</td>
                                <td>${o.end}</td>
                                <td>${o.lengthBp}</td>
                                <td><strong>${o.lengthAa}</strong></td>
                                <td style="font-family:var(--font-mono); font-size:0.8rem; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${o.protein}">${o.protein}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    handleFindMotif() {
        const query = document.getElementById('motif-input')?.value.trim();
        if (!query) return alert('Please enter a motif query.');
        if (!this.currentSequence) return alert('Please load a sequence first.');

        const isRegex = document.getElementById('motif-regex')?.checked || false;
        const matches = findMotifs(this.currentSequence.sequence, query, isRegex);
        
        const resDiv = document.getElementById('motif-results');
        if (!resDiv) return;

        if (matches.length === 0) {
            resDiv.innerHTML = `<p style="color:var(--text-muted);">No matches found for motif "${query}".</p>`;
            return;
        }

        resDiv.innerHTML = `
            <h4>Found ${matches.length} Match${matches.length > 1 ? 'es' : ''}</h4>
            <table class="data-table" style="width:100%; margin-top:0.75rem;">
                <thead><tr><th>Position (1-based)</th><th>Length</th><th>Matched Subsequence</th></tr></thead>
                <tbody>
                    ${matches.map(m => `<tr><td>${m.start + 1}</td><td>${m.length}</td><td style="font-family:var(--font-mono);">${m.matchedSequence}</td></tr>`).join('')}
                </tbody>
            </table>
        `;
    }

    handleFindMutations() {
        const ref = document.getElementById('mutation-ref')?.value.trim();
        const alt = document.getElementById('mutation-alt')?.value.trim();
        if (!ref || !alt) return alert('Please provide both reference and alternative sequences.');

        const diffs = compareAlignedSequences(ref, alt);
        const resDiv = document.getElementById('mutation-results');
        if (!resDiv) return;

        resDiv.innerHTML = `
            <h4>Detected Mutations (${diffs.length})</h4>
            <table class="data-table" style="width:100%; margin-top:0.75rem;">
                <thead><tr><th>1-based Coordinate</th><th>Type</th><th>Ref Base</th><th>Alt Base</th><th>Consequence</th></tr></thead>
                <tbody>
                    ${diffs.map(d => `
                        <tr>
                            <td><strong>${d.coordinate}</strong></td>
                            <td><span class="badge ${d.type === 'Substitution' ? 'badge-dna' : 'badge-beta'}">${d.type}</span></td>
                            <td style="font-family:var(--font-mono);">${d.refBase}</td>
                            <td style="font-family:var(--font-mono);">${d.altBase}</td>
                            <td>${d.consequence}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    handleAnalyzePrimer() {
        const primer = document.getElementById('primer-input')?.value.trim();
        if (!primer) return alert('Please enter a primer sequence.');

        const report = analyzePrimer(primer);
        const resDiv = document.getElementById('primer-results');
        if (!resDiv) return;

        resDiv.innerHTML = `
            <div class="card" style="margin:0; background:var(--bg-secondary);">
                <h4>Oligonucleotide Primer Analysis</h4>
                <table class="data-table" style="width:100%; margin-top:0.75rem;">
                    <tr><th>Sequence (5' to 3')</th><td style="font-family:var(--font-mono);">${primer.toUpperCase()}</td></tr>
                    <tr><th>Length</th><td>${report.length} nt</td></tr>
                    <tr><th>GC Content</th><td>${report.gcPercent.toFixed(1)}%</td></tr>
                    <tr><th>Melting Temp (Tm)</th><td><strong>${report.tmCelsius.toFixed(1)} °C</strong></td></tr>
                    <tr><th>3' GC Clamp</th><td>${report.hasGcClamp ? '✅ Present (G/C at 3\' terminus)' : '❌ Absent (A/T at 3\' terminus)'}</td></tr>
                </table>
            </div>
        `;
    }

    handleRestrictionMap() {
        if (!this.currentSequence) return alert('Please load a nucleotide sequence first.');
        const singleOnly = document.getElementById('chk-single-cutters')?.checked || false;
        
        fetch('./data/restriction-enzymes.json').then(r => r.json()).then(enzymes => {
            const cuts = findRestrictionSites(this.currentSequence.sequence, enzymes, singleOnly);
            const resDiv = document.getElementById('restriction-results');
            if (!resDiv) return;

            resDiv.innerHTML = `
                <h4>Restriction Digest Cleavage Sites (${cuts.length})</h4>
                <table class="data-table" style="width:100%; margin-top:0.75rem;">
                    <thead><tr><th>Enzyme</th><th>Recognition Site</th><th>Cut Position (1-based)</th><th>Overhang</th></tr></thead>
                    <tbody>
                        ${cuts.map(c => `<tr><td><strong>${c.enzyme}</strong></td><td style="font-family:var(--font-mono);">${c.pattern}</td><td>${c.cutPosition}</td><td>${c.overhang}</td></tr>`).join('')}
                    </tbody>
                </table>
            `;
        }).catch(err => {
            console.error('Failed to load restriction enzymes:', err);
            alert('Error loading enzyme database.');
        });
    }

    handleSixFrameTranslation() {
        if (!this.currentSequence) return alert('Please load a sequence first.');
        const frames = translateSequence(this.currentSequence.sequence);
        const resDiv = document.getElementById('translation-results');
        if (!resDiv) return;

        resDiv.innerHTML = Object.entries(frames).map(([frameName, peptide]) => `
            <div class="card" style="margin:0 0 1rem 0; background:var(--bg-secondary);">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong>Frame ${frameName}</strong>
                    <span style="font-size:0.8rem; color:var(--text-muted);">${peptide.length} aa</span>
                </div>
                <div style="font-family:var(--font-mono); font-size:0.85rem; word-break:break-all; margin-top:0.5rem; background:var(--bg-primary); padding:0.5rem; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
                    ${peptide}
                </div>
            </div>
        `).join('');
    }

    handleCompareSequences() {
        const s1 = document.getElementById('compare-1')?.value.trim();
        const s2 = document.getElementById('compare-2')?.value.trim();
        if (!s1 || !s2) return alert('Please enter both sequences.');

        const res = calculateIdentity(s1, s2);
        const resDiv = document.getElementById('compare-results');
        if (!resDiv) return;

        resDiv.innerHTML = `
            <div class="card" style="margin:0; background:var(--bg-secondary);">
                <h4>Pairwise Sequence Comparison</h4>
                <table class="data-table" style="width:100%; margin-top:0.75rem;">
                    <tr><th>Pairwise Identity</th><td><strong style="color:var(--accent-primary); font-size:1.1rem;">${res.identityPercent.toFixed(2)}%</strong></td></tr>
                    <tr><th>Exact Matches</th><td>${res.matches}</td></tr>
                    <tr><th>Mismatches</th><td>${res.mismatches}</td></tr>
                    <tr><th>Gaps</th><td>${res.gaps}</td></tr>
                    <tr><th>Alignment Length</th><td>${res.alignmentLength}</td></tr>
                </table>
            </div>
        `;
    }

    handleRunBatch() {
        const input = document.getElementById('batch-input')?.value.trim();
        if (!input) return alert('Please enter Multi-FASTA sequences.');

        const results = processBatch(input);
        this.batchResults = results;

        const resDiv = document.getElementById('batch-results');
        if (!resDiv) return;

        document.getElementById('btn-export-batch-csv').style.display = 'inline-block';
        document.getElementById('batch-filter').style.display = 'inline-block';

        resDiv.innerHTML = `
            <table class="data-table" style="width:100%;">
                <thead><tr><th>Sequence Name</th><th>Type</th><th>Length</th><th>GC %</th><th>Action</th></tr></thead>
                <tbody id="batch-table-body">
                    ${results.map((r, idx) => `
                        <tr>
                            <td><strong>${r.name}</strong></td>
                            <td><span class="badge ${r.type === 'Protein' ? 'badge-protein' : 'badge-dna'}">${r.type}</span></td>
                            <td>${r.length}</td>
                            <td>${r.gcPercent ? r.gcPercent.toFixed(1) + '%' : 'N/A'}</td>
                            <td><button class="btn secondary small btn-batch-load" data-idx="${idx}">Load to Workbench</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        document.querySelectorAll('.btn-batch-load').forEach(btn => {
            btn.onclick = () => {
                const idx = parseInt(btn.getAttribute('data-idx'), 10);
                const rec = this.batchResults[idx];
                if (rec) {
                    const mainInput = document.getElementById('main-sequence-input');
                    if (mainInput) mainInput.value = `>${rec.name}\n${rec.sequence}`;
                    navigateTo('home');
                    this.handleSequenceInput();
                }
            };
        });
    }

    filterBatchTable(query) {
        const q = query.toLowerCase();
        document.querySelectorAll('#batch-table-body tr').forEach(row => {
            const name = row.children[0]?.textContent.toLowerCase() || '';
            row.style.display = name.includes(q) ? '' : 'none';
        });
    }

    handleExportBatchCsv() {
        if (!this.batchResults || this.batchResults.length === 0) return;
        let csv = 'Name,Type,Length,GC_Percent\n';
        this.batchResults.forEach(r => {
            csv += `"${r.name}","${r.type}",${r.length},${r.gcPercent ? r.gcPercent.toFixed(2) : ''}\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'GeneTrace_Batch_Analysis.csv';
        a.click();
    }

    handleRunAlignment() {
        const q = document.getElementById('align-query')?.value.trim();
        const r = document.getElementById('align-ref')?.value.trim();
        if (!q || !r) return alert('Please enter both Query and Reference sequences.');

        const container = document.getElementById('alignment-results-container');
        if (container) {
            renderAlignment('alignment-results-container', q, r);
        }
    }

    handleRenderTree() {
        const newick = document.getElementById('newick-input')?.value.trim();
        if (!newick) return alert('Please enter a Newick string.');

        try {
            const tree = parseNewick(newick);
            renderSVGTree('tree-viewer-container', tree);
        } catch (err) {
            alert('Failed to parse Newick tree: ' + err.message);
        }
    }

    async handleCreateProject() {
        const name = document.getElementById('new-project-name')?.value.trim();
        const desc = document.getElementById('new-project-desc')?.value.trim();
        if (!name) return alert('Project name is required.');

        const p = await createProject(name, desc);
        this.activeProject = p;
        localStorage.setItem('genetrace_active_project_id', p.id);
        this.updateProjectHeader();
        this.loadProjectsList();
        this.loadProjectSamples();
        alert(`Project "${p.name}" created!`);
    }

    async loadProjectsList() {
        const container = document.getElementById('projects-list-container');
        if (!container) return;
        const projects = await getAllProjects();

        if (projects.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted);">No saved projects.</p>';
            return;
        }

        container.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:0.5rem;">
                ${projects.map(p => `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:0.75rem 1rem; background:var(--bg-secondary); border-radius:var(--radius-md); border:1px solid ${p.id === this.activeProject?.id ? 'var(--accent-primary)' : 'var(--border-color)'};">
                        <div>
                            <strong>${p.name}</strong> ${p.id === this.activeProject?.id ? '<span class="badge badge-protein">Active</span>' : ''}
                            <div style="font-size:0.8rem; color:var(--text-muted);">${p.description || 'No description'}</div>
                        </div>
                        <div style="display:flex; gap:0.5rem;">
                            <button class="btn secondary small btn-proj-switch" data-id="${p.id}">Switch</button>
                            <button class="btn ghost small btn-proj-del" data-id="${p.id}" style="color:var(--error);">Delete</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        document.querySelectorAll('.btn-proj-switch').forEach(btn => {
            btn.onclick = async () => {
                const id = btn.getAttribute('data-id');
                const matched = projects.find(x => x.id === id);
                if (matched) {
                    this.activeProject = matched;
                    localStorage.setItem('genetrace_active_project_id', matched.id);
                    this.updateProjectHeader();
                    this.loadProjectsList();
                    this.loadProjectSamples();
                }
            };
        });

        document.querySelectorAll('.btn-proj-del').forEach(btn => {
            btn.onclick = async () => {
                const id = btn.getAttribute('data-id');
                if (confirm('Delete this project and its samples?')) {
                    await deleteProject(id);
                    this.initDefaultProject();
                }
            };
        });
    }

    async loadProjectSamples() {
        const container = document.getElementById('project-samples-container');
        if (!container || !this.activeProject) return;
        const samples = await getSamples(this.activeProject.id);

        if (samples.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted);">No samples stored in active project.</p>';
            return;
        }

        container.innerHTML = `
            <table class="data-table" style="width:100%;">
                <thead><tr><th>Sample Name</th><th>Type</th><th>Length</th><th>Saved Date</th><th>Actions</th></tr></thead>
                <tbody>
                    ${samples.map(s => `
                        <tr>
                            <td><strong>${s.name}</strong></td>
                            <td><span class="badge ${s.type === 'Protein' ? 'badge-protein' : 'badge-dna'}">${s.type}</span></td>
                            <td>${s.sequence ? s.sequence.length : 0}</td>
                            <td>${s.createdAt ? new Date(s.createdAt).toLocaleDateString() : 'N/A'}</td>
                            <td>
                                <button class="btn secondary small btn-sample-load" data-id="${s.id}">Load</button>
                                <button class="btn ghost small btn-sample-del" data-id="${s.id}" style="color:var(--error);">Delete</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        document.querySelectorAll('.btn-sample-load').forEach(btn => {
            btn.onclick = () => {
                const id = btn.getAttribute('data-id');
                const s = samples.find(x => x.id === id);
                if (s) {
                    const mainInput = document.getElementById('main-sequence-input');
                    if (mainInput) mainInput.value = `>${s.name}\n${s.sequence}`;
                    navigateTo('home');
                    this.handleSequenceInput();
                }
            };
        });

        document.querySelectorAll('.btn-sample-del').forEach(btn => {
            btn.onclick = async () => {
                const id = btn.getAttribute('data-id');
                if (confirm('Delete sample?')) {
                    await deleteSample(id);
                    this.loadProjectSamples();
                }
            };
        });
    }

    async handleExportProjectJson() {
        if (!this.activeProject) return alert('No active project.');
        const json = await exportProject(this.activeProject.id);
        const blob = new Blob([json], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `GeneTrace_Project_${this.activeProject.name.replace(/\s+/g, '_')}.json`;
        a.click();
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
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.body.classList.add('theme-light');
            document.body.classList.remove('theme-dark');
            document.documentElement.setAttribute('data-theme', 'light');
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
}

// Global initialization
document.addEventListener('DOMContentLoaded', () => {
    window.GeneTrace = new GeneTraceApp();
});
