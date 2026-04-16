import { loadContent } from './contentLoader.js';
import { buildInitialState, saveState, loadState, clearState } from './state.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const canvas = $('#matchCanvas');
const ctx = canvas?.getContext('2d');
let state;
let content;
let currentStrategy = 'balanced';
let courtLoopId = null;
let courtClock = 0;
let autoPlayTimer = null;
let autoPlaySpeed = 1;
const BUILD_LABEL = 'v1.1.0 • 20260416-172803';

const STRATEGY_EFFECTS = {
  balanced: { offense: 0, defense: 0, serve: 0, stamina: 0, error: 0, pressure: 0 },
  aggressive: { offense: 6, defense: -2, serve: 1, stamina: 1.5, error: 4.2, pressure: 1 },
  defensive: { offense: -3, defense: 5, serve: 0, stamina: -0.6, error: -2, pressure: -1 },
  serve: { offense: 2, defense: -1, serve: 6, stamina: 0.6, error: 1.2, pressure: 0 },
  pressure: { offense: 3, defense: 0, serve: 0, stamina: 2.2, error: 2.1, pressure: 5 },
  control: { offense: 1, defense: 3, serve: 0, stamina: -0.4, error: -1.2, pressure: 1 }
};
const SCORE_NAMES = ['0', '15', '30', '40', 'AD'];
const ROUND_ORDER = ['Q', 'R16', 'QF', 'SF', 'F'];

boot();

async function boot() {
  content = await loadContent();
  applyAdminOverrides(content);
  state = loadState() || buildInitialState(content);
  migrateState();
  bindUI();
  applyBuildMarkers();
  startCourtLoop();
  drawCourt();
  render();
}

function applyAdminOverrides(content) {
  const override = JSON.parse(localStorage.getItem('ace_admin_overrides') || '{}');
  if (override.academyName) content.academyDefaults.name = override.academyName;
}

function migrateState() {
  state.version = '1.1.0';
  state.logs ||= [];
  state.summary ||= [];
  state.inbox ||= [];
  state.sponsorOffers ||= [];
  state.objectives ||= { current: 'Entrar no Top 120' };
  state.flags ||= {};
  state.academy.bankruptcyWarnings ??= 0;
  state.activeTournament ??= null;
  state.roster.forEach(p => {
    p.health ??= 100;
    p.injuredWeeks ??= 0;
    p.lastResult ??= 'Sem jogos';
    p.salary ??= 1800 + Math.round(p.overall * 25);
  });
}

function bindUI() {
  $$('#mainTabs .tab-btn').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
  $$('.dock-btn').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
  $('#openCalendarBtn')?.addEventListener('click', () => switchTab('calendar'));
  $('#advanceWeekBtn').addEventListener('click', advanceWeek);
  $('#saveBtn').addEventListener('click', () => { saveState(state); addLog('Save realizado manualmente.'); render(); });
  $('#resetBtn').addEventListener('click', () => {
    clearState();
    state = buildInitialState(content);
    migrateState();
    addLog('Nova carreira iniciada.');
    render();
  });
  $('#startMatchBtn').addEventListener('click', startScheduledMatch);
  $('#playPointBtn').addEventListener('click', () => { stopAutoPlay(); playPoint(); });
  $('#autoMatchBtn').addEventListener('click', () => { if (autoPlayTimer) stopAutoPlay(); else startAutoPlay(autoPlaySpeed); });
  $('#speed1Btn')?.addEventListener('click', () => setAutoPlaySpeed(1));
  $('#speed2Btn')?.addEventListener('click', () => setAutoPlaySpeed(2));
  $('#speed4Btn')?.addEventListener('click', () => setAutoPlaySpeed(4));
  $('#pauseAutoBtn')?.addEventListener('click', stopAutoPlay);
  $$('.action-btn').forEach(btn => btn.addEventListener('click', () => {
    $$('.action-btn').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    currentStrategy = btn.dataset.strategy;
    addMatchLog(`Estratégia alterada para ${btn.textContent}.`);
    renderMatch();
  }));
}


function applyBuildMarkers() {
  const ids = ['buildPill', 'buildOverlay', 'mobileBuildBadge', 'matchBuildInline'];
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = BUILD_LABEL; });
}

function setAutoPlaySpeed(mult) {
  autoPlaySpeed = mult;
  document.querySelectorAll('.speed-btn').forEach(btn => btn.classList.remove('active'));
  const btn = document.getElementById(`speed${mult}Btn`);
  if (btn) btn.classList.add('active');
  const label = document.getElementById('autoModeLabel');
  if (label) label.textContent = autoPlayTimer ? `Auto ${mult}x` : `Manual • ${mult}x pronto`;
  if (autoPlayTimer) startAutoPlay(mult);
}

function startAutoPlay(mult = autoPlaySpeed) {
  if (!state.match?.inProgress || state.match.finished) return;
  stopAutoPlay();
  autoPlaySpeed = mult;
  const label = document.getElementById('autoModeLabel');
  if (label) label.textContent = `Auto ${mult}x`;
  const delay = mult === 1 ? 700 : mult === 2 ? 380 : 190;
  const tick = () => {
    if (!state.match?.inProgress || state.match.finished) { stopAutoPlay(); return; }
    playPoint();
    if (state.match?.inProgress && !state.match.finished) autoPlayTimer = setTimeout(tick, delay);
  };
  autoPlayTimer = setTimeout(tick, delay);
}

