const STORAGE_KEY = 'ace_academy_save_v020';

export function buildInitialState(content) {
  const academy = structuredClone(content.academyDefaults);
  const staff = {
    Tecnico: null,
    Fisioterapeuta: null,
    Financeiro: null,
    Psicologo: null
  };

  const roster = content.starterRoster.map(player => ({
    ...player,
    morale: 72,
    fatigue: 8,
    injuries: 0,
    salary: 1800 + Math.round(player.overall * 25),
    isUser: true
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
    version: '0.2.0',
    academy,
    roster,
    ranking,
    calendar: content.calendar,
    marketTalents: content.marketTalents,
    staffMarket: content.staffMarket,
    staff,
    match: null,
    logs: ['Nova carreira iniciada. Sua academia está pronta para competir.'],
    summary: ['Semana 1 iniciada. Escolha treinos, mercado ou prepare a partida.']
  };
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}

export function exportState() {
  return loadState();
}

export function importState(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
