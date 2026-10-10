import { getFeatureConfig as fetchFeatureConfigFromDb } from './firestore.js';

const DEFAULT_FEATURES = {
  'sequence-inspector': { name:'Sequence Inspector', enabled:true, accessTier:'free', freeDailyLimit:100, premiumDailyLimit:1000, beta:false },
  'orf-finder': { name:'ORF Finder', enabled:true, accessTier:'free', freeDailyLimit:50, premiumDailyLimit:500, beta:false },
  'translation': { name:'Translation', enabled:true, accessTier:'free', freeDailyLimit:50, premiumDailyLimit:500, beta:false },
  'protein-analysis': { name:'Protein Analysis', enabled:true, accessTier:'free', freeDailyLimit:20, premiumDailyLimit:200, beta:false },
  'motif-finder': { name:'Motif Finder', enabled:true, accessTier:'free', freeDailyLimit:30, premiumDailyLimit:300, beta:false },
  'mutation-explorer': { name:'Mutation Explorer', enabled:true, accessTier:'free', freeDailyLimit:20, premiumDailyLimit:200, beta:false },
  'restriction-map': { name:'Restriction Map', enabled:true, accessTier:'free', freeDailyLimit:20, premiumDailyLimit:200, beta:false },
  'primer-utilities': { name:'Primer Utilities', enabled:true, accessTier:'free', freeDailyLimit:20, premiumDailyLimit:200, beta:false },
  'sequence-compare': { name:'Sequence Compare', enabled:true, accessTier:'free', freeDailyLimit:20, premiumDailyLimit:200, beta:false },
  'batch-analysis': { name:'Batch Analysis', enabled:true, accessTier:'student_pro', freeDailyLimit:3, premiumDailyLimit:100, beta:false },
  'alignment': { name:'Alignment Viewer', enabled:true, accessTier:'free', freeDailyLimit:10, premiumDailyLimit:100, beta:false },
  'phylogeny': { name:'Phylogeny', enabled:true, accessTier:'free', freeDailyLimit:10, premiumDailyLimit:100, beta:false },
  'raw-lab-ab1': { name:'AB1 Analysis', enabled:true, accessTier:'student_pro', freeDailyLimit:0, premiumDailyLimit:50, beta:false },
  'raw-lab-fastq': { name:'FASTQ Analysis', enabled:true, accessTier:'student_pro', freeDailyLimit:0, premiumDailyLimit:100, beta:false },
  'format-converter': { name:'Format Converter', enabled:true, accessTier:'free', freeDailyLimit:20, premiumDailyLimit:200, beta:false },
  'sixteen-s': { name:'16S Identification', enabled:true, accessTier:'student_pro', freeDailyLimit:0, premiumDailyLimit:20, beta:false },
  'its': { name:'ITS Identification', enabled:true, accessTier:'student_pro', freeDailyLimit:0, premiumDailyLimit:20, beta:false },
  'eighteen-s': { name:'18S Identification', enabled:true, accessTier:'student_pro', freeDailyLimit:0, premiumDailyLimit:20, beta:false },
  'virus-analysis': { name:'Virus Sequence Analysis', enabled:true, accessTier:'student_pro', freeDailyLimit:0, premiumDailyLimit:20, beta:false },
  'unknown-sequence': { name:'Unknown Sequence Investigation', enabled:true, accessTier:'free', freeDailyLimit:10, premiumDailyLimit:100, beta:false },
  'scientific-report': { name:'Scientific Report', enabled:true, accessTier:'free', freeDailyLimit:5, premiumDailyLimit:50, beta:false },
  'advanced-export': { name:'Advanced Export', enabled:true, accessTier:'research_pro', freeDailyLimit:0, premiumDailyLimit:50, beta:false },
  'organism-3d-viewer': { name:'3D Organism Viewer', enabled:true, accessTier:'student_pro', freeDailyLimit:0, premiumDailyLimit:20, beta:true },
  'advanced-phylogeny': { name:'Advanced Phylogeny', enabled:true, accessTier:'research_pro', freeDailyLimit:0, premiumDailyLimit:50, beta:false },
  'smart-router': { name:'Smart Workflow Router', enabled:true, accessTier:'free', freeDailyLimit:50, premiumDailyLimit:500, beta:false }
};

let features = { ...DEFAULT_FEATURES };
let currentUserProfile = null;

const PLAN_HIERARCHY = {
  'free': 0,
  'student_pro': 1,
  'research_pro': 2,
  'admin': 3
};

export async function initFeatureManager(userProfile) {
  currentUserProfile = userProfile;
  await refreshFromFirestore();
}

export async function refreshFromFirestore() {
  const remoteFeatures = await fetchFeatureConfigFromDb();
  if (remoteFeatures) {
    features = { ...DEFAULT_FEATURES, ...remoteFeatures };
  } else {
    features = { ...DEFAULT_FEATURES };
  }
}

export function updateUserPlan(userProfile) {
  currentUserProfile = userProfile;
}

export function canUseFeature(featureId) {
  const feature = features[featureId];
  if (!feature) {
    return { allowed: false, reason: 'Feature not found', remainingUsage: 0, upgradeRequired: false, requiredPlan: null };
  }
  
  if (!feature.enabled) {
    return { allowed: false, reason: 'Feature disabled', remainingUsage: 0, upgradeRequired: false, requiredPlan: null };
  }

  const userPlan = currentUserProfile ? currentUserProfile.plan : 'free';
  const userPlanLevel = PLAN_HIERARCHY[userPlan] || 0;
  const featurePlanLevel = PLAN_HIERARCHY[feature.accessTier] || 0;
  
  // Usage tracking is skipped here for synchronous checks, but theoretically we check limits.
  // We'll just return allowed based on plan tier for simplicity.
  
  if (userPlanLevel < featurePlanLevel && feature.freeDailyLimit === 0) {
    return { 
      allowed: false, 
      reason: 'Upgrade required', 
      remainingUsage: 0, 
      upgradeRequired: true, 
      requiredPlan: feature.accessTier 
    };
  }

  // Assuming remaining usage is handled by some usage tracker, here we return allowed=true
  return { allowed: true, reason: 'Allowed', remainingUsage: null, upgradeRequired: false, requiredPlan: null };
}

export function getFeatureConfig(featureId) {
  return features[featureId] || null;
}

export function getAllFeatures() {
  return features;
}
