import { BUILD_INFO } from './build.js';
import { enrichPlayers } from './modules/player-database.js';

const STORAGE_KEY = 'vale_tennis_manager_save';
const LEGACY_KEYS = ['ace_academy_save_v040', 'ace-manager-save'];
const BACKUP_KEY = 'vale_tennis_manager_save_backup';
const CORRUPT_KEY = 'vale_tennis_manager_corrupt_save';
const CURRENT_SCHEMA = 38;

const clone = (value) => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));

export function buildInitialState(content) {
  const academy = clone(content.academyDefaults);
  const staff = { Tecnico: null, 'Preparador Fisico': null, Fisioterapeuta: null, Psicologo: null, Nutricionista: null, Analista: null, Scouting: null, Financeiro: null };
  const roster = enrichPlayers(content.starterRoster).map(player => ({
    ...player, morale: 72, fatigue: 8, injuries: 0,
    salary: 1800 + Math.round(player.overall * 25), isUser: true,
    health: 100, injuredWeeks: 0, lastResult: 'Sem jogos'
  }));
  const ranking = [
    ...enrichPlayers(content.rankingSeed).map(p => ({ ...p, isUser: false })),
    ...roster.map((p, i) => ({ rank: content.rankingSeed.length + i + 1, name: p.name,
      country: p.country, points: p.rankingPoints, overall: p.overall, age: p.age,
      style: p.style, playerId: p.id, isUser: true }))
  ];
  return {
    version: BUILD_INFO.version,
    meta: { schemaVersion: CURRENT_SCHEMA, version: BUILD_INFO.version, build: BUILD_INFO.build,
      builtAt: BUILD_INFO.builtAt, migratedAt: null, createdAt: new Date().toISOString() },
    academy: { ...academy, bankruptcyWarnings: 0, owner: null, careerProfile: null }, roster, ranking,
    calendar: content.calendar, marketTalents: content.marketTalents, staffMarket: content.staffMarket,
    staff, match: null, activeTournament: null,
    logs: ['Nova carreira iniciada. Sua academia está pronta para competir.'],
    summary: ['Semana 1 iniciada. Prioridade mobile, gestão de risco e entrada em torneios.'],
    inbox: [
      { title: 'Board da academia', body: 'Objetivo inicial: colocar um atleta no Top 120 e manter caixa saudável.', week: 1 },
      { title: 'Core Consolidation concluída', body: 'Save protegido, versão sincronizada e estrutura preparada para os próximos upgrades.', week: 1 }
    ],
    sponsorOffers: [], objectives: { current: 'Entrar no Top 120' },
    worldTour: { weeklyResults: [], rankingHistory: [], lastSimulatedWeek: 0, lastSimulatedSeason: academy.season },
    trainingLab: { cycle: 'balanced', autoApply: true, lastProcessedWeek: 0, lastReport: [], plans: Object.fromEntries(roster.map(p => [p.id, { focus: 'balanced', intensity: 'moderate' }])) },
    tournamentDraws: {}, tournamentLife: { championHistory: [], drawAudit: [], lastViewedDraw: null }, flags: { ownerSetupComplete: false, safeMode: false }, tournamentIdentity: { spotlightHistory: [], lastViewedEvent: null }, broadcast: { presentationMode: 'pro', replayArchive: [], lastAudit: null }, playerCareer: { weeklyEvents: [], conversations: [], promises: [], lastProcessedToken: null }, tacticalIntelligence: { plan: { serveTarget: 'body', rallyPlan: 'balanced', attackPattern: 'weakness', returnPlan: 'secondServePressure', riskMode: 'balanced' }, history: [], lastAppliedWeek: 0, analyst: 'Plano equilibrado ativo.' }, visualAcademy: { activeScene: 'office', lastViewedScene: 'office', environmentAudit: [], premiumMode: true }, newsroom: { items: [], pressQuestions: [], sentiment: 62, reputationPulse: 0, lastProcessedToken: null, lastInterviewWeek: 0 }, mobileUX: { mode: 'auto', compact: false, oneHand: false, matchFocus: true, reduceMotion: false, lastViewport: null, auditLog: [] }, commercialCareer: { ledger: [], activeSponsors: [], sponsorPipeline: [], investorOffers: [], travelBudgetMode: 'balanced', riskScore: 24, cashflowTrend: 0, lastProcessedToken: null, boardConfidence: 64 }, generationalCareer: { seasonHistory: [], retirementLog: [], hallOfFame: [], prospects: [], records: {}, legacyScore: 0, lastProcessedSeason: null, simulationAudit: [] }, releaseCandidate: { readiness: 82, safeMode: false, lastAuditToken: null, auditLog: [], checklist: {}, storeChecklist: {}, legal: { privacyOffline: true, creditsReady: true, dataSale: false }, stress: { weeksProjected: 52, status: 'pending', issues: [] } }, qualityPolish: { score: 88, lastAuditToken: null, auditLog: [], issues: [], deviceMatrix: ['320x568','360x640','390x844','412x915','tablet','desktop'], checks: { tapTargets: true, scrollSafety: true, assetFallbacks: true, saveRecovery: true, legalAccess: true }, safeLaunchMode: true }, releaseHardening: { score: 90, lastAuditToken: null, auditLog: [], cacheStatus: 'pending', diagnostics: [], recoveryMode: 'guarded', pwaResetRecommended: false, startupChecks: { buildVisible: true, saveWritable: true, cacheVersioned: true, mobileSafeArea: true, fallbackAssets: true } }, performanceDelivery: { score: 91, mode: 'balanced', lastAuditToken: null, auditLog: [], assetDiagnostics: [], warmupComplete: false, liteMode: false, runtimeHints: { lazyImages: true, asyncDecode: true, criticalAssets: 4, lastHydratedImages: 0, missingAssets: 0 } }, qaAutomation: { score: 92, lastRunToken: null, auditLog: [], smokeResults: [], screenResults: [], saveSnapshots: [], exportReady: false, publicTestMode: false, checklist: { boot: true, tabs: true, save: true, mobile: true, pwa: true, legal: true, performance: true } }, browserCompatibility: { score: 93, lastAuditToken: null, auditLog: [], installDiagnostics: [], compatibilityMatrix: [], installMode: 'auto', lastUserAgent: '', environment: { serviceWorker: false, standalone: false, touch: true, storage: true, online: true, viewportStable: true }, flags: { iosSafari: false, androidChrome: false, desktopChrome: false, pwaInstalled: false } }, inputReliability: { score: 94, lastAuditToken: null, auditLog: [], gestureDiagnostics: [], keyboardDiagnostics: [], scrollDiagnostics: [], safePreset: false, environment: { touch: true, pointer: 'coarse', viewportLocked: true, scrollUnlocked: true, keyboardSafe: true, passiveListeners: true }, flags: { stickyScrollGuard: true, tapTargetGuard: true, keyboardGuard: true, orientationGuard: true } }, accessibilityReadability: { score: 95, mode: 'auto', largeText: false, highContrast: false, readingMode: false, reducedTransparency: false, focusRing: true, ariaAudit: [], readabilityAudit: [], lastAuditToken: null, exportReady: false, environment: { colorScheme: 'dark', reducedMotion: false, textScale: 1, contrast: 'normal', focusVisible: true }, flags: { contrastGuard: true, textScaleGuard: true, focusGuard: true, ariaGuard: true } }, localizationStore: { score: 96, activeLocale: 'pt-BR', fallbackLocale: 'pt-BR', supportedLocales: ['pt-BR','en','es'], textCoverage: { 'pt-BR': 100, en: 78, es: 74 }, storeReadiness: { titleReady: true, descriptionReady: true, screenshotsPending: true, legalReady: true, ageRatingPending: true }, auditLog: [], exportReady: false, lastAuditToken: null, preview: { title: 'Vale Games Tennis Manager', subtitle: 'Academia internacional de tênis', storeShort: 'Gerencie atletas, torneios, patrocínios e legado em uma carreira mobile-first.' }, flags: { localeGuard: true, storeCopyGuard: true, fallbackGuard: true, exportGuard: true } }, releaseNotesHelp: { score: 97, firstRunSeen: false, activeGuide: 'quickstart', releaseNotesSeenBuild: null, helpArticles: [], onboardingChecklist: { createCareer: false, trainPlayer: false, playMatch: false, reviewEconomy: false, runQA: false }, auditLog: [], exportReady: false, lastAuditToken: null, flags: { offlineHelp: true, releaseNotesGuard: true, firstRunGuide: true, supportExport: true } }, onboardingReliability: { score: 98, lastAuditToken: null, auditLog: [], buttonProbe: [], forcedOpens: 0, lastForcedReason: null, safeStartLocks: 0, modalVisibilityChecks: [], checklist: { setupModal: true, avatarChoices: true, ownerSaveButton: true, tabDelegation: true, dockDelegation: true, dashboardRecovery: true }, flags: { mandatorySetupGuard: true, eventDelegationFallback: true, hashRouter: true, modalRetry: true, buttonProbe: true } }, careerCreationUX: { score: 100, setupAttempts: 0, avatarTouchCount: 0, saveButtonChecks: [], lastAuditToken: null, auditLog: [], lastSelectedAvatar: null, firstRunVerified: false, buttonGuardActive: true, flags: { stickyModalFooter: true, delegatedAvatarTap: true, saveButtonGuard: true, defaultValueGuard: true, dashboardBlocker: true } }, cacheUpdateGuard: { score: 99, previousBuild: null, currentBuild: BUILD_INFO.build, lastSeenBuild: null, staleDetected: false, firstRunConfirmed: false, serviceWorkerStatus: 'pending', cacheKeys: [], auditLog: [], clearCount: 0, reloadCount: 0, flags: { serviceWorkerRegister: true, cacheBustAssets: true, visibleBuildGate: true, forceFreshJson: true } }, mandatoryCareerGate: { score: 100, locked: true, lastAuditToken: null, auditLog: [], blockedTabs: 0, repairCount: 0, lastRepairReason: null, firstRunGatePassed: false, flags: { blockEmptyDashboard: true, requireOwnerProfile: true, requirePlayableCore: true, openModalBeforeGameplay: true, preserveBackupBeforeRepair: true } }, forcedOnboardingGate: { score: 100, hardLock: true, lastAuditToken: null, auditLog: [], forcedLaunches: 0, invalidDashboardBlocks: 0, lastInvalidReason: null, firstRunConfirmed: false, lastRepairAt: null, flags: { forceFullScreenSetup: true, blockDashboardWhenInvalid: true, validateBeforeRender: true, autoRepairEmptySave: true, cacheAwareLaunch: true } }, onboardingRuntimeProof: { score: 100, lastAuditToken: null, auditLog: [], bootProofs: [], modalProofs: [], lastProofStatus: 'pending', lastUserAgent: '', firstRunVisualConfirmed: false, flags: { runtimeLockOverlay: true, modalVisibilityProof: true, dashboardBlankProof: true, mobileProofExport: true } }, cleanStartWizard: { score: 100, lastAuditToken: null, auditLog: [], deploymentChecks: [], resetBackups: [], staleBuildSeen: false, cleanStartConfirmed: false, lastResetAt: null, flags: { guidedReset: true, deployCheck: true, cacheClear: true, firstRunReopen: true, preserveBackup: true } }, emergencyStartControl: { score: 100, hardResetCount: 0, lastResetAt: null, auditLog: [], routeDetected: null, startupShieldVisible: false, lastExportAt: null, flags: { hardResetRoute: true, standaloneShield: true, cacheBypassUrl: true, backupBeforeReset: true, blockDashboardZeroMetrics: true } }, careerSetupRecovery: { lastReason: null, repairedAt: null, forcedSetup: false, snapshots: [], bootGuard: true }, ui: { currentTab: 'dashboard', lastStableTab: 'dashboard' }
  };
}

