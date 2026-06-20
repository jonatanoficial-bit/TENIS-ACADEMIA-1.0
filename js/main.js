import { loadContent } from './contentLoader.js';
import { buildInitialState, saveState, loadState, clearState, migrateSave } from './state.js';
import { BUILD_INFO, BUILD_LABEL } from './build.js';
import { enrichPlayer, categoryAverage, surfaceLabel } from './modules/player-database.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const canvas = $('#matchCanvas');
const ctx = canvas?.getContext('2d');
let state;
let content;
let currentStrategy = 'balanced';

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
let autoPlayTimer = null;
let autoPlaySpeed = 1;
let courtClock = 0;
let courtAnimId = null;

const PLAYER_AVATARS = [
  'assets/branding/players/player_blond.png',
  'assets/branding/players/player_latino.png',
  'assets/branding/players/player_asian.png',
  'assets/branding/players/player_black.png',
  'assets/branding/players/player_brunette.png'
];
const STAFF_AVATARS = {
  'Tecnico': 'assets/branding/staff/coach.png',
  'Treinador Chefe': 'assets/branding/staff/coach.png',
  'Fisioterapeuta': 'assets/branding/staff/doctor.png',
  'Departamento Medico': 'assets/branding/staff/doctor.png',
  'Financeiro': 'assets/branding/staff/finance.png',
  'Psicologo': 'assets/branding/staff/finance.png',
  'Scouting': 'assets/branding/staff/finance.png',
  'Preparador Fisico': 'assets/branding/staff/coach.png',
  'Nutricionista': 'assets/branding/staff/doctor.png',
  'Analista': 'assets/branding/staff/finance.png'
};
const TOURNAMENT_LOGOS = [
  ['brisbane', 'assets/branding/logos/atp250_brisbane.png'],
  ['auckland', 'assets/branding/logos/atp250_auckland.png'],
  ['australian open', 'assets/branding/logos/grandslam_australianopen.png'],
  ['doha', 'assets/branding/logos/atp250_doha.png'],
  ['indian wells', 'assets/branding/logos/masters_indianwells.png'],
  ['miami', 'assets/branding/logos/masters_miami.png'],
  ['monte carlo', 'assets/branding/logos/masters_montecarlo.png'],
  ['madrid', 'assets/branding/logos/masters_madrid.png'],
  ['rome', 'assets/branding/logos/masters_rome.png'],
  ['roland garros', 'assets/branding/logos/grandslam_rolandgarros.png'],
  ['wimbledon', 'assets/branding/logos/grandslam_wimbledon.png'],
  ['washington', 'assets/branding/logos/atp500_washington.png'],
  ['canada', 'assets/branding/logos/masters_canada.png'],
  ['cincinnati', 'assets/branding/logos/masters_cincinnati.png'],
  ['us open', 'assets/branding/logos/grandslam_usopen.png'],
  ['beijing', 'assets/branding/logos/atp500_beijing.png'],
  ['tokyo', 'assets/branding/logos/atp500_tokyo.png'],
  ['shanghai', 'assets/branding/logos/masters_shanghai.png'],
  ['paris', 'assets/branding/logos/masters_paris.png'],
  ['dubai', 'assets/branding/logos/atp500_dubai.png'],
  ['barcelona', 'assets/branding/logos/atp500_barcelona.png'],
  ['rio', 'assets/branding/logos/atp500_rio.png'],
  ["queen's", 'assets/branding/logos/atp500_queens.png'],
  ['halle', 'assets/branding/logos/atp500_halle.png'],
  ['marseille', 'assets/branding/logos/atp250_marseille.png'],
  ['buenos aires', 'assets/branding/logos/atp250_buenosaires.png'],
  ['santiago', 'assets/branding/logos/atp250_santiago.png'],
  ['estoril', 'assets/branding/logos/atp250_estoril.png'],
  ['kitz', 'assets/branding/logos/atp250_kitzbuhel.png'],
  ['antwerp', 'assets/branding/logos/atp250_antwerp.png'],
  ['stockholm', 'assets/branding/logos/atp250_stockholm.png'],
  ['metz', 'assets/branding/logos/atp250_metz.png'],
  ['finals', 'assets/branding/logos/atp_finals.png']
];
function logoForTournament(name='') {
  const key = (name || '').toLowerCase();
  const hit = TOURNAMENT_LOGOS.find(([needle]) => key.includes(needle));
  return hit ? hit[1] : '';
}

