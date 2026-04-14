import { loadContent } from './contentLoader.js';
import { buildInitialState, saveState, loadState, clearState } from './state.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const money = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

const STRATEGY_EFFECTS = {
  balanced: { offense: 0, error: 0, serve: 0, pressure: 0, stamina: 0 },
  aggressive: { offense: 8, error: 6, serve: 1, pressure: 2, stamina: 2 },
  defensive: { offense: -4, error: -5, serve: 0, pressure: -1, stamina: -1 },
  serve: { offense: 2, error: 1, serve: 8, pressure: 0, stamina: 1 },
  pressure: { offense: 4, error: 3, serve: 0, pressure: 7, stamina: 3 },
  control: { offense: -1, error: -3, serve: 1, pressure: 1, stamina: -1 }
};

let content;
let state;
let currentStrategy = 'balanced';
let canvas, ctx;

init();

async function init() {
  content = await loadContent();
  state = loadState() || buildInitialState(content);
  wireTabs();
  wireActions();
  canvas = $('#matchCanvas');
  ctx = canvas.getContext('2d');
  drawCourt();
  render();
}

function wireTabs() {
  $$('#mainTabs .tab-btn').forEach(btn => btn.addEventListener('click', () => {
    $$('#mainTabs .tab-btn').forEach(x => x.classList.remove('active'));
    $$('.tab-panel').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    $('#tab-' + btn.dataset.tab).classList.add('active');
  }));
  $('#openCalendarBtn').addEventListener('click', () => document.querySelector('[data-tab="calendar"]').click());
}

function wireActions() {
  $('#advanceWeekBtn').addEventListener('click', advanceWeek);
  $('#saveBtn').addEventListener('click', () => { saveState(state); addLog('Jogo salvo localmente.'); render(); });
  $('#resetBtn').addEventListener('click', () => {
    clearState();
    state = buildInitialState(content);
    render();
  });
  $('#startMatchBtn').addEventListener('click', startScheduledMatch);
  $('#playPointBtn').addEventListener('click', playPoint);
  $('#autoMatchBtn').addEventListener('click', autoPlaySet);
  $$('.action-btn').forEach(btn => btn.addEventListener('click', () => {
    $$('.action-btn').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    currentStrategy = btn.dataset.strategy;
    addMatchLog(`Estratégia alterada para ${btn.textContent}.`);
  }));
}