function parseSave(raw, sourceKey) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (error) {
    try { localStorage.setItem(CORRUPT_KEY, JSON.stringify({ sourceKey, raw, capturedAt: new Date().toISOString() })); } catch {}
    console.error('Save corrompido preservado para diagnóstico.', error);
    return null;
  }
}

export function migrateSave(data) {
  if (!data || typeof data !== 'object') return null;
  const state = data;
  state.meta ||= {};
  state.meta.schemaVersion = CURRENT_SCHEMA;
  state.meta.version = BUILD_INFO.version;
  state.meta.build = BUILD_INFO.build;
  state.meta.builtAt = BUILD_INFO.builtAt;
  state.meta.migratedAt = new Date().toISOString();
  state.version = BUILD_INFO.version;
  state.logs ||= [];
  state.summary ||= [];
  state.inbox ||= [];
  state.sponsorOffers ||= [];
  state.objectives ||= { current: 'Entrar no Top 120' };
  state.flags ||= {};
  state.ui ||= { currentTab: 'dashboard' };
  state.academy ||= {};
  state.academy.bankruptcyWarnings ??= 0;
  state.academy.owner ??= null;
  state.academy.careerProfile ??= null;
  state.flags.safeMode ??= false;
  state.ui.lastStableTab ??= state.ui.currentTab || 'dashboard';
  state.activeTournament ??= null;
  state.worldTour ||= { weeklyResults: [], rankingHistory: [], lastSimulatedWeek: 0, lastSimulatedSeason: state.academy?.season || 2026 };
  state.worldTour.weeklyResults ||= []; state.worldTour.rankingHistory ||= []; state.worldTour.lastSimulatedWeek ??= 0; state.worldTour.lastSimulatedSeason ??= state.academy?.season || 2026;
  state.trainingLab ||= { cycle: 'balanced', autoApply: true, lastProcessedWeek: 0, lastReport: [], plans: {} };
  state.tournamentIdentity ||= { spotlightHistory: [], lastViewedEvent: null };
  state.tournamentIdentity.spotlightHistory ||= [];
  state.tournamentIdentity.lastViewedEvent ??= null;
  state.tournamentDraws ||= {};
  state.tournamentLife ||= { championHistory: [], drawAudit: [], lastViewedDraw: null };
  state.tournamentLife.championHistory ||= [];
  state.tournamentLife.drawAudit ||= [];
  state.tournamentLife.lastViewedDraw ??= null;
  state.broadcast ||= { presentationMode: 'pro', replayArchive: [], lastAudit: null };
  state.broadcast.replayArchive ||= [];
  state.broadcast.presentationMode ||= 'pro';
  state.playerCareer ||= { weeklyEvents: [], conversations: [], promises: [], lastProcessedToken: null };
  state.playerCareer.weeklyEvents ||= [];
  state.playerCareer.conversations ||= [];
  state.playerCareer.promises ||= [];
  state.playerCareer.lastProcessedToken ??= null;
  state.tacticalIntelligence ||= { plan: { serveTarget: 'body', rallyPlan: 'balanced', attackPattern: 'weakness', returnPlan: 'secondServePressure', riskMode: 'balanced' }, history: [], lastAppliedWeek: 0, analyst: 'Plano equilibrado ativo.' };
  state.tacticalIntelligence.plan ||= { serveTarget: 'body', rallyPlan: 'balanced', attackPattern: 'weakness', returnPlan: 'secondServePressure', riskMode: 'balanced' };
  state.tacticalIntelligence.plan.serveTarget ||= 'body';
  state.tacticalIntelligence.plan.rallyPlan ||= 'balanced';
  state.tacticalIntelligence.plan.attackPattern ||= 'weakness';
  state.tacticalIntelligence.plan.returnPlan ||= 'secondServePressure';
  state.tacticalIntelligence.plan.riskMode ||= 'balanced';
  state.tacticalIntelligence.history ||= [];
  state.tacticalIntelligence.lastAppliedWeek ??= 0;
  state.tacticalIntelligence.analyst ||= 'Plano equilibrado ativo.';
  state.visualAcademy ||= { activeScene: 'office', lastViewedScene: 'office', environmentAudit: [], premiumMode: true };
  state.visualAcademy.activeScene ||= 'office';
  state.visualAcademy.lastViewedScene ||= state.visualAcademy.activeScene;
  state.visualAcademy.environmentAudit ||= [];
  state.visualAcademy.premiumMode ??= true;
  state.newsroom ||= { items: [], pressQuestions: [], sentiment: 62, reputationPulse: 0, lastProcessedToken: null, lastInterviewWeek: 0 };
  state.newsroom.items ||= [];
  state.newsroom.pressQuestions ||= [];
  state.newsroom.sentiment ??= 62;
  state.newsroom.reputationPulse ??= 0;
  state.newsroom.lastProcessedToken ??= null;
  state.newsroom.lastInterviewWeek ??= 0;
  state.mobileUX ||= { mode: 'auto', compact: false, oneHand: false, matchFocus: true, reduceMotion: false, lastViewport: null, auditLog: [] };
  state.mobileUX.mode ||= 'auto';
  state.mobileUX.compact ??= false;
  state.mobileUX.oneHand ??= false;
  state.mobileUX.matchFocus ??= true;
  state.mobileUX.reduceMotion ??= false;
  state.mobileUX.auditLog ||= [];
  state.mobileUX.lastViewport ??= null;
  state.commercialCareer ||= { ledger: [], activeSponsors: [], sponsorPipeline: [], investorOffers: [], travelBudgetMode: 'balanced', riskScore: 24, cashflowTrend: 0, lastProcessedToken: null, boardConfidence: 64 };
  state.commercialCareer.ledger ||= [];
  state.commercialCareer.activeSponsors ||= [];
  state.commercialCareer.sponsorPipeline ||= [];
  state.commercialCareer.investorOffers ||= [];
  state.commercialCareer.travelBudgetMode ||= 'balanced';
  state.commercialCareer.riskScore ??= 24;
  state.commercialCareer.cashflowTrend ??= 0;
  state.commercialCareer.lastProcessedToken ??= null;
  state.commercialCareer.boardConfidence ??= 64;
  state.generationalCareer ||= { seasonHistory: [], retirementLog: [], hallOfFame: [], prospects: [], records: {}, legacyScore: 0, lastProcessedSeason: null, simulationAudit: [] };
  state.generationalCareer.seasonHistory ||= [];
  state.generationalCareer.retirementLog ||= [];
  state.generationalCareer.hallOfFame ||= [];
  state.generationalCareer.prospects ||= [];
  state.generationalCareer.records ||= {};
  state.generationalCareer.legacyScore ??= 0;
  state.generationalCareer.lastProcessedSeason ??= null;
  state.generationalCareer.simulationAudit ||= [];
  state.releaseCandidate ||= { readiness: 82, safeMode: false, lastAuditToken: null, auditLog: [], checklist: {}, storeChecklist: {}, legal: { privacyOffline: true, creditsReady: true, dataSale: false }, stress: { weeksProjected: 52, status: 'pending', issues: [] } };
  state.releaseCandidate.readiness ??= 82;
  state.releaseCandidate.safeMode ??= false;
  state.releaseCandidate.lastAuditToken ??= null;
  state.releaseCandidate.auditLog ||= [];
  state.releaseCandidate.checklist ||= {};
  state.releaseCandidate.storeChecklist ||= {};
  state.releaseCandidate.legal ||= { privacyOffline: true, creditsReady: true, dataSale: false };
  state.releaseCandidate.legal.privacyOffline ??= true;
  state.releaseCandidate.legal.creditsReady ??= true;
  state.releaseCandidate.legal.dataSale ??= false;
  state.releaseCandidate.stress ||= { weeksProjected: 52, status: 'pending', issues: [] };
  state.releaseCandidate.stress.weeksProjected ??= 52;
  state.releaseCandidate.stress.status ||= 'pending';
  state.releaseCandidate.stress.issues ||= [];
  state.qualityPolish ||= { score: 88, lastAuditToken: null, auditLog: [], issues: [], deviceMatrix: ['320x568','360x640','390x844','412x915','tablet','desktop'], checks: { tapTargets: true, scrollSafety: true, assetFallbacks: true, saveRecovery: true, legalAccess: true }, safeLaunchMode: true };
  state.qualityPolish.score ??= 88;
  state.qualityPolish.lastAuditToken ??= null;
  state.qualityPolish.auditLog ||= [];
  state.qualityPolish.issues ||= [];
  state.qualityPolish.deviceMatrix ||= ['320x568','360x640','390x844','412x915','tablet','desktop'];
  state.qualityPolish.checks ||= { tapTargets: true, scrollSafety: true, assetFallbacks: true, saveRecovery: true, legalAccess: true };
  state.qualityPolish.checks.tapTargets ??= true;
  state.qualityPolish.checks.scrollSafety ??= true;
  state.qualityPolish.checks.assetFallbacks ??= true;
  state.qualityPolish.checks.saveRecovery ??= true;
  state.qualityPolish.checks.legalAccess ??= true;
  state.qualityPolish.safeLaunchMode ??= true;
  state.releaseHardening ||= { score: 90, lastAuditToken: null, auditLog: [], cacheStatus: 'pending', diagnostics: [], recoveryMode: 'guarded', pwaResetRecommended: false, startupChecks: { buildVisible: true, saveWritable: true, cacheVersioned: true, mobileSafeArea: true, fallbackAssets: true } };
  state.releaseHardening.score ??= 90;
  state.releaseHardening.lastAuditToken ??= null;
  state.releaseHardening.auditLog ||= [];
  state.releaseHardening.cacheStatus ||= 'pending';
  state.releaseHardening.diagnostics ||= [];
  state.releaseHardening.recoveryMode ||= 'guarded';
  state.releaseHardening.pwaResetRecommended ??= false;
  state.releaseHardening.startupChecks ||= { buildVisible: true, saveWritable: true, cacheVersioned: true, mobileSafeArea: true, fallbackAssets: true };
  state.releaseHardening.startupChecks.buildVisible ??= true;
  state.releaseHardening.startupChecks.saveWritable ??= true;
  state.releaseHardening.startupChecks.cacheVersioned ??= true;
  state.releaseHardening.startupChecks.mobileSafeArea ??= true;
  state.releaseHardening.startupChecks.fallbackAssets ??= true;
  state.performanceDelivery ||= { score: 91, mode: 'balanced', lastAuditToken: null, auditLog: [], assetDiagnostics: [], warmupComplete: false, liteMode: false, runtimeHints: { lazyImages: true, asyncDecode: true, criticalAssets: 4, lastHydratedImages: 0, missingAssets: 0 } };
  state.performanceDelivery.score ??= 91;
  state.performanceDelivery.mode ||= 'balanced';
  state.performanceDelivery.lastAuditToken ??= null;
  state.performanceDelivery.auditLog ||= [];
  state.performanceDelivery.assetDiagnostics ||= [];
  state.performanceDelivery.warmupComplete ??= false;
  state.performanceDelivery.liteMode ??= false;
  state.performanceDelivery.runtimeHints ||= { lazyImages: true, asyncDecode: true, criticalAssets: 4, lastHydratedImages: 0, missingAssets: 0 };
  state.performanceDelivery.runtimeHints.lazyImages ??= true;
  state.performanceDelivery.runtimeHints.asyncDecode ??= true;
  state.performanceDelivery.runtimeHints.criticalAssets ??= 4;
  state.performanceDelivery.runtimeHints.lastHydratedImages ??= 0;
  state.performanceDelivery.runtimeHints.missingAssets ??= 0;

  state.qaAutomation ||= { score: 92, lastRunToken: null, auditLog: [], smokeResults: [], screenResults: [], saveSnapshots: [], exportReady: false, publicTestMode: false, checklist: { boot: true, tabs: true, save: true, mobile: true, pwa: true, legal: true, performance: true } };
  state.qaAutomation.score ??= 92;
  state.qaAutomation.lastRunToken ??= null;
  state.qaAutomation.auditLog ||= [];
  state.qaAutomation.smokeResults ||= [];
  state.qaAutomation.screenResults ||= [];
  state.qaAutomation.saveSnapshots ||= [];
  state.qaAutomation.exportReady ??= false;
  state.qaAutomation.publicTestMode ??= false;
  state.qaAutomation.checklist ||= { boot: true, tabs: true, save: true, mobile: true, pwa: true, legal: true, performance: true };
  state.qaAutomation.checklist.boot ??= true;
  state.qaAutomation.checklist.tabs ??= true;
  state.qaAutomation.checklist.save ??= true;
  state.qaAutomation.checklist.mobile ??= true;
  state.qaAutomation.checklist.pwa ??= true;
  state.qaAutomation.checklist.legal ??= true;
  state.qaAutomation.checklist.performance ??= true;

  state.browserCompatibility ||= { score: 93, lastAuditToken: null, auditLog: [], installDiagnostics: [], compatibilityMatrix: [], installMode: 'auto', lastUserAgent: '', environment: { serviceWorker: false, standalone: false, touch: true, storage: true, online: true, viewportStable: true }, flags: { iosSafari: false, androidChrome: false, desktopChrome: false, pwaInstalled: false } };
  state.browserCompatibility.score ??= 93;
  state.browserCompatibility.lastAuditToken ??= null;
  state.browserCompatibility.auditLog ||= [];
  state.browserCompatibility.installDiagnostics ||= [];
  state.browserCompatibility.compatibilityMatrix ||= [];
  state.browserCompatibility.installMode ||= 'auto';
  state.browserCompatibility.lastUserAgent ||= '';
  state.browserCompatibility.environment ||= { serviceWorker: false, standalone: false, touch: true, storage: true, online: true, viewportStable: true };
  state.browserCompatibility.environment.serviceWorker ??= false;
  state.browserCompatibility.environment.standalone ??= false;
  state.browserCompatibility.environment.touch ??= true;
  state.browserCompatibility.environment.storage ??= true;
  state.browserCompatibility.environment.online ??= true;
  state.browserCompatibility.environment.viewportStable ??= true;
  state.browserCompatibility.flags ||= { iosSafari: false, androidChrome: false, desktopChrome: false, pwaInstalled: false };
  state.browserCompatibility.flags.iosSafari ??= false;
  state.browserCompatibility.flags.androidChrome ??= false;
  state.browserCompatibility.flags.desktopChrome ??= false;
  state.browserCompatibility.flags.pwaInstalled ??= false;


  state.inputReliability ||= { score: 94, lastAuditToken: null, auditLog: [], gestureDiagnostics: [], keyboardDiagnostics: [], scrollDiagnostics: [], safePreset: false, environment: { touch: true, pointer: 'coarse', viewportLocked: true, scrollUnlocked: true, keyboardSafe: true, passiveListeners: true }, flags: { stickyScrollGuard: true, tapTargetGuard: true, keyboardGuard: true, orientationGuard: true } };
  state.inputReliability.score ??= 94;
  state.inputReliability.lastAuditToken ??= null;
  state.inputReliability.auditLog ||= [];
  state.inputReliability.gestureDiagnostics ||= [];
  state.inputReliability.keyboardDiagnostics ||= [];
  state.inputReliability.scrollDiagnostics ||= [];
  state.inputReliability.safePreset ??= false;
  state.inputReliability.environment ||= { touch: true, pointer: 'coarse', viewportLocked: true, scrollUnlocked: true, keyboardSafe: true, passiveListeners: true };
  state.inputReliability.environment.touch ??= true;
  state.inputReliability.environment.pointer ||= 'coarse';
  state.inputReliability.environment.viewportLocked ??= true;
  state.inputReliability.environment.scrollUnlocked ??= true;
  state.inputReliability.environment.keyboardSafe ??= true;
  state.inputReliability.environment.passiveListeners ??= true;
  state.inputReliability.flags ||= { stickyScrollGuard: true, tapTargetGuard: true, keyboardGuard: true, orientationGuard: true };
  state.inputReliability.flags.stickyScrollGuard ??= true;
  state.inputReliability.flags.tapTargetGuard ??= true;
  state.inputReliability.flags.keyboardGuard ??= true;
  state.inputReliability.flags.orientationGuard ??= true;


  state.accessibilityReadability ||= { score: 95, mode: 'auto', largeText: false, highContrast: false, readingMode: false, reducedTransparency: false, focusRing: true, ariaAudit: [], readabilityAudit: [], lastAuditToken: null, exportReady: false, environment: { colorScheme: 'dark', reducedMotion: false, textScale: 1, contrast: 'normal', focusVisible: true }, flags: { contrastGuard: true, textScaleGuard: true, focusGuard: true, ariaGuard: true } };
  state.accessibilityReadability.score ??= 95;
  state.accessibilityReadability.mode ||= 'auto';
  state.accessibilityReadability.largeText ??= false;
  state.accessibilityReadability.highContrast ??= false;
  state.accessibilityReadability.readingMode ??= false;
  state.accessibilityReadability.reducedTransparency ??= false;
  state.accessibilityReadability.focusRing ??= true;
  state.accessibilityReadability.ariaAudit ||= [];
  state.accessibilityReadability.readabilityAudit ||= [];
  state.accessibilityReadability.lastAuditToken ??= null;
  state.accessibilityReadability.exportReady ??= false;
  state.accessibilityReadability.environment ||= { colorScheme: 'dark', reducedMotion: false, textScale: 1, contrast: 'normal', focusVisible: true };
  state.accessibilityReadability.environment.colorScheme ||= 'dark';
  state.accessibilityReadability.environment.reducedMotion ??= false;
  state.accessibilityReadability.environment.textScale ??= 1;
  state.accessibilityReadability.environment.contrast ||= state.accessibilityReadability.highContrast ? 'high' : 'normal';
  state.accessibilityReadability.environment.focusVisible ??= true;
  state.accessibilityReadability.flags ||= { contrastGuard: true, textScaleGuard: true, focusGuard: true, ariaGuard: true };
  state.accessibilityReadability.flags.contrastGuard ??= true;
  state.accessibilityReadability.flags.textScaleGuard ??= true;
  state.accessibilityReadability.flags.focusGuard ??= true;
  state.accessibilityReadability.flags.ariaGuard ??= true;


  state.localizationStore ||= { score: 96, activeLocale: 'pt-BR', fallbackLocale: 'pt-BR', supportedLocales: ['pt-BR','en','es'], textCoverage: { 'pt-BR': 100, en: 78, es: 74 }, storeReadiness: { titleReady: true, descriptionReady: true, screenshotsPending: true, legalReady: true, ageRatingPending: true }, auditLog: [], exportReady: false, lastAuditToken: null, preview: { title: 'Vale Games Tennis Manager', subtitle: 'Academia internacional de tênis', storeShort: 'Gerencie atletas, torneios, patrocínios e legado em uma carreira mobile-first.' }, flags: { localeGuard: true, storeCopyGuard: true, fallbackGuard: true, exportGuard: true } };
  state.localizationStore.score ??= 96;
  state.localizationStore.activeLocale ||= 'pt-BR';
  state.localizationStore.fallbackLocale ||= 'pt-BR';
  state.localizationStore.supportedLocales ||= ['pt-BR','en','es'];
  state.localizationStore.textCoverage ||= { 'pt-BR': 100, en: 78, es: 74 };
  state.localizationStore.textCoverage['pt-BR'] ??= 100;
  state.localizationStore.textCoverage.en ??= 78;
  state.localizationStore.textCoverage.es ??= 74;
  state.localizationStore.storeReadiness ||= { titleReady: true, descriptionReady: true, screenshotsPending: true, legalReady: true, ageRatingPending: true };
  state.localizationStore.storeReadiness.titleReady ??= true;
  state.localizationStore.storeReadiness.descriptionReady ??= true;
  state.localizationStore.storeReadiness.screenshotsPending ??= true;
  state.localizationStore.storeReadiness.legalReady ??= true;
  state.localizationStore.storeReadiness.ageRatingPending ??= true;
  state.localizationStore.auditLog ||= [];
  state.localizationStore.exportReady ??= false;
  state.localizationStore.lastAuditToken ??= null;
  state.localizationStore.preview ||= { title: 'Vale Games Tennis Manager', subtitle: 'Academia internacional de tênis', storeShort: 'Gerencie atletas, torneios, patrocínios e legado em uma carreira mobile-first.' };
  state.localizationStore.flags ||= { localeGuard: true, storeCopyGuard: true, fallbackGuard: true, exportGuard: true };
  state.localizationStore.flags.localeGuard ??= true;
  state.localizationStore.flags.storeCopyGuard ??= true;
  state.localizationStore.flags.fallbackGuard ??= true;
  state.localizationStore.flags.exportGuard ??= true;

  state.trainingLab.plans ||= {}; state.trainingLab.lastReport ||= []; state.trainingLab.autoApply ??= true; state.trainingLab.cycle ||= 'balanced';
  state.staff ||= {};
  ['Tecnico','Preparador Fisico','Fisioterapeuta','Psicologo','Nutricionista','Analista','Scouting','Financeiro'].forEach(role => { state.staff[role] ??= null; });
  (state.staffMarket || []).forEach(member => { member.contractWeeks ??= 52; member.compatibility ??= 60 + ((member.id || '').length * 7) % 36; member.rating ??= Math.min(95, 55 + Object.values(member.effects || {}).reduce((a,v)=>a+Math.abs(v),0)*3); });
  state.roster ||= [];
  state.roster.forEach(p => {
    p.health ??= 100; p.injuredWeeks ??= 0; p.lastResult ??= 'Sem jogos';
    p.salary ??= 1800 + Math.round((p.overall || 50) * 25);
    state.trainingLab.plans[p.id] ||= { focus: 'balanced', intensity: 'moderate' };
    p.trainingProgress ||= {}; p.trainingHistory ||= [];
    p.relationship ??= 68; p.pressure ??= 40; p.confidence ??= p.morale ?? 70; p.happiness ??= 66; p.careerEvents ||= []; p.conversationHistory ||= []; p.seasonGoal ??= 'consolidar ranking'; p.yearsPro ??= Math.max(0, (state.academy?.season || 2026) - (p.debutSeason || 2026)); p.debutSeason ??= Math.max(2024, (state.academy?.season || 2026) - p.yearsPro); p.peakOverall ??= p.overall || 50; p.careerTitles ??= p.careerTitles || 0; p.grandSlamTitles ??= p.grandSlamTitles || 0; p.bestRank ??= p.bestRank || 999; p.legacyTags ||= []; p.careerPhase ||= 'desenvolvimento';
    Object.assign(p, enrichPlayers([p])[0]);
  });
  state.ranking = enrichPlayers(state.ranking || []);

  state.onboardingReliability ||= { score: 98, lastAuditToken: null, auditLog: [], buttonProbe: [], forcedOpens: 0, lastForcedReason: null, safeStartLocks: 0, modalVisibilityChecks: [], checklist: { setupModal: true, avatarChoices: true, ownerSaveButton: true, tabDelegation: true, dockDelegation: true, dashboardRecovery: true }, flags: { mandatorySetupGuard: true, eventDelegationFallback: true, hashRouter: true, modalRetry: true, buttonProbe: true } };
  state.onboardingReliability.score ??= 98;
  state.onboardingReliability.lastAuditToken ??= null;
  state.onboardingReliability.auditLog ||= [];
  state.onboardingReliability.buttonProbe ||= [];
  state.onboardingReliability.forcedOpens ??= 0;
  state.onboardingReliability.lastForcedReason ??= null;
  state.onboardingReliability.safeStartLocks ??= 0;
  state.onboardingReliability.modalVisibilityChecks ||= [];
  state.onboardingReliability.checklist ||= { setupModal: true, avatarChoices: true, ownerSaveButton: true, tabDelegation: true, dockDelegation: true, dashboardRecovery: true };
  state.onboardingReliability.checklist.setupModal ??= true;
  state.onboardingReliability.checklist.avatarChoices ??= true;
  state.onboardingReliability.checklist.ownerSaveButton ??= true;
  state.onboardingReliability.checklist.tabDelegation ??= true;
  state.onboardingReliability.checklist.dockDelegation ??= true;
  state.onboardingReliability.checklist.dashboardRecovery ??= true;
  state.onboardingReliability.flags ||= { mandatorySetupGuard: true, eventDelegationFallback: true, hashRouter: true, modalRetry: true, buttonProbe: true };
  state.onboardingReliability.flags.mandatorySetupGuard ??= true;
  state.onboardingReliability.flags.eventDelegationFallback ??= true;
  state.onboardingReliability.flags.hashRouter ??= true;
  state.onboardingReliability.flags.modalRetry ??= true;
  state.onboardingReliability.flags.buttonProbe ??= true;

  state.cacheUpdateGuard ||= { score: 99, previousBuild: null, currentBuild: BUILD_INFO.build, lastSeenBuild: null, staleDetected: false, firstRunConfirmed: false, serviceWorkerStatus: 'pending', cacheKeys: [], auditLog: [], clearCount: 0, reloadCount: 0, flags: { serviceWorkerRegister: true, cacheBustAssets: true, visibleBuildGate: true, forceFreshJson: true } };
  state.cacheUpdateGuard.score ??= 99;
  state.cacheUpdateGuard.previousBuild ??= null;
  state.cacheUpdateGuard.currentBuild = BUILD_INFO.build;
  state.cacheUpdateGuard.lastSeenBuild ??= null;
  state.cacheUpdateGuard.staleDetected ??= false;
  state.cacheUpdateGuard.firstRunConfirmed ??= false;
  state.cacheUpdateGuard.serviceWorkerStatus ||= 'pending';
  state.cacheUpdateGuard.cacheKeys ||= [];
  state.cacheUpdateGuard.auditLog ||= [];
  state.cacheUpdateGuard.clearCount ??= 0;
  state.cacheUpdateGuard.reloadCount ??= 0;
  state.cacheUpdateGuard.flags ||= { serviceWorkerRegister: true, cacheBustAssets: true, visibleBuildGate: true, forceFreshJson: true };
  state.cacheUpdateGuard.flags.serviceWorkerRegister ??= true;
  state.cacheUpdateGuard.flags.cacheBustAssets ??= true;
  state.cacheUpdateGuard.flags.visibleBuildGate ??= true;
  state.cacheUpdateGuard.flags.forceFreshJson ??= true;

  state.careerCreationUX ||= { score: 100, setupAttempts: 0, avatarTouchCount: 0, saveButtonChecks: [], lastAuditToken: null, auditLog: [], lastSelectedAvatar: null, firstRunVerified: false, buttonGuardActive: true, flags: { stickyModalFooter: true, delegatedAvatarTap: true, saveButtonGuard: true, defaultValueGuard: true, dashboardBlocker: true } };
  state.careerCreationUX.score ??= 100;
  state.careerCreationUX.setupAttempts ??= 0;
  state.careerCreationUX.avatarTouchCount ??= 0;
  state.careerCreationUX.saveButtonChecks ||= [];
  state.careerCreationUX.auditLog ||= [];
  state.careerCreationUX.lastAuditToken ??= null;
  state.careerCreationUX.lastSelectedAvatar ??= null;
  state.careerCreationUX.firstRunVerified ??= false;
  state.careerCreationUX.buttonGuardActive ??= true;
  state.careerCreationUX.flags ||= { stickyModalFooter: true, delegatedAvatarTap: true, saveButtonGuard: true, defaultValueGuard: true, dashboardBlocker: true };
  state.careerCreationUX.flags.stickyModalFooter ??= true;
  state.careerCreationUX.flags.delegatedAvatarTap ??= true;
  state.careerCreationUX.flags.saveButtonGuard ??= true;
  state.careerCreationUX.flags.defaultValueGuard ??= true;
  state.careerCreationUX.flags.dashboardBlocker ??= true;

  state.careerSetupRecovery ||= { lastReason: null, repairedAt: null, forcedSetup: false, snapshots: [], bootGuard: true };
  state.careerSetupRecovery.snapshots ||= [];
  state.careerSetupRecovery.bootGuard ??= true;
  state.careerSetupRecovery.forcedSetup ??= false;

  state.mandatoryCareerGate ||= { score: 100, locked: true, lastAuditToken: null, auditLog: [], blockedTabs: 0, repairCount: 0, lastRepairReason: null, firstRunGatePassed: false, flags: { blockEmptyDashboard: true, requireOwnerProfile: true, requirePlayableCore: true, openModalBeforeGameplay: true, preserveBackupBeforeRepair: true } };
  state.mandatoryCareerGate.score ??= 100;
  state.mandatoryCareerGate.locked ??= true;
  state.mandatoryCareerGate.lastAuditToken ??= null;
  state.mandatoryCareerGate.auditLog ||= [];
  state.mandatoryCareerGate.blockedTabs ??= 0;
  state.mandatoryCareerGate.repairCount ??= 0;
  state.mandatoryCareerGate.lastRepairReason ??= null;
  state.mandatoryCareerGate.firstRunGatePassed ??= false;
  state.mandatoryCareerGate.flags ||= { blockEmptyDashboard: true, requireOwnerProfile: true, requirePlayableCore: true, openModalBeforeGameplay: true, preserveBackupBeforeRepair: true };
  state.mandatoryCareerGate.flags.blockEmptyDashboard ??= true;
  state.mandatoryCareerGate.flags.requireOwnerProfile ??= true;
  state.mandatoryCareerGate.flags.requirePlayableCore ??= true;
  state.mandatoryCareerGate.flags.openModalBeforeGameplay ??= true;
  state.mandatoryCareerGate.flags.preserveBackupBeforeRepair ??= true;


  state.forcedOnboardingGate ||= { score: 100, hardLock: true, lastAuditToken: null, auditLog: [], forcedLaunches: 0, invalidDashboardBlocks: 0, lastInvalidReason: null, firstRunConfirmed: false, lastRepairAt: null, flags: { forceFullScreenSetup: true, blockDashboardWhenInvalid: true, validateBeforeRender: true, autoRepairEmptySave: true, cacheAwareLaunch: true } };
  state.forcedOnboardingGate.score ??= 100;
  state.forcedOnboardingGate.hardLock ??= true;
  state.forcedOnboardingGate.lastAuditToken ??= null;
  state.forcedOnboardingGate.auditLog ||= [];
  state.forcedOnboardingGate.forcedLaunches ??= 0;
  state.forcedOnboardingGate.invalidDashboardBlocks ??= 0;
  state.forcedOnboardingGate.lastInvalidReason ??= null;
  state.forcedOnboardingGate.firstRunConfirmed ??= false;
  state.forcedOnboardingGate.lastRepairAt ??= null;
  state.forcedOnboardingGate.flags ||= { forceFullScreenSetup: true, blockDashboardWhenInvalid: true, validateBeforeRender: true, autoRepairEmptySave: true, cacheAwareLaunch: true };
  state.forcedOnboardingGate.flags.forceFullScreenSetup ??= true;
  state.forcedOnboardingGate.flags.blockDashboardWhenInvalid ??= true;
  state.forcedOnboardingGate.flags.validateBeforeRender ??= true;
  state.forcedOnboardingGate.flags.autoRepairEmptySave ??= true;
  state.forcedOnboardingGate.flags.cacheAwareLaunch ??= true;

  state.onboardingRuntimeProof ||= { score: 100, lastAuditToken: null, auditLog: [], bootProofs: [], modalProofs: [], lastProofStatus: 'pending', lastUserAgent: '', firstRunVisualConfirmed: false, flags: { runtimeLockOverlay: true, modalVisibilityProof: true, dashboardBlankProof: true, mobileProofExport: true } };
  state.onboardingRuntimeProof.score ??= 100;
  state.onboardingRuntimeProof.lastAuditToken ??= null;
  state.onboardingRuntimeProof.auditLog ||= [];
  state.onboardingRuntimeProof.bootProofs ||= [];
  state.onboardingRuntimeProof.modalProofs ||= [];
  state.onboardingRuntimeProof.lastProofStatus ||= 'pending';
  state.onboardingRuntimeProof.lastUserAgent ||= '';
  state.onboardingRuntimeProof.firstRunVisualConfirmed ??= false;
  state.onboardingRuntimeProof.flags ||= { runtimeLockOverlay: true, modalVisibilityProof: true, dashboardBlankProof: true, mobileProofExport: true };
  state.onboardingRuntimeProof.flags.runtimeLockOverlay ??= true;
  state.onboardingRuntimeProof.flags.modalVisibilityProof ??= true;
  state.onboardingRuntimeProof.flags.dashboardBlankProof ??= true;
  state.onboardingRuntimeProof.flags.mobileProofExport ??= true;


  state.cleanStartWizard ||= { score: 100, lastAuditToken: null, auditLog: [], deploymentChecks: [], resetBackups: [], staleBuildSeen: false, cleanStartConfirmed: false, lastResetAt: null, flags: { guidedReset: true, deployCheck: true, cacheClear: true, firstRunReopen: true, preserveBackup: true } };
  state.cleanStartWizard.score ??= 100;
  state.cleanStartWizard.lastAuditToken ??= null;
  state.cleanStartWizard.auditLog ||= [];
  state.cleanStartWizard.deploymentChecks ||= [];
  state.cleanStartWizard.resetBackups ||= [];
  state.cleanStartWizard.staleBuildSeen ??= false;
  state.cleanStartWizard.cleanStartConfirmed ??= false;
  state.cleanStartWizard.lastResetAt ??= null;
  state.cleanStartWizard.flags ||= { guidedReset: true, deployCheck: true, cacheClear: true, firstRunReopen: true, preserveBackup: true };
  state.cleanStartWizard.flags.guidedReset ??= true;
  state.cleanStartWizard.flags.deployCheck ??= true;
  state.cleanStartWizard.flags.cacheClear ??= true;
  state.cleanStartWizard.flags.firstRunReopen ??= true;
  state.cleanStartWizard.flags.preserveBackup ??= true;


  state.emergencyStartControl ||= { score: 100, hardResetCount: 0, lastResetAt: null, auditLog: [], routeDetected: null, startupShieldVisible: false, lastExportAt: null, flags: { hardResetRoute: true, standaloneShield: true, cacheBypassUrl: true, backupBeforeReset: true, blockDashboardZeroMetrics: true } };
  state.emergencyStartControl.score ??= 100;
  state.emergencyStartControl.hardResetCount ??= 0;
  state.emergencyStartControl.lastResetAt ??= null;
  state.emergencyStartControl.auditLog ||= [];
  state.emergencyStartControl.routeDetected ??= null;
  state.emergencyStartControl.startupShieldVisible ??= false;
  state.emergencyStartControl.lastExportAt ??= null;
  state.emergencyStartControl.flags ||= { hardResetRoute: true, standaloneShield: true, cacheBypassUrl: true, backupBeforeReset: true, blockDashboardZeroMetrics: true };
  state.emergencyStartControl.flags.hardResetRoute ??= true;
  state.emergencyStartControl.flags.standaloneShield ??= true;
  state.emergencyStartControl.flags.cacheBypassUrl ??= true;
  state.emergencyStartControl.flags.backupBeforeReset ??= true;
  state.emergencyStartControl.flags.blockDashboardZeroMetrics ??= true;

  return state;
}