function assetCandidates(src='') {
  if (!src) return [];
  const clean = src.replace(/^\.\//, '').replace(/^\//, '');
  const parts = clean.split('/');
  const base = parts[parts.length - 1];
  const type = parts.length >= 3 ? parts[parts.length - 2] : '';
  const candidates = [
    `./${clean}`,
    clean,
    `./${base}`,
    base
  ];
  if (type) {
    candidates.push(`./branding-flat/${type}/${base}`);
    candidates.push(`branding-flat/${type}/${base}`);
  }
  return [...new Set(candidates)];
}

function attachFallback(el, src='') {
  const candidates = assetCandidates(src);
  if (!el || !candidates.length) return;
  let idx = 0;
  el.src = candidates[idx];
  el.dataset.assetCandidates = JSON.stringify(candidates);
  el.onerror = () => {
    idx += 1;
    if (idx < candidates.length) {
      el.src = candidates[idx];
    } else {
      el.onerror = null;
      el.classList.add('asset-missing');
    }
  };
}

function avatarForPlayer(name='') {
  const lower = (name || '').toLowerCase();
  if (lower.includes('gabriel')) return PLAYER_AVATARS[0];
  if (lower.includes('thiago')) return PLAYER_AVATARS[4];
  if (lower.includes('joao')) return PLAYER_AVATARS[1];
  if (lower.includes('luis')) return PLAYER_AVATARS[4];
  if (lower.includes('ethan')) return PLAYER_AVATARS[0];
  if (lower.includes('kenji')) return PLAYER_AVATARS[2];
  if (lower.includes('jannik') || lower.includes('novak') || lower.includes('zverev')) return PLAYER_AVATARS[4];
  if (lower.includes('carlos')) return PLAYER_AVATARS[1];
  if (lower.includes('ben') || lower.includes('felix')) return PLAYER_AVATARS[0];
  const idx = Math.abs([...lower].reduce((a,c)=>a+c.charCodeAt(0),0)) % PLAYER_AVATARS.length;
  return PLAYER_AVATARS[idx];
}
function avatarImg(src, cls='avatar-img', alt='avatar') {
  return src ? `<img class="${cls}" data-asset-src="${src}" alt="${alt}">` : '';
}
function logoImg(src, cls='tour-logo', alt='logo') {
  return src ? `<img class="${cls}" data-asset-src="${src}" alt="${alt}">` : '';
}


const OWNER_AVATARS = PLAYER_AVATARS;



function slugifyText(text='') {
  return (text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function logoMarkup(src, name='', cls='tour-logo', fallbackCls='tournament-logo-fallback') {
  if (src) return logoImg(src, cls, name);
  const safe = (name || 'ATP').split(/\s+/).slice(0,2).map(w => w[0] || '').join('').toUpperCase();
  return `<div class="${fallbackCls}">${safe}</div>`;
}
function tournamentKey(event) {
  return event?.id || slugifyText(event?.name || 'event');
}
function makeEntrantFromRow(row) {
  return {
    id: row.playerId || slugifyText(row.name),
    name: row.name,
    country: row.country || '---',
    overall: Math.round(row.overall || 70),
    points: Math.round(row.points || 0),
    avatar: avatarForPlayer(row.name),
    isUser: !!row.isUser
  };
}
function pickEntrantsForEvent(player, event, roundsLength) {
  const total = Math.max(8, 2 ** roundsLength);
  const nonUsers = state.ranking.filter(r => !r.isUser).slice(0, 96);
  const entrants = [];
  if (player) entrants.push(makeEntrantFromRow({ name: player.name, country: player.country, overall: player.overall, points: player.rankingPoints, playerId: player.id, isUser: true }));
  let cursor = 0;
  while (entrants.length < total && cursor < nonUsers.length) {
    const row = nonUsers[cursor++];
    if (entrants.some(x => x.name === row.name)) continue;
    entrants.push(makeEntrantFromRow(row));
  }
  while (entrants.length < total) {
    entrants.push(makeEntrantFromRow(nonUsers[entrants.length % nonUsers.length] || { name:`ATP ${entrants.length+1}`, country:'ATP', overall:70, points:100 }));
  }
  entrants.sort((a,b) => (b.points + b.overall*4) - (a.points + a.overall*4));
  return entrants.slice(0,total);
}
function seedingPositions(size) {
  if (size === 2) return [1,2];
  const prev = seedingPositions(size/2);
  const out = [];
  for (const p of prev) { out.push(p); out.push(size + 1 - p); }
  return out;
}
function createDrawMatches(entrants) {
  const positions = seedingPositions(entrants.length);
  const slots = Array(entrants.length).fill(null);
  entrants.forEach((entrant, idx) => {
    const pos = positions[idx] - 1;
    slots[pos] = entrant;
  });
  const matches = [];
  for (let i=0; i<slots.length; i+=2) {
    const a = slots[i]; const b = slots[i+1];
    matches.push({ id:`m${i/2+1}`, a, b, winner:null, score:'', userMatch: !!(a?.isUser || b?.isUser) });
  }
  return matches;
}
function createTournamentDraw(player, event, rounds) {
  const entrants = pickEntrantsForEvent(player, event, rounds.length);
  const roundDefs = rounds.map((label, idx) => ({ label, matches: idx === 0 ? createDrawMatches(entrants) : [] }));
  return { key: tournamentKey(event), eventName: event.name, rounds: roundDefs };
}
function ensureTournamentRunDraw(player, event, rounds) {
  if (!state.tournamentDraws) state.tournamentDraws = {};
  const key = tournamentKey(event);
  if (!state.tournamentDraws[key]) state.tournamentDraws[key] = createTournamentDraw(player, event, rounds);
  return state.tournamentDraws[key];
}
function pickDrawOpponent(draw, roundIndex) {
  const round = draw?.rounds?.[roundIndex];
  if (!round) return null;
  const match = round.matches.find(m => m.a?.isUser || m.b?.isUser);
  if (!match) return null;
  return { match, opponent: match.a?.isUser ? match.b : match.a };
}
function decideDrawWinner(a, b) {
  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;
  const aScore = (a.overall || 70) * 5 + (a.points || 0) / 40 + (a.isUser ? 10 : 0) + (Math.random() * 40);
  const bScore = (b.overall || 70) * 5 + (b.points || 0) / 40 + (b.isUser ? 10 : 0) + (Math.random() * 40);
  return aScore >= bScore ? a : b;
}
function simulatedScore() {
  const patterns = ['6-4 6-3', '7-5 6-4', '6-2 3-6 6-3', '6-3 6-4', '7-6 6-4'];
  return patterns[Math.floor(Math.random()*patterns.length)];
}
function advanceDrawRound(run, playerWon) {
  if (!run?.draw) return;
  const round = run.draw.rounds[run.roundIndex];
  if (!round) return;
  round.matches = round.matches.map(match => {
    if (match.a?.isUser || match.b?.isUser) {
      const winner = playerWon ? (match.a?.isUser ? match.a : match.b) : (match.a?.isUser ? match.b : match.a);
      return { ...match, winner, score: simulatedScore() };
    }
    const winner = match.winner || decideDrawWinner(match.a, match.b);
    return { ...match, winner, score: match.score || simulatedScore() };
  });
  const nextRound = run.draw.rounds[run.roundIndex + 1];
  if (nextRound) {
    const winners = round.matches.map(m => m.winner).filter(Boolean);
    const matches = [];
    for (let i=0; i<winners.length; i+=2) {
      const a = winners[i]; const b = winners[i+1];
      matches.push({ id:`r${run.roundIndex+2}m${i/2+1}`, a, b, winner:null, score:'', userMatch: !!(a?.isUser || b?.isUser) });
    }
    nextRound.matches = matches;
  }
}
function ensureDrawModal() {
  if (document.querySelector('#drawModal')) return;
  const node = document.createElement('section');
  node.id = 'drawModal';
  node.className = 'draw-modal hidden';
  node.innerHTML = `<div class="draw-backdrop" data-draw-close="1"></div>
    <div class="draw-card glass">
      <div class="draw-head">
        <div>
          <p class="eyebrow">Chave do torneio</p>
          <h3 id="drawTitle">Visão da competição</h3>
          <div id="drawSub" class="small"></div>
        </div>
        <button id="closeDrawBtn" class="mini-btn" type="button">Fechar</button>
      </div>
      <div id="drawContent" class="draw-columns"></div>
    </div>`;
  document.body.appendChild(node);
  node.querySelectorAll('[data-draw-close="1"]').forEach(el => el.addEventListener('click', closeDrawModal));
  node.querySelector('#closeDrawBtn')?.addEventListener('click', closeDrawModal);
}
function openDrawModal(eventName='') {
  ensureDrawModal();
  const event = state.calendar.find(e => e.name === eventName) || state.activeTournament?.event || state.calendar.find(e => e.week === state.academy.week);
  if (!event) return;
  const player = chooseBestPlayer();
  const rounds = state.activeTournament?.event?.name === event.name ? state.activeTournament.rounds : (event.drawSize >= 64 ? ['R32','R16','QF','SF','F'] : event.drawSize >= 32 ? ['R16','QF','SF','F'] : ['QF','SF','F']);
  const draw = state.activeTournament?.event?.name === event.name && state.activeTournament.draw
    ? state.activeTournament.draw
    : ensureTournamentRunDraw(player, event, rounds);
  const modal = document.querySelector('#drawModal');
  modal.classList.remove('hidden');
  document.body.classList.add('setup-open');
  document.querySelector('#drawTitle').textContent = event.name;
  document.querySelector('#drawSub').textContent = `${event.tier} • ${event.surface.toUpperCase()} • chave ${event.drawSize || 32}`;
  const content = document.querySelector('#drawContent');
  content.innerHTML = draw.rounds.map((round, idx) => `<div class="draw-col"><div class="draw-col-head">${round.label}</div>${(round.matches||[]).map(match => `
    <div class="draw-match ${match.a?.isUser || match.b?.isUser ? 'user-path' : ''} ${idx === (state.activeTournament?.roundIndex ?? -1) ? 'active-round' : ''}">
      <div class="draw-line ${match.winner?.name === match.a?.name ? 'winner' : ''}">${match.a ? `<span class="draw-name">${match.a.name}</span><span class="draw-country">${match.a.country}</span>` : '<span class="draw-name">TBD</span>'}</div>
      <div class="draw-line ${match.winner?.name === match.b?.name ? 'winner' : ''}">${match.b ? `<span class="draw-name">${match.b.name}</span><span class="draw-country">${match.b.country}</span>` : '<span class="draw-name">TBD</span>'}</div>
      ${match.score ? `<div class="draw-score">${match.score}</div>` : ''}
    </div>`).join('')}</div>`).join('');
}
function closeDrawModal() {
  const modal = document.querySelector('#drawModal');
  if (!modal) return;
  modal.classList.add('hidden');
  document.body.classList.remove('setup-open');
}
function flagEmoji(code='BRA') {
  const map = { BRA:'🇧🇷', ARG:'🇦🇷', CHI:'🇨🇱', USA:'🇺🇸', GBR:'🇬🇧', ESP:'🇪🇸', GER:'🇩🇪', FRA:'🇫🇷', ITA:'🇮🇹', AUS:'🇦🇺', JPN:'🇯🇵', CHN:'🇨🇳', QAT:'🇶🇦', PRT:'🇵🇹', BEL:'🇧🇪', SWE:'🇸🇪', AUT:'🇦🇹', SRB:'🇷🇸', RUS:'🇷🇺' };
  return map[(code||'BRA').toUpperCase()] || '🏳️';
}
function ownerData() {
  const owner = state.academy.owner || {};
  return {
    name: owner.name || 'Seu nome',
    country: (owner.country || 'BRA').toUpperCase(),
    academyName: state.academy.name || 'Ace Academy',
    logo: owner.logo || 'A',
    avatar: owner.avatar || PLAYER_AVATARS[0],
    age: owner.age || 36, gender: owner.gender || 'masculino',
    background: owner.background || 'ex-jogador', specialty: owner.specialty || 'tecnica'
  };
}
function openOwnerSetup(force=false) {
  const modal = $('#ownerSetupModal');
  if (!modal) return;
  const owner = ownerData();
  $('#ownerNameInput').value = force ? '' : owner.name;
  $('#ownerCountryInput').value = force ? 'BRA' : owner.country;
  $('#academyNameInput').value = state.academy.name || 'Ace Academy';
  $('#academyLogoInput').value = owner.logo || 'A';
  $('#ownerAgeInput').value = owner.age || 36;
  $('#ownerGenderInput').value = owner.gender || 'masculino';
  $('#ownerBackgroundInput').value = owner.background || 'ex-jogador';
  $('#ownerSpecialtyInput').value = owner.specialty || 'tecnica';
  $('#academyCityInput').value = state.academy.careerProfile?.city || 'São Paulo';
  $('#academyPhilosophyInput').value = state.academy.careerProfile?.philosophy || 'equilibrada';
  $('#careerDifficultyInput').value = state.academy.careerProfile?.difficulty || 'normal';
  $('#careerCurrencyInput').value = state.academy.careerProfile?.currency || 'BRL';
  modal.style.display = 'flex';
  modal.classList.remove('hidden');
  document.body.classList.add('setup-open');
  modal.setAttribute('aria-hidden','false');
  renderOwnerChoices(owner.avatar);
}
function closeOwnerSetup() {
  const modal = $('#ownerSetupModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden','true');
  modal.style.display = 'none';
  document.body.classList.remove('setup-open');
}
function renderOwnerChoices(active) {
  const host = $('#ownerAvatarChoices');
  if (!host) return;
  host.innerHTML = OWNER_AVATARS.map((src, idx) => `<button class="choice-avatar ${src===active?'active':''}" data-owner-avatar="${src}" type="button">${avatarImg(src,'avatar-img',`avatar-${idx}`)}</button>`).join('');
  host.querySelectorAll('[data-owner-avatar]').forEach(btn => btn.addEventListener('click', () => {
    host.querySelectorAll('[data-owner-avatar]').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
  }));
  hydrateAssetImages();
}

function validateCareerSetup() {
  const name = ($('#ownerNameInput')?.value || '').trim();
  const academy = ($('#academyNameInput')?.value || '').trim();
  const city = ($('#academyCityInput')?.value || '').trim();
  const age = Number($('#ownerAgeInput')?.value || 0);
  const errors = [];
  if (name.length < 2) errors.push('Informe um nome com pelo menos 2 caracteres.');
  if (academy.length < 3) errors.push('Informe o nome da academia.');
  if (city.length < 2) errors.push('Informe a cidade-sede.');
  if (age < 18 || age > 85) errors.push('A idade deve estar entre 18 e 85 anos.');
  const box = $('#setupValidation');
  if (box) { box.innerHTML = errors.map(x => `<span>• ${x}</span>`).join(''); box.classList.toggle('hidden', !errors.length); }
  return errors.length === 0;
}
function updateCareerPreview() {
  const host = $('#careerPreview'); if (!host) return;
  const name = ($('#ownerNameInput')?.value || 'Treinador').trim();
  const academy = ($('#academyNameInput')?.value || 'Sua academia').trim();
  const city = ($('#academyCityInput')?.value || 'Cidade').trim();
  const difficulty = $('#careerDifficultyInput')?.selectedOptions?.[0]?.text || 'Profissional';
  host.innerHTML = `<strong>${academy}</strong><span>${name} • ${city} • ${difficulty}</span>`;
}
function saveOwnerSetup() {
  if (!state || !validateCareerSetup()) return false;
  const ownerName = ($('#ownerNameInput')?.value || '').trim();
  const country = ($('#ownerCountryInput')?.value || 'BRA').trim().toUpperCase().replace(/[^A-Z]/g,'').slice(0,3) || 'BRA';
  const academyName = ($('#academyNameInput')?.value || '').trim();
  const logo = (($('#academyLogoInput')?.value || 'VTM').trim().toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,3)) || 'VTM';
  const active = document.querySelector('.choice-avatar.active');
  const avatar = active?.dataset.ownerAvatar || PLAYER_AVATARS[0];
  const snapshot = JSON.parse(JSON.stringify(state));
  try {
    state.academy.name = academyName;
    state.academy.owner = { name: ownerName, country, avatar, logo, age: Number($('#ownerAgeInput').value), gender: $('#ownerGenderInput').value, background: $('#ownerBackgroundInput').value, specialty: $('#ownerSpecialtyInput').value };
    state.academy.careerProfile = { city: $('#academyCityInput').value.trim(), philosophy: $('#academyPhilosophyInput').value, difficulty: $('#careerDifficultyInput').value, currency: $('#careerCurrencyInput').value, createdInBuild: BUILD_INFO.build };
    state.flags ||= {}; state.flags.ownerSetupComplete = true; state.flags.safeMode = false;
    state.inbox.unshift({ title: `Bem-vindo, ${ownerName}`, body: `A ${academyName} iniciou sua trajetória internacional em ${state.academy.careerProfile.city}.`, week: state.academy.week });
    if (!saveState(state)) throw new Error('O armazenamento local recusou o salvamento.');
  } catch (err) {
    state = snapshot; showSystemError(`A carreira não foi criada. Seus dados anteriores foram preservados. ${err.message || ''}`); return false;
  }
  closeOwnerSetup(); switchTab('dashboard'); render(); hydrateAssetImages(); return true;
}
function renderOwnerHub() {
  const host = $('#ownerHubCard');
  if (!host) return;
  const owner = ownerData();
  host.innerHTML = `
    <div>${avatarImg(owner.avatar,'owner-avatar',owner.name)}</div>
    <div class="owner-meta">
      <p class="eyebrow">Lobby da academia</p>
      <h4>${owner.academyName}</h4>
      <div class="owner-sub">
        <span class="owner-logo-badge">${owner.logo}</span>
        <div>
          <strong>${owner.name}</strong>
          <div class="small"><span class="flag">${flagEmoji(owner.country)}</span> ${owner.country} • Dono da academia</div>
        </div>
      </div>
      <div class="owner-money">${money(state.academy.money)}</div>
    </div>`;
  hydrateAssetImages();
}
function launchEvent(eventName='') {
  const event = state.calendar.find(e => e.name === eventName) || state.calendar.find(e => e.week === state.academy.week);
  if (!event) return;
  if (event.week !== state.academy.week) {
    state.academy.week = event.week;
    state.match = null;
    state.activeTournament = null;
    addLog(`Semana ajustada para ${event.week} • ${event.name}.`);
  }
  switchTab('match');
  render();
}

installGlobalErrorHandling();
function showSystemError(message, error = null) {
  if (error) console.error(message, error);
  const banner = $('#systemErrorBanner');
  const text = $('#systemErrorText');
  if (text) text.textContent = message;
  banner?.classList.remove('hidden');
}

function installGlobalErrorHandling() {
  window.addEventListener('error', event => showSystemError('Uma falha foi detectada, mas o jogo tentou continuar.', event.error));
  window.addEventListener('unhandledrejection', event => showSystemError('Uma operação não foi concluída. Seu save permanece protegido.', event.reason));
  document.addEventListener('DOMContentLoaded', () => $('#dismissErrorBtn')?.addEventListener('click', () => $('#systemErrorBanner')?.classList.add('hidden')));
}

boot();

async function boot() {
  try {
    content = await loadContent();
    applyAdminOverrides(content);
    state = loadState() || buildInitialState(content);
  } catch (error) {
    showSystemError('Não foi possível carregar os dados principais. Uma nova carreira segura foi preparada.', error);
    content = await loadContent();
    state = buildInitialState(content);
  }
  migrateState();
  bindUI();
  applyBuildMarkers();
  startCourtAnimation();
  drawCourt();
  render();
  hydrateAssetImages();
  if (!state.academy.owner || !state.flags?.ownerSetupComplete) openOwnerSetup(true);
}

function applyAdminOverrides(content) {
  const override = JSON.parse(localStorage.getItem('ace_admin_overrides') || '{}');
  if (override.academyName) content.academyDefaults.name = override.academyName;
}

function migrateState() {
  state = migrateSave(state);
  state.logs ||= [];
  state.summary ||= [];
  state.inbox ||= [];
  state.sponsorOffers ||= [];
  state.objectives ||= { current: 'Entrar no Top 120' };
  state.flags ||= {};
  state.academy.bankruptcyWarnings ??= 0;
  state.academy.owner ??= null;
  state.activeTournament ??= null;
  state.roster.forEach(p => {
    p.health ??= 100;
    p.injuredWeeks ??= 0;
    p.lastResult ??= 'Sem jogos';
    p.salary ??= 1800 + Math.round(p.overall * 25);
  });
}


function applyBuildMarkers() {
  const pill = $('#buildPill');
  const overlay = $('#buildOverlay');
  const mobile = $('#mobileBuildBadge');
  const inline = $('#matchBuildInline');
  if (pill) pill.textContent = BUILD_LABEL;
  if (overlay) overlay.textContent = BUILD_LABEL;
  if (mobile) mobile.textContent = BUILD_LABEL;
  if (inline) inline.textContent = BUILD_LABEL;
  const stamp = $('#runtimeBuildStamp');
  if (stamp) stamp.textContent = `${BUILD_LABEL} • ${BUILD_INFO.phase}`;
  document.documentElement.dataset.version = BUILD_INFO.version;
  document.documentElement.dataset.build = BUILD_INFO.build;
}

function hydrateAssetImages() {
  document.querySelectorAll('img[data-asset-src]').forEach((img) => {
    if (img.dataset.assetHydrated === '1') return;
    img.dataset.assetHydrated = '1';
    attachFallback(img, img.dataset.assetSrc || '');
  });
}

function refreshAutoButtons() {
  ['#auto1xBtn','#auto2xBtn','#auto4xBtn'].forEach((sel, index) => {
    const btn = $(sel);
    if (!btn) return;
    const val = [1,2,4][index];
    btn.classList.toggle('active', !!autoPlayTimer && autoPlaySpeed === val);
  });
}

function setAutoPlay(multiplier = 1) {
  if (!state.match?.inProgress || state.match.finished) return addLog('Inicie uma partida primeiro.');
  stopAutoPlay();
  autoPlaySpeed = multiplier;
  const delay = Math.max(120, 720 / multiplier);
  autoPlayTimer = setInterval(() => {
    if (!state.match || state.match.finished || !state.match.inProgress) {
      stopAutoPlay();
      return;
    }
    playPoint();
  }, delay);
  addMatchLog(`Autoplay ativado em ${multiplier}x.`);
  refreshAutoButtons();
}

function stopAutoPlay() {
  if (autoPlayTimer) {
    clearInterval(autoPlayTimer);
    autoPlayTimer = null;
    addMatchLog('Autoplay pausado.');
    renderMatch();
  hydrateAssetImages();
  }
  refreshAutoButtons();
}

function startCourtAnimation() {
  if (!ctx || !canvas || courtAnimId) return;
  const tick = (ts) => {
    courtClock = ts || performance.now();
    drawCourt();
    courtAnimId = requestAnimationFrame(tick);
  };
  courtAnimId = requestAnimationFrame(tick);
}

function bindUI() {
  $$('#mainTabs .tab-btn').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
  $$('.dock-btn').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
  $$('.hub-btn').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.jumpTab)));
  ensureDrawModal();
  $('#saveOwnerSetupBtn')?.addEventListener('click', saveOwnerSetup);
  $('#openCalendarBtn')?.addEventListener('click', () => switchTab('calendar'));
  $('#advanceWeekBtn').addEventListener('click', advanceWeek);
  $('#saveBtn').addEventListener('click', () => { saveState(state); addLog('Save realizado manualmente.'); render(); });
  $('#resetBtn').addEventListener('click', () => {
    clearState();
    state = buildInitialState(content);
    migrateState();
    state.flags ||= {};
    state.flags.ownerSetupComplete = false;
    addLog('Nova carreira iniciada.');
    render();
    openOwnerSetup(true);
  });
  $('#startMatchBtn').addEventListener('click', startScheduledMatch);
  $('#playPointBtn').addEventListener('click', playPoint);
  $('#autoMatchBtn').addEventListener('click', () => setAutoPlay(1));
  $('#auto1xBtn')?.addEventListener('click', () => setAutoPlay(1));
  $('#auto2xBtn')?.addEventListener('click', () => setAutoPlay(2));
  $('#auto4xBtn')?.addEventListener('click', () => setAutoPlay(4));
  $('#pauseAutoBtn')?.addEventListener('click', stopAutoPlay);
  $$('.action-btn').forEach(btn => btn.addEventListener('click', () => {
    $$('.action-btn').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    currentStrategy = btn.dataset.strategy;
    addMatchLog(`Estratégia alterada para ${btn.textContent}.`);
    renderMatch();
  hydrateAssetImages();
  }));
}