function render() {
  $('#seasonLabel').textContent = state.academy.season;
  $('#weekLabel').textContent = state.academy.week;
  $('#moneyLabel').textContent = money(state.academy.money);
  $('#reputationLabel').textContent = state.academy.reputation;
  $('#sponsorLabel').textContent = money(calculateSponsor());
  $('#costsLabel').textContent = money(calculateWeeklyCosts());
  $('#rosterCountLabel').textContent = state.roster.length;
  $('#statusText').textContent = state.academy.money < 0 ? 'Risco de falência' : 'Pronto para competir';
  renderNextEvents();
  renderSummary();
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

function renderNextEvents() {
  const list = $('#nextEventsList');
  const next = state.calendar.filter(e => e.week >= state.academy.week).slice(0, 5);
  list.innerHTML = next.map(event => `
    <div class="list-item">
      <div><strong>Semana ${event.week}</strong><div class="small">${event.name} • ${event.tier}</div></div>
      <div class="small">${event.surface}</div>
    </div>
  `).join('');
}

function renderSummary() {
  $('#weekSummary').innerHTML = state.summary.slice(-5).map(text => `<div class="list-item"><span>${text}</span></div>`).join('');
}

function renderFacilities() {
  const map = {
    training: 'Centro de Treino',
    medical: 'Centro Médico',
    finance: 'Financeiro',
    scouting: 'Scouting'
  };
  $('#facilityList').innerHTML = Object.entries(state.academy.facilities).map(([key, level]) => `
    <article class="panel-card">
      <h4>${map[key]}</h4>
      <p class="muted">Nível ${level}</p>
      <button class="btn-secondary" onclick="window.upgradeFacility('${key}')">Upgrade (${money((level + 1) * 18000)})</button>
    </article>
  `).join('');
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
  $('#rosterList').innerHTML = state.roster.map(player => `
    <article class="player-card">
      <header>
        <div class="avatar">${initials(player.name)}</div>
        <div>
          <h4>${player.name}</h4>
          <div class="small">${player.country} • ${player.age} anos • ${player.style}</div>
        </div>
      </header>
      <div class="metric-row">
        <span class="metric">OVR ${player.overall}</span>
        <span class="metric">POT ${player.potential}</span>
        <span class="metric">STA ${player.stamina}</span>
        <span class="metric">MEN ${player.mental}</span>
        <span class="metric">Fatiga ${player.fatigue}</span>
      </div>
      <div class="tag-row" style="margin-top:12px">
        <button class="btn-secondary" onclick="window.trainPlayer('${player.id}','technique')">Treino Técnico</button>
        <button class="btn-secondary" onclick="window.trainPlayer('${player.id}','fitness')">Treino Físico</button>
      </div>
    </article>
  `).join('');
}

window.trainPlayer = (playerId, type) => {
  const player = state.roster.find(p => p.id === playerId);
  if (!player) return;
  const trainingBoost = state.academy.facilities.training * 0.9 + getStaffBonus('Tecnico', 'training');
  const fatigueGain = type === 'fitness' ? 6 : 4;
  player.fatigue = Math.min(100, player.fatigue + fatigueGain);
  if (type === 'technique') {
    player.overall = Math.min(player.potential, player.overall + 0.6 + trainingBoost * 0.06);
    player.forehand += 1;
    player.backhand += 1;
  } else {
    player.stamina = Math.min(99, player.stamina + 1 + trainingBoost * 0.04);
    player.overall = Math.min(player.potential, player.overall + 0.3);
  }
  player.morale = Math.min(100, player.morale + 2);
  addLog(`${player.name} realizou treino ${type === 'fitness' ? 'físico' : 'técnico'}.`);
  render();
};

function renderCalendar() {
  $('#calendarList').innerHTML = state.calendar.map(event => {
    const available = state.ranking.find(r => r.playerId === state.roster[0]?.id)?.rank || 999;
    const eligible = available <= event.minRank || event.minRank >= 120;
    return `
      <div class="list-item">
        <div>
          <strong>Semana ${event.week} • ${event.name}</strong>
          <div class="small">${event.tier} • ${event.surface} • prêmio ${money(event.prize)}</div>
        </div>
        <div class="${eligible ? '' : 'warn'}">${eligible ? 'Elegível' : 'Precisa rank ' + event.minRank}</div>
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
    </article>
  `).join('');
}

window.signTalent = (id) => {
  const talent = state.marketTalents.find(t => t.id === id);
  if (!talent) return;
  if (state.academy.money < talent.fee) return addLog('Caixa insuficiente para contratação.');
  state.academy.money -= talent.fee;
  state.roster.push({
    ...talent,
    stamina: 78,
    mental: 68,
    serve: 67,
    forehand: 68,
    backhand: 66,
    morale: 74,
    fatigue: 10,
    injuries: 0,
    rankingPoints: 40,
    isUser: true
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
      </article>
    `;
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
      state.ranking.push({
        rank: 999,
        name: player.name,
        country: player.country,
        points: player.rankingPoints,
        overall: Math.round(player.overall),
        age: player.age,
        style: player.style,
        playerId: player.id,
        isUser: true
      });
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

function startScheduledMatch() {
  const player = chooseBestPlayer();
  const event = state.calendar.find(e => e.week === state.academy.week) || state.calendar.find(e => e.week > state.academy.week);
  if (!player || !event) return addLog('Nenhum evento disponível.');
  const userRank = getPlayerRank(player.id);
  if (!(userRank <= event.minRank || event.minRank >= 120)) return addLog('Seu atleta principal ainda não tem ranking para este evento.');
  const opponentSeed = state.ranking.filter(r => !r.isUser).slice(0, 32).sort(() => Math.random() - 0.5)[0];
  state.match = {
    event,
    playerId: player.id,
    playerName: player.name,
    opponentName: opponentSeed.name,
    playerScore: 0,
    opponentScore: 0,
    gamesPlayer: 0,
    gamesOpponent: 0,
    set: 1,
    pointText: '0-0',
    strategy: currentStrategy,
    inProgress: true,
    log: [`${event.name} iniciado contra ${opponentSeed.name}.`],
    opponent: opponentSeed,
    finished: false
  };
  $('#matchPlayerName').textContent = player.name;
  $('#matchOpponentName').textContent = opponentSeed.name;
  addLog(`Partida preparada: ${player.name} vs ${opponentSeed.name} em ${event.name}.`);
  document.querySelector('[data-tab="match"]').click();
  renderMatch();
}

function playPoint() {
  if (!state.match?.inProgress || state.match.finished) return addLog('Inicie uma partida primeiro.');
  const player = state.roster.find(p => p.id === state.match.playerId);
  const opp = state.match.opponent;
  const effects = STRATEGY_EFFECTS[currentStrategy];
  const coachBonus = getStaffBonus('Tecnico', 'match');
  const psychBonus = getStaffBonus('Psicologo', 'mental');
  const playerPower = player.overall + player.serve * 0.18 + player.forehand * 0.16 + player.mental * 0.12 + coachBonus + psychBonus * 0.5 - player.fatigue * 0.18 + effects.offense + effects.serve;
  const oppPower = opp.overall + (Math.random() * 8) + (state.match.gamesOpponent > state.match.gamesPlayer ? 3 : 0);
  const errorPenalty = Math.max(0, effects.error + player.fatigue * 0.03 - psychBonus * 0.2);
  const pressureBonus = effects.pressure + (state.match.gamesPlayer < state.match.gamesOpponent ? 2 : 0);
  const chance = playerPower + pressureBonus - errorPenalty - oppPower + 50;
  const won = Math.random() * 100 < chance;
  if (won) state.match.playerScore += 1; else state.match.opponentScore += 1;
  player.fatigue = Math.min(100, player.fatigue + 1 + Math.max(0, effects.stamina));
  resolveGame();
  drawCourt(won ? 'player' : 'opponent');
  renderMatch();
}

function autoPlaySet() {
  if (!state.match?.inProgress || state.match.finished) return;
  let guard = 0;
  while (!state.match.finished && guard < 60) {
    playPoint();
    guard += 1;
    if (state.match.gamesPlayer >= 6 || state.match.gamesOpponent >= 6) break;
  }
}

function resolveGame() {
  const scoreMap = ['0', '15', '30', '40', 'AD'];
  const p = state.match.playerScore;
  const o = state.match.opponentScore;
  if (p >= 4 || o >= 4) {
    if (Math.abs(p - o) >= 2) {
      if (p > o) state.match.gamesPlayer += 1; else state.match.gamesOpponent += 1;
      addMatchLog(`Game para ${p > o ? state.match.playerName : state.match.opponentName}.`);
      state.match.playerScore = 0;
      state.match.opponentScore = 0;
    }
  }
  state.match.pointText = `${scoreMap[Math.min(state.match.playerScore, 4)]}-${scoreMap[Math.min(state.match.opponentScore, 4)]}`;
  if ((state.match.gamesPlayer >= 6 || state.match.gamesOpponent >= 6) && Math.abs(state.match.gamesPlayer - state.match.gamesOpponent) >= 2) {
    finishMatch(state.match.gamesPlayer > state.match.gamesOpponent);
  }
}

function finishMatch(playerWon) {
  const player = state.roster.find(p => p.id === state.match.playerId);
  const event = state.match.event;
  const pointsGain = playerWon ? event.prize / 600 : event.prize / 1600;
  const cashGain = playerWon ? event.prize : Math.round(event.prize * 0.18);
  player.rankingPoints += pointsGain;
  player.morale = Math.min(100, player.morale + (playerWon ? 10 : -3));
  player.fatigue = Math.min(100, player.fatigue + 8);
  state.academy.money += cashGain;
  state.academy.reputation += playerWon ? 5 : 1;
  state.summary = [`${player.name} ${playerWon ? 'venceu' : 'caiu em'} ${event.name}. Caixa ${playerWon ? 'fortalecido' : 'ainda competitivo'}.`, ...state.summary].slice(0, 8);
  addLog(`${player.name} ${playerWon ? 'venceu' : 'perdeu'} no ${event.name}. ${playerWon ? 'Premiação recebida.' : 'Alguns pontos ainda foram somados.'}`);
  state.match.finished = true;
  state.match.inProgress = false;
  addMatchLog(playerWon ? 'Vitória! Seu atleta dominou o duelo.' : 'Derrota. Hora de reajustar o plano.');
}

function renderMatch() {
  const match = state.match;
  if (!match) {
    $('#scorePlayer').textContent = '0';
    $('#scoreOpponent').textContent = '0';
    $('#setLabel').textContent = 'Set 1';
    $('#pointLabel').textContent = '0-0';
    $('#matchLog').textContent = 'Nenhuma partida em andamento.';
    drawCourt();
    return;
  }
  $('#scorePlayer').textContent = match.gamesPlayer;
  $('#scoreOpponent').textContent = match.gamesOpponent;
  $('#setLabel').textContent = `Set ${match.set}`;
  $('#pointLabel').textContent = match.pointText;
  $('#matchLog').textContent = match.log.slice(-12).join('\n');
}

function addMatchLog(text) {
  if (!state.match) return;
  state.match.log.push(text);
}

function advanceWeek() {
  const weeklyIncome = calculateSponsor();
  const weeklyCosts = calculateWeeklyCosts();
  state.academy.money += weeklyIncome - weeklyCosts;
  state.roster.forEach(player => {
    const physio = getStaffBonus('Fisioterapeuta', 'recovery');
    player.fatigue = Math.max(0, player.fatigue - (8 + state.academy.facilities.medical * 1.2 + physio * 0.4));
    player.morale = Math.max(45, player.morale - 1 + state.academy.facilities.training * 0.2);
  });
  state.academy.week += 1;
  if (state.academy.week > 52) {
    state.academy.week = 1;
    state.academy.season += 1;
    rotateSeason();
  }
  state.match = null;
  if (state.academy.money < 0) {
    addLog('Sua academia entrou no vermelho. Mais algumas semanas assim e o projeto quebra.');
  } else {
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
    player.overall = Math.min(player.potential, player.overall + 1.5);
    player.rankingPoints = Math.round(player.rankingPoints * 0.65 + 80);
  });
  addLog(`Nova temporada ${state.academy.season} começou.`);
}

function calculateSponsor() {
  return Math.round(state.academy.sponsor * (1 + state.academy.reputation / 140 + getStaffBonus('Financeiro', 'sponsor') / 100));
}

function calculateWeeklyCosts() {
  const salaries = state.roster.reduce((sum, p) => sum + p.salary, 0) + Object.values(state.staff).filter(Boolean).reduce((sum, s) => sum + s.salary, 0);
  const financeCut = getStaffBonus('Financeiro', 'costs');
  return Math.round((state.academy.weeklyCosts + salaries) * (1 - Math.abs(Math.min(0, financeCut)) / 100));
}

function getStaffBonus(role, key) {
  const member = state.staff[role];
  return member?.effects?.[key] || 0;
}

function chooseBestPlayer() {
  return [...state.roster].sort((a, b) => (b.overall - b.fatigue * 0.18) - (a.overall - a.fatigue * 0.18))[0];
}

function getPlayerRank(playerId) {
  updateRanking();
  return state.ranking.find(r => r.playerId === playerId)?.rank || 999;
}

function addLog(text) {
  state.logs.push(text);
}

function initials(name) {
  return name.split(' ').slice(0, 2).map(part => part[0]).join('').toUpperCase();
}

function drawCourt(lastWinner = null) {
  const w = canvas?.width || 960;
  const h = canvas?.height || 540;
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, '#0e3a69');
  gradient.addColorStop(1, '#0d6c66');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 4;
  ctx.strokeRect(120, 80, w - 240, h - 160);
  ctx.beginPath(); ctx.moveTo(w / 2, 80); ctx.lineTo(w / 2, h - 80); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(120, h / 2); ctx.lineTo(w - 120, h / 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(w/2, h/2, 5, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.fillStyle = lastWinner === 'player' ? '#8cff80' : '#61ebff';
  ctx.beginPath(); ctx.arc(w * 0.35, h * 0.72, 20, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = lastWinner === 'opponent' ? '#ff7a90' : '#c9d8f3';
  ctx.beginPath(); ctx.arc(w * 0.65, h * 0.28, 20, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(lastWinner === 'player' ? w * 0.42 : w * 0.58, lastWinner === 'player' ? h * 0.56 : h * 0.44, 8, 0, Math.PI * 2); ctx.fill();
}
