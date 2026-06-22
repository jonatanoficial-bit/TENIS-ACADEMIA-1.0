import { BUILD_INFO } from './build.js';
import { enrichPlayers } from './modules/player-database.js';

const STORAGE_KEY = 'vale_tennis_manager_save';
const LEGACY_KEYS = ['ace_academy_save_v040', 'ace-manager-save'];
const BACKUP_KEY = 'vale_tennis_manager_save_backup';
const CORRUPT_KEY = 'vale_tennis_manager_corrupt_save';
const CURRENT_SCHEMA = 22;

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
    tournamentDraws: {}, tournamentLife: { championHistory: [], drawAudit: [], lastViewedDraw: null }, flags: { ownerSetupComplete: false, safeMode: false }, tournamentIdentity: { spotlightHistory: [], lastViewedEvent: null }, broadcast: { presentationMode: 'pro', replayArchive: [], lastAudit: null }, playerCareer: { weeklyEvents: [], conversations: [], promises: [], lastProcessedToken: null }, tacticalIntelligence: { plan: { serveTarget: 'body', rallyPlan: 'balanced', attackPattern: 'weakness', returnPlan: 'secondServePressure', riskMode: 'balanced' }, history: [], lastAppliedWeek: 0, analyst: 'Plano equilibrado ativo.' }, visualAcademy: { activeScene: 'office', lastViewedScene: 'office', environmentAudit: [], premiumMode: true }, newsroom: { items: [], pressQuestions: [], sentiment: 62, reputationPulse: 0, lastProcessedToken: null, lastInterviewWeek: 0 }, mobileUX: { mode: 'auto', compact: false, oneHand: false, matchFocus: true, reduceMotion: false, lastViewport: null, auditLog: [] }, commercialCareer: { ledger: [], activeSponsors: [], sponsorPipeline: [], investorOffers: [], travelBudgetMode: 'balanced', riskScore: 24, cashflowTrend: 0, lastProcessedToken: null, boardConfidence: 64 }, generationalCareer: { seasonHistory: [], retirementLog: [], hallOfFame: [], prospects: [], records: {}, legacyScore: 0, lastProcessedSeason: null, simulationAudit: [] }, releaseCandidate: { readiness: 82, safeMode: false, lastAuditToken: null, auditLog: [], checklist: {}, storeChecklist: {}, legal: { privacyOffline: true, creditsReady: true, dataSale: false }, stress: { weeksProjected: 52, status: 'pending', issues: [] } }, qualityPolish: { score: 88, lastAuditToken: null, auditLog: [], issues: [], deviceMatrix: ['320x568','360x640','390x844','412x915','tablet','desktop'], checks: { tapTargets: true, scrollSafety: true, assetFallbacks: true, saveRecovery: true, legalAccess: true }, safeLaunchMode: true }, releaseHardening: { score: 90, lastAuditToken: null, auditLog: [], cacheStatus: 'pending', diagnostics: [], recoveryMode: 'guarded', pwaResetRecommended: false, startupChecks: { buildVisible: true, saveWritable: true, cacheVersioned: true, mobileSafeArea: true, fallbackAssets: true } }, ui: { currentTab: 'dashboard', lastStableTab: 'dashboard' }
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