function switchTab(tab) {
  state.ui ||= {}; state.ui.currentTab = tab;
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
  renderOwnerHub();
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
  renderTrainingLab();
  renderWorldTourFeed();
  renderCalendar();
  renderMarket();
  renderStaff();
  updateRanking();
  renderRanking();
  hydrateAssetImages();
  renderMatch();
  hydrateAssetImages();
  ensureDrawModal();
  ensurePlayerProfileModal();
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
  box.innerHTML = items.map((msg, idx) => `
    <article class="inbox-card ${idx===0 ? 'featured' : ''}">
      <div class="inbox-icon">${idx===0 ? '✦' : '✉'}</div>
      <div class="inbox-copy"><strong>${msg.title}</strong><div class="small">${msg.body}</div></div>
      <div class="small inbox-week">S${msg.week}</div>
    </article>`).join('') || '<div class="list-item"><span>Nenhuma mensagem ainda.</span></div>';
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
  const next = state.calendar.filter(e => e.week >= state.academy.week).slice(0, 4);
  list.innerHTML = `<div class="tournament-mini-list">${next.map(event => {
    const gate = getTournamentGate(event);
    const logo = logoForTournament(event.name);
    return `<div class="next-event-card premium" >
      <button class="next-event-main" onclick="window.launchEvent('${event.name.replace("'", "&#39;")}')">
        ${logoMarkup(logo,event.name,'tour-logo large','tournament-logo-fallback large')}
        <div><strong>Semana ${event.week} • ${event.name}</strong><div class="small">${event.tier} • ${event.surface} • ${gate.label}</div></div>
      </button>
      <button class="mini-btn next-bracket-btn" onclick="window.openDrawModal('${event.name.replace("'", "&#39;")}')">Ver chave</button>
    </div>`;
  }).join('')}</div>`;
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
  const map = {
    training: { title: 'Centro de Treino', staff: state.staff.Tecnico, avatar: STAFF_AVATARS['Tecnico'], desc: 'Evolução técnica, potência e consistência.' },
    medical: { title: 'Centro Médico', staff: state.staff.Fisioterapeuta, avatar: STAFF_AVATARS['Fisioterapeuta'], desc: 'Recuperação, prevenção e gestão física.' },
    finance: { title: 'Financeiro', staff: state.staff.Financeiro, avatar: STAFF_AVATARS['Financeiro'], desc: 'Patrocínio, caixa e acordos estratégicos.' },
    scouting: { title: 'Scouting', staff: state.staff.Psicologo, avatar: STAFF_AVATARS['Psicologo'], desc: 'Leitura de mercado e novos perfis.' }
  };
  $('#facilityList').innerHTML = Object.entries(state.academy.facilities).map(([key, level]) => {
    const info = map[key];
    const cost = (level + 1) * 18000;
    return `
    <article class="facility-card panel-card">
      <div class="facility-head">${avatarImg(info.avatar,'avatar-img',info.title)}<div><h4>${info.title}</h4><p class="muted">${info.desc}</p></div></div>
      <div class="facility-level-row"><span class="metric">Nível ${level}</span><span class="metric">Staff ${info.staff ? info.staff.name : 'vago'}</span></div>
      <div class="facility-progress"><span style="width:${Math.min(100, level*20 + 10)}%"></span></div>
      <button class="btn-secondary facility-upgrade-btn" onclick="window.upgradeFacility('${key}')">Upgrade ${money(cost)}</button>
    </article>`;
  }).join('');
}

window.launchEvent = launchEvent;
window.openDrawModal = openDrawModal;

window.upgradeFacility = (key) => {
  const level = state.academy.facilities[key];
  const cost = (level + 1) * 18000;
  if (state.academy.money < cost) return addLog('Caixa insuficiente para upgrade.');
  state.academy.money -= cost;
  state.academy.facilities[key] += 1;
  state.academy.reputation += 2;
  addLog(`Upgrade concluído em ${key}.`);
  render();
  hydrateAssetImages();
};