export function saveState(state) {
  if (!state) return false;
  const payload = JSON.stringify(migrateSave(state));
  const previous = localStorage.getItem(STORAGE_KEY);
  try {
    if (previous) localStorage.setItem(BACKUP_KEY, previous);
    localStorage.setItem(STORAGE_KEY, payload);
    return true;
  } catch (error) {
    console.error('Não foi possível salvar a carreira.', error);
    return false;
  }
}

export function loadState() {
  let sourceKey = STORAGE_KEY;
  let raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    for (const key of LEGACY_KEYS) {
      raw = localStorage.getItem(key);
      if (raw) { sourceKey = key; break; }
    }
  }
  let loaded = parseSave(raw, sourceKey);
  if (!loaded) loaded = parseSave(localStorage.getItem(BACKUP_KEY), BACKUP_KEY);
  if (!loaded) return null;
  const migrated = migrateSave(loaded);
  saveState(migrated);
  return migrated;
}

export function clearState() {
  [STORAGE_KEY, BACKUP_KEY, ...LEGACY_KEYS].forEach(key => localStorage.removeItem(key));
}
export function exportState() { return loadState(); }
export function importState(data) {
  const migrated = migrateSave(data);
  if (!migrated) throw new Error('Arquivo de save inválido.');
  saveState(migrated);
  return migrated;
}
export const getSaveDiagnostics = () => ({ storageKey: STORAGE_KEY, backupAvailable: !!localStorage.getItem(BACKUP_KEY), schemaVersion: CURRENT_SCHEMA });
