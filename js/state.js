const STORAGE_KEY = 'ace_academy_save_v040';

export function buildInitialState(content) {
  const academy = structuredClone(content.academyDefaults);
  const staff = { Tecnico: null, Fisioterapeuta: null, Financeiro: null, Psicologo: null };
  const roster = content.starterRoster.map(player => ({
    ...player,
    morale: 72,
    fatigue: 8,
    injuries: 0,
    salary: 1800 + Math.round(player.overall * 25),
    isUser: true,
    health: 100,
    injuredWeeks: 0,
    lastResult: 'Sem jogos'
  }));
  const ranking = [
    ...content.rankingSeed.map(p => ({ ...p, isUser: false })),
    ...roster.map((p, i) => ({
      rank: content.rankingSeed.length + i + 1,
      name: p.name,
      country: p.country,
      points: p.rankingPoints,
      overall: p.overall,
      age: p.age,
      style: p.style,
      playerId: p.id,
      isUser: true
    }))
  ];
  return {
    version: '2.7.2',
    academy: { ...academy, bankruptcyWarnings: 0, owner: null },
    roster,
    ranking,
    calendar: content.calendar,
    marketTalents: content.marketTalents,
    staffMarket: content.staffMarket,
    staff,
    match: null,
    activeTournament: null,
    logs: ['Nova carreira iniciada. Sua academia está pronta para competir.'],
    summary: ['Semana 1 iniciada. Prioridade mobile, gestão de risco e entrada em torneios.'],
    inbox: [
      { title: 'Board da academia', body: 'Objetivo inicial: colocar um atleta no Top 120 e manter caixa saudável.', week: 1 },
      { title: 'Scouting inicial', body: 'Há jovens talentos no mercado e espaço para montar um staff competitivo.', week: 1 }
    ],
    sponsorOffers: [],
    objectives: { current: 'Entrar no Top 120' },
    flags: { ownerSetupComplete: false }
  };
}
export function saveState(state) { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
export function loadState() { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; }
export function clearState() { localStorage.removeItem(STORAGE_KEY); }
export function exportState() { return loadState(); }
export function importState(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
