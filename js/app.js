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
import { DatabaseManager } from './search/database-manager.js';
import { searchReferences, pairwiseAlign } from './search/reference-search.js';
import { buildPhylogeneticTreeFromReferences } from './phylogeny/tree-builder.js';
import { evaluateConfidence } from './identification/confidence-engine.js';
import { SixteenSWorkflow } from './identification/sixteen-s.js';
import { ArchaeaWorkflow } from './identification/archaea.js';
import { ITSWorkflow } from './identification/its.js';
import { EighteenSWorkflow } from './identification/eighteen-s.js';
import { VirusWorkflow } from './identification/virus.js';
import { UnknownSequenceInvestigator } from './identification/unknown.js';
import { DEMO_SEQUENCES } from './identification/demo-sequences.js';
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

        // Reference Database & Subsystems
        this.dbManager = new DatabaseManager('data/reference');
        this.evidenceEngine = new EvidenceEngine();
        this.rawLabUI = new RawLabUI();
        this.authUI = new AuthUI();
        this.adminDashboard = new AdminDashboard();
        this.userDashboard = new UserDashboard();
        this.organismViewer = null;
        this.idOrganismViewer = null;
        this.taxonomyPath = null;
        this.sixteenS = new SixteenSWorkflow(this.dbManager);
        this.archaea = new ArchaeaWorkflow(this.dbManager);
        this.itsWorkflow = new ITSWorkflow(this.dbManager);
        this.eighteenS = new EighteenSWorkflow(this.dbManager);
        this.virusWorkflow = new VirusWorkflow(this.dbManager);
        this.unknownInvestigator = new UnknownSequenceInvestigator(this.dbManager);
        this.currentIdentificationResult = null;
        this.selectedCandidateIndex = 0;

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

        // Direct Raw Lab to Identification Handoffs
        const btnAb1Id = document.getElementById('btn-ab1-identify');
        if (btnAb1Id) {
            btnAb1Id.addEventListener('click', async () => {
                if (!this.rawLabUI.state.currentAB1) {
                    const syntheticBuffer = createSyntheticAB1('AGAGTTTGATCCTGGCTCAGATTGAACGCTGGCGGCAGGCCTAACACATGCAAGTCGAACGGTAACAGGAAGAAGCTTGCTTCTTTGCTGACGAGTGGCGGACGGGTGAGTAATGTCTGGGAAACTGCCTGATGGAGGGGGATAACTACTGGAAACGGTAGCTAATACCGCATAACGTCGCAAGACCAAAGAGGGGGACCTTCGGGCCTCTTGCCATCGGATGTGCCCAGATGGGATTAGCTAGTAGGTGGGGTAACGGCTCACCTAGGCGACGATCCCTAGCTGGTCTGAGAGGATGACCAGCCACACTGGAACTGAGACACGGTCCAGACTCCTACGGGAGGCAGCAGTGGGGAATATTGCACAATGGGCGCAAGCCTGATGCAGCCATGCCGCGTGTATGAAGAAGGCCTTCGGGTTGTAAAGTACTTTCAGCGGGGAGGAAGGGAGTAAAGTTAATACCTTTGCTCATTGACGTTACCCGCAGAAGAAGCACCGGCTAACTCCGTGCCAGCAGCCGCGGTAATAC', 'Sanger_16S_Isolate_1');
                    this.rawLabUI.state.currentAB1 = parseAB1(syntheticBuffer);
                    this.rawLabUI.renderAB1Viewer();
                }
                const bounds = this.rawLabUI.state.chromatogramViewer ? this.rawLabUI.state.chromatogramViewer.getTrimBoundaries() : { start: 0, end: this.rawLabUI.state.currentAB1.basecalls.length };
                const fasta = convertAb1ToFasta(this.rawLabUI.state.currentAB1, bounds.start, bounds.end, 'Sanger_Trace_Isolate');
                const mainInput = document.getElementById('main-sequence-input');
                if (mainInput) mainInput.value = fasta;
                await this.handleSequenceInput(false);
                navigateTo('analyze-identify');
                await this.runIdentificationPipeline();
            });
        }

        const btnFastqId = document.getElementById('btn-fastq-identify');
        if (btnFastqId) {
            btnFastqId.addEventListener('click', async () => {
                if (!this.rawLabUI.state.currentFASTQ || this.rawLabUI.state.currentFASTQ.length === 0) {
                    const demoFastqText = createSyntheticFastq();
                    const reads = parseFastq(demoFastqText);
                    this.rawLabUI.state.currentFASTQ = reads;
                    this.rawLabUI.renderFASTQQCCharts(calculateFastqQC(reads));
                }
                const firstRead = this.rawLabUI.state.currentFASTQ[0];
                const fasta = `>${firstRead.id || 'FASTQ_Read_1'}\n${firstRead.sequence}`;
                const mainInput = document.getElementById('main-sequence-input');
                if (mainInput) mainInput.value = fasta;
                await this.handleSequenceInput(false);
                navigateTo('analyze-identify');
                await this.runIdentificationPipeline();
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

        // Identification Workflows
        this.bindIdentificationHubEvents();
        this.bind16SEvents();
        this.bindArchaeaEvents();
        this.bindITSEvents();
        this.bind18SEvents();
        this.bindVirusEvents();
        this.bindUnknownEvents();
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

        // GeneTrace in-app analysis buttons
        const btnNucId = document.getElementById('btn-nuc-identify');
        if (btnNucId) {
            btnNucId.addEventListener('click', () => {
                navigateTo('analyze-identify');
                this.runIdentificationPipeline();
            });
        }

        const btnProtId = document.getElementById('btn-prot-identify');
        if (btnProtId) {
            btnProtId.addEventListener('click', () => {
                navigateTo('vis-3d');
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
                if (!this.currentIdentificationResult) {
                    this.runIdentificationPipeline();
                }
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
            'sixteen-s': 'id-16s',
            '16S': 'id-16s',
            'bacteria-16s': 'id-16s',
            'archaea-16s': 'id-archaea',
            'ITS': 'id-its',
            'its': 'id-its',
            'fungi-its': 'id-its',
            '18S': 'id-18s',
            'eighteen-s': 'id-18s',
            'eukaryotes-18s': 'id-18s',
            'virus': 'id-virus',
            'viruses': 'id-virus',
            'protein': 'analyze-protein',
            'unknown': 'id-unknown'
        };
        return map[recId] || 'analyze-identify';
    }

    // Flagship Identification Hub Event Bindings
    bindIdentificationHubEvents() {
        const btnRun = document.getElementById('btn-run-identification');
        if (btnRun) {
            btnRun.addEventListener('click', () => this.runIdentificationPipeline());
        }

        const markerSelect = document.getElementById('id-marker-select');
        if (markerSelect) {
            markerSelect.addEventListener('change', () => {
                if (this.currentSequence) {
                    this.runIdentificationPipeline();
                }
            });
        }

        const btnTree = document.getElementById('btn-id-build-tree');
        if (btnTree) {
            btnTree.addEventListener('click', () => this.buildPhylogenyFromReferences());
        }

        const btnAddEvidence = document.getElementById('btn-id-add-evidence');
        if (btnAddEvidence) {
            btnAddEvidence.addEventListener('click', () => this.addIdentificationToEvidence());
        }

        const btnReport = document.getElementById('btn-id-view-report');
        if (btnReport) {
            btnReport.addEventListener('click', () => {
                this.renderReport();
                navigateTo('reports');
            });
        }
    }

    // 16S rRNA Bacterial Identification Workflow
    bind16SEvents() {
        const btnCopy = document.getElementById('btn-16s-copy-fasta');
        if (btnCopy) {
            btnCopy.onclick = () => {
                if (!this.currentSequence) return alert('No sequence loaded');
                navigator.clipboard.writeText(`>${this.currentSequence.name}\n${this.currentSequence.sequence}`);
                alert('16S FASTA copied to clipboard!');
            };
        }

        const btnSearch = document.getElementById('btn-16s-run-search');
        if (btnSearch) {
            btnSearch.onclick = async () => {
                navigateTo('analyze-identify');
                await this.runIdentificationPipeline('bacteria-16s');
            };
        }

        const btnDemo = document.getElementById('btn-16s-load-candidate-demo');
        if (btnDemo) {
            btnDemo.onclick = async () => {
                const demo = DEMO_SEQUENCES['bacteria-16s'];
                const input = document.getElementById('main-sequence-input');
                if (input) input.value = `>${demo.name}\n${demo.sequence}`;
                await this.handleSequenceInput(false);
                navigateTo('analyze-identify');
                await this.runIdentificationPipeline('bacteria-16s');
            };
        }
    }

    // 16S rRNA Archaeal Identification Workflow
    bindArchaeaEvents() {
        const btnCopy = document.getElementById('btn-archaea-copy-fasta');
        if (btnCopy) {
            btnCopy.onclick = () => {
                if (!this.currentSequence) return alert('No sequence loaded');
                navigator.clipboard.writeText(`>${this.currentSequence.name}\n${this.currentSequence.sequence}`);
                alert('Archaeal 16S FASTA copied to clipboard!');
            };
        }

        const btnSearch = document.getElementById('btn-archaea-run-search');
        if (btnSearch) {
            btnSearch.onclick = async () => {
                navigateTo('analyze-identify');
                await this.runIdentificationPipeline('archaea-16s');
            };
        }

        const btnDemo = document.getElementById('btn-archaea-load-demo');
        if (btnDemo) {
            btnDemo.onclick = async () => {
                const demo = DEMO_SEQUENCES['archaea-16s'];
                const input = document.getElementById('main-sequence-input');
                if (input) input.value = `>${demo.name}\n${demo.sequence}`;
                await this.handleSequenceInput(false);
                navigateTo('analyze-identify');
                await this.runIdentificationPipeline('archaea-16s');
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

        const btnSearch = document.getElementById('btn-its-run-search');
        if (btnSearch) {
            btnSearch.onclick = async () => {
                navigateTo('analyze-identify');
                await this.runIdentificationPipeline('fungi-its');
            };
        }

        const btnDemo = document.getElementById('btn-its-load-candidate-demo');
        if (btnDemo) {
            btnDemo.onclick = async () => {
                const demo = DEMO_SEQUENCES['fungi-its'];
                const input = document.getElementById('main-sequence-input');
                if (input) input.value = `>${demo.name}\n${demo.sequence}`;
                await this.handleSequenceInput(false);
                navigateTo('analyze-identify');
                await this.runIdentificationPipeline('fungi-its');
            };
        }
    }

    // 18S Eukaryotic Events
    bind18SEvents() {
        const btnCopy = document.getElementById('btn-18s-copy-fasta');
        if (btnCopy) {
            btnCopy.onclick = () => {
                if (!this.currentSequence) return alert('No sequence loaded');
                navigator.clipboard.writeText(`>${this.currentSequence.name}\n${this.currentSequence.sequence}`);
                alert('18S FASTA copied!');
            };
        }

        const btnSearch = document.getElementById('btn-18s-run-search');
        if (btnSearch) {
            btnSearch.onclick = async () => {
                navigateTo('analyze-identify');
                await this.runIdentificationPipeline('eukaryotes-18s');
            };
        }

        const btnDemo = document.getElementById('btn-18s-load-demo');
        if (btnDemo) {
            btnDemo.onclick = async () => {
                const demo = DEMO_SEQUENCES['eukaryotes-18s'];
                const input = document.getElementById('main-sequence-input');
                if (input) input.value = `>${demo.name}\n${demo.sequence}`;
                await this.handleSequenceInput(false);
                navigateTo('analyze-identify');
                await this.runIdentificationPipeline('eukaryotes-18s');
            };
        }
    }

    // Virus Events
    bindVirusEvents() {
        const btnCopy = document.getElementById('btn-virus-copy-fasta');
        if (btnCopy) {
            btnCopy.onclick = () => {
                if (!this.currentSequence) return alert('No sequence loaded');
                navigator.clipboard.writeText(`>${this.currentSequence.name}\n${this.currentSequence.sequence}`);
                alert('Viral FASTA copied!');
            };
        }

        const btnSearch = document.getElementById('btn-virus-run-search');
        if (btnSearch) {
            btnSearch.onclick = async () => {
                navigateTo('analyze-identify');
                await this.runIdentificationPipeline('viruses');
            };
        }

        const btnDemo = document.getElementById('btn-virus-load-demo');
        if (btnDemo) {
            btnDemo.onclick = async () => {
                const demo = DEMO_SEQUENCES['viruses'];
                const input = document.getElementById('main-sequence-input');
                if (input) input.value = `>${demo.name}\n${demo.sequence}`;
                await this.handleSequenceInput(false);
                navigateTo('analyze-identify');
                await this.runIdentificationPipeline('viruses');
            };
        }
    }

    // Unknown Sequence Pipeline Events
    bindUnknownEvents() {
        const btnRun = document.getElementById('btn-run-unknown-investigate');
        if (btnRun) {
            btnRun.onclick = async () => {
                if (!this.currentSequence) {
                    await this.handleSequenceInput(false);
                }
                if (!this.currentSequence) return alert('Please load a sequence in the Home tab first.');
                
                navigateTo('analyze-identify');
                await this.runIdentificationPipeline('auto');
            };
        }
    }

    // GeneTrace Reference Search & Identification Engine
    async runIdentificationPipeline(preferredMarker = null) {
        if (this.isIdentifying) return;
        this.isIdentifying = true;
        try {
            if (!this.currentSequence) {
                const inputVal = document.getElementById('main-sequence-input')?.value.trim();
                if (inputVal) {
                    await this.handleSequenceInput(false);
                } else {
                    // Load E. coli default
                    const demo = DEMO_SEQUENCES['bacteria-16s'];
                    const input = document.getElementById('main-sequence-input');
                    if (input) input.value = `>${demo.name}\n${demo.sequence}`;
                    await this.handleSequenceInput(false);
                }
            }

            if (!this.currentSequence) return;

            const seq = this.currentSequence.sequence;
            const seqName = this.currentSequence.name || 'Query_Sample';

            // Update active sequence display header
            const nameDisp = document.getElementById('id-seq-name-display');
            const lenDisp = document.getElementById('id-seq-len-display');
            const gcDisp = document.getElementById('id-seq-gc-display');
            const typeDisp = document.getElementById('id-seq-type-display');
            const statusDisp = document.getElementById('id-engine-status');

            if (nameDisp) nameDisp.textContent = `Active Query: ${seqName}`;
            if (lenDisp) lenDisp.textContent = `${seq.length} bp`;
            if (gcDisp) gcDisp.textContent = `GC: ${(this.currentStats?.gcPercent || 50).toFixed(1)}%`;
            if (typeDisp) typeDisp.textContent = this.currentValidation?.type || 'DNA';
            if (statusDisp) {
                statusDisp.innerHTML = `<span class="status-dot green"></span> Aligning against reference database...`;
            }

            // Determine marker
            const markerSelect = document.getElementById('id-marker-select');
            let marker = preferredMarker || (markerSelect ? markerSelect.value : 'auto');
            if (preferredMarker && markerSelect) {
                markerSelect.value = preferredMarker;
            }

            let chosenCategory = marker;
            if (marker === 'auto') {
                const recommendation = analyzeAndRecommend(seq, this.currentStats);
                const recId = recommendation.recommendedWorkflow?.id || 'sixteen-s';
                const categoryMap = {
                    'sixteen-s': 'bacteria-16s',
                    'its': 'fungi-its',
                    'eighteen-s': 'eukaryotes-18s',
                    'virus': 'viruses',
                    'unknown': 'bacteria-16s'
                };
                chosenCategory = categoryMap[recId] || 'bacteria-16s';
            }

            const candContainer = document.getElementById('id-candidates-container');
            if (candContainer) {
                candContainer.innerHTML = `
                    <div style="padding:2rem; text-align:center; color:var(--text-muted);">
                        <div style="margin-bottom:0.5rem; font-size:1.1rem;">⏳ Aligning against ${chosenCategory} reference database...</div>
                        <div style="font-size:0.85rem;">Executing dynamic programming semi-global pairwise alignment</div>
                    </div>
                `;
            }

            const refs = await this.dbManager.loadMarkerGroup(chosenCategory);
            if (!refs || refs.length === 0) {
                if (candContainer) {
                    candContainer.innerHTML = `<div style="padding:1.5rem; color:var(--warning); text-align:center;">No reference records found for ${chosenCategory}.</div>`;
                }
                return;
            }

            const candidates = searchReferences(seq, refs, { topN: 6 });
            const confidence = evaluateConfidence({
                sequenceObj: this.currentSequence,
                stats: this.currentStats,
                suitability: { suitabilityScore: 95 },
                candidates,
                markerType: chosenCategory
            });

            this.currentIdentificationResult = {
                sequence: this.currentSequence,
                markerCategory: chosenCategory,
                candidates,
                confidence,
                refs,
                topCandidate: candidates[0] || null
            };
            this.selectedCandidateIndex = 0;

            if (statusDisp) {
                statusDisp.innerHTML = `<span class="status-dot green"></span> Reference Engine: ${candidates.length} match(es) identified in ${chosenCategory}`;
            }

            this.renderIdentificationResults(this.currentIdentificationResult);
        } catch (err) {
            console.error('Identification pipeline execution error:', err);
            const candContainer = document.getElementById('id-candidates-container');
            if (candContainer) {
                candContainer.innerHTML = `<div style="padding:1.5rem; color:var(--danger); text-align:center;">Alignment error: ${err.message}</div>`;
            }
        } finally {
            this.isIdentifying = false;
        }
    }

    renderIdentificationResults(result) {
        if (!result) return;

        // 1. Left Column: Query Profile
        const profileContainer = document.getElementById('id-query-profile-content');
        if (profileContainer) {
            profileContainer.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:0.4rem;">
                    <div><strong>Sequence:</strong> ${result.sequence.name || 'Query_Sample'}</div>
                    <div><strong>Length:</strong> ${result.sequence.sequence.length} bp</div>
                    <div><strong>GC Content:</strong> ${(this.currentStats?.gcPercent || 50).toFixed(1)}%</div>
                    <div><strong>IUPAC Ambiguity:</strong> ${(this.currentStats?.ambiguousPercent || 0).toFixed(2)}%</div>
                    <div><strong>Locus / Category:</strong> <span class="badge" style="background:var(--accent-light); color:var(--accent-primary); font-size:0.75rem;">${result.markerCategory}</span></div>
                </div>
            `;
        }

        // 2. Left Column: Candidate Table
        const countBadge = document.getElementById('id-candidate-count-badge');
        if (countBadge) countBadge.textContent = `${result.candidates.length} candidate(s)`;

        const candContainer = document.getElementById('id-candidates-container');
        if (candContainer) {
            if (result.candidates.length === 0) {
                candContainer.innerHTML = `
                    <div style="padding:1.5rem; text-align:center; color:var(--warning); border:1px dashed var(--border-color); border-radius:var(--radius-md);">
                        No reference sequence matched above the minimum 70% identity threshold.
                    </div>
                `;
            } else {
                candContainer.innerHTML = `
                    <table class="data-table id-candidates-table" style="width:100%; font-size:0.85rem; border-collapse:collapse;">
                        <thead>
                            <tr style="border-bottom:1px solid var(--border-color); text-align:left;">
                                <th style="padding:6px 8px; width:28px;">#</th>
                                <th style="padding:6px 8px;">Organism / Taxon</th>
                                <th style="padding:6px 8px;">Identity</th>
                                <th style="padding:6px 8px;">Coverage</th>
                                <th style="padding:6px 8px;">Score</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${result.candidates.map((c, idx) => `
                                <tr class="${idx === this.selectedCandidateIndex ? 'active-candidate' : ''}" data-cand-idx="${idx}" style="cursor:pointer; border-bottom:1px solid var(--border-color);">
                                    <td style="padding:6px 8px;"><strong>${c.rank}</strong></td>
                                    <td style="padding:6px 8px;">
                                        <strong><em>${c.organism}</em></strong>
                                        <div style="font-size:0.72rem; color:var(--text-muted);">${c.accession} | ${c.marker}</div>
                                    </td>
                                    <td style="padding:6px 8px;"><strong style="color:${c.identity >= 99 ? 'var(--success)' : (c.identity >= 98 ? 'var(--accent-primary)' : 'var(--text-primary)')};">${c.identity}%</strong></td>
                                    <td style="padding:6px 8px;">${c.coverage}%</td>
                                    <td style="padding:6px 8px;">${c.score}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;

                candContainer.querySelectorAll('tr[data-cand-idx]').forEach(tr => {
                    tr.addEventListener('click', () => {
                        const idx = parseInt(tr.getAttribute('data-cand-idx'), 10);
                        this.selectCandidate(idx);
                    });
                });
            }
        }

        // Render detail for active candidate
        const activeCand = result.candidates[this.selectedCandidateIndex] || result.topCandidate;
        this.renderCandidateDetail(activeCand);
    }

    renderCandidateDetail(cand) {
        // 1. Center Column: Probable ID Card
        const probableCard = document.getElementById('id-probable-card');
        const probableContent = document.getElementById('id-probable-content');
        if (probableContent) {
            if (!cand) {
                probableContent.innerHTML = `
                    <div style="padding:2rem; text-align:center; color:var(--text-muted);">
                        <p style="font-size:1.1rem; color:var(--warning);">⚠️ Insufficient Evidence</p>
                        <p style="font-size:0.9rem;">No candidate match exceeded similarity thresholds in this marker category.</p>
                    </div>
                `;
            } else {
                probableContent.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem;">
                        <div>
                            <span style="font-size:0.8rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-muted); font-weight:600;">Probable Identification & Top Match</span>
                            <h3 style="margin:0.25rem 0 0 0; font-size:1.45rem; color:var(--text-primary);">
                                <em>${cand.organism}</em>
                            </h3>
                            <div style="display:flex; gap:0.5rem; align-items:center; margin-top:0.5rem; flex-wrap:wrap;">
                                <span class="badge" style="background:var(--bg-tertiary); font-weight:600;">NCBI RefSeq: ${cand.accession}</span>
                                <span class="badge" style="background:${cand.identity >= 99 ? 'var(--success)' : 'var(--accent-primary)'}; color:#fff; font-weight:700;">${cand.identity}% Match</span>
                                <span class="badge badge-beta" style="font-weight:700;">${this.currentIdentificationResult?.confidence?.level || 'EVALUATED'}</span>
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <span style="font-size:0.8rem; color:var(--text-muted);">Alignment Score</span>
                            <div style="font-size:1.3rem; font-weight:700; color:var(--accent-primary);">${cand.score}</div>
                        </div>
                    </div>
                    <div style="background:var(--bg-secondary); padding:0.75rem 1rem; border-radius:var(--radius-md); font-size:0.85rem; line-height:1.5; margin-top:1rem;">
                        <div><strong>Taxonomy:</strong> ${cand.taxonomy?.genus || ''} ${cand.taxonomy?.species || ''} (Family: ${cand.taxonomy?.family || 'N/A'}, Phylum: ${cand.taxonomy?.phylum || 'N/A'})</div>
                        <div style="margin-top:0.25rem; color:var(--text-secondary);">
                            <strong>Marker Target:</strong> ${cand.marker} | <strong>Aligned Region:</strong> ${cand.alignmentLength} bp (${cand.matches} matches, ${cand.mismatches} mismatches, ${cand.gaps} gaps)
                        </div>
                    </div>
                `;
            }
        }

        // 2. Center Column: 3D Model
        if (cand) {
            const group = this.getOrganismGroup(cand);
            const morphLabel = document.getElementById('id-3d-morph-label');
            if (morphLabel) morphLabel.textContent = `Morphology: ${group.replace(/-/g, ' ')}`;

            try {
                if (!this.idOrganismViewer) {
                    this.idOrganismViewer = new OrganismViewer('id-3d-canvas-container', { width: 440, height: 260, interactive: true });
                    this.idOrganismViewer.init().then(() => {
                        this.idOrganismViewer.showOrganism(group, cand.organism, true);
                    }).catch(() => {
                        this.idOrganismViewer.showOrganism(group, cand.organism, false);
                    });
                } else {
                    this.idOrganismViewer.showOrganism(group, cand.organism, true);
                }
            } catch (e) {
                console.warn('3D Organism preview error:', e);
            }
        }

        // 3. Center Column: Pairwise Alignment Viewer
        const alnMetrics = document.getElementById('id-alignment-metrics');
        const alnViewer = document.getElementById('id-alignment-viewer');
        if (alnMetrics && cand) {
            alnMetrics.innerHTML = `
                <span class="badge" style="background:var(--bg-tertiary);">ID: ${cand.identity}%</span>
                <span class="badge" style="background:var(--bg-tertiary);">Cov: ${cand.coverage}%</span>
                <span class="badge" style="background:var(--bg-tertiary);">Mismatches: ${cand.mismatches}</span>
                <span class="badge" style="background:var(--bg-tertiary);">Gaps: ${cand.gaps}</span>
            `;
        }
        if (alnViewer) {
            if (cand && cand.alignment) {
                const formatted = this.formatAlignmentBlock(
                    cand.alignment.alignedQuery,
                    cand.alignment.matchLine,
                    cand.alignment.alignedRef,
                    cand.alignment.queryStart,
                    cand.alignment.refStart
                );
                alnViewer.textContent = formatted;
            } else {
                alnViewer.textContent = 'No alignment available.';
            }
        }

        // 4. Right Column: Taxonomic Ladder
        const taxContainer = document.getElementById('id-taxonomy-container');
        if (taxContainer) {
            if (cand && cand.taxonomy) {
                const ranks = ['superkingdom', 'domain', 'kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species'];
                const items = ranks.filter(r => cand.taxonomy[r]).map(r => `
                    <div class="tax-item" style="display:flex; justify-content:space-between; padding:4px 8px; background:var(--bg-secondary); border-radius:var(--radius-sm); border:1px solid var(--border-color); font-size:0.85rem;">
                        <span class="rank" style="color:var(--text-muted); font-size:0.75rem; text-transform:uppercase;">${r}</span>
                        <span class="name" style="font-weight:600;"><em>${cand.taxonomy[r]}</em></span>
                    </div>
                `).join('');
                taxContainer.innerHTML = items || '<p style="color:var(--text-muted); font-size:0.85rem;">Lineage data not available for this record.</p>';
            } else {
                taxContainer.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem;">Select a candidate to view taxonomic lineage.</p>';
            }
        }

        // 5. Right Column: Scientific Confidence Card
        const confBadge = document.getElementById('id-confidence-badge');
        const confContainer = document.getElementById('id-confidence-container');
        const conf = this.currentIdentificationResult?.confidence;
        if (confBadge && conf) {
            confBadge.textContent = conf.level;
            confBadge.className = 'badge';
            if (conf.level === 'HIGH') confBadge.style.background = 'var(--success)';
            else if (conf.level === 'MODERATE') confBadge.style.background = 'var(--accent-primary)';
            else if (conf.level === 'LOW') confBadge.style.background = 'var(--warning)';
            else confBadge.style.background = 'var(--danger)';
            confBadge.style.color = '#fff';
        }
        if (confContainer && conf) {
            confContainer.innerHTML = `
                <div style="font-size:0.85rem; line-height:1.5;">
                    <div style="font-weight:600; margin-bottom:0.5rem; color:var(--text-primary);">${conf.title}</div>
                    <ul style="padding-left:1.2rem; color:var(--text-secondary); margin:0;">
                        ${conf.reasons.map(r => `<li style="margin-bottom:0.35rem;">${r}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        // 6. Right Column: Limitations & Confirmation
        const limitContainer = document.getElementById('id-limitations-container');
        if (limitContainer && conf) {
            limitContainer.innerHTML = `
                <ul style="padding-left:1.2rem; margin:0 0 0.75rem 0; font-size:0.82rem;">
                    ${conf.limitations.map(l => `<li style="margin-bottom:0.35rem;">${l}</li>`).join('')}
                </ul>
                <div style="background:var(--bg-tertiary); padding:0.5rem 0.75rem; border-radius:var(--radius-sm); font-size:0.8rem;">
                    <strong>Recommended Polyphasic Steps:</strong> Sanger bidirectional resequencing, MALDI-TOF MS, whole-genome ANI (threshold >=95-96%), and biochemical profiling.
                </div>
            `;
        }
    }

    selectCandidate(idx) {
        if (!this.currentIdentificationResult || !this.currentIdentificationResult.candidates[idx]) return;
        this.selectedCandidateIndex = idx;
        const cand = this.currentIdentificationResult.candidates[idx];
        this.renderCandidateDetail(cand);

        // Update active row highlighting
        document.querySelectorAll('.id-candidates-table tr[data-cand-idx]').forEach(tr => {
            const rowIdx = parseInt(tr.getAttribute('data-cand-idx'), 10);
            if (rowIdx === idx) {
                tr.classList.add('active-candidate');
            } else {
                tr.classList.remove('active-candidate');
            }
        });
    }

    buildPhylogenyFromReferences() {
        if (!this.currentIdentificationResult || !this.currentIdentificationResult.candidates || this.currentIdentificationResult.candidates.length === 0) {
            alert('Please run identification first to find candidate reference hits.');
            return;
        }

        const container = document.getElementById('id-tree-container');
        if (container) {
            container.innerHTML = '<div style="padding:1.5rem; text-align:center; color:var(--text-muted);">Constructing pairwise distance matrix and clustering UPGMA tree...</div>';
        }

        try {
            const queryName = (this.currentSequence.name || 'Query_Isolate').replace(/[\s(),:]+/g, '_');
            const treeData = buildPhylogeneticTreeFromReferences(
                queryName,
                this.currentSequence.sequence,
                this.currentIdentificationResult.candidates,
                this.currentIdentificationResult.refs || []
            );

            const parsedTree = parseNewick(treeData.newick);
            renderSVGTree('id-tree-container', parsedTree, treeData.queryName);
        } catch (err) {
            console.error('Tree building error:', err);
            if (container) {
                container.innerHTML = `<div style="padding:1.5rem; color:var(--danger); text-align:center;">Tree generation failed: ${err.message}</div>`;
            }
        }
    }

    addIdentificationToEvidence() {
        if (!this.currentIdentificationResult || !this.currentIdentificationResult.topCandidate) {
            alert('No identification result to add.');
            return;
        }
        const top = this.currentIdentificationResult.topCandidate;
        const conf = this.currentIdentificationResult.confidence;
        this.evidenceEngine.addEvidence(
            'TAXONOMIC_CONSISTENCY',
            `Molecular ID: ${top.organism} (${top.identity}% ID)`,
            top.marker,
            conf.level === 'HIGH' ? 'STRONG' : (conf.level === 'MODERATE' ? 'MODERATE' : 'WEAK'),
            `Aligned against GenBank/RefSeq reference ${top.accession} with ${top.identity}% identity and ${top.coverage}% query coverage.`,
            conf.limitations.join('; ')
        );
        this.evidenceEngine.renderEvidenceBoard('evidence-board');
        alert(`Added identification for "${top.organism}" to Evidence Board!`);
    }

    formatAlignmentBlock(alignedQuery, matchLine, alignedRef, qStart = 1, rStart = 1, blockSize = 60) {
        if (!alignedQuery || !alignedRef) return 'No alignment data available.';
        let out = '';
        let currentQ = qStart;
        let currentR = rStart;

        for (let pos = 0; pos < alignedQuery.length; pos += blockSize) {
            const qChunk = alignedQuery.substring(pos, pos + blockSize);
            const mChunk = matchLine.substring(pos, pos + blockSize);
            const rChunk = alignedRef.substring(pos, pos + blockSize);

            const qNonGaps = (qChunk.match(/[^-]/g) || []).length;
            const rNonGaps = (rChunk.match(/[^-]/g) || []).length;

            const nextQ = qNonGaps > 0 ? (currentQ + qNonGaps - 1) : currentQ;
            const nextR = rNonGaps > 0 ? (currentR + rNonGaps - 1) : currentR;

            out += `Query  ${String(currentQ).padStart(5, ' ')}  ${qChunk}  ${nextQ}\n`;
            out += `              ${mChunk}\n`;
            out += `Sbjct  ${String(currentR).padStart(5, ' ')}  ${rChunk}  ${nextR}\n\n`;

            currentQ += qNonGaps;
            currentR += rNonGaps;
        }
        return out;
    }

    getOrganismGroup(cand) {
        const org = (cand?.organism || '').toLowerCase();
        const marker = (cand?.marker || '').toLowerCase();
        if (org.includes('bacillus') || org.includes('staphylococcus') || org.includes('streptococcus') || org.includes('lactobacillus') || org.includes('mycobacterium')) {
            return 'gram-positive';
        }
        if (marker.includes('archaea') || org.includes('methanocaldococcus') || org.includes('halobacterium') || org.includes('sulfolobus')) {
            return 'bacterium';
        }
        if (org.includes('saccharomyces') || org.includes('candida') || org.includes('cryptococcus')) {
            return 'yeast';
        }
        if (org.includes('aspergillus') || org.includes('penicillium')) {
            return 'filamentous-fungus';
        }
        if (org.includes('tetrahymena') || org.includes('dictyostelium') || org.includes('paramecium')) {
            return 'protozoan';
        }
        if (org.includes('chlamydomonas') || org.includes('chlorella')) {
            return 'microalgae';
        }
        if (org.includes('phage') || org.includes('lambda') || org.includes('t4')) {
            return 'bacteriophage';
        }
        if (org.includes('virus') || org.includes('sars') || org.includes('influenza') || org.includes('hiv')) {
            return 'ssRNA-virus';
        }
        return 'gram-negative';
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

    async handleSequenceInput(autoNavigate = true) {
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
            
            if (autoNavigate) {
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
            }

        } catch (error) {
            console.error('Sequence parse error:', error);
            alert('Error parsing sequence: ' + error.message);
        }
    }

    async handleIdentifySequence() {
        await this.handleSequenceInput(false);
        if (!this.currentSequence) return;
        navigateTo('analyze-identify');
        await this.runIdentificationPipeline();
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
function initApp() {
    if (!window.GeneTrace) {
        window.GeneTrace = new GeneTraceApp();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