function ensurePlayerProfileModal(){
  if ($('#playerProfileModal')) return;
  document.body.insertAdjacentHTML('beforeend', `<div id="playerProfileModal" class="player-profile-modal hidden" role="dialog" aria-modal="true" aria-label="Perfil do atleta"><div class="profile-backdrop" onclick="window.closePlayerProfile()"></div><article class="profile-sheet glass"><button class="profile-close" onclick="window.closePlayerProfile()" aria-label="Fechar">×</button><div id="playerProfileBody"></div></article></div>`);
}
function statBar(label,value){return `<div class="profile-stat"><span>${label}</span><div><i style="width:${Math.max(2,Math.min(100,value))}%"></i></div><b>${Math.round(value)}</b></div>`}
window.openPlayerProfile=(playerId,source='roster')=>{
  ensurePlayerProfileModal();
  const pool=source==='market'?state.marketTalents:source==='ranking'?state.ranking:state.roster;
  const raw=pool.find(p=>String(p.id||p.playerId||p.name)===String(playerId)) || state.ranking.find(p=>String(p.playerId||p.id||p.name)===String(playerId));
  if(!raw) return addLog('Perfil do atleta não encontrado.');
  const p=enrichPlayer(raw), rank=p.rank||getPlayerRank(p.id), avatar=avatarForPlayer(p.name);
  const tech=categoryAverage(p,['serve','forehand','backhand','return','volley','slice']);
  const physical=categoryAverage(p,['speed','agility','stamina','strength']);
  const mental=categoryAverage(p,['mental','composure','consistency','tacticalIQ']);
  $('#playerProfileBody').innerHTML=`<header class="profile-hero">${avatarImg(avatar,'profile-avatar',p.name)}<div><p class="eyebrow">Dossiê internacional</p><h2>${p.name}</h2><p>${p.country} • ${p.age||'—'} anos • ${p.style} • Rank ${rank||'—'}</p><div class="profile-badges"><span>OVR ${p.overall}</span><span>POT ${p.potential}</span><span>${p.personality}</span><span>${surfaceLabel(p.preferredSurface)}</span></div></div></header>
  <div class="profile-overview"><div><b>${tech}</b><span>Técnico</span></div><div><b>${physical}</b><span>Físico</span></div><div><b>${mental}</b><span>Mental</span></div><div><b>${p.form}</b><span>Forma</span></div></div>
  <section class="profile-grid"><div class="profile-panel"><h3>Técnica</h3>${statBar('Saque',p.serve)}${statBar('Forehand',p.forehand)}${statBar('Backhand',p.backhand)}${statBar('Devolução',p.return)}${statBar('Voleio',p.volley)}${statBar('Slice',p.slice)}</div>
  <div class="profile-panel"><h3>Físico e mental</h3>${statBar('Velocidade',p.speed)}${statBar('Agilidade',p.agility)}${statBar('Resistência',p.stamina)}${statBar('Força',p.strength)}${statBar('Compostura',p.composure)}${statBar('QI tático',p.tacticalIQ)}</div></section>
  <section class="profile-panel"><h3>Superfícies</h3><div class="surface-cards"><div><b>${p.surfaceRatings.hard}</b><span>Piso duro</span></div><div><b>${p.surfaceRatings.clay}</b><span>Saibro</span></div><div><b>${p.surfaceRatings.grass}</b><span>Grama</span></div></div><div class="profile-traits"><span>Profissionalismo ${p.professionalism}</span><span>Ambição ${p.ambition}</span><span>Lealdade ${p.loyalty}</span><span>Risco de lesão ${p.injuryProneness}</span></div></section>`;
  hydrateAssetImages(); $('#playerProfileModal').classList.remove('hidden'); document.body.classList.add('profile-open');
};
window.closePlayerProfile=()=>{$('#playerProfileModal')?.classList.add('hidden');document.body.classList.remove('profile-open')};


const TRAINING_FOCUS = {
  balanced:{label:'Equilibrado',attrs:['forehand','backhand','serve','return','stamina','mental'],fatigue:5,health:1,risk:2},
  technique:{label:'Técnica',attrs:['forehand','backhand','serve','return','volley','slice'],fatigue:6,health:2,risk:3},
  fitness:{label:'Físico',attrs:['stamina','speed','agility','strength'],fatigue:9,health:3,risk:6},
  tactical:{label:'Tática',attrs:['tacticalIQ','composure','consistency','mental'],fatigue:4,health:1,risk:2},
  match:{label:'Jogo simulado',attrs:['serve','return','composure','tacticalIQ'],fatigue:8,health:2,risk:5},
  recovery:{label:'Recuperação',attrs:[],fatigue:-16,health:-9,risk:0}
};
const TRAINING_INTENSITY = { light:{label:'Leve',mult:.65,risk:.5}, moderate:{label:'Moderada',mult:1,risk:1}, intense:{label:'Intensa',mult:1.45,risk:1.65}, extreme:{label:'Extrema',mult:1.9,risk:2.5} };
function ensureTrainingLab(){
  state.trainingLab ||= {cycle:'balanced',autoApply:true,lastProcessedWeek:0,lastReport:[],plans:{}};
  state.trainingLab.plans ||= {}; state.trainingLab.lastReport ||= [];
  state.roster.forEach(p=>{ state.trainingLab.plans[p.id] ||= {focus:'balanced',intensity:'moderate'}; p.trainingProgress ||= {}; p.trainingHistory ||= []; });
}
function trainingRisk(plan,player){ const f=TRAINING_FOCUS[plan.focus]||TRAINING_FOCUS.balanced, i=TRAINING_INTENSITY[plan.intensity]||TRAINING_INTENSITY.moderate; return Math.round(f.risk*i.risk + Math.max(0,(player.fatigue||0)-55)/8 + (player.injuryProneness||50)/25); }
function renderTrainingLab(){
  const host=$('#trainingPlanList'); if(!host) return; ensureTrainingLab();
  const plans=state.roster.map(p=>state.trainingLab.plans[p.id]);
  const avgLoad=plans.reduce((a,p)=>a+(['light','moderate','intense','extreme'].indexOf(p.intensity)+1),0)/Math.max(1,plans.length);
  const avgRisk=state.roster.reduce((a,p)=>a+trainingRisk(state.trainingLab.plans[p.id],p),0)/Math.max(1,state.roster.length);
  $('#trainingCycleLabel').textContent=TRAINING_FOCUS[state.trainingLab.cycle]?.label||'Equilibrado';
  $('#trainingLoadLabel').textContent=avgLoad<1.7?'Leve':avgLoad<2.6?'Moderada':avgLoad<3.5?'Intensa':'Extrema';
  $('#trainingRiskLabel').textContent=avgRisk<7?'Baixo':avgRisk<12?'Moderado':'Alto';
  $('#trainingWeekLabel').textContent=`Semana ${state.academy.week+1}`;
  const cycle=$('#academyTrainingCycle'); cycle.value=state.trainingLab.cycle; cycle.onchange=e=>{state.trainingLab.cycle=e.target.value; addLog(`Ciclo da academia alterado para ${TRAINING_FOCUS[e.target.value].label}.`); render();};
  host.innerHTML=state.roster.map(p=>{const plan=state.trainingLab.plans[p.id], risk=trainingRisk(plan,p); return `<article class="training-player-card panel-card">
    <div class="training-player-head">${avatarImg(avatarForPlayer(p.name),'avatar-img',p.name)}<div><h4>${p.name}</h4><p class="muted">OVR ${Math.round(p.overall)} • POT ${Math.round(p.potential)} • fadiga ${Math.round(p.fatigue)} • saúde ${Math.round(p.health)}</p></div><span class="risk-chip ${risk>=12?'danger':risk>=7?'warn':'ok'}">Risco ${risk}</span></div>
    <div class="training-fields"><label>Foco<select onchange="window.setTrainingPlan('${p.id}','focus',this.value)">${Object.entries(TRAINING_FOCUS).map(([k,v])=>`<option value="${k}" ${plan.focus===k?'selected':''}>${v.label}</option>`).join('')}</select></label><label>Intensidade<select onchange="window.setTrainingPlan('${p.id}','intensity',this.value)">${Object.entries(TRAINING_INTENSITY).map(([k,v])=>`<option value="${k}" ${plan.intensity===k?'selected':''}>${v.label}</option>`).join('')}</select></label></div>
    <div class="training-projection"><span>Ganho projetado <b>+${((TRAINING_INTENSITY[plan.intensity]?.mult||1)*(state.academy.facilities.training*.08+.16)).toFixed(2)}</b></span><span>Fadiga projetada <b>${TRAINING_FOCUS[plan.focus].fatigue>0?'+':''}${Math.round(TRAINING_FOCUS[plan.focus].fatigue*(TRAINING_INTENSITY[plan.intensity]?.mult||1))}</b></span></div>
  </article>`}).join('');
  $('#trainingReport').innerHTML=(state.trainingLab.lastReport||[]).slice(0,8).map(x=>`<div class="list-item"><span>${x}</span></div>`).join('')||'<div class="list-item"><span>Nenhum ciclo processado. Os planos serão aplicados ao avançar a semana.</span></div>';
  hydrateAssetImages();
}
window.setTrainingPlan=(id,key,value)=>{ ensureTrainingLab(); const p=state.roster.find(x=>x.id===id); if(!p) return; const before={...state.trainingLab.plans[id]}; try{state.trainingLab.plans[id][key]=value; if(!TRAINING_FOCUS[state.trainingLab.plans[id].focus]||!TRAINING_INTENSITY[state.trainingLab.plans[id].intensity]) throw new Error('Plano inválido'); saveState(state); renderTrainingLab();}catch(e){state.trainingLab.plans[id]=before; showSystemError('Plano inválido restaurado sem perda de dados.');}};
function processWeeklyTraining(){
  ensureTrainingLab(); const token=`${state.academy.season}-${state.academy.week}`; if(state.trainingLab.lastProcessedToken===token) return;
  const snapshot=JSON.parse(JSON.stringify(state.roster)); const report=[];
  try{
    state.roster.forEach(player=>{
      const plan=state.trainingLab.plans[player.id]||{focus:'balanced',intensity:'moderate'}; const focus=TRAINING_FOCUS[plan.focus]||TRAINING_FOCUS.balanced; const intensity=TRAINING_INTENSITY[plan.intensity]||TRAINING_INTENSITY.moderate;
      if(player.injuredWeeks>0 && plan.focus!=='recovery'){ report.push(`${player.name}: plano convertido em recuperação por lesão.`); player.fatigue=Math.max(0,player.fatigue-12); player.health=Math.min(100,player.health+7); return; }
      if(plan.focus==='recovery'){ player.fatigue=Math.max(0,player.fatigue+focus.fatigue); player.health=Math.min(100,player.health-focus.health); player.morale=Math.min(100,(player.morale||70)+2); report.push(`${player.name}: recuperação, fadiga -${Math.abs(focus.fatigue)}.`); return; }
      const staff=state.academy.facilities.training*.08 + getStaffBonus('Tecnico','training')*.015; const gain=(.12+staff)*intensity.mult;
      focus.attrs.forEach(attr=>{ if(typeof player[attr]!=='number') player[attr]=player.overall||60; player[attr]=Math.min(99,player[attr]+gain); player.trainingProgress[attr]=(player.trainingProgress[attr]||0)+gain; });
      player.overall=Math.min(player.potential, player.overall + gain*.16); player.fatigue=Math.min(100,player.fatigue+focus.fatigue*intensity.mult); player.health=Math.max(35,player.health-focus.health*intensity.mult);
      const risk=trainingRisk(plan,player); maybeInjure(player,Math.max(0,risk-2)); player.trainingHistory.unshift({season:state.academy.season,week:state.academy.week,focus:plan.focus,intensity:plan.intensity,gain:+gain.toFixed(2)}); player.trainingHistory=player.trainingHistory.slice(0,12);
      report.push(`${player.name}: ${focus.label}/${intensity.label}, evolução +${gain.toFixed(2)}, risco ${risk}.`);
    });
    state.trainingLab.lastProcessedToken=token; state.trainingLab.lastProcessedWeek=state.academy.week; state.trainingLab.lastReport=report;
  }catch(error){ state.roster=snapshot; state.flags.safeMode=true; report.splice(0,report.length,'Falha no ciclo: atletas restaurados pelo sistema anti-quebra.'); state.trainingLab.lastReport=report; showSystemError('O treino semanal falhou e o elenco foi restaurado automaticamente.'); }
}

