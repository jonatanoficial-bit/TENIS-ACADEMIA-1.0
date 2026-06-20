import { BUILD_INFO } from './build.js';
import { enrichPlayers } from './modules/player-database.js';

const STORAGE_KEY = 'vale_tennis_manager_save';
const LEGACY_KEYS = ['ace_academy_save_v040', 'ace-manager-save'];
const BACKUP_KEY = 'vale_tennis_manager_save_backup';
const CORRUPT_KEY = 'vale_tennis_manager_corrupt_save';
const CURRENT_SCHEMA = 11;

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
    flags: { ownerSetupComplete: false, safeMode: false }, tournamentIdentity: { spotlightHistory: [], lastViewedEvent: null }, broadcast: { presentationMode: 'pro', replayArchive: [], lastAudit: null }, ui: { currentTab: 'dashboard', lastStableTab: 'dashboard' }
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
  state.broadcast ||= { presentationMode: 'pro', replayArchive: [], lastAudit: null };
  state.broadcast.replayArchive ||= [];
  state.broadcast.presentationMode ||= 'pro';
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