function stopAutoPlay() {
  if (autoPlayTimer) clearTimeout(autoPlayTimer);
  autoPlayTimer = null;
  const label = document.getElementById('autoModeLabel');
  if (label) label.textContent = `Manual • ${autoPlaySpeed}x pronto`;
}

function startCourtLoop() {
  if (courtLoopId || !canvas || !ctx) return;
  const frame = (ts) => {
    courtClock = ts || performance.now();
    if (document.getElementById('tab-match')?.classList.contains('active')) drawCourt();
    courtLoopId = requestAnimationFrame(frame);
  };
  courtLoopId = requestAnimationFrame(frame);
}

function switchTab(tab) {
  $$('#mainTabs .tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  $$('.dock-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  $$('.tab-panel').forEach(panel => panel.classList.toggle('active', panel.id === `tab-${tab}`));
  if (tab === 'match') drawCourt();
}


function render() {
  $('#seasonLabel').textContent = state.academy.season;
  $('#weekLabel').textContent = state.academy.week;
  $('#moneyLabel').textContent = money(state.academy.money);
  $('#goalLabel').textContent = state.objectives.current;
  $('#reputationLabel').textContent = state.academy.reputation;
  $('#sponsorLabel').textContent = money(calculateSponsor());
  $('#costsLabel').textContent = money(calculateWeeklyCosts());
  $('#rosterCountLabel').textContent = state.roster.length;
  $('#statusText').textContent = getStatusText();
  renderNextEvents();
  renderSummary();
  renderInbox();
  renderSponsorOffers();
  renderHealth();
  renderFacilities();
  renderRoster();
  renderCalendar();
  renderMarket();
  renderStaff();
  updateRanking();
  renderRanking();
  renderMatch();
  saveState(state);
}

function getStatusText() {
  if (state.academy.money < 0) return 'Risco de falência';
  if (state.sponsorOffers?.length) return 'Novas propostas comerciais disponíveis';
  if (state.roster.some(p => p.injuredWeeks > 0)) return 'Lesões exigem gestão';
  if (state.activeTournament) return `Semana de ${state.activeTournament.event.name}`;
  return 'Pronto para competir';
}

function renderInbox() {
  const box = $('#inboxList');
  const items = (state.inbox || []).slice(0, 6);
  box.innerHTML = items.map(msg => `
    <div class="list-item">
      <div><strong>${msg.title}</strong><div class="small">${msg.body}</div></div>
      <div class="small">S${msg.week}</div>
    </div>`).join('') || '<div class="list-item"><span>Nenhuma mensagem ainda.</span></div>';
}

function renderSponsorOffers() {
  const host = $('#sponsorOffers');
  const offers = state.sponsorOffers || [];
  host.innerHTML = offers.length ? offers.map(offer => `
    <article class="offer-card">
      <div>
        <h4>${offer.name}</h4>
        <p class="muted">Bônus imediato ${money(offer.signingBonus)} • semanal ${money(offer.weeklyBoost)} • exigência ${offer.requirement}</p>
      </div>
      <div class="tag-row">
        <button class="btn-primary" onclick="window.acceptSponsorOffer('${offer.id}')">Aceitar</button>
        <button class="btn-ghost" onclick="window.rejectSponsorOffer('${offer.id}')">Recusar</button>
      </div>
    </article>`).join('') : '<div class="list-item"><span>Sem propostas nesta semana.</span></div>';
}


function renderNextEvents() {
  const list = $('#nextEventsList');
  const next = state.calendar.filter(e => e.week >= state.academy.week).slice(0, 5);
  list.innerHTML = next.map(event => {
    const gate = getTournamentGate(event);
    return `
      <div class="list-item">
        <div><strong>Semana ${event.week}</strong><div class="small">${event.name} • ${event.tier}</div></div>
        <div class="small">${gate.label}</div>
      </div>`;
  }).join('');
}

function renderSummary() {
  $('#weekSummary').innerHTML = state.summary.slice(0, 6).map(text => `<div class="list-item"><span>${text}</span></div>`).join('');
}

function renderHealth() {
  const risk = $('#healthOverview');
  const rows = state.roster.map(player => {
    const status = player.injuredWeeks > 0 ? `Lesão (${player.injuredWeeks} sem.)` : player.fatigue >= 70 ? 'Risco alto' : 'Estável';
    const cls = player.injuredWeeks > 0 ? 'danger' : player.fatigue >= 70 ? 'warn' : 'ok';
    return `<div class="list-item"><div><strong>${player.name}</strong><div class="small">Saúde ${Math.round(player.health)} • fadiga ${Math.round(player.fatigue)}</div></div><div class="${cls}">${status}</div></div>`;
  }).join('');
  risk.innerHTML = rows;
}

function renderFacilities() {
  const map = { training: 'Centro de Treino', medical: 'Centro Médico', finance: 'Financeiro', scouting: 'Scouting' };
  $('#facilityList').innerHTML = Object.entries(state.academy.facilities).map(([key, level]) => `
    <article class="panel-card">
      <h4>${map[key]}</h4>
      <p class="muted">Nível ${level}</p>
      <button class="btn-secondary" onclick="window.upgradeFacility('${key}')">Upgrade (${money((level + 1) * 18000)})</button>
    </article>`).join('');
}
window.upgradeFacility = (key) => {
  const level = state.academy.facilities[key];
  const cost = (level + 1) * 18000;
  if (state.academy.money < cost) return addLog('Caixa insuficiente para upgrade.');
  state.academy.money -= cost;
  state.academy.facilities[key] += 1;
  state.academy.reputation += 2;
  addLog(`Upgrade concluído em ${key}.`);
  render();
};

function renderRoster() {
  $('#rosterList').innerHTML = state.roster.map(player => {
    const rank = getPlayerRank(player.id);
    return `
    <article class="player-card">
      <header>
        <div class="avatar">${initials(player.name)}</div>
        <div>
          <h4>${player.name}</h4>
          <div class="small">${player.country} • ${player.age} anos • ${player.style} • rank ${rank}</div>
        </div>
      </header>
      <div class="metric-row">
        <span class="metric">OVR ${round(player.overall)}</span>
        <span class="metric">POT ${player.potential}</span>
        <span class="metric">STA ${round(player.stamina)}</span>
        <span class="metric">MEN ${round(player.mental)}</span>
        <span class="metric">Saúde ${round(player.health)}</span>
        <span class="metric">Fadiga ${round(player.fatigue)}</span>
      </div>
      <div class="metric-row" style="margin-top:8px">
        <span class="metric ${player.injuredWeeks > 0 ? 'danger' : ''}">${player.injuredWeeks > 0 ? `Lesão ${player.injuredWeeks} sem.` : 'Disponível'}</span>
        <span class="metric">Último resultado: ${player.lastResult}</span>
      </div>
      <div class="tag-row" style="margin-top:12px">
        <button class="btn-secondary" onclick="window.trainPlayer('${player.id}','technique')">Treino técnico</button>
        <button class="btn-secondary" onclick="window.trainPlayer('${player.id}','fitness')">Treino físico</button>
        <button class="btn-ghost" onclick="window.restPlayer('${player.id}')">Recuperar</button>
      </div>
    </article>`;
  }).join('');
}
window.trainPlayer = (playerId, type) => {
  const player = state.roster.find(p => p.id === playerId);
  if (!player) return;
  if (player.injuredWeeks > 0) return addLog(`${player.name} está lesionado.`);
  const boost = state.academy.facilities.training * 0.9 + getStaffBonus('Tecnico', 'training');
  const fatigueGain = type === 'fitness' ? 7 : 5;
  player.fatigue = Math.min(100, player.fatigue + fatigueGain);
  player.health = Math.max(50, player.health - (type === 'fitness' ? 3 : 2));
  if (type === 'technique') {
    player.overall = Math.min(player.potential, player.overall + 0.55 + boost * 0.06);
    player.forehand += 1; player.backhand += 1;
  } else {
    player.stamina = Math.min(99, player.stamina + 1 + boost * 0.04);
    player.overall = Math.min(player.potential, player.overall + 0.28);
  }
  maybeInjure(player, type === 'fitness' ? 6 : 3);
  player.morale = Math.min(100, (player.morale || 70) + 1);
  addLog(`${player.name} realizou treino ${type === 'fitness' ? 'físico' : 'técnico'}.`);
  render();
};
window.restPlayer = (playerId) => {
  const player = state.roster.find(p => p.id === playerId);
  if (!player) return;
  player.fatigue = Math.max(0, player.fatigue - 14);
  player.health = Math.min(100, player.health + 8);
  addLog(`${player.name} recebeu semana de recuperação.`);
  render();
};

function renderCalendar() {
  $('#calendarList').innerHTML = state.calendar.map(event => {
    const gate = getTournamentGate(event);
    return `
      <div class="list-item">
        <div>
          <strong>Semana ${event.week} • ${event.name}</strong>
          <div class="small">${event.tier} • ${event.surface} • prêmio ${money(event.prize)} • chave ${event.drawSize || 16}</div>
        </div>
        <div class="${gate.cls}">${gate.label}</div>
      </div>`;
  }).join('');
}

function renderMarket() {
  $('#marketList').innerHTML = state.marketTalents.map(talent => `
    <article class="market-card">
      <header>
        <div class="avatar">${initials(talent.name)}</div>
        <div>
          <h4>${talent.name}</h4>
          <div class="small">${talent.country} • ${talent.age} anos • ${talent.style}</div>
        </div>
      </header>
      <div class="metric-row">
        <span class="metric">OVR ${talent.overall}</span>
        <span class="metric">POT ${talent.potential}</span>
        <span class="metric">Salário ${money(talent.salary)}</span>
      </div>
      <div class="tag-row" style="margin-top:12px">
        <button class="btn-primary" onclick="window.signTalent('${talent.id}')">Contratar ${money(talent.fee)}</button>
      </div>
    </article>`).join('');
}
window.signTalent = (id) => {
  const talent = state.marketTalents.find(t => t.id === id);
  if (!talent) return;
  if (state.academy.money < talent.fee) return addLog('Caixa insuficiente para contratação.');
  state.academy.money -= talent.fee;
  state.roster.push({
    ...talent,
    stamina: 78, mental: 68, serve: 67, forehand: 68, backhand: 66,
    morale: 74, fatigue: 10, injuries: 0, rankingPoints: 40, isUser: true, health: 100, injuredWeeks: 0, lastResult: 'Recém-contratado'
  });
  state.marketTalents = state.marketTalents.filter(t => t.id !== id);
  addLog(`${talent.name} assinou com sua academia.`);
  render();
};

function renderStaff() {
  $('#staffList').innerHTML = state.staffMarket.map(member => {
    const hired = state.staff[member.role] && state.staff[member.role].id === member.id;
    return `
      <article class="staff-card">
        <h4>${member.role} • ${member.name}</h4>
        <p class="muted">${member.tier} • contratação ${money(member.cost)} • salário ${money(member.salary)}</p>
        <div class="metric-row">
          ${Object.entries(member.effects).map(([k,v]) => `<span class="metric">${k}: ${v > 0 ? '+' : ''}${v}</span>`).join('')}
        </div>
        <div class="tag-row" style="margin-top:12px">
          <button class="${hired ? 'btn-ghost' : 'btn-secondary'}" onclick="window.hireStaff('${member.id}')">${hired ? 'Ativo' : 'Contratar'}</button>
        </div>
      </article>`;
  }).join('');
}
window.hireStaff = (id) => {
  const member = state.staffMarket.find(s => s.id === id);
  if (!member || state.staff[member.role]?.id === member.id) return;
  if (state.academy.money < member.cost) return addLog('Caixa insuficiente para staff.');
  state.academy.money -= member.cost;
  state.staff[member.role] = member;
  addLog(`${member.name} agora lidera o setor ${member.role}.`);
  render();
};
window.acceptSponsorOffer = (id) => {
  const offer = (state.sponsorOffers || []).find(o => o.id === id);
  if (!offer) return;
  state.academy.money += offer.signingBonus;
  state.academy.sponsor += offer.weeklyBoost;
  state.inbox.unshift({ title: `Contrato assinado: ${offer.name}`, body: `Entrada imediata de ${money(offer.signingBonus)} e reforço semanal de ${money(offer.weeklyBoost)}.`, week: state.academy.week });
  state.sponsorOffers = state.sponsorOffers.filter(o => o.id !== id);
  addLog(`Novo patrocínio firmado com ${offer.name}.`);
  render();
};
window.rejectSponsorOffer = (id) => {
  const offer = (state.sponsorOffers || []).find(o => o.id === id);
  if (!offer) return;
  state.sponsorOffers = state.sponsorOffers.filter(o => o.id !== id);
  addLog(`Proposta de ${offer.name} recusada.`);
  render();
};

function updateRanking() {
  const rankMap = new Map(state.ranking.map(r => [r.playerId || r.name, r]));
  state.roster.forEach(player => {
    const existing = [...rankMap.values()].find(r => r.playerId === player.id);
    if (existing) {
      existing.points = Math.max(0, Math.round(player.rankingPoints));
      existing.overall = Math.round(player.overall);
      existing.name = player.name;
      existing.country = player.country;
      existing.age = player.age;
      existing.style = player.style;
    } else {
      state.ranking.push({ rank: 999, name: player.name, country: player.country, points: player.rankingPoints, overall: Math.round(player.overall), age: player.age, style: player.style, playerId: player.id, isUser: true });
    }
  });
  state.ranking.sort((a, b) => b.points - a.points || b.overall - a.overall);
  state.ranking.forEach((row, index) => row.rank = index + 1);
}
function renderRanking() {
  const header = `<div class="ranking-row"><strong>#</strong><strong>Jogador</strong><strong>País</strong><strong>OVR</strong><strong>Pontos</strong></div>`;
  const body = state.ranking.slice(0, 40).map(row => `
    <div class="ranking-row">
      <div>${row.rank}</div>
      <div>${row.isUser ? '⭐ ' : ''}${row.name}</div>
      <div>${row.country}</div>
      <div>${Math.round(row.overall)}</div>
      <div>${Math.round(row.points)}</div>
    </div>`).join('');
  $('#rankingTable').innerHTML = header + body;
}

function getTournamentGate(event) {
  const player = chooseBestPlayer();
  const rank = player ? getPlayerRank(player.id) : 999;
  const mainCut = event.minRank || 999;
  const qualCut = Math.min(160, mainCut + 40);
  if (rank <= mainCut) return { label: 'Chave principal', cls: 'ok' };
  if (rank <= qualCut) return { label: 'Qualifying', cls: 'warn' };
  if ((event.inviteSlots || 0) > 0 && state.academy.reputation >= 40) return { label: 'Wild card possível', cls: 'warn' };
  return { label: `Precisa rank ${mainCut}`, cls: '' };
}

function startScheduledMatch() {
  const player = chooseBestPlayer();
  const event = state.calendar.find(e => e.week === state.academy.week);
  if (!player) return addLog('Nenhum atleta disponível.');
  if (!event) return addLog('Nenhum torneio principal nesta semana. Avance a semana ou treine atletas.');
  if (player.injuredWeeks > 0) return addLog(`${player.name} está lesionado e não pode jogar.`);
  if (state.activeTournament?.event?.week !== state.academy.week) state.activeTournament = null;
  if (!state.activeTournament) createTournamentRun(player, event);
  const run = state.activeTournament;
  if (!run || run.complete) return addLog('Nenhum torneio ativo.');
  const round = run.rounds[run.roundIndex];
  const opponent = pickOpponent(round, player);
  state.match = {
    event, round, drawType: run.entryType, playerId: player.id, playerName: player.name, opponentName: opponent.name, playerScore: 0, opponentScore: 0,
    gamesPlayer: 0, gamesOpponent: 0, set: 1, pointText: '0-0', strategy: currentStrategy, inProgress: true,
    log: [`${event.name} ${round} iniciado contra ${opponent.name}.`], opponent, finished: false,
    lastWinner: null, lastPointAt: performance.now()
  };
  stopAutoPlay();
  $('#matchPlayerName').textContent = player.name;
  $('#matchOpponentName').textContent = opponent.name;
  addLog(`Partida preparada: ${player.name} vs ${opponent.name} em ${event.name} (${round}).`);
  switchTab('match');
  renderMatch();
}

function createTournamentRun(player, event) {
  const gate = getTournamentGate(event);
  const entryType = gate.label === 'Chave principal' ? 'main' : gate.label === 'Qualifying' ? 'qualifying' : gate.label === 'Wild card possível' ? 'wildcard' : null;
  if (!entryType) return addLog('Seu atleta principal ainda não tem acesso a este evento.');
  const rounds = entryType === 'qualifying' ? ['Q', 'R16', 'QF', 'SF', 'F'] : ['R16', 'QF', 'SF', 'F'];
  state.activeTournament = {
    playerId: player.id,
    event,
    entryType,
    roundIndex: 0,
    rounds,
    complete: false,
    wins: 0
  };
  addLog(`Entrada confirmada em ${event.name} via ${entryType === 'main' ? 'chave principal' : entryType === 'qualifying' ? 'qualifying' : 'wild card'}.`);
}

function pickOpponent(round, player) {
  const basePool = state.ranking.filter(r => !r.isUser);
  const playerRank = getPlayerRank(player.id);
  const band = round === 'Q' ? [playerRank - 20, playerRank + 30] : round === 'R16' ? [Math.max(1, playerRank - 40), playerRank + 40] : round === 'QF' ? [1, Math.max(32, playerRank + 15)] : round === 'SF' ? [1, 20] : [1, 12];
  const pool = basePool.filter(r => r.rank >= band[0] && r.rank <= band[1]);
  const set = pool.length ? pool : basePool.slice(0, 32);
  return structuredClone(set[Math.floor(Math.random() * set.length)]);
}

function playPoint() {
  if (!state.match?.inProgress || state.match.finished) return addLog('Inicie uma partida primeiro.');
  const player = state.roster.find(p => p.id === state.match.playerId);
  const opp = state.match.opponent;
  const effects = STRATEGY_EFFECTS[currentStrategy];
  const coachBonus = getStaffBonus('Tecnico', 'match');
  const psychBonus = getStaffBonus('Psicologo', 'mental');
  const medicalSafety = getStaffBonus('Fisioterapeuta', 'injury') * -0.25;
  const playerPower = player.overall + player.serve * 0.18 + player.forehand * 0.16 + player.mental * 0.12 + player.health * 0.06 + coachBonus + psychBonus * 0.5 - player.fatigue * 0.22 + effects.offense + effects.serve;
  const oppPower = opp.overall + Math.random() * 8 + (state.match.gamesOpponent > state.match.gamesPlayer ? 3 : 0);
  const errorPenalty = Math.max(0, effects.error + player.fatigue * 0.04 - psychBonus * 0.2 - medicalSafety);
  const pressureBonus = effects.pressure + (state.match.gamesPlayer < state.match.gamesOpponent ? 2 : 0);
  const defenseStabilizer = effects.defense * 0.8;
  const chance = playerPower + pressureBonus + defenseStabilizer - errorPenalty - oppPower + 50;
  const won = Math.random() * 100 < chance;
  if (won) state.match.playerScore += 1; else state.match.opponentScore += 1;
  state.match.lastWinner = won ? 'player' : 'opponent';
  state.match.lastPointAt = performance.now();
  player.fatigue = Math.min(100, player.fatigue + 1 + Math.max(0, effects.stamina));
  player.health = Math.max(42, player.health - 0.35 - Math.max(0, effects.stamina) * 0.2);
  maybeInjure(player, 1.1);
  resolveGame();
  drawCourt(won ? 'player' : 'opponent');
  renderMatch();
}

function autoPlayGame() {
  if (!state.match?.inProgress || state.match.finished) return;
  startAutoPlay(autoPlaySpeed);
}

function resolveGame() {
  const p = state.match.playerScore;
  const o = state.match.opponentScore;
  if (p >= 4 || o >= 4) {
    if (Math.abs(p - o) >= 2) {
      if (p > o) state.match.gamesPlayer += 1; else state.match.gamesOpponent += 1;
      addMatchLog(`Game para ${p > o ? state.match.playerName : state.match.opponentName}.`);
      state.match.playerScore = 0; state.match.opponentScore = 0;
    }
  }
  state.match.pointText = `${SCORE_NAMES[Math.min(state.match.playerScore, 4)]}-${SCORE_NAMES[Math.min(state.match.opponentScore, 4)]}`;
  if ((state.match.gamesPlayer >= 6 || state.match.gamesOpponent >= 6) && Math.abs(state.match.gamesPlayer - state.match.gamesOpponent) >= 2) {
    finishMatch(state.match.gamesPlayer > state.match.gamesOpponent);
  }
}

function finishMatch(playerWon) {
  const player = state.roster.find(p => p.id === state.match.playerId);
  const event = state.match.event;
  const run = state.activeTournament;
  const round = state.match.round;
  const roundFactor = { Q: 0.08, R16: 0.18, QF: 0.34, SF: 0.56, F: 1 }[round] || 0.1;
  const rankFactor = Math.max(0.82, 1 + (120 - getPlayerRank(player.id)) / 500);
  const pointsGain = Math.round(event.prize * roundFactor / 180 * rankFactor * (playerWon ? 1 : 0.45));
  const cashGain = Math.round(event.prize * roundFactor * (playerWon ? 1 : 0.35));
  player.rankingPoints += pointsGain;
  player.morale = clamp((player.morale || 70) + (playerWon ? 8 : -3), 35, 100);
  player.fatigue = Math.min(100, player.fatigue + 6);
  state.academy.money += cashGain;
  state.academy.reputation += playerWon ? 4 : 1;
  player.lastResult = `${event.name} ${playerWon ? 'venceu ' + round : 'parou em ' + round}`;
  state.summary.unshift(`${player.name} ${playerWon ? 'venceu' : 'caiu em'} ${round} de ${event.name}. +${pointsGain} pts / ${money(cashGain)}.`);
  state.summary = state.summary.slice(0, 8);
  addLog(`${player.name} ${playerWon ? 'venceu' : 'perdeu'} em ${event.name} (${round}).`);
  state.inbox.unshift({ title: `${event.name}: ${player.name}`, body: `${playerWon ? 'Vitória importante' : 'Derrota'} na rodada ${round}. ${pointsGain} pontos processados no ranking.`, week: state.academy.week });
  state.match.finished = true;
  state.match.inProgress = false;
  stopAutoPlay();

  if (!run) return render();
  if (!playerWon) {
    run.complete = true;
    state.activeTournament = null;
    addMatchLog('Eliminado. Hora de reagrupar.');
  } else {
    run.wins += 1;
    run.roundIndex += 1;
    if (run.roundIndex >= run.rounds.length) {
      run.complete = true;
      state.activeTournament = null;
      player.rankingPoints += Math.round(event.prize / 75);
      state.academy.money += Math.round(event.prize * 0.4);
      state.academy.reputation += event.tier === 'Grand Slam' ? 18 : event.tier.includes('Masters') ? 12 : 8;
      addMatchLog('Título conquistado! Sua academia deu um salto de prestígio.');
      player.lastResult = `${event.name} campeão`;
      state.summary.unshift(`${player.name} foi campeão de ${event.name}!`);
    } else {
      addMatchLog(`Vitória. Próxima rodada: ${run.rounds[run.roundIndex]}.`);
    }
  }
  render();
}

function renderMatch() {
  const match = state.match;
  $('#roundLabel').textContent = state.activeTournament ? `Rodada ${state.activeTournament.rounds[state.activeTournament.roundIndex] || 'fim'}` : 'Rodada -';
  $('#tournamentLabel').textContent = state.activeTournament ? state.activeTournament.event.name : 'Nenhum torneio';
  if (!match) {
    $('#scorePlayer').textContent = '0'; $('#scoreOpponent').textContent = '0'; $('#setLabel').textContent = 'Set 1'; $('#pointLabel').textContent = '0-0';
    $('#matchLog').textContent = state.activeTournament ? `Torneio ativo em ${state.activeTournament.event.name}. Toque em iniciar rodada.` : 'Nenhuma partida em andamento.';
    drawCourt();
    return;
  }
  $('#scorePlayer').textContent = match.gamesPlayer;
  $('#scoreOpponent').textContent = match.gamesOpponent;
  $('#setLabel').textContent = `Set ${match.set}`;
  $('#pointLabel').textContent = match.pointText;
  $('#matchLog').textContent = match.log.slice(-12).join('\n');
  const autoLabel = document.getElementById('autoModeLabel');
  if (autoLabel) autoLabel.textContent = autoPlayTimer ? `Auto ${autoPlaySpeed}x` : `Manual • ${autoPlaySpeed}x pronto`;
  applyBuildMarkers();
}
function addMatchLog(text) { if (!state.match) return; state.match.log.push(text); }

function advanceWeek() {
  const weeklyIncome = calculateSponsor();
  const weeklyCosts = calculateWeeklyCosts();
  state.academy.money += weeklyIncome - weeklyCosts;
  if (state.activeTournament && state.activeTournament.event.week < state.academy.week) state.activeTournament = null;
  state.roster.forEach(player => {
    const physio = getStaffBonus('Fisioterapeuta', 'recovery');
    player.fatigue = Math.max(0, player.fatigue - (7 + state.academy.facilities.medical * 1.4 + physio * 0.45));
    player.health = Math.min(100, player.health + (4 + state.academy.facilities.medical + physio * 0.25));
    if (player.injuredWeeks > 0) {
      player.injuredWeeks -= 1;
      if (player.injuredWeeks <= 0) { player.injuredWeeks = 0; addLog(`${player.name} recebeu alta médica.`); }
    }
    player.morale = Math.max(45, (player.morale || 70) - 1 + state.academy.facilities.training * 0.2);
  });
  state.academy.week += 1;
  maybeCreateWeeklyNews();
  maybeCreateSponsorOffer();
  evaluateObjectives();
  if (state.academy.week > 52) {
    state.academy.week = 1;
    state.academy.season += 1;
    rotateSeason();
  }
  stopAutoPlay();
  state.match = null;
  if (state.academy.money < 0) {
    state.academy.bankruptcyWarnings += 1;
    addLog(state.academy.bankruptcyWarnings >= 4 ? 'Falência iminente: recupere o caixa urgentemente.' : 'Sua academia entrou no vermelho.');
  } else {
    state.academy.bankruptcyWarnings = 0;
    addLog(`Semana ${state.academy.week} iniciada.`);
  }
  state.summary.unshift(`Fluxo semanal: ${money(weeklyIncome)} de entrada e ${money(weeklyCosts)} de saída.`);
  state.summary = state.summary.slice(0, 8);
  render();
}

function rotateSeason() {
  state.ranking.forEach(row => row.points = Math.round(row.points * (row.isUser ? 0.62 : 0.7)));
  state.roster.forEach(player => {
    player.age += 1;
    player.overall = Math.min(player.potential, player.overall + 1.4);
    player.rankingPoints = Math.round(player.rankingPoints * 0.65 + 80);
    player.health = Math.min(100, player.health + 12);
    player.injuredWeeks = 0;
  });
  state.objectives.current = state.academy.season <= 2027 ? 'Colocar um atleta no Top 80' : 'Brigar por ATP 500';
  state.inbox.unshift({ title: `Nova temporada ${state.academy.season}`, body: 'Novo calendário, novos convites e nova pressão por resultados.', week: state.academy.week });
  addLog(`Nova temporada ${state.academy.season} começou.`);
}

function maybeCreateWeeklyNews() {
  const player = chooseBestPlayer();
  if (!player) return;
  const rank = getPlayerRank(player.id);
  if (state.academy.week === 2) {
    state.inbox.unshift({ title: 'Bem-vindo ao circuito', body: 'Seu staff sugere foco em caixa, staff-chave e pontos de ranking nas primeiras 12 semanas.', week: state.academy.week });
  }
  if (rank <= 120 && !state.flags.top120Mail) {
    state.flags.top120Mail = true;
    state.inbox.unshift({ title: 'Marco alcançado', body: `${player.name} entrou na zona Top 120 e passa a mirar entradas mais frequentes em chaves principais.`, week: state.academy.week });
  }
  if (player.injuredWeeks > 0) {
    state.inbox.unshift({ title: 'Boletim médico', body: `${player.name} segue em recuperação. Ajuste carga e preserve saúde para evitar recaída.`, week: state.academy.week });
  }
  state.inbox = state.inbox.slice(0, 18);
}

function maybeCreateSponsorOffer() {
  state.sponsorOffers ||= [];
  if (state.sponsorOffers.length >= 2) return;
  const trigger = state.academy.week % 4 === 0 || state.academy.reputation >= 28;
  if (!trigger || Math.random() > 0.55) return;
  const id = `offer-${state.academy.season}-${state.academy.week}-${Math.floor(Math.random()*999)}`;
  const rep = state.academy.reputation;
  const offer = {
    id,
    name: rep >= 40 ? 'Apex Rackets' : rep >= 26 ? 'Blue Court Energy' : 'Local Sports Hub',
    signingBonus: 12000 + rep * 420,
    weeklyBoost: 1800 + rep * 75,
    requirement: rep >= 40 ? 'manter atleta no Top 80' : rep >= 26 ? 'avançar em ATP 250/500' : 'crescer reputação regional'
  };
  state.sponsorOffers.unshift(offer);
  state.inbox.unshift({ title: `Nova proposta: ${offer.name}`, body: `Oferta comercial com bônus de assinatura de ${money(offer.signingBonus)}.`, week: state.academy.week });
}

function evaluateObjectives() {
  const best = chooseBestPlayer();
  if (!best) return;
  const rank = getPlayerRank(best.id);
  if (rank <= 80) state.objectives.current = 'Consolidar Top 80 e buscar ATP 500';
  else if (rank <= 120) state.objectives.current = 'Atingir Top 80';
  else state.objectives.current = 'Entrar no Top 120';
}


function calculateSponsor() {
  return Math.round(state.academy.sponsor * (1 + state.academy.reputation / 140 + getStaffBonus('Financeiro', 'sponsor') / 100));
}
function calculateWeeklyCosts() {
  const salaries = state.roster.reduce((sum, p) => sum + p.salary, 0) + Object.values(state.staff).filter(Boolean).reduce((sum, s) => sum + s.salary, 0);
  const financeCut = getStaffBonus('Financeiro', 'costs');
  return Math.round((state.academy.weeklyCosts + salaries) * (1 - Math.abs(Math.min(0, financeCut)) / 100));
}
function getStaffBonus(role, key) { const member = state.staff[role]; return member?.effects?.[key] || 0; }
function chooseBestPlayer() {
  return [...state.roster].filter(p => p.injuredWeeks <= 0).sort((a, b) => (b.overall + b.health * 0.08 - b.fatigue * 0.2) - (a.overall + a.health * 0.08 - a.fatigue * 0.2))[0] || null;
}
function getPlayerRank(playerId) { updateRanking(); return state.ranking.find(r => r.playerId === playerId)?.rank || 999; }
function addLog(text) { state.logs.unshift(text); state.logs = state.logs.slice(0, 24); }
function initials(name) { return name.split(' ').slice(0, 2).map(part => part[0]).join('').toUpperCase(); }
function money(v) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v); }
function round(v) { return Math.round(v); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function maybeInjure(player, baseChance) {
  const physio = Math.abs(Math.min(0, getStaffBonus('Fisioterapeuta', 'injury')));
  const risk = Math.max(0.4, baseChance + player.fatigue * 0.04 - state.academy.facilities.medical * 0.5 - physio * 0.35);
  if (player.injuredWeeks > 0) return;
  if (Math.random() * 100 < risk * 0.6) {
    player.injuredWeeks = 1 + Math.floor(Math.random() * 3);
    player.health = Math.max(35, player.health - 12);
    addLog(`${player.name} sofreu uma lesão leve.`);
  }
}

function drawCourt(lastWinner = null) {
  if (!ctx || !canvas) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const targetWidth = Math.max(320, Math.round((rect.width || 960) * dpr));
  const targetHeight = Math.max(180, Math.round(targetWidth * 0.5625));
  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }
  const w = canvas.width;
  const h = canvas.height;
  const now = courtClock || performance.now();
  const match = state?.match || null;
  if (match && lastWinner) {
    match.lastWinner = lastWinner;
    match.lastPointAt = now;
  }
  const pulse = now * 0.001;
  const rallySeed = (now % 1600) / 1600;
  const rallyT = rallySeed < 0.5 ? rallySeed * 2 : (1 - rallySeed) * 2;
  const player = { x: w * (0.34 + Math.sin(pulse * 2.0) * 0.05), y: h * 0.78 + Math.sin(pulse * 3.1) * 4 };
  const opponent = { x: w * (0.66 + Math.cos(pulse * 1.8) * 0.05), y: h * 0.22 + Math.cos(pulse * 2.8) * 4 };
  const pointAge = match?.lastPointAt ? Math.min(1, (now - match.lastPointAt) / 520) : 1;
  const nudgeToPlayer = match?.lastWinner === 'player' ? 1 - pointAge : 0;
  const nudgeToOpponent = match?.lastWinner === 'opponent' ? 1 - pointAge : 0;
  const ball = {
    x: player.x + (opponent.x - player.x) * rallyT + (nudgeToPlayer - nudgeToOpponent) * 36,
    y: player.y + (opponent.y - player.y) * rallyT - Math.sin(rallyT * Math.PI) * h * 0.16
  };

  ctx.clearRect(0, 0, w, h);
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#0c3c71'); bg.addColorStop(0.55, '#135b7b'); bg.addColorStop(1, '#0f7666');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.78)'; ctx.lineWidth = Math.max(2, w * 0.0042);
  ctx.strokeRect(w * 0.12, h * 0.14, w * 0.76, h * 0.72);
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.14); ctx.lineTo(w * 0.5, h * 0.86);
  ctx.moveTo(w * 0.12, h * 0.5); ctx.lineTo(w * 0.88, h * 0.5);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(w * 0.12, h * 0.498, w * 0.76, 2);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(w * 0.5, h * 0.5, Math.max(3, w * 0.005), 0, Math.PI * 2); ctx.fill();

  function drawAthlete(a, color, mirror = 1) {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(0, -24, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(-8, -14, 16, 34);
    ctx.fillRect(-18, 18, 10, 30); ctx.fillRect(8, 18, 10, 30);
    ctx.save();
    ctx.rotate(mirror * 0.55 + Math.sin(pulse * 5.0) * 0.08);
    ctx.fillRect(-3, -10, 6, 28);
    ctx.strokeStyle = '#f8fbff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 24, 14, 18, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    ctx.restore();
  }
  drawAthlete(opponent, match?.lastWinner === 'opponent' ? '#ff97a9' : '#d5e4ff', -1);
  drawAthlete(player, match?.lastWinner === 'player' ? '#8cff80' : '#66ecff', 1);

  for (let i = 0; i < 4; i++) {
    const t = Math.max(0, rallyT - i * 0.06);
    const tx = player.x + (opponent.x - player.x) * t;
    const ty = player.y + (opponent.y - player.y) * t - Math.sin(t * Math.PI) * h * 0.16;
    ctx.fillStyle = `rgba(255,255,255,${0.16 - i * 0.03})`;
    ctx.beginPath(); ctx.arc(tx, ty, Math.max(2, 6 - i), 0, Math.PI * 2); ctx.fill();
  }

  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.ellipse(ball.x, ball.y + 16, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
  const glow = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, 20);
  glow.addColorStop(0, 'rgba(255,255,255,0.95)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(ball.x, ball.y, 20, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fffef2'; ctx.beginPath(); ctx.arc(ball.x, ball.y, 7, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = 'rgba(7,14,27,0.74)'; ctx.fillRect(18, 16, Math.min(360, w * 0.48), 58);
  ctx.fillStyle = '#edf7ff'; ctx.font = `700 ${Math.max(16, w * 0.022)}px Inter, system-ui, sans-serif`;
  ctx.fillText(match ? `${match.playerName} vs ${match.opponentName}` : '2D Match Center', 30, 38);
  ctx.fillStyle = '#9fb6cf'; ctx.font = `500 ${Math.max(11, w * 0.014)}px Inter, system-ui, sans-serif`;
  ctx.fillText(match ? `Estratégia ${currentStrategy.toUpperCase()} • ${autoPlayTimer ? 'AUTO' : 'MANUAL'}` : 'Quadra animada', 30, 60);
}