function renderRoster() {
  $('#rosterList').innerHTML = state.roster.map(rawPlayer => {
    const player = enrichPlayer(rawPlayer);
    const rank = getPlayerRank(player.id);
    const avatar = avatarForPlayer(player.name);
    return `
    <article class="player-card panel-card has-logo">
      <header>
        <div class="avatar-stack">
          ${avatarImg(avatar,'avatar-img',player.name)}
          <div>
            <h4>${player.name}</h4>
            <div class="small">${player.country} • ${player.age} anos • ${player.style} • rank ${rank}</div>
          </div>
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
        <button class="btn-primary" onclick="window.openPlayerProfile('${player.id}','roster')">Ver perfil</button>
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



function stableNumber(text='') { let h=2166136261; for (const c of String(text)) { h ^= c.charCodeAt(0); h = Math.imul(h,16777619); } return Math.abs(h>>>0); }
function simulateWorldTourWeek() {
  state.worldTour ||= { weeklyResults: [], rankingHistory: [], lastSimulatedWeek: 0, lastSimulatedSeason: state.academy.season };
  const season = state.academy.season, week = state.academy.week;
  if (state.worldTour.lastSimulatedSeason === season && state.worldTour.lastSimulatedWeek === week) return;
  const events = state.calendar.filter(event => event.week === week);
  const nonUsers = state.ranking.filter(row => !row.isUser).slice(0,100);
  const results = events.map(event => {
    const eligible = nonUsers.filter(row => (row.rank || 999) <= Math.max(event.minRank || 120, 24));
    const pool = eligible.length >= 8 ? eligible : nonUsers;
    const seed = stableNumber(`${season}-${week}-${event.id || event.name}`);
    const contenders = pool.slice(0, Math.min(pool.length, Math.max(8,event.drawSize || 32)));
    const weighted = contenders.map((row,idx) => ({ row, score:(row.overall||70)*7 + Math.log1p(row.points||0)*28 + ((stableNumber(`${seed}-${row.name}`)%101)-50) - idx*.4 })).sort((a,b)=>b.score-a.score);
    const champion = weighted[0]?.row, finalist = weighted[1]?.row;
    if (champion) champion.points = Math.max(0, Math.round((champion.points||0) + (event.winnerPoints||250)*0.22));
    if (finalist) finalist.points = Math.max(0, Math.round((finalist.points||0) + (event.winnerPoints||250)*0.11));
    return { eventId:event.id||event.name, eventName:event.name, tier:event.tier, surface:event.surface, city:event.city||'', champion:champion?.name||'A definir', championCountry:champion?.country||'INT', finalist:finalist?.name||'A definir', week, season };
  });
  state.worldTour.weeklyResults = [...results, ...(state.worldTour.weeklyResults||[])].slice(0,30);
  state.worldTour.rankingHistory.unshift({ season, week, leader: nonUsers.sort((a,b)=>(b.points||0)-(a.points||0))[0]?.name || '—', events:results.length });
  state.worldTour.rankingHistory = state.worldTour.rankingHistory.slice(0,24);
  state.worldTour.lastSimulatedWeek = week; state.worldTour.lastSimulatedSeason = season;
  if (results.length) state.inbox.unshift({ title:'World Tour atualizado', body:`${results.length} torneio(s) concluído(s) nesta semana. O ranking mundial foi recalculado.`, week });
}
function renderWorldTourFeed() {
  const host = $('#worldTourFeed'); if (!host) return;
  const current = state.calendar.filter(event => event.week === state.academy.week);
  const recent = (state.worldTour?.weeklyResults || []).slice(0,4);
  $('#tourEventCount').textContent = `${state.calendar.length} eventos`;
  $('#tourLastUpdate').textContent = `S${state.worldTour?.lastSimulatedWeek || 0} • ${state.worldTour?.lastSimulatedSeason || state.academy.season}`;
  const live = current.length ? current.map(event => `<article class="tour-live-card"><span class="tour-status">SEMANA ATUAL</span><strong>${event.name}</strong><small>${event.tier} • ${event.surface} • ${event.city||event.country||'Circuito mundial'}</small></article>`).join('') : '<article class="tour-live-card"><span class="tour-status quiet">SEM EVENTO</span><strong>Semana de preparação</strong><small>Treine, recupere atletas e planeje a próxima viagem.</small></article>';
  const past = recent.map(result => `<article class="tour-result-card"><span>${result.tier||'Tour'}</span><strong>${result.champion}</strong><small>campeão de ${result.eventName} • final sobre ${result.finalist}</small></article>`).join('');
  host.innerHTML = `<div class="tour-live-grid">${live}</div>${past ? `<div class="tour-results-strip">${past}</div>` : ''}`;
}

function renderCalendar() {
  const nearby = state.calendar.filter(event => event.week >= Math.max(1,state.academy.week-1) && event.week <= Math.min(52,state.academy.week+10));
  $('#calendarList').innerHTML = nearby.map(event => {
    const gate = getTournamentGate(event);
    const logo = logoForTournament(event.name);
    return `
      <article class="tournament-card premium-card">
        <button class="tournament-hero" onclick="window.launchEvent('${event.name.replace("'", "&#39;")}')">
          <div class="tournament-logo-wrap hero">${logoMarkup(logo,event.name,'tournament-logo giant','tournament-logo-fallback giant')}</div>
          <div class="tournament-main">
            <strong>Semana ${event.week} • ${event.name}</strong>
            <div class="meta">${event.tier} • ${event.surface} • ${event.city || event.country || "Circuito mundial"} • prêmio ${money(event.prize)} • chave ${event.drawSize || 16}</div>
          </div>
        </button>
        <div class="tournament-side full">
          <div class="entry-pill ${gate.cls}">${gate.label}</div>
          <div class="tournament-actions-row">
            <button class="mini-btn" onclick="window.launchEvent('${event.name.replace("'", "&#39;")}')">Ir para partida</button>
            <button class="mini-btn" onclick="window.openDrawModal('${event.name.replace("'", "&#39;")}')">Chave</button>
          </div>
        </div>
      </article>`;
  }).join('');
}


function renderMarket() {
  $('#marketList').innerHTML = state.marketTalents.map(talent => {
    const avatar = avatarForPlayer(talent.name);
    return `
    <article class="market-card panel-card has-logo">
      <header>
        <div class="avatar-stack">
          ${avatarImg(avatar,'avatar-img',talent.name)}
          <div>
            <h4>${talent.name}</h4>
            <div class="small">${talent.country} • ${talent.age} anos • ${talent.style}</div>
          </div>
        </div>
      </header>
      <div class="metric-row">
        <span class="metric">OVR ${talent.overall}</span>
        <span class="metric">POT ${talent.potential}</span>
        <span class="metric">Salário ${money(talent.salary)}</span>
      </div>
      <div class="tag-row" style="margin-top:12px">
        <button class="btn-ghost" onclick="window.openPlayerProfile('${talent.id}','market')">Analisar perfil</button>
        <button class="btn-primary" onclick="window.signTalent('${talent.id}')">Contratar ${money(talent.fee)}</button>
      </div>
    </article>`;
  }).join('');
}
window.signTalent = (id) => {
  const talent = state.marketTalents.find(t => t.id === id);
  if (!talent) return;
  if (state.academy.money < talent.fee) return addLog('Caixa insuficiente para contratação.');
  state.academy.money -= talent.fee;
  state.roster.push(enrichPlayer({
    ...talent,
    morale: 74, fatigue: 10, injuries: 0, rankingPoints: 40, isUser: true, health: 100, injuredWeeks: 0, lastResult: 'Recém-contratado'
  }));
  state.marketTalents = state.marketTalents.filter(t => t.id !== id);
  addLog(`${talent.name} assinou com sua academia.`);
  render();
};

function staffStatus(member) {
  if (!member) return 'Vaga aberta';
  const weeks = Math.max(0, member.contractWeeks ?? 52);
  return `${weeks} sem. restantes`;
}
function renderStaff() {
  const roles = ['Tecnico','Preparador Fisico','Fisioterapeuta','Psicologo','Nutricionista','Analista','Scouting','Financeiro'];
  const active = roles.map(role => state.staff[role]).filter(Boolean);
  const payroll = active.reduce((sum,m)=>sum+(m.salary||0),0);
  const avg = active.length ? Math.round(active.reduce((sum,m)=>sum+(m.rating||65),0)/active.length) : 0;
  const summary = $('#staffDepartmentSummary');
  if (summary) summary.innerHTML = `
    <article class="staff-kpi"><span>Departamentos</span><strong>${active.length}/${roles.length}</strong></article>
    <article class="staff-kpi"><span>Qualidade média</span><strong>${avg || '--'}</strong></article>
    <article class="staff-kpi"><span>Folha semanal</span><strong>${money(payroll)}</strong></article>
    <article class="staff-kpi"><span>Integração</span><strong>${active.length ? Math.round(active.reduce((sum,m)=>sum+(m.compatibility||70),0)/active.length) : 0}%</strong></article>`;
  const activeCards = roles.map(role => {
    const member = state.staff[role];
    const avatar = STAFF_AVATARS[role] || 'assets/branding/staff/finance.png';
    return `<article class="staff-card panel-card department-card ${member ? 'filled' : 'vacant'}">
      <div class="staff-head">${avatarImg(avatar,'avatar-img',role)}<div><p class="eyebrow">${role}</p><h4>${member?.name || 'Departamento sem líder'}</h4><p class="muted">${member ? `${member.specialty || member.tier} • ${staffStatus(member)}` : 'Contrate um especialista no mercado abaixo.'}</p></div></div>
      ${member ? `<div class="metric-row"><span class="metric">Nível ${member.rating || 65}</span><span class="metric">Compat. ${member.compatibility || 70}%</span><span class="metric">${money(member.salary)}/sem.</span></div>` : '<div class="department-empty">Sem bônus ativo</div>'}
    </article>`;
  }).join('');
  const marketCards = state.staffMarket.map(member => {
    const hired = state.staff[member.role]?.id === member.id;
    const avatar = STAFF_AVATARS[member.role] || 'assets/branding/staff/finance.png';
    return `<article class="staff-card panel-card has-logo market-staff-card">
      <div class="staff-head">${avatarImg(avatar,'avatar-img',member.role)}<div><p class="eyebrow">${member.role}</p><h4>${member.name}</h4><p class="muted">${member.tier} • ${member.specialty || 'Especialista multidisciplinar'}</p></div></div>
      <div class="metric-row"><span class="metric">Nível ${member.rating || 70}</span><span class="metric">Compat. ${member.compatibility || 70}%</span><span class="metric">${member.contractWeeks || 52} sem.</span></div>
      <div class="metric-row">${Object.entries(member.effects || {}).map(([k,v])=>`<span class="metric">${k}: ${v>0?'+':''}${v}</span>`).join('')}</div>
      <div class="staff-contract"><span>Luvas ${money(member.cost)}</span><span>Salário ${money(member.salary)}/sem.</span></div>
      <button class="${hired?'btn-ghost':'btn-secondary'}" onclick="window.hireStaff('${member.id}')" ${hired?'disabled':''}>${hired?'Em atividade':'Assinar contrato'}</button>
    </article>`;
  }).join('');
  $('#staffList').innerHTML = `<div class="staff-block"><div class="section-head compact"><div><p class="eyebrow">Estrutura atual</p><h3>Departamentos ativos</h3></div></div><div class="staff-departments">${activeCards}</div></div><div class="staff-block"><div class="section-head compact"><div><p class="eyebrow">Mercado profissional</p><h3>Candidatos disponíveis</h3></div></div><div class="staff-market-grid">${marketCards}</div></div>`;
}
window.hireStaff = (id) => {
  const member = state.staffMarket.find(s => s.id === id);
  if (!member || state.staff[member.role]?.id === member.id) return;
  if (state.academy.money < member.cost) return addLog('Caixa insuficiente para contratar este profissional.');
  const snapshot = { money: state.academy.money, staff: JSON.parse(JSON.stringify(state.staff)), logs: [...state.logs] };
  try {
    state.academy.money -= member.cost;
    state.staff[member.role] = { ...member, hiredWeek: state.academy.week, hiredSeason: state.academy.season };
    addLog(`${member.name} assumiu o departamento ${member.role} por ${member.contractWeeks || 52} semanas.`);
    if (!saveState(state)) throw new Error('Falha ao salvar contrato');
    render();
  } catch (error) {
    state.academy.money = snapshot.money; state.staff = snapshot.staff; state.logs = snapshot.logs;
    addLog('A contratação foi cancelada com segurança; nenhuma alteração financeira foi mantida.');
    console.error(error); render();
  }
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
  const body = state.ranking.slice(0, 40).map(row => {
    const avatar = avatarForPlayer(row.name);
    return `
    <div class="ranking-row">
      <div>${row.rank}</div>
      <div class="ranking-player">
        ${avatarImg(avatar,'mini-avatar',row.name)}
        <span class="ranking-player-name" title="${row.name}">${row.isUser ? '⭐ ' : ''}${row.name}</span>
      </div>
      <div>${row.country}</div>
      <div>${Math.round(row.overall)}</div>
      <div>${Math.round(row.points)}</div>
    </div>`;
  }).join('');
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


function getMatchPlayer(player) {
  return enrichPlayer({ ...(player || {}) });
}

function attrValue(entity, key, fallback = 60) {
  const value = Number(entity?.[key]);
  return Number.isFinite(value) ? value : Number(entity?.overall) || fallback;
}

function surfaceKey(surface = '') {
  const text = String(surface).toLowerCase();
  if (text.includes('saibro') || text.includes('clay')) return 'clay';
  if (text.includes('grama') || text.includes('grass')) return 'grass';
  if (text.includes('indoor')) return 'indoor';
  return 'hard';
}

function surfaceRating(player, surface) {
  const key = surfaceKey(surface);
  return Number(player?.surfaceRatings?.[key] ?? player?.[key] ?? player?.overall ?? 60);
}

function pressureScore(match, side) {
  const own = side === 'player' ? match.playerScore : match.opponentScore;
  const other = side === 'player' ? match.opponentScore : match.playerScore;
  if (match.tiebreak) return Math.max(0, 6 - own) + Math.max(0, other - own);
  if (own >= 3 && other >= 3) return 6;
  if (other === 3 && own < 3) return 8;
  if (own === 3 && other <= 2) return 4;
  return Math.max(0, other - own);
}

function emptyMatchStats() {
  return {
    points: 0, aces: 0, doubleFaults: 0, winners: 0, unforcedErrors: 0,
    firstServeIn: 0, firstServeTotal: 0, firstServeWon: 0, secondServeWon: 0,
    servicePoints: 0, returnPointsWon: 0, breakPoints: 0, breakPointsWon: 0,
    rallyTotal: 0, rallyCount: 0, maxRally: 0
  };
}

function statsPct(a, b) { return b ? `${Math.round((a / b) * 100)}%` : '0%'; }
function statLine(stats) { return `${stats.aces} aces • ${stats.doubleFaults} DF • ${stats.winners} winners • ${stats.unforcedErrors} ENF`; }
function matchSetScore(match) { return (match.sets || []).map(s => `${s.player}-${s.opponent}`).join('  ') || '—'; }

function currentServerName(match) {
  return match?.server === 'opponent' ? match.opponentName : match.playerName;
}

function createBroadcastReport(match) {
  const p = match.stats.player;
  const o = match.stats.opponent;
  const rallyAvg = p.rallyCount + o.rallyCount ? ((p.rallyTotal + o.rallyTotal) / (p.rallyCount + o.rallyCount)).toFixed(1) : '0.0';
  return [
    `Placar em sets: ${matchSetScore(match)}`,
    `${match.playerName}: ${statLine(p)} • 1º saque ${statsPct(p.firstServeIn, p.firstServeTotal)}`,
    `${match.opponentName}: ${statLine(o)} • 1º saque ${statsPct(o.firstServeIn, o.firstServeTotal)}`,
    `Rally médio ${rallyAvg} bolas • maior rally ${Math.max(p.maxRally, o.maxRally)}`
  ];
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
  const drawPick = pickDrawOpponent(run.draw, run.roundIndex);
  const opponent = getMatchPlayer(drawPick?.opponent || pickOpponent(round, player));
  const user = getMatchPlayer(player);
  const logo = logoForTournament(event.name);
  const firstServer = (state.academy.week + (run.roundIndex || 0)) % 2 === 0 ? 'player' : 'opponent';
  state.match = {
    engineVersion: 'v3.6-real-point-engine', event, round, drawType: run.entryType,
    playerId: player.id, playerName: player.name, opponentName: opponent.name, opponent,
    sets: [], set: 1, setsPlayer: 0, setsOpponent: 0,
    gamesPlayer: 0, gamesOpponent: 0, playerScore: 0, opponentScore: 0,
    tiebreak: false, server: firstServer, pointText: '0-0', strategy: currentStrategy,
    inProgress: true, finished: false, lastWinner: null, lastPointAt: performance.now(), momentum: 0,
    stats: { player: emptyMatchStats(), opponent: emptyMatchStats() },
    lastPoint: null, report: [], logo,
    log: [`${event.name} ${round}: ${player.name} vs ${opponent.name}. Piso ${event.surface || 'hard'} • saque inicial: ${firstServer === 'player' ? player.name : opponent.name}.`]
  };
  stopAutoPlay();
  $('#matchPlayerName').textContent = player.name;
  $('#matchOpponentName').textContent = opponent.name;
  addLog(`Partida preparada: ${player.name} vs ${opponent.name} em ${event.name} (${round}).`);
  switchTab('match');
  renderMatch();
  hydrateAssetImages();
}

function pointWillBeBreakPoint(match, receiverSide) {
  if (match.tiebreak) return false;
  const receiverScore = receiverSide === 'player' ? match.playerScore : match.opponentScore;
  const serverScore = receiverSide === 'player' ? match.opponentScore : match.playerScore;
  const nextReceiver = receiverScore + 1;
  return nextReceiver >= 4 && nextReceiver - serverScore >= 2;
}

function simulateTennisPoint(match, player, opponent) {
  const serverSide = match.server;
  const receiverSide = serverSide === 'player' ? 'opponent' : 'player';
  const server = serverSide === 'player' ? player : opponent;
  const receiver = receiverSide === 'player' ? player : opponent;
  const serverStats = match.stats[serverSide];
  const receiverStats = match.stats[receiverSide];
  const effects = STRATEGY_EFFECTS[currentStrategy] || STRATEGY_EFFECTS.balanced;
  const surface = match.event?.surface || 'hard';
  const coachBonus = getStaffBonus('Tecnico', 'match') + getStaffBonus('Analista','match') + getStaffBonus('Analista','tactical') * 0.45;
  const psychBonus = getStaffBonus('Psicologo', 'mental') + getStaffBonus('Psicologo','morale') * 0.35;
  const serverServe = attrValue(server, 'serve');
  const receiverReturn = attrValue(receiver, 'return', attrValue(receiver, 'backhand'));
  const serverComposure = attrValue(server, 'composure', attrValue(server, 'mental')) + (serverSide === 'player' ? psychBonus * 0.35 : 0);
  const receiverComposure = attrValue(receiver, 'composure', attrValue(receiver, 'mental'));
  const serverSurface = surfaceRating(server, surface);
  const receiverSurface = surfaceRating(receiver, surface);
  const fatiguePenalty = (serverSide === 'player' ? player.fatigue || 0 : 18) * 0.18;
  const pressure = pressureScore(match, serverSide);
  let firstServeChance = clamp(52 + serverServe * 0.28 + serverComposure * 0.08 + serverSurface * 0.04 - fatiguePenalty - pressure * 1.2 + (serverSide === 'player' ? effects.serve : 0), 46, 82);
  if (currentStrategy === 'aggressive' && serverSide === 'player') firstServeChance -= 4;
  if (currentStrategy === 'control' && serverSide === 'player') firstServeChance += 3;
  serverStats.firstServeTotal += 1;
  serverStats.servicePoints += 1;
  const firstIn = Math.random() * 100 < firstServeChance;
  if (firstIn) serverStats.firstServeIn += 1;

  const aceChance = firstIn ? clamp(1.5 + (serverServe - receiverReturn) * 0.10 + (surfaceKey(surface) === 'grass' ? 2.2 : 0) + (serverSide === 'player' ? effects.serve * 0.34 : 0), 0.6, 16) : 0;
  if (firstIn && Math.random() * 100 < aceChance) {
    serverStats.aces += 1;
    serverStats.points += 1;
    serverStats.firstServeWon += 1;
    return { winner: serverSide, type: 'Ace', serve: '1º saque', rally: 1, text: `Ace de ${server.name}.` };
  }

  if (!firstIn) {
    const doubleFaultChance = clamp(3.8 + (62 - serverServe) * 0.07 + pressure * 0.75 + (serverSide === 'player' ? effects.error * 0.45 : 0), 2, 18);
    if (Math.random() * 100 < doubleFaultChance) {
      serverStats.doubleFaults += 1;
      receiverStats.points += 1;
      receiverStats.returnPointsWon += 1;
      return { winner: receiverSide, type: 'Dupla falta', serve: '2º saque', rally: 0, text: `Dupla falta de ${server.name}.` };
    }
  }

  const rallyBase = 3 + Math.floor(Math.random() * 8);
  const consistency = (attrValue(server, 'consistency') + attrValue(receiver, 'consistency')) / 2;
  const rally = clamp(Math.round(rallyBase + (consistency - 60) / 12 + (surfaceKey(surface) === 'clay' ? 3 : surfaceKey(surface) === 'grass' ? -1 : 0)), 2, 22);
  serverStats.rallyTotal += rally; serverStats.rallyCount += 1; serverStats.maxRally = Math.max(serverStats.maxRally, rally);
  receiverStats.rallyTotal += rally; receiverStats.rallyCount += 1; receiverStats.maxRally = Math.max(receiverStats.maxRally, rally);

  const serverAttack = attrValue(server, 'forehand') * 0.34 + attrValue(server, 'backhand') * 0.22 + serverServe * (firstIn ? 0.22 : 0.10) + serverSurface * 0.10 + serverComposure * 0.08;
  const receiverDefense = receiverReturn * 0.28 + attrValue(receiver, 'agility') * 0.18 + attrValue(receiver, 'speed') * 0.12 + attrValue(receiver, 'consistency') * 0.24 + receiverSurface * 0.10 + receiverComposure * 0.08;
  const userTactical = serverSide === 'player' ? effects.offense + effects.pressure - effects.error * 0.55 : receiverSide === 'player' ? effects.defense - effects.error * 0.45 : 0;
  const momentum = match.momentum * (serverSide === 'player' ? 1 : -1);
  const winChance = clamp(50 + (serverAttack - receiverDefense) * 0.42 + userTactical + momentum, 24, 76);
  const serverWins = Math.random() * 100 < winChance;
  const winner = serverWins ? serverSide : receiverSide;
  const loser = serverWins ? receiverSide : serverSide;
  const winnerStats = match.stats[winner];
  const loserStats = match.stats[loser];
  const attackingError = clamp(8 + (currentStrategy === 'aggressive' && loser === 'player' ? 5 : 0) + (rally - 6) * 0.55 - attrValue(loser === 'player' ? player : opponent, 'consistency') * 0.06, 4, 24);
  const isError = Math.random() * 100 < attackingError;
  if (isError) loserStats.unforcedErrors += 1; else winnerStats.winners += 1;
  winnerStats.points += 1;
  if (winner === receiverSide) receiverStats.returnPointsWon += 1;
  if (firstIn && winner === serverSide) serverStats.firstServeWon += 1;
  if (!firstIn && winner === serverSide) serverStats.secondServeWon += 1;
  const shot = rally > 10 ? 'rally longo' : firstIn ? 'devolução pressionada' : 'segundo saque atacado';
  return { winner, type: isError ? 'Erro não forçado' : 'Winner', serve: firstIn ? '1º saque' : '2º saque', rally, text: isError ? `${loser === 'player' ? player.name : opponent.name} erra após ${rally} bolas.` : `${winner === 'player' ? player.name : opponent.name} fecha com ${shot}.` };
}

function playPoint() {
  if (!state.match?.inProgress || state.match.finished) return addLog('Inicie uma partida primeiro.');
  const player = state.roster.find(p => p.id === state.match.playerId);
  if (!player) return addLog('Atleta da partida não encontrado.');
  const snapshot = { match: structuredClone(state.match), player: structuredClone(player) };
  try {
    const opp = getMatchPlayer(state.match.opponent);
    const point = simulateTennisPoint(state.match, getMatchPlayer(player), opp);
    const receiverSide = state.match.server === 'player' ? 'opponent' : 'player';
    if (pointWillBeBreakPoint(state.match, receiverSide)) state.match.stats[receiverSide].breakPoints += 1;
    state.match.lastPoint = point;
    state.match.lastWinner = point.winner;
    state.match.lastPointAt = performance.now();
    const won = point.winner === 'player';
    const effects = STRATEGY_EFFECTS[currentStrategy] || STRATEGY_EFFECTS.balanced;
    state.match.momentum = clamp((state.match.momentum || 0) * 0.72 + (won ? 1 : -1) * (point.type === 'Ace' || point.type === 'Winner' ? 1.4 : 0.9), -8, 8);
    player.fatigue = Math.min(100, (player.fatigue || 0) + 0.55 + Math.max(0, effects.stamina) * 0.28 + (point.rally || 0) * 0.035);
    player.health = Math.max(42, (player.health || 100) - 0.08 - Math.max(0, effects.stamina) * 0.05 - (point.rally || 0) * 0.012);
    maybeInjure(player, point.rally > 14 ? 1.4 : 0.8);
    updateTennisScore(point.winner);
    addMatchLog(`${point.serve} • ${point.type}: ${point.text}`);
    drawCourt(won ? 'player' : 'opponent');
    renderMatch();
    hydrateAssetImages();
  } catch (error) {
    Object.assign(player, snapshot.player);
    state.match = snapshot.match;
    showSystemError('Ponto cancelado com segurança. O estado anterior foi restaurado.', error);
    renderMatch();
  }
}

function autoPlayGame() {
  if (!state.match?.inProgress || state.match.finished) return;
  let guard = 0;
  const startGames = `${state.match.gamesPlayer}-${state.match.gamesOpponent}-${state.match.set}`;
  while (!state.match.finished && `${state.match.gamesPlayer}-${state.match.gamesOpponent}-${state.match.set}` === startGames && guard < 80) {
    playPoint();
    guard += 1;
  }
}

function updateTennisScore(winnerSide) {
  const match = state.match;
  if (!match) return;
  if (match.tiebreak) {
    if (winnerSide === 'player') match.playerScore += 1; else match.opponentScore += 1;
    const total = match.playerScore + match.opponentScore;
    if (total === 1 || total % 2 === 1) match.server = match.server === 'player' ? 'opponent' : 'player';
    match.pointText = `TB ${match.playerScore}-${match.opponentScore}`;
    const p = match.playerScore, o = match.opponentScore;
    if ((p >= 7 || o >= 7) && Math.abs(p - o) >= 2) awardSet(p > o);
    return;
  }
  if (winnerSide === 'player') match.playerScore += 1; else match.opponentScore += 1;
  const p = match.playerScore, o = match.opponentScore;
  if ((p >= 4 || o >= 4) && Math.abs(p - o) >= 2) {
    const playerGame = p > o;
    if (playerGame) match.gamesPlayer += 1; else match.gamesOpponent += 1;
    if (match.server !== (playerGame ? 'player' : 'opponent')) match.stats[playerGame ? 'player' : 'opponent'].breakPointsWon += 1;
    addMatchLog(`Game para ${playerGame ? match.playerName : match.opponentName}.`);
    match.playerScore = 0; match.opponentScore = 0;
    match.server = match.server === 'player' ? 'opponent' : 'player';
    if (match.gamesPlayer === 6 && match.gamesOpponent === 6) {
      match.tiebreak = true;
      match.pointText = 'TB 0-0';
      addMatchLog('Tiebreak iniciado. Cada ponto agora pesa no set.');
      return;
    }
    if ((match.gamesPlayer >= 6 || match.gamesOpponent >= 6) && Math.abs(match.gamesPlayer - match.gamesOpponent) >= 2) {
      awardSet(match.gamesPlayer > match.gamesOpponent);
      return;
    }
  }
  match.pointText = pointDisplay(match.playerScore, match.opponentScore);
}

function pointDisplay(p, o) {
  if (p >= 3 && o >= 3) {
    if (p === o) return '40-40';
    return p > o ? 'AD-40' : '40-AD';
  }
  return `${SCORE_NAMES[Math.min(p, 3)]}-${SCORE_NAMES[Math.min(o, 3)]}`;
}

function awardSet(playerWonSet) {
  const match = state.match;
  match.sets.push({ player: match.gamesPlayer, opponent: match.gamesOpponent, tiebreak: match.tiebreak ? `${match.playerScore}-${match.opponentScore}` : null });
  if (playerWonSet) match.setsPlayer += 1; else match.setsOpponent += 1;
  addMatchLog(`Set ${match.set} para ${playerWonSet ? match.playerName : match.opponentName}: ${match.gamesPlayer}-${match.gamesOpponent}${match.tiebreak ? ` (${match.playerScore}-${match.opponentScore})` : ''}.`);
  if (match.setsPlayer >= 2 || match.setsOpponent >= 2) {
    finishMatch(match.setsPlayer > match.setsOpponent);
    return;
  }
  match.set += 1;
  match.gamesPlayer = 0; match.gamesOpponent = 0; match.playerScore = 0; match.opponentScore = 0; match.tiebreak = false; match.pointText = '0-0';
  match.server = match.server === 'player' ? 'opponent' : 'player';
}

function resolveGame() { /* Mantido apenas para compatibilidade com saves antigos. O placar real usa updateTennisScore(). */ }

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
  player.morale = clamp((player.morale || 70) + (playerWon ? 8 : -4), 35, 100);
  player.fatigue = Math.min(100, player.fatigue + 5 + ((state.match.stats.player.rallyTotal || 0) / 180));
  state.academy.money += cashGain;
  state.academy.reputation += playerWon ? 4 : 1;
  const score = matchSetScore(state.match);
  player.lastResult = `${event.name} ${playerWon ? 'venceu ' + round : 'parou em ' + round} • ${score}`;
  state.match.report = createBroadcastReport(state.match);
  state.summary.unshift(`${player.name} ${playerWon ? 'venceu' : 'caiu em'} ${round} de ${event.name}. Placar ${score}. +${pointsGain} pts / ${money(cashGain)}.`);
  state.summary = state.summary.slice(0, 8);
  addLog(`${player.name} ${playerWon ? 'venceu' : 'perdeu'} em ${event.name} (${round}) • ${score}.`);
  state.inbox.unshift({ title: `${event.name}: ${player.name}`, body: `${playerWon ? 'Vitória importante' : 'Derrota'} na rodada ${round}. Placar ${score}. ${pointsGain} pontos processados no ranking.`, week: state.academy.week });
  state.match.finished = true;
  state.match.inProgress = false;
  stopAutoPlay();

  if (!run) return render();
  advanceDrawRound(run, playerWon);
  if (!playerWon) {
    run.complete = true;
    state.activeTournament = null;
    addMatchLog('Eliminado. Hora de reagrupar. Relatório tático salvo no histórico.');
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
      player.lastResult = `${event.name} campeão • ${score}`;
      state.summary.unshift(`${player.name} foi campeão de ${event.name}!`);
    } else {
      addMatchLog(`Vitória. Próxima rodada: ${run.rounds[run.roundIndex]}.`);
    }
  }
  render();
}

function renderMatch() {
  const match = state.match;
  const matchWrap = $('#matchBrandWrap');
  const activeName = state.activeTournament ? state.activeTournament.event.name : (match?.event?.name || '');
  const activeLogo = logoForTournament(activeName);
  if (matchWrap) matchWrap.innerHTML = `<div class="match-brand-actions">${activeLogo ? `<div class="tournament-logo-wrap hero">${logoMarkup(activeLogo,activeName,'tour-logo large','tournament-logo-fallback large')}</div>` : ''}<button class="mini-btn" type="button" onclick="window.openDrawModal('${activeName.replace("'", "&#39;")}')">Ver chave</button></div>`; 
  $('#roundLabel').textContent = state.activeTournament ? `Rodada ${state.activeTournament.rounds[state.activeTournament.roundIndex] || 'fim'}` : (match?.round ? `Rodada ${match.round}` : 'Rodada -');
  $('#tournamentLabel').textContent = state.activeTournament ? state.activeTournament.event.name : (match?.event?.name || 'Nenhum torneio');
  const statsHost = $('#matchStatsPanel');
  const reportHost = $('#matchReportPanel');
  const scoutHost = $('#matchScoutPanel');
  if (!match) {
    const badge = document.querySelector('.score-card .tour-badge'); if (badge) badge.remove();
    $('#scorePlayer').textContent = '0'; $('#scoreOpponent').textContent = '0'; $('#setLabel').textContent = 'Set 1'; $('#pointLabel').textContent = '0-0';
    $('#matchLog').textContent = state.activeTournament ? `Torneio ativo em ${state.activeTournament.event.name}. Toque em iniciar rodada.` : 'Nenhuma partida em andamento.';
    if (statsHost) statsHost.innerHTML = '<div class="empty-state">Inicie uma partida para ver estatísticas reais ponto a ponto.</div>';
    if (reportHost) reportHost.innerHTML = '<div class="empty-state">Relatório final aparecerá aqui após a partida.</div>';
    if (scoutHost) scoutHost.innerHTML = '<div class="empty-state">O dossiê tático será montado com atleta, adversário, piso e staff.</div>';
    drawCourt(); return;
  }
  $('#scorePlayer').textContent = match.gamesPlayer;
  $('#scoreOpponent').textContent = match.gamesOpponent;
  $('#setLabel').textContent = `Set ${match.set} • sets ${match.setsPlayer}-${match.setsOpponent}`;
  $('#pointLabel').textContent = match.pointText;
  $('#matchLog').textContent = match.log.slice(-14).join('\n');
  const player = getMatchPlayer(state.roster.find(p => p.id === match.playerId) || {});
  const opp = getMatchPlayer(match.opponent || {});
  const scoreCard = document.querySelector('.score-card');
  if (scoreCard) {
    const old = scoreCard.querySelector('.tour-badge'); if (old) old.remove();
    const badge = document.createElement('div'); badge.className='tour-badge broadcast';
    const logo = logoForTournament(match.event.name);
    badge.innerHTML = `${logoImg(logo,'tour-logo',match.event.name)}<div class="copy"><strong>${match.event.name}</strong><div class="event-surface">${match.event.surface} • ${match.round} • Saque: ${currentServerName(match)}</div><div class="set-strip">${match.sets?.length ? match.sets.map((s,i)=>`S${i+1} ${s.player}-${s.opponent}`).join(' • ') : 'Melhor de 3 sets'}</div></div>`;
    scoreCard.appendChild(badge);
  }
  const p = match.stats.player, o = match.stats.opponent;
  if (statsHost) statsHost.innerHTML = `<article class="match-stat-card"><span>Aces</span><strong>${p.aces} - ${o.aces}</strong></article><article class="match-stat-card"><span>Duplas faltas</span><strong>${p.doubleFaults} - ${o.doubleFaults}</strong></article><article class="match-stat-card"><span>Winners</span><strong>${p.winners} - ${o.winners}</strong></article><article class="match-stat-card"><span>Erros não forçados</span><strong>${p.unforcedErrors} - ${o.unforcedErrors}</strong></article><article class="match-stat-card"><span>1º saque</span><strong>${statsPct(p.firstServeIn,p.firstServeTotal)} - ${statsPct(o.firstServeIn,o.firstServeTotal)}</strong></article><article class="match-stat-card"><span>Break points</span><strong>${p.breakPointsWon}/${p.breakPoints} - ${o.breakPointsWon}/${o.breakPoints}</strong></article>`;
  const last = match.lastPoint;
  if (scoutHost) scoutHost.innerHTML = `<div class="scout-row"><strong>${player.name}</strong><span>SAQ ${Math.round(attrValue(player,'serve'))} • DEV ${Math.round(attrValue(player,'return'))} • MENT ${Math.round(attrValue(player,'composure',attrValue(player,'mental')))}</span></div><div class="scout-row"><strong>${opp.name}</strong><span>SAQ ${Math.round(attrValue(opp,'serve'))} • DEV ${Math.round(attrValue(opp,'return'))} • MENT ${Math.round(attrValue(opp,'composure',attrValue(opp,'mental')))}</span></div><div class="last-point-card"><span>Último ponto</span><strong>${last ? `${last.type} • ${last.rally} bolas` : 'Aguardando'}</strong><p>${last?.text || 'Use jogar ponto ou auto para iniciar o rally.'}</p></div>`;
  if (reportHost) reportHost.innerHTML = match.finished ? createBroadcastReport(match).map(line=>`<div class="report-line">${line}</div>`).join('') : `<div class="report-line">Motor v3.6 ativo: ponto a ponto, saque, rally, tiebreak e pressão do placar.</div><div class="report-line">Momentum: ${Math.round((match.momentum||0)*10)/10} • Piso: ${match.event.surface || 'hard'} • Estratégia: ${currentStrategy}</div>`;
  const autoBtn = $('#autoMatchBtn');
  if (autoBtn) autoBtn.textContent = autoPlayTimer ? `Auto ${autoPlaySpeed}x ativo` : 'Auto 1x';
  refreshAutoButtons();
}
function addMatchLog(text) { if (!state.match) return; state.match.log.push(text); state.match.log = state.match.log.slice(-80); }

function advanceWeek() {
  processWeeklyTraining();
  const weeklyIncome = calculateSponsor();
  const weeklyCosts = calculateWeeklyCosts();
  state.academy.money += weeklyIncome - weeklyCosts;
  if (state.activeTournament && state.activeTournament.event.week < state.academy.week) state.activeTournament = null;
  state.roster.forEach(player => {
    const physio = getStaffBonus('Fisioterapeuta', 'recovery') + getStaffBonus('Nutricionista','recovery') + getStaffBonus('Preparador Fisico','recovery');
    player.fatigue = Math.max(0, player.fatigue - (7 + state.academy.facilities.medical * 1.4 + physio * 0.45));
    player.health = Math.min(100, player.health + (4 + state.academy.facilities.medical + physio * 0.25));
    if (player.injuredWeeks > 0) {
      player.injuredWeeks -= 1;
      if (player.injuredWeeks <= 0) { player.injuredWeeks = 0; addLog(`${player.name} recebeu alta médica.`); }
    }
    player.morale = Math.max(45, (player.morale || 70) - 1 + state.academy.facilities.training * 0.2);
  });
  Object.entries(state.staff || {}).forEach(([role, member]) => {
    if (!member) return;
    member.contractWeeks = Math.max(0, (member.contractWeeks ?? 52) - 1);
    if (member.contractWeeks === 0) {
      state.inbox.unshift({ title: `Contrato encerrado: ${member.name}`, body: `${member.name} deixou o departamento ${role}. Contrate um substituto para recuperar os bônus.`, week: state.academy.week });
      state.staff[role] = null;
    }
  });
  state.academy.week += 1;
  simulateWorldTourWeek();
  maybeCreateWeeklyNews();
  maybeCreateSponsorOffer();
  evaluateObjectives();
  if (state.academy.week > 52) {
    state.academy.week = 1;
    state.academy.season += 1;
    rotateSeason();
  }
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
function getDepartmentBonus(key) { return Object.values(state.staff || {}).filter(Boolean).reduce((sum,m)=>sum+(m.effects?.[key]||0),0); }
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
  const physio = Math.abs(Math.min(0, getStaffBonus('Fisioterapeuta', 'injury') + getStaffBonus('Nutricionista','injury') + getStaffBonus('Preparador Fisico','injury')));
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
  const width = Math.max(320, Math.round((rect.width || 960) * dpr));
  const height = Math.max(180, Math.round((rect.height || 540) * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const w = canvas.width;
  const h = canvas.height;
  const now = courtClock || performance.now();
  const match = state?.match || null;
  const pulse = now * 0.001;

  const p1 = {
    x: w * (0.34 + Math.sin(pulse * 2.0) * 0.05),
    y: h * (0.76 + Math.sin(pulse * 3.2) * 0.01)
  };
  const p2 = {
    x: w * (0.66 + Math.cos(pulse * 1.7) * 0.05),
    y: h * (0.24 + Math.cos(pulse * 3.1) * 0.01)
  };

  const rally = ((now % 1600) / 1600);
  const t = rally < 0.5 ? rally * 2 : (1 - rally) * 2;
  const bias = match?.lastWinner === 'player' ? -0.08 : match?.lastWinner === 'opponent' ? 0.08 : 0;
  const bx = p1.x + (p2.x - p1.x) * t + w * bias * Math.max(0, 1 - ((now - (match?.lastPointAt || now)) / 700));
  const by = p1.y + (p2.y - p1.y) * t - Math.sin(t * Math.PI) * h * 0.18;

  ctx.clearRect(0, 0, w, h);

  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0e3a69');
  g.addColorStop(1, '#0d6c66');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(255,255,255,0.82)';
  ctx.lineWidth = Math.max(2, w * 0.004);
  ctx.strokeRect(w * 0.12, h * 0.12, w * 0.76, h * 0.76);
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.12);
  ctx.lineTo(w * 0.5, h * 0.88);
  ctx.moveTo(w * 0.12, h * 0.5);
  ctx.lineTo(w * 0.88, h * 0.5);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(w * 0.12, h * 0.498, w * 0.76, 2);

  function drawPlayer(x, y, fill, invert = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(0, -24, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-8, -14, 16, 34);
    ctx.fillRect(-18, 16, 10, 34);
    ctx.fillRect(8, 16, 10, 34);

    ctx.save();
    ctx.rotate(invert * 0.45 + Math.sin(pulse * 6) * 0.08);
    ctx.fillRect(-3, -6, 6, 32);
    ctx.strokeStyle = '#f6fbff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 26, 12, 16, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  drawPlayer(p2.x, p2.y, match?.lastWinner === 'opponent' ? '#ff8fa5' : '#d8e6ff', -1);
  drawPlayer(p1.x, p1.y, match?.lastWinner === 'player' ? '#9aff81' : '#61ebff', 1);

  for (let i = 0; i < 4; i++) {
    const tt = Math.max(0, t - i * 0.06);
    const tx = p1.x + (p2.x - p1.x) * tt;
    const ty = p1.y + (p2.y - p1.y) * tt - Math.sin(tt * Math.PI) * h * 0.18;
    ctx.fillStyle = `rgba(255,255,255,${0.16 - i * 0.03})`;
    ctx.beginPath();
    ctx.arc(tx, ty, Math.max(2, 6 - i), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(bx, by + 14, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(bx, by, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(5,10,18,0.66)';
  ctx.fillRect(18, 16, 320, 58);
  ctx.fillStyle = '#e8f4ff';
  ctx.font = '700 18px Inter, system-ui, sans-serif';
  ctx.fillText(match ? `${match.playerName} vs ${match.opponentName}` : '2D Match Center', 30, 40);
  ctx.fillStyle = '#9fb6cf';
  ctx.font = '500 14px Inter, system-ui, sans-serif';
  const autoLabel = autoPlayTimer ? `Auto ${autoPlaySpeed}x` : 'Manual';
  ctx.fillText(`Estratégia ${currentStrategy.toUpperCase()} • ${autoLabel}`, 30, 61);
}



function getEconomySummary(){
  const cash = state.finance?.cash || state.cash || 0;
  const weekly = (state.story?.wins||0)*5000 - (state.story?.losses||0)*2000;
  return {cash, weekly};
}

function getStaffImpact(){
  const rep = state.academy?.reputation||0;
  return {
    coaching: Math.min(100, rep*3),
    medical: Math.min(100, rep*2),
    management: Math.min(100, rep*2.5)
  };
}




window.forceEnterCareer = () => saveOwnerSetup();
['ownerNameInput','academyNameInput','academyCityInput','careerDifficultyInput'].forEach(id => document.getElementById(id)?.addEventListener('input', updateCareerPreview));
document.getElementById('saveOwnerSetupBtn')?.addEventListener('click', () => saveOwnerSetup());
window.addEventListener('orientationchange', () => setTimeout(() => { document.documentElement.style.setProperty('--app-vh', `${window.innerHeight * 0.01}px`); }, 150));
window.addEventListener('resize', () => document.documentElement.style.setProperty('--app-vh', `${window.innerHeight * 0.01}px`), { passive: true });
document.documentElement.style.setProperty('--app-vh', `${window.innerHeight * 0.01}px`);
