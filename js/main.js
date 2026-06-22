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

const TACTICAL_DEFAULT_PLAN = { serveTarget: 'body', rallyPlan: 'balanced', attackPattern: 'weakness', returnPlan: 'secondServePressure', riskMode: 'balanced' };
const TACTICAL_OPTIONS = {
  serveTarget: {
    wide: { label: 'Sacar aberto', desc: 'Abre a quadra e aumenta chance de ace, mas cobra precisão.', firstServe: -2, ace: 2.2, error: 0.6, direction: 'aberto' },
    body: { label: 'Sacar no corpo', desc: 'Reduz ângulo da devolução e protege pontos de pressão.', firstServe: 2, ace: -0.4, error: -0.6, direction: 'corpo' },
    t: { label: 'Sacar no T', desc: 'Busca potência e ponto curto, especialmente em indoor/grama.', firstServe: -1, ace: 1.4, error: 0.2, direction: 'T' },
    mixed: { label: 'Variar direção', desc: 'Evita leitura do adversário e estabiliza o saque.', firstServe: 1, ace: 0.5, error: -0.2, direction: 'misto' }
  },
  rallyPlan: {
    short: { label: 'Encurtar pontos', desc: 'Primeira bola agressiva, rede e risco controlado para poupar energia.', rally: -2.1, offense: 3.2, defense: -1.2, stamina: -0.9, error: 1.2 },
    balanced: { label: 'Rally equilibrado', desc: 'Plano sem extremos, bom para ler o jogo antes de arriscar.', rally: 0, offense: 0, defense: 0, stamina: 0, error: 0 },
    long: { label: 'Alongar rallies', desc: 'Testa resistência e consistência do adversário, forte no saibro.', rally: 2.6, offense: -1, defense: 3.1, stamina: 1.4, error: -0.6 },
    net: { label: 'Subir à rede', desc: 'Encurta trocas e aumenta winners/erros conforme voleio e timing.', rally: -2.6, offense: 4.4, defense: -2.5, stamina: -0.6, error: 1.9 }
  },
  attackPattern: {
    weakness: { label: 'Atacar fraqueza', desc: 'O analista escolhe automaticamente o golpe mais frágil do adversário.', offense: 2.2, pressure: 1.8, error: 0.4 },
    backhand: { label: 'Atacar backhand', desc: 'Insiste no lado geralmente mais vulnerável em rallies e devoluções.', offense: 1.5, pressure: 2.4, error: 0.5 },
    forehand: { label: 'Evitar forehand forte', desc: 'Protege contra a melhor bola do rival e reduz winners sofridos.', offense: -0.5, defense: 2.8, error: -0.4 },
    openCourt: { label: 'Abrir a quadra', desc: 'Usa ângulos para puxar o rival para fora e finalizar no espaço.', offense: 3.3, pressure: 1.1, error: 1.2 },
    middle: { label: 'Jogar no corpo', desc: 'Tira ângulo, reduz erro e força decisão do adversário.', offense: -0.4, defense: 1.5, error: -1.1 }
  },
  returnPlan: {
    neutral: { label: 'Devolução neutra', desc: 'Bloqueia a bola e entra no rally com segurança.', return: 0, second: 0, error: 0 },
    secondServePressure: { label: 'Pressionar 2º saque', desc: 'Ataca a segunda bola e aumenta chance de break, com risco extra.', return: 1.2, second: 4.2, error: 1.2 },
    chip: { label: 'Bloquear/slice', desc: 'Reduz erro na devolução e força o rival a construir o ponto.', return: 0.6, second: 1.2, error: -1.1 },
    deep: { label: 'Devolver profundo', desc: 'Joga no fundo para tirar tempo do sacador.', return: 2.1, second: 2.2, error: 0.5 }
  },
  riskMode: {
    safe: { label: 'Risco baixo', desc: 'Menos erro, menos winner. Bom quando o atleta está pressionado.', offense: -1.8, defense: 2.1, error: -2.6, firstServe: 2.4 },
    balanced: { label: 'Risco equilibrado', desc: 'Mantém margem e agressividade em níveis profissionais.', offense: 0, defense: 0, error: 0, firstServe: 0 },
    aggressive: { label: 'Risco alto', desc: 'Busca dominar pontos curtos, mas aumenta erros e desgaste mental.', offense: 3.8, defense: -1.8, error: 2.9, firstServe: -2.4 }
  }
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

const PLAYER_PERSONALITIES = {
  fighter: { label: 'Competidor feroz', icon: '🔥', desc: 'Cresce em jogos grandes, mas cobra resultados e torneios fortes.', pressure: 8, ambition: 88, discipline: 74, conflict: 10 },
  disciplined: { label: 'Profissional disciplinado', icon: '📋', desc: 'Aceita rotina pesada, evolui com constância e raramente cria ruído.', pressure: -4, ambition: 72, discipline: 92, conflict: -6 },
  prodigy: { label: 'Promessa sensível', icon: '⭐', desc: 'Grande teto técnico, mas oscila com pressão, imprensa e derrotas duras.', pressure: 14, ambition: 84, discipline: 68, conflict: 4 },
  leader: { label: 'Líder de vestiário', icon: '🧭', desc: 'Eleva moral do elenco e responde bem a conversas francas.', pressure: 0, ambition: 78, discipline: 82, conflict: -2 },
  mercurial: { label: 'Talento instável', icon: '⚡', desc: 'Pode explodir tecnicamente, mas exige gestão fina de confiança e ego.', pressure: 10, ambition: 90, discipline: 55, conflict: 14 },
  loyal: { label: 'Leal à academia', icon: '🤝', desc: 'Valoriza relação com treinador, estabilidade e plano de longo prazo.', pressure: -2, ambition: 65, discipline: 80, conflict: -8 }
};
const TALK_ACTIONS = {
  praise: { label: 'Elogiar atuação', morale: 6, confidence: 5, relationship: 4, pressure: -1, risk: 0 },
  demand: { label: 'Cobrar evolução', morale: -3, confidence: 1, relationship: -2, pressure: 5, risk: 2 },
  calm: { label: 'Reduzir pressão', morale: 2, confidence: 2, relationship: 3, pressure: -7, risk: -2 },
  promise: { label: 'Prometer calendário forte', morale: 4, confidence: 2, relationship: 5, pressure: 4, risk: 3 },
  rest: { label: 'Proteger descanso', morale: 3, confidence: 1, relationship: 4, pressure: -3, risk: -4 }
};
const SEASON_GOALS = {
  ranking: 'Subir no ranking',
  title: 'Buscar título',
  development: 'Desenvolvimento técnico',
  recovery: 'Saúde e recuperação',
  consistency: 'Consistência competitiva'
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


const SURFACE_THEMES = {
  hard: { label: 'Piso duro', cls: 'hard', accent: '#52d7ff', tempo: 'médio-rápido', tactical: 'Saque sólido, devolução agressiva e troca curta com controle de erro.' },
  clay: { label: 'Saibro', cls: 'clay', accent: '#f07a45', tempo: 'lento', tactical: 'Rallies longos, paciência, consistência e preparação física acima da média.' },
  grass: { label: 'Grama', cls: 'grass', accent: '#9aff81', tempo: 'rápido', tactical: 'Primeiro saque, slice baixo, rede e tomada de decisão em poucos golpes.' },
  indoor: { label: 'Indoor', cls: 'indoor', accent: '#b48cff', tempo: 'rápido', tactical: 'Saque mais pesado, devolução curta e pouca interferência externa.' }
};
const TIER_THEMES = {
  'Grand Slam': { label:'Grand Slam', cls:'grand-slam', stars:5, aura:'evento máximo', trophy:'🏆', pressure:96 },
  'Masters 1000': { label:'Masters 1000', cls:'masters', stars:4, aura:'elite mundial', trophy:'💎', pressure:88 },
  'ATP 500': { label:'ATP 500', cls:'atp500', stars:3, aura:'tour premium', trophy:'🥇', pressure:74 },
  'ATP 250': { label:'ATP 250', cls:'atp250', stars:2, aura:'circuito regular', trophy:'🏅', pressure:58 },
  'Finals': { label:'Finals', cls:'finals', stars:5, aura:'final de temporada', trophy:'👑', pressure:94 },
  'Seleções': { label:'Seleções', cls:'team', stars:3, aura:'competição nacional', trophy:'🌍', pressure:80 },
  'Challenger': { label:'Challenger', cls:'challenger', stars:1, aura:'desenvolvimento', trophy:'🎾', pressure:42 }
};
function escapeAttr(value='') { return String(value).replace(/&/g,'&amp;').replace(/'/g,'&#39;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escapeHtml(value='') { return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function eventSurfaceTheme(event={}) {
  const key = surfaceKey(event.surface || 'hard');
  return SURFACE_THEMES[key] || SURFACE_THEMES.hard;
}
function eventTierTheme(event={}) {
  return TIER_THEMES[event.tier] || TIER_THEMES[event.category] || TIER_THEMES['ATP 250'];
}
function eventIdentity(event={}) {
  const tier = eventTierTheme(event);
  const surface = eventSurfaceTheme(event);
  const prestige = Math.round(event.prestige || tier.pressure || 55);
  const prizePool = event.prizePool || (event.prize || 0) * Math.max(8, event.drawSize || 32);
  const logo = logoForTournament(event.name || '');
  const seed = stableNumber(`${event.id || event.name}-${event.city || ''}-${event.country || ''}`);
  const weather = surface.cls === 'indoor' ? 'condições controladas' : surface.cls === 'clay' ? 'vento e quique alto' : surface.cls === 'grass' ? 'piso baixo e úmido' : 'calor e velocidade média';
  const attendance = Math.round((prestige * 700) + ((seed % 9000) + 2500));
  const atmosphere = prestige >= 95 ? 'pressão de arena lotada e mídia global' : prestige >= 80 ? 'ambiente internacional com alta cobrança' : prestige >= 60 ? 'torneio competitivo com chance de pontos importantes' : 'evento de desenvolvimento para construir ranking';
  return { ...event, tier, surface, prestige, prizePool, logo, weather, attendance, atmosphere };
}
function prestigeStars(value=0) {
  const n = Math.max(1, Math.min(5, Math.ceil((value || 50) / 20)));
  return '★★★★★'.slice(0,n) + '☆☆☆☆☆'.slice(0,5-n);
}
function shortMoney(value=0) {
  const n = Number(value || 0);
  if (n >= 1000000) return `$${(n/1000000).toFixed(n >= 10000000 ? 0 : 1)}M`;
  if (n >= 1000) return `$${Math.round(n/1000)}k`;
  return money(n);
}
function tournamentHeroMarkup(event, opts={}) {
  const id = eventIdentity(event);
  const safeName = escapeAttr(id.name || 'Torneio');
  const compact = opts.compact ? ' compact' : '';
  return `<article class="tournament-identity-card ${id.tier.cls} surface-${id.surface.cls}${compact}">
    <div class="identity-bg-glow"></div>
    <div class="identity-logo-panel">${logoMarkup(id.logo, id.name, 'tournament-logo giant', 'tournament-logo-fallback giant')}</div>
    <div class="identity-copy">
      <p class="eyebrow">${id.tier.label} • ${id.surface.label}</p>
      <h4>${escapeHtml(id.name || 'Torneio')}</h4>
      <div class="identity-meta"><span>${escapeHtml(id.city || id.country || 'Circuito mundial')}</span><span>${id.tier.trophy} ${id.tier.aura}</span><span>${prestigeStars(id.prestige)}</span></div>
      <div class="identity-kpis"><span>Prestígio <strong>${id.prestige}</strong></span><span>Pontos <strong>${id.winnerPoints || 250}</strong></span><span>Bolsa <strong>${shortMoney(id.prizePool)}</strong></span><span>Chave <strong>${id.drawSize || 32}</strong></span></div>
      <p class="identity-tactical">${escapeHtml(id.surface.tactical)}</p>
    </div>
    <div class="identity-actions">
      <button class="mini-btn" onclick="window.openTournamentIdentity('${safeName}')">Identidade</button>
      <button class="mini-btn" onclick="window.openDrawModal('${safeName}')">Chave</button>
    </div>
  </article>`;
}
function renderTournamentIdentityHub() {
  const host = $('#tournamentIdentityHub');
  if (!host || !state?.calendar) return;
  const week = state.academy.week;
  const current = state.calendar.find(e => e.week === week) || state.calendar.find(e => e.week > week) || state.calendar[0];
  const nextMajors = state.calendar.filter(e => e.week >= week && ['Grand Slam','Masters 1000','Finals'].includes(e.tier)).slice(0,3);
  const spotlight = current ? tournamentHeroMarkup(current) : '<div class="empty-state">Nenhum torneio disponível.</div>';
  const majors = nextMajors.length ? nextMajors.map(e => tournamentHeroMarkup(e, {compact:true})).join('') : '<div class="empty-state">Sem eventos premium próximos.</div>';
  host.innerHTML = `<div class="identity-section-head"><div><p class="eyebrow">Tournament Identity System</p><h4>Circuito com identidade visual</h4></div><span>${BUILD_LABEL}</span></div><div class="identity-hub-grid"><div>${spotlight}</div><div class="identity-next-stack">${majors}</div></div>`;
  hydrateAssetImages();
}
function ensureTournamentIdentityModal() {
  if (document.querySelector('#tournamentIdentityModal')) return;
  const node = document.createElement('section');
  node.id = 'tournamentIdentityModal';
  node.className = 'tournament-identity-modal hidden';
  node.innerHTML = `<div class="identity-modal-backdrop" data-identity-close="1"></div>
    <div class="identity-modal-card glass">
      <div class="draw-head"><div><p class="eyebrow">Dossiê do torneio</p><h3 id="identityModalTitle">Torneio</h3><div id="identityModalSub" class="small"></div></div><button id="closeIdentityBtn" class="mini-btn" type="button">Fechar</button></div>
      <div id="identityModalContent" class="identity-modal-content"></div>
    </div>`;
  document.body.appendChild(node);
  node.querySelectorAll('[data-identity-close="1"]').forEach(el => el.addEventListener('click', closeTournamentIdentity));
  node.querySelector('#closeIdentityBtn')?.addEventListener('click', closeTournamentIdentity);
}
function openTournamentIdentity(eventName='') {
  ensureTournamentIdentityModal();
  const event = state.calendar.find(e => e.name === eventName) || state.activeTournament?.event || state.calendar.find(e => e.week === state.academy.week) || state.calendar[0];
  if (!event) return;
  state.tournamentIdentity ||= { spotlightHistory: [], lastViewedEvent: null };
  state.tournamentIdentity.lastViewedEvent = event.name;
  const id = eventIdentity(event);
  const modal = document.querySelector('#tournamentIdentityModal');
  modal.classList.remove('hidden');
  document.body.classList.add('setup-open');
  document.querySelector('#identityModalTitle').textContent = id.name;
  document.querySelector('#identityModalSub').textContent = `${id.tier.label} • ${id.surface.label} • semana ${id.week} • ${id.city || id.country || 'Circuito mundial'}`;
  const recent = (state.worldTour?.weeklyResults || []).filter(r => r.eventName === id.name).slice(0,3);
  document.querySelector('#identityModalContent').innerHTML = `
    <div class="identity-modal-hero ${id.tier.cls} surface-${id.surface.cls}">
      <div class="identity-logo-panel huge">${logoMarkup(id.logo, id.name, 'tournament-logo giant', 'tournament-logo-fallback giant')}</div>
      <div><p class="eyebrow">${id.tier.trophy} ${id.tier.aura}</p><h2>${escapeHtml(id.name)}</h2><p>${escapeHtml(id.atmosphere)}</p><div class="identity-meta"><span>${prestigeStars(id.prestige)}</span><span>${escapeHtml(id.weather)}</span><span>Público estimado ${id.attendance.toLocaleString('pt-BR')}</span></div></div>
    </div>
    <div class="identity-modal-kpis">
      <article><span>Prestígio</span><strong>${id.prestige}/100</strong></article><article><span>Pontos campeão</span><strong>${id.winnerPoints || 250}</strong></article><article><span>Bolsa total</span><strong>${shortMoney(id.prizePool)}</strong></article><article><span>Entrada mínima</span><strong>Top ${id.minRank || id.entryCutoff || 120}</strong></article>
    </div>
    <div class="identity-detail-grid">
      <article class="panel-card"><h4>DNA tático do evento</h4><p>${escapeHtml(id.surface.tactical)}</p><p class="muted">Tempo de quadra: ${id.surface.tempo}. Piso: ${id.surface.label}. Chave: ${id.drawSize || 32} jogadores.</p></article>
      <article class="panel-card"><h4>Uso dos assets</h4><p>Logo oficial do pacote visual aplicado no calendário, hub de torneios, tela de partida, chave e dossiê.</p><p class="muted">Fallback ativo caso a imagem não carregue.</p></article>
      <article class="panel-card"><h4>Histórico recente</h4>${recent.length ? recent.map(r=>`<div class="report-line">${escapeHtml(r.champion)} campeão sobre ${escapeHtml(r.finalist)} • S${r.week}/${r.season}</div>`).join('') : '<p class="muted">Ainda não há campeão salvo nesta carreira.</p>'}</article>
      <article class="panel-card"><h4>Decisão de gestão</h4><p>${getTournamentGate(id).label}</p><button class="btn-primary" onclick="window.launchEvent('${escapeAttr(id.name)}'); window.closeTournamentIdentity();">Ir para este torneio</button></article>
    </div>`;
  hydrateAssetImages();
}
function closeTournamentIdentity() {
  const modal = document.querySelector('#tournamentIdentityModal');
  if (!modal) return;
  modal.classList.add('hidden');
  document.body.classList.remove('setup-open');
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

function hashNumber(text='') {
  return Math.abs([...String(text)].reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0), 0));
}
function flagEmoji(country='') {
  const code = String(country || '').slice(0, 2).toUpperCase();
  if (code.length !== 2 || /[^A-Z]/.test(code)) return '🏳️';
  return code.replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)));
}
function pctNumber(a, b) { return b ? Math.round((a / b) * 100) : 0; }
function rallyAverage(statsA, statsB) {
  const count = (statsA?.rallyCount || 0) + (statsB?.rallyCount || 0);
  return count ? (((statsA?.rallyTotal || 0) + (statsB?.rallyTotal || 0)) / count).toFixed(1) : '0.0';
}
function safePlayerName(player, fallback='Atleta') { return player?.name || fallback; }
function scoreSnapshot(match) {
  if (!match) return '0-0';
  const sets = `${match.setsPlayer || 0}-${match.setsOpponent || 0}`;
  const games = `${match.gamesPlayer || 0}-${match.gamesOpponent || 0}`;
  return `Sets ${sets} • Games ${games} • ${match.pointText || '0-0'}`;
}

function getTacticalPlan() {
  state.tacticalIntelligence ||= { plan: { ...TACTICAL_DEFAULT_PLAN }, history: [], lastAppliedWeek: 0, analyst: 'Plano equilibrado ativo.' };
  state.tacticalIntelligence.plan ||= { ...TACTICAL_DEFAULT_PLAN };
  return { ...TACTICAL_DEFAULT_PLAN, ...state.tacticalIntelligence.plan };
}
function tacticalOption(group, key) { return TACTICAL_OPTIONS[group]?.[key] || TACTICAL_OPTIONS[group]?.[TACTICAL_DEFAULT_PLAN[group]] || {}; }
function tacticalProfile(plan = getTacticalPlan()) {
  const serve = tacticalOption('serveTarget', plan.serveTarget);
  const rally = tacticalOption('rallyPlan', plan.rallyPlan);
  const attack = tacticalOption('attackPattern', plan.attackPattern);
  const ret = tacticalOption('returnPlan', plan.returnPlan);
  const risk = tacticalOption('riskMode', plan.riskMode);
  return {
    firstServe: (serve.firstServe || 0) + (risk.firstServe || 0),
    ace: serve.ace || 0,
    serveError: serve.error || 0,
    rally: rally.rally || 0,
    offense: (rally.offense || 0) + (attack.offense || 0) + (risk.offense || 0),
    defense: (rally.defense || 0) + (attack.defense || 0) + (risk.defense || 0),
    return: ret.return || 0,
    secondServePressure: ret.second || 0,
    error: (serve.error || 0) + (rally.error || 0) + (attack.error || 0) + (ret.error || 0) + (risk.error || 0),
    stamina: rally.stamina || 0,
    pressure: attack.pressure || 0,
    serveDirection: serve.direction || 'misto'
  };
}
function opponentWeakness(opponent) {
  const fh = attrValue(opponent, 'forehand');
  const bh = attrValue(opponent, 'backhand');
  const ret = attrValue(opponent, 'return', bh);
  const volley = attrValue(opponent, 'volley', 58);
  const list = [ ['forehand', fh, 'forehand'], ['backhand', bh, 'backhand'], ['return', ret, 'devolução'], ['volley', volley, 'rede'] ];
  return list.sort((a,b)=>a[1]-b[1])[0];
}
function tacticalPressureAgainst(opponent, plan = getTacticalPlan()) {
  const attack = plan.attackPattern;
  const weak = opponentWeakness(opponent);
  if (attack === 'weakness') return clamp((72 - weak[1]) * 0.14 + 2.2, -2, 6.5);
  if (attack === 'backhand') return clamp((72 - attrValue(opponent,'backhand')) * 0.16 + 1.6, -2.5, 7);
  if (attack === 'forehand') return clamp((attrValue(opponent,'forehand') - attrValue(opponent,'backhand')) * 0.10 + 1.2, -1, 5);
  if (attack === 'openCourt') return clamp((attrValue(opponent,'speed') < 68 ? 2.7 : 0.8) + (attrValue(opponent,'agility') < 68 ? 1.4 : 0), -1, 5.5);
  if (attack === 'middle') return 1.1;
  return 0;
}
function tacticalSummaryText(plan = getTacticalPlan()) {
  return `${tacticalOption('serveTarget',plan.serveTarget).label || 'Saque'} • ${tacticalOption('returnPlan',plan.returnPlan).label || 'Devolução'} • ${tacticalOption('attackPattern',plan.attackPattern).label || 'Ataque'} • ${tacticalOption('rallyPlan',plan.rallyPlan).label || 'Rally'} • ${tacticalOption('riskMode',plan.riskMode).label || 'Risco'}`;
}
function tacticalAnalystRead(match = state.match) {
  const plan = getTacticalPlan();
  const player = match ? getMatchPlayer(state.roster.find(p => p.id === match.playerId) || {}) : getMatchPlayer(chooseBestPlayer() || {});
  const opponent = match ? getMatchPlayer(match.opponent || {}) : null;
  if (!opponent) return `Plano pré-jogo: ${tacticalSummaryText(plan)}. O analista ajustará a leitura quando o adversário for definido.`;
  const weak = opponentWeakness(opponent);
  const surface = surfaceKey(match?.event?.surface || 'hard');
  const risk = tacticalOption('riskMode', plan.riskMode).label;
  const rally = tacticalOption('rallyPlan', plan.rallyPlan).label;
  const serve = tacticalOption('serveTarget', plan.serveTarget).label;
  const edge = tacticalPressureAgainst(opponent, plan);
  const surfaceHint = surface === 'clay' ? 'No saibro, paciência e profundidade valem mais que pressa.' : surface === 'grass' ? 'Na grama, primeiro saque e pontos curtos ganham peso.' : surface === 'indoor' ? 'Indoor favorece saque pesado e devolução profunda.' : 'No piso duro, equilíbrio entre saque, devolução e primeira bola.';
  return `${serve}; atacar ${weak[2]} adversário; ${rally}; risco ${risk}. Bônus tático estimado ${edge.toFixed(1)}. ${surfaceHint}`;
}
function recommendTacticalPlan(match = state.match) {
  const player = match ? getMatchPlayer(state.roster.find(p => p.id === match.playerId) || {}) : getMatchPlayer(chooseBestPlayer() || {});
  const opponent = match ? getMatchPlayer(match.opponent || {}) : null;
  const surface = surfaceKey(match?.event?.surface || state.activeTournament?.event?.surface || 'hard');
  const plan = { ...TACTICAL_DEFAULT_PLAN };
  if (surface === 'clay') plan.rallyPlan = attrValue(player,'stamina') >= 68 ? 'long' : 'balanced';
  if (surface === 'grass') { plan.rallyPlan = 'short'; plan.serveTarget = 'wide'; }
  if (surface === 'indoor') { plan.serveTarget = 't'; plan.returnPlan = 'deep'; }
  if (player?.pressure > 68 || player?.fatigue > 70) plan.riskMode = 'safe';
  if (opponent) {
    const weak = opponentWeakness(opponent)[0];
    plan.attackPattern = weak === 'backhand' ? 'backhand' : weak === 'forehand' ? 'forehand' : 'weakness';
    if (attrValue(opponent,'serve') < 68 || attrValue(opponent,'composure',60) < 66) plan.returnPlan = 'secondServePressure';
    if (attrValue(opponent,'speed') < 64 && surface !== 'clay') plan.attackPattern = 'openCourt';
    if (attrValue(opponent,'forehand') > attrValue(opponent,'backhand') + 10) plan.attackPattern = 'forehand';
  }
  return plan;
}
function serveDirectionFor(match, serverSide) {
  const plan = getTacticalPlan();
  const strategy = currentStrategy;
  let options = strategy === 'serve' ? ['aberto', 'corpo', 'T', 'aberto'] : strategy === 'control' ? ['corpo', 'T', 'corpo'] : ['aberto', 'T', 'corpo'];
  if (serverSide === 'player') {
    const preferred = tacticalOption('serveTarget', plan.serveTarget).direction || 'misto';
    if (preferred === 'aberto') options = ['aberto','aberto','T','corpo'];
    else if (preferred === 'corpo') options = ['corpo','corpo','T','aberto'];
    else if (preferred === 'T') options = ['T','T','corpo','aberto'];
    else options = ['aberto','corpo','T','corpo','aberto'];
  }
  const idx = (hashNumber(`${match?.event?.name || ''}-${match?.set || 1}-${match?.playerScore || 0}-${match?.opponentScore || 0}-${serverSide}-${Date.now()}`) + Math.floor(Math.random()*99)) % options.length;
  return options[idx];
}
function serveSpeedFor(server, surface, firstIn) {
  const serve = attrValue(server, 'serve');
  const power = attrValue(server, 'power', attrValue(server, 'forehand'));
  const surfaceBoost = surfaceKey(surface) === 'grass' ? 4 : surfaceKey(surface) === 'clay' ? -3 : 0;
  const base = firstIn ? 158 : 130;
  return Math.round(clamp(base + serve * 0.45 + power * 0.18 + surfaceBoost + (Math.random()*14 - 7), firstIn ? 160 : 122, firstIn ? 226 : 178));
}
function pointTacticalRead(point, match) {
  if (!point) return tacticalAnalystRead(match);
  if (point.planRead) return point.planRead;
  if (point.type === 'Ace') return `Saque ${point.direction || 'aberto'} com ${point.speed || 190} km/h criou ponto grátis dentro do plano ${tacticalSummaryText()}.`;
  if (point.type === 'Dupla falta') return 'Pressão no segundo saque gerou falha mental; avalie risco baixo se a sequência continuar.';
  if (point.rally >= 12) return `Rally longo de ${point.rally} bolas testou resistência e consistência dentro do plano de troca.`;
  if (point.type === 'Winner') return `Execução agressiva encaixou após ${point.rally} bolas; padrão tático favoreceu a finalização.`;
  return `Erro apareceu após ${point.rally || 0} bolas; ajuste risco, alvo de ataque ou duração dos rallies.`;
}
function broadcastRecommendation(match, player, opponent) {
  if (!match) return 'Inicie uma rodada para receber leitura do analista.';
  const p = match.stats?.player || emptyMatchStats();
  const o = match.stats?.opponent || emptyMatchStats();
  const playerFirst = pctNumber(p.firstServeIn, p.firstServeTotal);
  const oppErrors = o.unforcedErrors || 0;
  const pErrors = p.unforcedErrors || 0;
  const surface = surfaceKey(match.event?.surface);
  if (p.doubleFaults >= 3 || playerFirst < 48) return 'Recomendação: reduzir risco no saque e jogar com mais controle por dois games.';
  if (pErrors > oppErrors + 3) return 'Recomendação: trocar para Controlar ou Defensivo e alongar menos os pontos.';
  if (surface === 'clay' && attrValue(player,'consistency') >= attrValue(opponent,'consistency')) return 'Recomendação: alongar rallies no saibro e atacar só a bola curta.';
  if (attrValue(opponent,'backhand') < attrValue(opponent,'forehand') - 6) return 'Recomendação: insistir no backhand do adversário nas devoluções.';
  if ((match.momentum || 0) < -4) return 'Recomendação: pausa tática, saque no corpo e foco no primeiro ponto do game.';
  return `Recomendação: ${tacticalAnalystRead(match)}`;
}
function renderBroadcastIntro(match) {
  const host = $('#matchBroadcastIntro');
  if (!host) return;
  const event = match?.event || state.activeTournament?.event || state.calendar.find(e => e.week === state.academy.week) || {};
  const player = match ? getMatchPlayer(state.roster.find(p => p.id === match.playerId) || {}) : getMatchPlayer(chooseBestPlayer() || {});
  const opponent = match ? getMatchPlayer(match.opponent || {}) : null;
  const logo = logoForTournament(event.name || '');
  const playerRank = player?.id ? getPlayerRank(player.id) : '—';
  const oppRank = opponent?.rank || opponent?.ranking || (opponent ? Math.max(1, Math.round(180 - (opponent.overall || 60))) : '—');
  const reco = match ? broadcastRecommendation(match, player, opponent) : 'Entre na partida para abrir dossiê, placar de transmissão e estatísticas ao vivo.';
  host.innerHTML = `
    <article class="broadcast-hero-card ${eventIdentity(event).tier.cls} surface-${eventIdentity(event).surface.cls}">
      <div class="broadcast-event-block">
        <div class="broadcast-logo-frame">${logoMarkup(logo, event.name || 'Torneio', 'tour-logo xl', 'tournament-logo-fallback xl')}</div>
        <div class="broadcast-event-copy">
          <p class="eyebrow">Broadcast Match Center Pro</p>
          <h4>${event.name || 'Semana de preparação'}</h4>
          <div class="broadcast-chips"><span>${eventIdentity(event).tier.trophy} ${event.tier || 'Circuito'}</span><span>${eventIdentity(event).surface.label}</span><span>Prestígio ${eventIdentity(event).prestige}</span><span>${match?.round || state.activeTournament?.rounds?.[state.activeTournament.roundIndex] || 'Pré-jogo'}</span><span>${BUILD_LABEL}</span></div>
        </div>
      </div>
      <div class="broadcast-vs-grid">
        <div class="broadcast-player-card user">
          ${avatarImg(avatarForPlayer(player?.name || 'player'), 'avatar-img broadcast-avatar', safePlayerName(player,'Seu atleta'))}
          <div><strong>${safePlayerName(player,'Seu atleta')}</strong><span>${flagEmoji(player?.country)} ${player?.country || '---'} • Rank ${playerRank}</span><small>OVR ${Math.round(player?.overall || 0)} • Forma ${Math.round(player?.form || player?.morale || 70)} • Saúde ${Math.round(player?.health || 100)}</small></div>
        </div>
        <div class="broadcast-versus">VS</div>
        <div class="broadcast-player-card rival">
          ${opponent ? avatarImg(avatarForPlayer(opponent?.name || 'opponent'), 'avatar-img broadcast-avatar', safePlayerName(opponent,'Adversário')) : '<div class="avatar broadcast-avatar">?</div>'}
          <div><strong>${opponent ? safePlayerName(opponent,'Adversário') : 'Adversário a definir'}</strong><span>${opponent ? `${flagEmoji(opponent.country)} ${opponent.country || '---'} • Rank ${oppRank}` : 'Toque em iniciar rodada'}</span><small>${opponent ? `OVR ${Math.round(opponent.overall || 0)} • Piso ${surfaceLabel(surfaceKey(event.surface || 'hard'))}` : 'A chave será carregada com fallback seguro.'}</small></div>
        </div>
      </div>
      <div class="broadcast-analyst-strip"><strong>Analista:</strong><span>${reco}</span></div>
    </article>`;
  hydrateAssetImages();
}
function appendReplay(point, match) {
  if (!match || !point) return;
  match.replayTape ||= [];
  match.replayTape.push({
    text: `${point.serve} • ${point.type} • ${point.speed || '—'} km/h • ${point.rally || 0} bolas`,
    detail: pointTacticalRead(point, match),
    at: new Date().toISOString()
  });
  match.replayTape = match.replayTape.slice(-8);
}
function withMatchGuard(label, fn) {
  if (!state.match?.inProgress || state.match.finished) { addLog('Inicie uma partida primeiro.'); return; }
  const player = state.roster.find(p => p.id === state.match.playerId);
  const snapshot = { match: structuredClone(state.match), player: player ? structuredClone(player) : null };
  try { fn(); }
  catch (error) {
    if (player && snapshot.player) Object.assign(player, snapshot.player);
    state.match = snapshot.match;
    showSystemError(`${label} cancelado com segurança. O estado anterior foi restaurado.`, error);
    renderMatch();
  }
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

function normalizeDrawSize(event={}) {
  const raw = Number(event.drawSize || 32);
  if (raw >= 128) return 128;
  if (raw >= 96) return 128;
  if (raw >= 64) return 64;
  if (raw >= 48) return 64;
  if (raw >= 32) return 32;
  if (raw >= 24) return 32;
  if (raw >= 16) return 16;
  return 8;
}
function actualFieldSize(event={}) {
  const raw = Number(event.drawSize || 32);
  return Math.max(8, Math.min(normalizeDrawSize(event), raw || 32));
}
function roundLabelsForBracket(size=32) {
  const map = { 128:['R128','R64','R32','R16','QF','SF','F'], 64:['R64','R32','R16','QF','SF','F'], 32:['R32','R16','QF','SF','F'], 16:['R16','QF','SF','F'], 8:['QF','SF','F'] };
  return map[normalizeDrawSize({drawSize:size})] || map[32];
}
function makeEntrantFromRow(row, meta={}) {
  const points = Math.round(row.points ?? row.rankingPoints ?? 0);
  const overall = Math.round(row.overall || 70);
  const rank = row.rank || (points ? Math.max(1, Math.round(90000 / Math.max(50, points))) : 999);
  return {
    id: row.playerId || row.id || slugifyText(row.name),
    name: row.name || meta.name || 'Jogador ATP',
    country: row.country || row.countryCode || '---',
    overall, points, rank,
    avatar: row.avatar || avatarForPlayer(row.name || meta.name || 'Jogador'),
    isUser: !!row.isUser,
    seed: meta.seed || null,
    entryType: meta.entryType || 'direct',
    form: meta.form ?? (stableNumber(`${row.name}-${points}-${overall}`) % 34) + 56,
    status: meta.status || 'active'
  };
}
function getTournamentGate(event) {
  const player = chooseBestPlayer();
  const rank = player ? getPlayerRank(player.id) : 999;
  const mainCut = event.minRank || 999;
  const qualCut = Math.min(180, mainCut + (event.tier === 'Grand Slam' ? 80 : 48));
  if (rank <= mainCut) return { label: 'Chave principal', cls: 'ok', entryType:'direct', rank, mainCut, qualCut };
  if (rank <= qualCut) return { label: 'Qualifying', cls: 'warn', entryType:'qualifying', rank, mainCut, qualCut };
  if ((event.inviteSlots || 0) > 0 && state.academy.reputation >= 40) return { label: 'Wild card possível', cls: 'warn', entryType:'wildcard', rank, mainCut, qualCut };
  return { label: `Precisa rank ${mainCut}`, cls: 'blocked', entryType:'blocked', rank, mainCut, qualCut };
}
function pickEntrantsForEvent(player, event, options={}) {
  const fieldSize = actualFieldSize(event);
  const includeUser = options.includeUser !== false;
  const seedCount = Math.min(fieldSize >= 128 ? 32 : fieldSize >= 64 ? 16 : fieldSize >= 32 ? 8 : 4, Math.floor(fieldSize/2));
  const wildCards = Math.min(event.inviteSlots || 0, Math.max(0, Math.floor(fieldSize * .12)));
  const qualifiers = Math.max(event.tier === 'Grand Slam' ? 16 : event.tier === 'Masters 1000' ? 8 : 4, Math.floor(fieldSize * .12));
  const nonUsers = [...(state.ranking || [])].filter(r => !r.isUser).sort((a,b)=>(a.rank||999)-(b.rank||999)).slice(0, 140);
  const entrants = [];
  if (includeUser && player) {
    const gate = getTournamentGate(event);
    entrants.push(makeEntrantFromRow({ name: player.name, country: player.country, overall: player.overall, points: player.rankingPoints, playerId: player.id, isUser: true, rank:getPlayerRank(player.id), avatar: player.avatar }, { entryType: gate.entryType === 'qualifying' ? 'qualifier' : gate.entryType }));
  }
  let cursor = 0;
  while (entrants.length < fieldSize && cursor < nonUsers.length) {
    const row = nonUsers[cursor++];
    if (entrants.some(x => x.name === row.name)) continue;
    let entryType = 'direct';
    if (entrants.length >= fieldSize - qualifiers) entryType = 'qualifier';
    else if (entrants.length >= fieldSize - qualifiers - wildCards) entryType = 'wildcard';
    entrants.push(makeEntrantFromRow(row, { entryType }));
  }
  while (entrants.length < fieldSize) {
    const idx = entrants.length + 1;
    entrants.push(makeEntrantFromRow({ name:`Qualificador ${idx}`, country:'INT', overall:65 + (idx % 9), points:80 + idx * 13, rank:180 + idx }, { entryType:'qualifier' }));
  }
  entrants.sort((a,b) => (a.rank || 999) - (b.rank || 999) || (b.points + b.overall*4) - (a.points + a.overall*4));
  entrants.forEach((entrant, idx) => { entrant.seed = idx < seedCount ? idx + 1 : null; });
  return entrants.slice(0, fieldSize);
}
function seedingPositions(size) {
  if (size <= 2) return [1,2];
  const prev = seedingPositions(size/2);
  const out = [];
  for (const p of prev) { out.push(p); out.push(size + 1 - p); }
  return out;
}
function eventSeed(event={}, salt='') { return stableNumber(`${state.academy?.season || 2026}-${event.id || event.name}-${salt}`); }
function createDrawMatches(entrants, event={}) {
  const bracketSize = normalizeDrawSize(event);
  const positions = seedingPositions(bracketSize);
  const slots = Array(bracketSize).fill(null);
  entrants.forEach((entrant, idx) => {
    const pos = positions[idx] ? positions[idx] - 1 : idx;
    slots[pos] = entrant;
  });
  const matches = [];
  for (let i=0; i<slots.length; i+=2) {
    const a = slots[i]; const b = slots[i+1];
    const winner = !a ? b : !b ? a : null;
    matches.push({ id:`m${i/2+1}`, a, b, winner, score:winner ? 'BYE' : '', userMatch: !!(a?.isUser || b?.isUser), status:winner ? 'bye' : 'scheduled', upset:false, withdrawal:null });
  }
  return matches;
}
function createQualifyingLayer(player, event) {
  const pool = (state.ranking || []).filter(r => !r.isUser).slice(100, 132);
  const seed = eventSeed(event, 'qualifying');
  const opponentRow = pool[seed % Math.max(1,pool.length)] || (state.ranking || []).find(r=>!r.isUser) || { name:'Especialista do qualifying', country:'INT', overall:68, points:120, rank:160 };
  const user = makeEntrantFromRow({ name:player.name, country:player.country, overall:player.overall, points:player.rankingPoints, playerId:player.id, isUser:true, rank:getPlayerRank(player.id), avatar:player.avatar }, { entryType:'qualifier' });
  const opponent = makeEntrantFromRow(opponentRow, { entryType:'qualifier' });
  const matches = [{ id:'q-user', a:user, b:opponent, winner:null, score:'', userMatch:true, status:'scheduled' }];
  for (let i=0; i<3; i++) {
    const a = makeEntrantFromRow(pool[(seed+i*2+1)%Math.max(1,pool.length)] || {name:`Q${i+1}A`, country:'INT', overall:64, points:60}, { entryType:'qualifier' });
    const b = makeEntrantFromRow(pool[(seed+i*2+2)%Math.max(1,pool.length)] || {name:`Q${i+1}B`, country:'INT', overall:63, points:55}, { entryType:'qualifier' });
    matches.push({ id:`q${i+2}`, a, b, winner:null, score:'', userMatch:false, status:'scheduled' });
  }
  return { label:'Qualifying', description:'Uma vitória garante entrada na chave principal.', matches };
}
function createTournamentDraw(player, event, options={}) {
  const gate = getTournamentGate(event);
  const mainRounds = roundLabelsForBracket(normalizeDrawSize(event));
  const includeUser = gate.entryType !== 'blocked';
  const entrants = pickEntrantsForEvent(player, event, { includeUser });
  const firstRound = createDrawMatches(entrants, event);
  const roundDefs = mainRounds.map((label, idx) => ({ label, matches: idx === 0 ? firstRound : [] }));
  const byes = firstRound.filter(m => m.status === 'bye').length;
  const wildcards = entrants.filter(e => e.entryType === 'wildcard').length;
  const qualifiers = entrants.filter(e => e.entryType === 'qualifier').length;
  const draw = {
    key: tournamentKey(event), eventName: event.name, season:state.academy?.season || 2026,
    bracketSize: normalizeDrawSize(event), fieldSize: actualFieldSize(event), mainRounds,
    generatedAt: new Date().toISOString(),
    rules: { bestOf: event.tier === 'Grand Slam' ? 5 : 3, seededPlayers: entrants.filter(e=>e.seed).length, wildcards, qualifiers, byes },
    rounds: roundDefs,
    qualifying: gate.entryType === 'qualifying' ? createQualifyingLayer(player, event) : null,
    champion: null,
    history: []
  };
  return draw;
}
function ensureTournamentRunDraw(player, event, rounds=null) {
  state.tournamentDraws ||= {};
  const key = tournamentKey(event);
  const existing = state.tournamentDraws[key];
  if (!existing || !existing.rounds || existing.version !== 'v3.9') {
    state.tournamentDraws[key] = { ...createTournamentDraw(player, event), version:'v3.9' };
  }
  return state.tournamentDraws[key];
}
function createTournamentRun(player, event) {
  const gate = getTournamentGate(event);
  if (gate.entryType === 'blocked') {
    addLog(`${event.name}: inscrição bloqueada. Ranking atual ${gate.rank}; corte principal ${gate.mainCut}.`);
    state.inbox.unshift({ title:`Inscrição recusada: ${event.name}`, body:`A academia precisa melhorar ranking ou reputação para receber convite. Rank atual ${gate.rank}.`, week: state.academy.week });
    return null;
  }
  const draw = ensureTournamentRunDraw(player, event);
  const mainRounds = draw.mainRounds || roundLabelsForBracket(normalizeDrawSize(event));
  const rounds = gate.entryType === 'qualifying' ? ['Q', ...mainRounds] : mainRounds;
  state.activeTournament = {
    event, gate, entryType: gate.entryType, draw,
    rounds, mainRoundOffset: gate.entryType === 'qualifying' ? 1 : 0,
    roundIndex: 0, wins: 0, complete:false,
    createdAt: new Date().toISOString(), auditTrail:[`Entrada: ${gate.label}`]
  };
  addLog(`${event.name}: ${gate.label} confirmada. Chave real criada com ${draw.fieldSize}/${draw.bracketSize} vagas.`);
  return state.activeTournament;
}
function roundToDrawIndex(run, roundIndex=run?.roundIndex || 0) {
  return Math.max(0, roundIndex - (run?.mainRoundOffset || 0));
}
function pickDrawOpponent(draw, roundIndex, run=null) {
  if (run?.rounds?.[roundIndex] === 'Q' && draw?.qualifying) {
    const match = draw.qualifying.matches.find(m => m.userMatch);
    return { match, opponent: match?.a?.isUser ? match.b : match?.a };
  }
  const drawIndex = run ? roundToDrawIndex(run, roundIndex) : roundIndex;
  const round = draw?.rounds?.[drawIndex];
  if (!round) return null;
  const match = round.matches.find(m => m.a?.isUser || m.b?.isUser);
  if (!match) return null;
  return { match, opponent: match.a?.isUser ? match.b : match.a };
}
function decideDrawWinner(a, b, event={}, context='') {
  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;
  const surface = surfaceKey(event.surface);
  const random = (stableNumber(`${event.id || event.name}-${context}-${a.name}-${b.name}-${state.academy?.week}`) % 101) - 50;
  const aSurface = Number(a.surfaceRatings?.[surface] || a.overall || 70);
  const bSurface = Number(b.surfaceRatings?.[surface] || b.overall || 70);
  const aScore = (a.overall || 70) * 5 + aSurface * 1.5 + Math.log1p(a.points || 0) * 16 + (a.form || 60) * .6 + (a.seed ? 22 - a.seed : 0) + (a.isUser ? 5 : 0) + random;
  const bScore = (b.overall || 70) * 5 + bSurface * 1.5 + Math.log1p(b.points || 0) * 16 + (b.form || 60) * .6 + (b.seed ? 22 - b.seed : 0) + (b.isUser ? 5 : 0) - random;
  return aScore >= bScore ? a : b;
}
function simulatedScore(seedText='') {
  const patterns = ['6-4 6-3', '7-5 6-4', '6-2 3-6 6-3', '6-3 6-4', '7-6 6-4', '4-6 6-3 6-4', '6-1 6-4'];
  return patterns[stableNumber(seedText || Math.random().toString()) % patterns.length];
}
function maybeWithdrawal(match, event={}, context='') {
  if (!match.a || !match.b) return null;
  const risk = event.tier === 'Grand Slam' ? 3 : 2;
  const roll = stableNumber(`${event.id || event.name}-${context}-wo-${match.a.name}-${match.b.name}`) % 100;
  if (roll >= risk) return null;
  const loser = roll % 2 === 0 ? match.a : match.b;
  return loser;
}
function advanceDrawRound(run, playerWon) {
  if (!run?.draw) return;
  const isQualifying = run.rounds?.[run.roundIndex] === 'Q';
  if (isQualifying) {
    const q = run.draw.qualifying;
    q.matches = (q.matches || []).map(match => {
      if (match.userMatch) {
        const winner = playerWon ? (match.a?.isUser ? match.a : match.b) : (match.a?.isUser ? match.b : match.a);
        return { ...match, winner, score: simulatedScore(`${run.event.name}-Q-user`), status:'played' };
      }
      const winner = match.winner || decideDrawWinner(match.a, match.b, run.event, match.id);
      return { ...match, winner, score: match.score || simulatedScore(`${run.event.name}-Q-${match.id}`), status:'played' };
    });
    run.auditTrail ||= [];
    run.auditTrail.push(playerWon ? 'Qualifying vencido; atleta entrou na chave principal.' : 'Eliminado no qualifying.');
    return;
  }
  const drawIndex = roundToDrawIndex(run);
  const round = run.draw.rounds[drawIndex];
  if (!round) return;
  round.matches = round.matches.map((match, idx) => {
    if (match.status === 'bye') return match;
    if (match.a?.isUser || match.b?.isUser) {
      const winner = playerWon ? (match.a?.isUser ? match.a : match.b) : (match.a?.isUser ? match.b : match.a);
      return { ...match, winner, score: match.score || matchSetScore(state.match) || simulatedScore(`${run.event.name}-${round.label}-user`), status:'played', upset: winner && ((winner.seed || 99) > ((match.a?.seed || 99) === (winner.seed || 99) ? (match.b?.seed || 99) : (match.a?.seed || 99))) };
    }
    const withdrawal = maybeWithdrawal(match, run.event, `${round.label}-${idx}`);
    const winner = withdrawal ? (withdrawal.name === match.a?.name ? match.b : match.a) : (match.winner || decideDrawWinner(match.a, match.b, run.event, `${round.label}-${idx}`));
    const upset = winner && match.a && match.b && (winner.seed || 99) > ((winner.name === match.a.name ? match.b?.seed : match.a?.seed) || 99);
    return { ...match, winner, score: match.score || (withdrawal ? 'W/O' : simulatedScore(`${run.event.name}-${round.label}-${idx}`)), status: withdrawal ? 'withdrawal' : 'played', upset, withdrawal: withdrawal?.name || null };
  });
  const nextRound = run.draw.rounds[drawIndex + 1];
  if (nextRound) {
    const winners = round.matches.map(m => m.winner).filter(Boolean);
    const matches = [];
    for (let i=0; i<winners.length; i+=2) {
      const a = winners[i]; const b = winners[i+1];
      matches.push({ id:`r${drawIndex+2}m${i/2+1}`, a, b, winner:(!a?b:!b?a:null), score:(!a||!b)?'BYE':'', userMatch: !!(a?.isUser || b?.isUser), status:(!a||!b)?'bye':'scheduled', upset:false, withdrawal:null });
    }
    nextRound.matches = matches;
  } else {
    run.draw.champion = round.matches.find(m => m.winner)?.winner || null;
  }
}
function drawEntryBadge(entrant) {
  if (!entrant) return '<span class="draw-entry bye">BYE</span>';
  if (entrant.seed) return `<span class="draw-entry seed">#${entrant.seed}</span>`;
  const map = { wildcard:'WC', qualifier:'Q', qualifying:'Q', direct:'DA' };
  return `<span class="draw-entry ${entrant.entryType || 'direct'}">${map[entrant.entryType] || 'DA'}</span>`;
}
function renderDrawLine(entrant, match, side) {
  if (!entrant) return '<div class="draw-line bye"><span class="draw-name">BYE</span><span class="draw-country">—</span></div>';
  const winner = match.winner?.name === entrant.name;
  const cls = `${winner ? 'winner' : ''} ${entrant.isUser ? 'user-line' : ''}`;
  return `<div class="draw-line ${cls}"><span class="draw-name">${drawEntryBadge(entrant)} ${escapeHtml(entrant.name)}</span><span class="draw-country">${escapeHtml(entrant.country)} ${entrant.rank ? `#${entrant.rank}` : ''}</span></div>`;
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
          <p class="eyebrow">Real Draws & Tournament Life</p>
          <h3 id="drawTitle">Visão da competição</h3>
          <div id="drawSub" class="small"></div>
        </div>
        <button id="closeDrawBtn" class="mini-btn" type="button">Fechar</button>
      </div>
      <div id="drawStats" class="draw-stats"></div>
      <div id="drawQualifying" class="draw-qualifying"></div>
      <div id="drawContent" class="draw-columns"></div>
      <div id="drawHistory" class="draw-history"></div>
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
  const draw = state.activeTournament?.event?.name === event.name && state.activeTournament.draw
    ? state.activeTournament.draw
    : ensureTournamentRunDraw(player, event);
  const modal = document.querySelector('#drawModal');
  const id = eventIdentity(event);
  modal.classList.remove('hidden');
  document.body.classList.add('setup-open');
  document.querySelector('#drawTitle').textContent = event.name;
  document.querySelector('#drawSub').textContent = `${id.tier.label} • ${id.surface.label} • ${event.city || event.country || 'Circuito mundial'} • ${BUILD_LABEL}`;
  const stats = document.querySelector('#drawStats');
  stats.innerHTML = `<article><span>Chave</span><strong>${draw.fieldSize}/${draw.bracketSize}</strong></article><article><span>Cabeças</span><strong>${draw.rules?.seededPlayers || 0}</strong></article><article><span>Qualifiers</span><strong>${draw.rules?.qualifiers || 0}</strong></article><article><span>Wild cards</span><strong>${draw.rules?.wildcards || 0}</strong></article><article><span>Byes</span><strong>${draw.rules?.byes || 0}</strong></article>`;
  const qHost = document.querySelector('#drawQualifying');
  qHost.innerHTML = draw.qualifying ? `<div class="draw-col-head">Qualifying</div><div class="draw-q-grid">${draw.qualifying.matches.map(match => `<div class="draw-match ${match.userMatch ? 'user-path' : ''}">${renderDrawLine(match.a, match, 'a')}${renderDrawLine(match.b, match, 'b')}${match.score ? `<div class="draw-score">${match.score}</div>` : ''}</div>`).join('')}</div>` : '';
  const content = document.querySelector('#drawContent');
  const activeDrawIndex = state.activeTournament?.event?.name === event.name ? roundToDrawIndex(state.activeTournament) : -1;
  content.innerHTML = draw.rounds.map((round, idx) => `<div class="draw-col"><div class="draw-col-head">${round.label}</div>${(round.matches||[]).map(match => `
    <div class="draw-match ${match.a?.isUser || match.b?.isUser ? 'user-path' : ''} ${idx === activeDrawIndex ? 'active-round' : ''} ${match.upset ? 'upset' : ''} ${match.status || ''}">
      ${renderDrawLine(match.a, match, 'a')}
      ${renderDrawLine(match.b, match, 'b')}
      ${match.score ? `<div class="draw-score">${match.score}${match.upset ? ' • zebra' : ''}${match.withdrawal ? ` • desistência: ${escapeHtml(match.withdrawal)}` : ''}</div>` : ''}
    </div>`).join('')}</div>`).join('');
  const history = state.tournamentLife?.championHistory?.filter(h => h.eventName === event.name).slice(0,5) || [];
  document.querySelector('#drawHistory').innerHTML = history.length ? `<h4>Histórico de campeões</h4>${history.map(h=>`<div class="report-line">${h.season} S${h.week}: ${escapeHtml(h.champion)} campeão • ${h.score || '—'}</div>`).join('')}` : `<div class="report-line">Histórico de campeões será registrado quando o torneio for concluído nesta carreira.</div>`;
}
function closeDrawModal() {
  const modal = document.querySelector('#drawModal');
  if (!modal) return;
  modal.classList.add('hidden');
  document.body.classList.remove('setup-open');
}
function pickOpponent(round, player) {
  const event = state.calendar.find(e => e.week === state.academy.week) || state.activeTournament?.event || {};
  const pool = (state.ranking || []).filter(row => !row.isUser && row.name !== player?.name);
  const strength = { Q: 90, R128: 120, R64: 90, R32: 64, R16: 38, QF: 24, SF: 12, F: 6 }[round] || 80;
  return pool[Math.min(pool.length-1, Math.max(0, Math.floor((eventSeed(event, round) % Math.max(1, strength))))) ] || pool[0] || { name:'Adversário internacional', country:'INT', overall:70, points:200, rank:120 };
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
  state.tournamentDraws ||= {};
  state.tournamentLife ||= { championHistory: [], drawAudit: [], lastViewedDraw: null };
  state.tournamentLife.championHistory ||= [];
  state.tournamentLife.drawAudit ||= [];
  state.roster.forEach(p => {
    p.health ??= 100;
    p.injuredWeeks ??= 0;
    p.lastResult ??= 'Sem jogos';
    p.salary ??= 1800 + Math.round(p.overall * 25);
  });
  ensurePlayerCareerSystem();
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
  $('#playGameBtn')?.addEventListener('click', simulateCurrentGame);
  $('#playSetBtn')?.addEventListener('click', simulateCurrentSet);
  $('#playMatchBtn')?.addEventListener('click', simulateFullMatch);
  $('#tacticalPauseBtn')?.addEventListener('click', tacticalPause);
  $('#autoMatchBtn').addEventListener('click', () => setAutoPlay(1));
  $('#auto1xBtn')?.addEventListener('click', () => setAutoPlay(1));
  $('#auto2xBtn')?.addEventListener('click', () => setAutoPlay(2));
  $('#auto4xBtn')?.addEventListener('click', () => setAutoPlay(4));
  $('#pauseAutoBtn')?.addEventListener('click', stopAutoPlay);
  $('#tacticalIntelligencePanel')?.addEventListener('change', handleTacticalPlanChange);
  $('#tacticalIntelligencePanel')?.addEventListener('click', handleTacticalPlanClick);
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
  renderTournamentIdentityHub();
  renderMarket();
  renderStaff();
  updateRanking();
  renderRanking();
  hydrateAssetImages();
  renderMatch();
  hydrateAssetImages();
  ensureDrawModal();
  ensureTournamentIdentityModal();
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
      <div class="next-event-actions"><button class="mini-btn next-bracket-btn" onclick="window.openTournamentIdentity('${event.name.replace("'", "&#39;")}')">Identidade</button><button class="mini-btn next-bracket-btn" onclick="window.openDrawModal('${event.name.replace("'", "&#39;")}')">Ver chave</button></div>
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
window.openTournamentIdentity = openTournamentIdentity;
window.closeTournamentIdentity = closeTournamentIdentity;

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


function personalityKeyFor(player={}) {
  const keys = Object.keys(PLAYER_PERSONALITIES);
  const seed = stableNumber(`${player.id || player.name || 'player'}-${player.country || ''}-${player.style || ''}`);
  return keys[seed % keys.length];
}
function ensurePlayerCareerSystem() {
  state.playerCareer ||= { weeklyEvents: [], conversations: [], promises: [], lastProcessedToken: null };
  state.playerCareer.weeklyEvents ||= [];
  state.playerCareer.conversations ||= [];
  state.playerCareer.promises ||= [];
  state.roster ||= [];
  state.roster.forEach(player => ensurePlayerPsychology(player));
}
function ensurePlayerPsychology(player) {
  if (!player) return player;
  const key = player.personalityKey || personalityKeyFor(player);
  const profile = PLAYER_PERSONALITIES[key] || PLAYER_PERSONALITIES.disciplined;
  const seed = stableNumber(`${player.id || player.name}-${key}-career`);
  player.personalityKey ||= key;
  player.personalityProfile ||= { key, label: profile.label, icon: profile.icon, desc: profile.desc };
  player.ambition ??= clamp(profile.ambition + (seed % 13) - 6, 35, 99);
  player.discipline ??= clamp(profile.discipline + ((seed >> 3) % 15) - 7, 35, 99);
  player.pressure ??= clamp(42 + profile.pressure + ((seed >> 6) % 20) - 10, 10, 95);
  player.relationship ??= clamp(66 + ((seed >> 9) % 18) - 9, 20, 100);
  player.confidence ??= clamp(player.morale ?? 70, 15, 100);
  player.happiness ??= clamp(62 + ((seed >> 12) % 24) - 12, 15, 100);
  player.careerEvents ||= [];
  player.conversationHistory ||= [];
  player.seasonGoal ??= 'ranking';
  player.contractMood ??= player.salary > 4200 ? 'exigente' : 'estável';
  return player;
}
function careerScore(player) {
  ensurePlayerPsychology(player);
  return Math.round(clamp((player.morale || 70)*0.24 + (player.confidence || 70)*0.24 + (player.relationship || 65)*0.18 + (player.discipline || 70)*0.16 + (player.happiness || 65)*0.12 - (player.pressure || 40)*0.14, 0, 100));
}
function careerRiskLabel(player) {
  ensurePlayerPsychology(player);
  if ((player.pressure || 0) >= 78 && (player.confidence || 0) <= 45) return { label: 'Crise emocional', cls: 'danger' };
  if ((player.relationship || 0) <= 38) return { label: 'Relação frágil', cls: 'danger' };
  if ((player.happiness || 0) <= 42 || (player.morale || 0) <= 42) return { label: 'Insatisfeito', cls: 'warn' };
  if (careerScore(player) >= 74) return { label: 'Engajado', cls: 'ok' };
  return { label: 'Atenção', cls: 'warn' };
}
function playerCareerSnapshot(player) {
  ensurePlayerPsychology(player);
  const profile = PLAYER_PERSONALITIES[player.personalityKey] || PLAYER_PERSONALITIES.disciplined;
  const risk = careerRiskLabel(player);
  return { profile, risk, score: careerScore(player), goal: SEASON_GOALS[player.seasonGoal] || 'Plano aberto' };
}
function recordCareerEvent(player, title, body, type='career') {
  ensurePlayerCareerSystem();
  const event = { playerId: player.id, playerName: player.name, title, body, type, week: state.academy.week, season: state.academy.season, build: BUILD_INFO.build, at: new Date().toISOString() };
  player.careerEvents ||= [];
  player.careerEvents.unshift(event);
  player.careerEvents = player.careerEvents.slice(0, 12);
  state.playerCareer.weeklyEvents.unshift(event);
  state.playerCareer.weeklyEvents = state.playerCareer.weeklyEvents.slice(0, 30);
  return event;
}
function processPlayerCareersWeekly() {
  ensurePlayerCareerSystem();
  const token = `${state.academy.season}-${state.academy.week}`;
  if (state.playerCareer.lastProcessedToken === token) return;
  const snapshot = JSON.parse(JSON.stringify(state.roster));
  try {
    state.roster.forEach(player => {
      ensurePlayerPsychology(player);
      const rank = getPlayerRank(player.id);
      const result = String(player.lastResult || '');
      const won = /venceu|campeão/i.test(result);
      const lost = /perdeu|parou|caiu/i.test(result);
      const profile = PLAYER_PERSONALITIES[player.personalityKey] || PLAYER_PERSONALITIES.disciplined;
      const plan = state.trainingLab?.plans?.[player.id] || { focus: 'balanced', intensity: 'moderate' };
      const extremeLoad = plan.intensity === 'extreme';
      if (won) { player.confidence = clamp((player.confidence || 65) + 5, 10, 100); player.pressure = clamp((player.pressure || 40) + (rank <= 100 ? 2 : -1), 5, 100); }
      if (lost) { player.confidence = clamp((player.confidence || 65) - 3 - Math.max(0, profile.pressure/12), 10, 100); player.relationship = clamp((player.relationship || 65) - (profile.conflict > 8 ? 2 : 0), 5, 100); }
      if (extremeLoad && (player.discipline || 70) < 68) { player.happiness = clamp((player.happiness || 65) - 5, 5, 100); player.pressure = clamp((player.pressure || 40) + 4, 5, 100); }
      if (plan.focus === 'recovery' || player.injuredWeeks > 0) { player.relationship = clamp((player.relationship || 65) + 2, 5, 100); player.pressure = clamp((player.pressure || 40) - 3, 5, 100); }
      if (rank <= 80 && player.ambition > 80) player.morale = clamp((player.morale || 70) + 1, 10, 100);
      if (rank > 180 && player.ambition > 82) player.pressure = clamp((player.pressure || 40) + 3, 5, 100);
      const chanceSeed = stableNumber(`${token}-${player.id}-${player.lastResult}-${player.pressure}-${player.relationship}`) % 100;
      if (chanceSeed < 18 || (player.pressure > 82 && chanceSeed < 42) || (player.relationship < 35 && chanceSeed < 55)) {
        const event = createCareerEventFor(player, chanceSeed);
        state.inbox.unshift({ title: event.title, body: event.body, week: state.academy.week });
      }
    });
    state.playerCareer.lastProcessedToken = token;
    state.inbox = state.inbox.slice(0, 24);
  } catch (error) {
    state.roster = snapshot;
    state.flags.safeMode = true;
    showSystemError('Falha no processamento humano dos atletas. Elenco restaurado pelo anti-quebra.', error);
  }
}
function createCareerEventFor(player, seed=0) {
  const rank = getPlayerRank(player.id);
  const profile = PLAYER_PERSONALITIES[player.personalityKey] || PLAYER_PERSONALITIES.disciplined;
  let title = `${player.name}: reunião solicitada`;
  let body = `${player.name} quer entender melhor o plano da temporada.`;
  if (player.pressure >= 80) { title = `${profile.icon} Pressão sobre ${player.name}`; body = `A pressão subiu para ${Math.round(player.pressure)}. O atleta precisa de gestão emocional antes do próximo torneio.`; }
  else if (player.relationship <= 38) { title = `Relação em alerta: ${player.name}`; body = `A confiança no treinador caiu. Uma conversa direta pode evitar queda de moral.`; }
  else if (player.injuredWeeks > 0) { title = `Recuperação monitorada: ${player.name}`; body = `O atleta está lesionado e valoriza proteção no calendário.`; }
  else if (rank > 160 && player.ambition >= 82) { title = `Ambição cobrando resultado`; body = `${player.name} quer torneios que gerem ranking, não apenas semanas de treino.`; }
  else if (seed % 3 === 0) { title = `Clima positivo no vestiário`; body = `${player.name} respondeu bem ao ciclo e fortaleceu vínculo com a academia.`; player.relationship = clamp(player.relationship + 3, 5, 100); player.morale = clamp((player.morale || 70) + 2, 10, 100); }
  return recordCareerEvent(player, title, body, 'weekly');
}
function renderCareerHub() {
  const host = $('#careerHub');
  if (!host) return;
  ensurePlayerCareerSystem();
  const avg = (key) => state.roster.length ? Math.round(state.roster.reduce((s,p)=>s+(Number(p[key])||0),0)/state.roster.length) : 0;
  const events = (state.playerCareer.weeklyEvents || []).slice(0,6);
  const players = state.roster.map(player => {
    const snap = playerCareerSnapshot(player);
    const profile = snap.profile;
    return `<article class="career-player-card panel-card">
      <div class="career-card-head">${avatarImg(avatarForPlayer(player.name),'avatar-img',player.name)}<div><p class="eyebrow">${profile.icon} ${profile.label}</p><h4>${player.name}</h4><div class="small">${profile.desc}</div></div><strong class="career-score ${snap.risk.cls}">${snap.score}</strong></div>
      <div class="career-bars">
        ${careerBar('Moral', player.morale || 70)}${careerBar('Confiança', player.confidence || 70)}${careerBar('Relação', player.relationship || 65)}${careerBar('Pressão', player.pressure || 40, true)}${careerBar('Felicidade', player.happiness || 65)}
      </div>
      <div class="metric-row"><span class="metric ${snap.risk.cls}">${snap.risk.label}</span><span class="metric">Meta: ${snap.goal}</span><span class="metric">Disciplina ${Math.round(player.discipline || 70)}</span><span class="metric">Ambição ${Math.round(player.ambition || 70)}</span></div>
      <div class="tag-row"><button class="btn-primary" onclick="window.talkToPlayer('${player.id}','praise')">Elogiar</button><button class="btn-secondary" onclick="window.talkToPlayer('${player.id}','calm')">Acalmar</button><button class="btn-secondary" onclick="window.talkToPlayer('${player.id}','demand')">Cobrar</button><button class="btn-ghost" onclick="window.talkToPlayer('${player.id}','rest')">Proteger</button></div>
      <div class="goal-row"><label>Meta da temporada <select onchange="window.setPlayerGoal('${player.id}', this.value)">${Object.entries(SEASON_GOALS).map(([k,v])=>`<option value="${k}" ${player.seasonGoal===k?'selected':''}>${v}</option>`).join('')}</select></label></div>
    </article>`;
  }).join('');
  host.innerHTML = `<div class="career-summary-grid full-width">
    <article class="stat-card"><span>Moral média</span><strong>${avg('morale')}</strong></article>
    <article class="stat-card"><span>Confiança média</span><strong>${avg('confidence')}</strong></article>
    <article class="stat-card"><span>Relação média</span><strong>${avg('relationship')}</strong></article>
    <article class="stat-card"><span>Pressão média</span><strong>${avg('pressure')}</strong></article>
  </div>
  <article class="panel-card career-feed full-width"><div class="panel-title-row"><h4>Eventos humanos da carreira</h4><span class="mini-badge">${BUILD_LABEL}</span></div>${events.length ? events.map(e=>`<div class="report-line"><strong>${escapeHtml(e.title)}</strong><br><span>${escapeHtml(e.body)} • S${e.week}/${e.season}</span></div>`).join('') : '<p class="muted">Os primeiros eventos aparecem ao avançar a semana.</p>'}</article>
  ${players}`;
  hydrateAssetImages();
}
function careerBar(label, value, inverse=false) {
  const v = Math.round(clamp(value || 0, 0, 100));
  const mood = inverse ? (v >= 78 ? 'danger' : v >= 58 ? 'warn' : 'ok') : (v >= 72 ? 'ok' : v >= 48 ? 'warn' : 'danger');
  return `<div class="career-bar ${mood}"><span>${label}</span><b>${v}</b><i style="width:${v}%"></i></div>`;
}
window.talkToPlayer = (playerId, action='praise') => {
  ensurePlayerCareerSystem();
  const player = state.roster.find(p => p.id === playerId);
  if (!player) return;
  const cfg = TALK_ACTIONS[action] || TALK_ACTIONS.praise;
  const profile = PLAYER_PERSONALITIES[player.personalityKey] || PLAYER_PERSONALITIES.disciplined;
  const snapshot = JSON.parse(JSON.stringify(player));
  try {
    const personalityMultiplier = profile.conflict > 10 && action === 'demand' ? 1.35 : profile.key === 'disciplined' && action === 'demand' ? 0.75 : 1;
    player.morale = clamp((player.morale || 70) + cfg.morale * personalityMultiplier, 5, 100);
    player.confidence = clamp((player.confidence || 65) + cfg.confidence, 5, 100);
    player.relationship = clamp((player.relationship || 65) + cfg.relationship * personalityMultiplier, 5, 100);
    player.pressure = clamp((player.pressure || 40) + cfg.pressure, 5, 100);
    player.happiness = clamp((player.happiness || 65) + (action === 'rest' ? 3 : action === 'demand' ? -2 : 1), 5, 100);
    const event = recordCareerEvent(player, `${cfg.label}: ${player.name}`, `Conversa realizada. Moral ${Math.round(player.morale)}, relação ${Math.round(player.relationship)}, pressão ${Math.round(player.pressure)}.`, 'conversation');
    player.conversationHistory.unshift(event);
    player.conversationHistory = player.conversationHistory.slice(0, 10);
    state.playerCareer.conversations.unshift(event);
    state.playerCareer.conversations = state.playerCareer.conversations.slice(0, 20);
    addLog(`${cfg.label} com ${player.name}: efeito humano aplicado.`);
    saveState(state);
    render();
  } catch (error) { Object.assign(player, snapshot); showSystemError('Conversa falhou e o atleta foi restaurado.', error); }
};
window.setPlayerGoal = (playerId, goal='ranking') => {
  const player = state.roster.find(p => p.id === playerId);
  if (!player || !SEASON_GOALS[goal]) return;
  ensurePlayerPsychology(player);
  player.seasonGoal = goal;
  player.relationship = clamp((player.relationship || 65) + 2, 5, 100);
  addLog(`Meta definida para ${player.name}: ${SEASON_GOALS[goal]}.`);
  saveState(state);
  renderCareerHub();
};

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
      ${(() => { const snap = playerCareerSnapshot(player); return `<div class="player-human-strip"><span>${snap.profile.icon} ${snap.profile.label}</span><b class="${snap.risk.cls}">${snap.risk.label} • score ${snap.score}</b></div><div class="metric-row compact"><span class="metric">Moral ${round(player.morale || 70)}</span><span class="metric">Confiança ${round(player.confidence || 70)}</span><span class="metric">Relação ${round(player.relationship || 65)}</span><span class="metric">Pressão ${round(player.pressure || 40)}</span></div>`; })()}
      <div class="tag-row" style="margin-top:12px">
        <button class="btn-primary" onclick="window.openPlayerProfile('${player.id}','roster')">Ver perfil</button>
        <button class="btn-secondary" onclick="window.trainPlayer('${player.id}','technique')">Treino técnico</button>
        <button class="btn-secondary" onclick="window.trainPlayer('${player.id}','fitness')">Treino físico</button>
        <button class="btn-ghost" onclick="window.restPlayer('${player.id}')">Recuperar</button>
        <button class="btn-ghost" onclick="window.talkToPlayer('${player.id}','calm')">Conversa</button>
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
  ensurePlayerPsychology(player);
  player.confidence = clamp((player.confidence || 70) + (type === 'technique' ? 1.5 : 0.5), 5, 100);
  player.pressure = clamp((player.pressure || 40) + (type === 'fitness' ? 1.5 : 0.5), 5, 100);
  player.happiness = clamp((player.happiness || 65) - (type === 'fitness' && (player.discipline || 70) < 65 ? 2 : 0), 5, 100);
  player.morale = Math.min(100, (player.morale || 70) + 1);
  addLog(`${player.name} realizou treino ${type === 'fitness' ? 'físico' : 'técnico'}.`);
  render();
};
window.restPlayer = (playerId) => {
  const player = state.roster.find(p => p.id === playerId);
  if (!player) return;
  player.fatigue = Math.max(0, player.fatigue - 14);
  player.health = Math.min(100, player.health + 8);
  ensurePlayerPsychology(player);
  player.relationship = clamp((player.relationship || 65) + 2, 5, 100);
  player.pressure = clamp((player.pressure || 40) - 3, 5, 100);
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
    const upset = weighted[0] && weighted[0].row?.rank > Math.max(18, Math.round((event.drawSize || 32) * .55));
    const withdrawalCount = (seed % 7) === 0 ? 1 : 0;
    return { eventId:event.id||event.name, eventName:event.name, tier:event.tier, surface:event.surface, city:event.city||'', champion:champion?.name||'A definir', championCountry:champion?.country||'INT', finalist:finalist?.name||'A definir', week, season, drawSize:event.drawSize||32, upset, withdrawalCount };
  });
  state.tournamentLife ||= { championHistory: [], drawAudit: [], lastViewedDraw: null };
  state.tournamentLife.championHistory ||= [];
  results.forEach(result => state.tournamentLife.championHistory.unshift({ eventId:result.eventId, eventName:result.eventName, champion:result.champion, championCountry:result.championCountry, finalist:result.finalist, season, week, tier:result.tier, surface:result.surface, worldTour:true, build:BUILD_INFO.build }));
  state.tournamentLife.championHistory = state.tournamentLife.championHistory.slice(0,80);
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
  const live = current.length ? current.map(event => { const id = eventIdentity(event); return `<article class="tour-live-card branded ${id.tier.cls} surface-${id.surface.cls}">${logoMarkup(id.logo,event.name,'tour-logo','tournament-logo-fallback')}<div><span class="tour-status">SEMANA ATUAL</span><strong>${event.name}</strong><small>${event.tier} • ${id.surface.label} • ${event.city||event.country||'Circuito mundial'}</small></div><button class="mini-btn" onclick="window.openTournamentIdentity('${escapeAttr(event.name)}')">Dossiê</button></article>`; }).join('') : '<article class="tour-live-card"><span class="tour-status quiet">SEM EVENTO</span><strong>Semana de preparação</strong><small>Treine, recupere atletas e planeje a próxima viagem.</small></article>';
  const past = recent.map(result => { const ev = state.calendar.find(e=>e.name===result.eventName) || {}; const logo = logoForTournament(result.eventName); return `<article class="tour-result-card branded">${logoMarkup(logo,result.eventName,'tour-logo','tournament-logo-fallback')}<div><span>${result.tier||'Tour'}</span><strong>${result.champion}</strong><small>campeão de ${result.eventName} • final sobre ${result.finalist}</small></div></article>`; }).join('');
  host.innerHTML = `<div class="tour-live-grid branded-grid">${live}</div>${past ? `<div class="tour-results-strip branded-results">${past}</div>` : ''}`;
  hydrateAssetImages();
}

function renderCalendar() {
  const nearby = state.calendar.filter(event => event.week >= Math.max(1,state.academy.week-1) && event.week <= Math.min(52,state.academy.week+10));
  $('#calendarList').innerHTML = nearby.map(event => {
    const gate = getTournamentGate(event);
    const identity = eventIdentity(event);
    const safeName = escapeAttr(event.name);
    return `
      <article class="tournament-card premium-card identity-calendar-card ${identity.tier.cls} surface-${identity.surface.cls}">
        <button class="tournament-hero" onclick="window.launchEvent('${safeName}')">
          <div class="tournament-logo-wrap hero">${logoMarkup(identity.logo,event.name,'tournament-logo giant','tournament-logo-fallback giant')}</div>
          <div class="tournament-main">
            <div class="identity-card-topline"><span>Semana ${event.week}</span><span>${identity.tier.trophy} ${identity.tier.label}</span><span>${prestigeStars(identity.prestige)}</span></div>
            <strong>${event.name}</strong>
            <div class="meta">${identity.surface.label} • ${event.city || event.country || "Circuito mundial"} • bolsa ${shortMoney(identity.prizePool)} • campeão ${event.winnerPoints || 250} pts • chave ${event.drawSize || 16}</div>
            <div class="identity-calendar-tactic">${identity.surface.tactical}</div>
          </div>
        </button>
        <div class="tournament-side full">
          <div class="entry-pill ${gate.cls}">${gate.label}</div>
          <div class="tournament-actions-row">
            <button class="mini-btn" onclick="window.openTournamentIdentity('${safeName}')">Identidade</button>
            <button class="mini-btn" onclick="window.launchEvent('${safeName}')">Partida</button>
            <button class="mini-btn" onclick="window.openDrawModal('${safeName}')">Chave</button>
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
    `Rally médio ${rallyAvg} bolas • maior rally ${Math.max(p.maxRally, o.maxRally)}`,
    `Plano tático final: ${tacticalSummaryText(match.tacticalPlan || getTacticalPlan())}`
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
  const drawPick = pickDrawOpponent(run.draw, run.roundIndex, run);
  const opponent = getMatchPlayer(drawPick?.opponent || pickOpponent(round, player));
  const user = getMatchPlayer(player);
  const logo = logoForTournament(event.name);
  const firstServer = (state.academy.week + (run.roundIndex || 0)) % 2 === 0 ? 'player' : 'opponent';
  state.match = {
    engineVersion: 'v3.11-tactical-intelligence', presentation: 'broadcast-pro', event, round, drawType: run.entryType, tournamentRunId: run.createdAt,
    playerId: player.id, playerName: player.name, opponentName: opponent.name, opponent,
    sets: [], set: 1, setsPlayer: 0, setsOpponent: 0,
    gamesPlayer: 0, gamesOpponent: 0, playerScore: 0, opponentScore: 0,
    tiebreak: false, server: firstServer, pointText: '0-0', strategy: currentStrategy, tacticalPlan: getTacticalPlan(),
    inProgress: true, finished: false, lastWinner: null, lastPointAt: performance.now(), momentum: 0,
    stats: { player: emptyMatchStats(), opponent: emptyMatchStats() },
    lastPoint: null, lastServeSpeed: 0, replayTape: [], report: [], logo,
    log: [`${event.name} ${round}: ${player.name} vs ${opponent.name}. Piso ${event.surface || 'hard'} • saque inicial: ${firstServer === 'player' ? player.name : opponent.name}.`]
  };
  stopAutoPlay();
  $('#matchPlayerName').textContent = player.name;
  $('#matchOpponentName').textContent = opponent.name;
  addLog(`Partida preparada: ${player.name} vs ${opponent.name} em ${event.name} (${round}).`);
  switchTab('match');
  renderMatch();
  renderBroadcastIntro(state.match);
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
  const plan = getTacticalPlan();
  match.tacticalPlan = { ...plan };
  const tactical = tacticalProfile(plan);
  const surface = match.event?.surface || 'hard';
  const coachBonus = getStaffBonus('Tecnico', 'match') + getStaffBonus('Analista','match') + getStaffBonus('Analista','tactical') * 0.45;
  const psychBonus = getStaffBonus('Psicologo', 'mental') + getStaffBonus('Psicologo','morale') * 0.35;
  const humanServer = serverSide === 'player' ? careerScore(player) * 0.05 - (player.pressure || 40) * 0.035 : 0;
  const humanReceiver = receiverSide === 'player' ? careerScore(player) * 0.04 - (player.pressure || 40) * 0.025 : 0;
  const serverServe = attrValue(server, 'serve');
  const receiverReturn = attrValue(receiver, 'return', attrValue(receiver, 'backhand'));
  const serverComposure = attrValue(server, 'composure', attrValue(server, 'mental')) + (serverSide === 'player' ? psychBonus * 0.35 : 0);
  const receiverComposure = attrValue(receiver, 'composure', attrValue(receiver, 'mental'));
  const serverSurface = surfaceRating(server, surface);
  const receiverSurface = surfaceRating(receiver, surface);
  const fatiguePenalty = (serverSide === 'player' ? player.fatigue || 0 : 18) * 0.18;
  const pressure = pressureScore(match, serverSide);
  let firstServeChance = clamp(52 + serverServe * 0.28 + serverComposure * 0.08 + serverSurface * 0.04 - fatiguePenalty - pressure * 1.2 + (serverSide === 'player' ? effects.serve + humanServer + tactical.firstServe : 0), 42, 86);
  if (currentStrategy === 'aggressive' && serverSide === 'player') firstServeChance -= 4;
  if (currentStrategy === 'control' && serverSide === 'player') firstServeChance += 3;
  serverStats.firstServeTotal += 1;
  serverStats.servicePoints += 1;
  const firstIn = Math.random() * 100 < firstServeChance;
  const serveDirection = serveDirectionFor(match, serverSide);
  const serveSpeed = serveSpeedFor(server, surface, firstIn);
  match.lastServeSpeed = serveSpeed;
  if (firstIn) serverStats.firstServeIn += 1;

  const aceChance = firstIn ? clamp(1.5 + (serverServe - receiverReturn) * 0.10 + (surfaceKey(surface) === 'grass' ? 2.2 : 0) + (serverSide === 'player' ? effects.serve * 0.34 + tactical.ace : 0), 0.4, 18) : 0;
  if (firstIn && Math.random() * 100 < aceChance) {
    serverStats.aces += 1;
    serverStats.points += 1;
    serverStats.firstServeWon += 1;
    return { winner: serverSide, type: 'Ace', serve: '1º saque', rally: 1, speed: serveSpeed, direction: serveDirection, text: `Ace de ${server.name} sacando ${serveDirection} a ${serveSpeed} km/h.` };
  }

  if (!firstIn) {
    const doubleFaultChance = clamp(3.8 + (62 - serverServe) * 0.07 + pressure * 0.75 + (serverSide === 'player' ? effects.error * 0.45 + tactical.serveError : 0), 1.4, 20);
    if (Math.random() * 100 < doubleFaultChance) {
      serverStats.doubleFaults += 1;
      receiverStats.points += 1;
      receiverStats.returnPointsWon += 1;
      return { winner: receiverSide, type: 'Dupla falta', serve: '2º saque', rally: 0, speed: serveSpeed, direction: serveDirection, text: `Dupla falta de ${server.name} tentando sacar ${serveDirection}.` };
    }
  }

  const rallyBase = 3 + Math.floor(Math.random() * 8);
  const consistency = (attrValue(server, 'consistency') + attrValue(receiver, 'consistency')) / 2;
  const rally = clamp(Math.round(rallyBase + (consistency - 60) / 12 + (surfaceKey(surface) === 'clay' ? 3 : surfaceKey(surface) === 'grass' ? -1 : 0) + (receiverSide === 'player' || serverSide === 'player' ? tactical.rally : 0)), 1, 26);
  serverStats.rallyTotal += rally; serverStats.rallyCount += 1; serverStats.maxRally = Math.max(serverStats.maxRally, rally);
  receiverStats.rallyTotal += rally; receiverStats.rallyCount += 1; receiverStats.maxRally = Math.max(receiverStats.maxRally, rally);

  const serverAttack = attrValue(server, 'forehand') * 0.34 + attrValue(server, 'backhand') * 0.22 + serverServe * (firstIn ? 0.22 : 0.10) + serverSurface * 0.10 + serverComposure * 0.08;
  const receiverDefense = receiverReturn * 0.28 + attrValue(receiver, 'agility') * 0.18 + attrValue(receiver, 'speed') * 0.12 + attrValue(receiver, 'consistency') * 0.24 + receiverSurface * 0.10 + receiverComposure * 0.08;
  const tacticalEdge = tacticalPressureAgainst(opponent, plan);
  const returnEdge = !firstIn && receiverSide === 'player' ? tactical.secondServePressure : receiverSide === 'player' ? tactical.return : 0;
  const userTactical = serverSide === 'player'
    ? effects.offense + effects.pressure - effects.error * 0.55 + humanServer + tactical.offense + tacticalEdge
    : receiverSide === 'player'
      ? effects.defense - effects.error * 0.45 + humanReceiver + tactical.defense + returnEdge + tacticalEdge * 0.55
      : 0;
  const momentum = match.momentum * (serverSide === 'player' ? 1 : -1);
  const winChance = clamp(50 + (serverAttack - receiverDefense) * 0.42 + userTactical + momentum, 24, 76);
  const serverWins = Math.random() * 100 < winChance;
  const winner = serverWins ? serverSide : receiverSide;
  const loser = serverWins ? receiverSide : serverSide;
  const winnerStats = match.stats[winner];
  const loserStats = match.stats[loser];
  const attackingError = clamp(8 + (currentStrategy === 'aggressive' && loser === 'player' ? 5 : 0) + (loser === 'player' ? tactical.error : 0) + (rally - 6) * 0.55 - attrValue(loser === 'player' ? player : opponent, 'consistency') * 0.06, 3, 28);
  const isError = Math.random() * 100 < attackingError;
  if (isError) loserStats.unforcedErrors += 1; else winnerStats.winners += 1;
  winnerStats.points += 1;
  if (winner === receiverSide) receiverStats.returnPointsWon += 1;
  if (firstIn && winner === serverSide) serverStats.firstServeWon += 1;
  if (!firstIn && winner === serverSide) serverStats.secondServeWon += 1;
  const attackLabel = tacticalOption('attackPattern', plan.attackPattern).label || 'padrão tático';
  const shot = plan.rallyPlan === 'net' ? 'subida à rede' : plan.rallyPlan === 'short' ? 'ponto encurtado' : rally > 10 ? 'rally longo' : firstIn ? 'devolução pressionada' : 'segundo saque atacado';
  const planRead = winner === 'player'
    ? `Plano ${attackLabel}: ${shot} funcionou. ${tacticalAnalystRead(match)}`
    : `Plano ${attackLabel}: adversário resistiu; ajuste risco se erros ou winners sofridos crescerem.`;
  return { winner, type: isError ? 'Erro não forçado' : 'Winner', serve: firstIn ? '1º saque' : '2º saque', rally, speed: serveSpeed, direction: serveDirection, tactical: shot, plan: { ...plan }, planRead, text: isError ? `${loser === 'player' ? player.name : opponent.name} erra após ${rally} bolas depois de saque ${serveDirection}.` : `${winner === 'player' ? player.name : opponent.name} fecha com ${shot} após saque ${serveDirection}.` };
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
    player.fatigue = Math.min(100, (player.fatigue || 0) + 0.55 + Math.max(0, effects.stamina + tacticalProfile().stamina) * 0.28 + (point.rally || 0) * 0.035);
    player.health = Math.max(42, (player.health || 100) - 0.08 - Math.max(0, effects.stamina) * 0.05 - (point.rally || 0) * 0.012);
    maybeInjure(player, point.rally > 14 ? 1.4 : 0.8);
    updateTennisScore(point.winner);
    appendReplay(point, state.match);
    addMatchLog(`${point.serve} • ${point.type} • ${point.speed || '—'} km/h: ${point.text}`);
    drawCourt(won ? 'player' : 'opponent');
    renderMatch();
    renderBroadcastIntro(state.match);
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

function simulateCurrentGame() {
  withMatchGuard('Simulação de game', () => {
    stopAutoPlay();
    const startKey = `${state.match.gamesPlayer}-${state.match.gamesOpponent}-${state.match.set}-${state.match.tiebreak}`;
    let guard = 0;
    while (!state.match.finished && `${state.match.gamesPlayer}-${state.match.gamesOpponent}-${state.match.set}-${state.match.tiebreak}` === startKey && guard < 90) {
      playPoint();
      guard += 1;
    }
    addMatchLog(`Simulação de game concluída com ${guard} pontos.`);
    renderMatch();
  });
}
function simulateCurrentSet() {
  withMatchGuard('Simulação de set', () => {
    stopAutoPlay();
    const startSet = state.match.set;
    let guard = 0;
    while (!state.match.finished && state.match.set === startSet && guard < 520) {
      playPoint();
      guard += 1;
    }
    addMatchLog(`Simulação de set concluída com ${guard} pontos.`);
    renderMatch();
  });
}
function simulateFullMatch() {
  withMatchGuard('Simulação da partida', () => {
    stopAutoPlay();
    let guard = 0;
    while (!state.match.finished && guard < 1200) {
      playPoint();
      guard += 1;
    }
    if (!state.match.finished) addMatchLog('Limite de segurança atingido. Partida preservada para continuar manualmente.');
    else addMatchLog(`Partida simulada até o fim com ${guard} pontos.`);
    renderMatch();
  });
}
function tacticalPause() {
  if (!state.match) return addLog('Inicie uma partida para usar a pausa tática.');
  stopAutoPlay();
  const player = getMatchPlayer(state.roster.find(p => p.id === state.match.playerId) || {});
  const opponent = getMatchPlayer(state.match.opponent || {});
  const msg = tacticalAnalystRead(state.match);
  addMatchLog(`Pausa tática: ${msg}`);
  state.match.replayTape ||= [];
  state.match.replayTape.push({ text: 'Pausa tática', detail: msg, at: new Date().toISOString() });
  state.match.replayTape = state.match.replayTape.slice(-8);
  renderMatch();
  renderBroadcastIntro(state.match);
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
  const roundFactor = { Q: 0.05, R128: 0.06, R64: 0.09, R32: 0.13, R16: 0.18, QF: 0.34, SF: 0.56, F: 1 }[round] || 0.1;
  const rankFactor = Math.max(0.82, 1 + (120 - getPlayerRank(player.id)) / 500);
  const pointsGain = Math.round(event.prize * roundFactor / 180 * rankFactor * (playerWon ? 1 : 0.45));
  const cashGain = Math.round(event.prize * roundFactor * (playerWon ? 1 : 0.35));
  player.rankingPoints += pointsGain;
  const score = matchSetScore(state.match);
  player.morale = clamp((player.morale || 70) + (playerWon ? 8 : -4), 35, 100);
  ensurePlayerPsychology(player);
  player.confidence = clamp((player.confidence || 65) + (playerWon ? 7 : -6), 5, 100);
  player.pressure = clamp((player.pressure || 40) + (playerWon ? -2 : 5), 5, 100);
  player.relationship = clamp((player.relationship || 65) + (playerWon ? 2 : -1), 5, 100);
  recordCareerEvent(player, `${playerWon ? 'Vitória fortaleceu' : 'Derrota cobrou'} ${player.name}`, `${event.name} ${round}: placar ${score}. Confiança ${Math.round(player.confidence)}, pressão ${Math.round(player.pressure)}.`, 'match');
  player.fatigue = Math.min(100, player.fatigue + 5 + ((state.match.stats.player.rallyTotal || 0) / 180));
  state.academy.money += cashGain;
  state.academy.reputation += playerWon ? 4 : 1;
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
      state.tournamentLife ||= { championHistory: [], drawAudit: [], lastViewedDraw: null };
      state.tournamentLife.championHistory ||= [];
      state.tournamentLife.championHistory.unshift({ eventId:event.id || event.name, eventName:event.name, champion:player.name, championCountry:player.country, season:state.academy.season, week:state.academy.week, score, tier:event.tier, surface:event.surface, build:BUILD_INFO.build });
      state.tournamentLife.championHistory = state.tournamentLife.championHistory.slice(0, 80);
      if (run.draw) { run.draw.champion = { name:player.name, country:player.country, score, season:state.academy.season, week:state.academy.week }; run.draw.history ||= []; run.draw.history.unshift({ champion:player.name, score, at:new Date().toISOString() }); }
      addMatchLog('Título conquistado! Histórico de campeão registrado na vida do torneio.');
      player.lastResult = `${event.name} campeão • ${score}`;
      state.summary.unshift(`${player.name} foi campeão de ${event.name}!`);
    } else {
      addMatchLog(`Vitória. Próxima rodada: ${run.rounds[run.roundIndex]}.`);
    }
  }
  render();
}


function renderTacticalIntelligencePanel(match = state.match) {
  const host = $('#tacticalIntelligencePanel');
  if (!host) return;
  const plan = getTacticalPlan();
  const makeSelect = (field, label) => {
    const opts = TACTICAL_OPTIONS[field] || {};
    return `<label class="tactical-select"><span>${label}</span><select data-tactical-field="${field}">${Object.entries(opts).map(([key,opt])=>`<option value="${key}" ${plan[field]===key?'selected':''}>${opt.label}</option>`).join('')}</select><small>${escapeHtml(opts[plan[field]]?.desc || '')}</small></label>`;
  };
  const profile = tacticalProfile(plan);
  host.innerHTML = `
    <div class="tactical-grid">
      ${makeSelect('serveTarget','Saque')}
      ${makeSelect('returnPlan','Devolução')}
      ${makeSelect('attackPattern','Alvo de ataque')}
      ${makeSelect('rallyPlan','Duração do ponto')}
      ${makeSelect('riskMode','Risco')}
    </div>
    <div class="tactical-impact-grid">
      <article><span>Ofensiva</span><strong>${profile.offense>=0?'+':''}${profile.offense.toFixed(1)}</strong></article>
      <article><span>Defesa</span><strong>${profile.defense>=0?'+':''}${profile.defense.toFixed(1)}</strong></article>
      <article><span>1º saque</span><strong>${profile.firstServe>=0?'+':''}${profile.firstServe.toFixed(1)}</strong></article>
      <article><span>Risco erro</span><strong>${profile.error>=0?'+':''}${profile.error.toFixed(1)}</strong></article>
    </div>
    <div class="tactical-analyst-box"><strong>Analista:</strong><span>${tacticalAnalystRead(match)}</span></div>
    <div class="tactical-button-row">
      <button class="mini-btn" type="button" data-tactical-action="recommend">Auto plano</button>
      <button class="mini-btn" type="button" data-tactical-action="reset">Equilibrar</button>
      <button class="btn-secondary" type="button" data-tactical-action="apply">Aplicar na partida</button>
    </div>`;
}
function handleTacticalPlanChange(event) {
  const field = event.target?.dataset?.tacticalField;
  if (!field) return;
  const previous = structuredClone(state.tacticalIntelligence || {});
  try {
    const value = event.target.value;
    state.tacticalIntelligence ||= { plan: { ...TACTICAL_DEFAULT_PLAN }, history: [] };
    state.tacticalIntelligence.plan ||= { ...TACTICAL_DEFAULT_PLAN };
    if (!TACTICAL_OPTIONS[field]?.[value]) throw new Error(`Plano tático inválido: ${field}/${value}`);
    state.tacticalIntelligence.plan[field] = value;
    state.tacticalIntelligence.analyst = tacticalAnalystRead(state.match);
    if (state.match) state.match.tacticalPlan = getTacticalPlan();
    renderMatch();
    saveState(state);
  } catch (error) {
    state.tacticalIntelligence = previous;
    showSystemError('Plano tático cancelado com segurança. O estado anterior foi restaurado.', error);
    renderMatch();
  }
}
function handleTacticalPlanClick(event) {
  const action = event.target?.dataset?.tacticalAction;
  if (!action) return;
  const previous = structuredClone(state.tacticalIntelligence || {});
  try {
    state.tacticalIntelligence ||= { plan: { ...TACTICAL_DEFAULT_PLAN }, history: [] };
    if (action === 'recommend') state.tacticalIntelligence.plan = recommendTacticalPlan(state.match);
    if (action === 'reset') state.tacticalIntelligence.plan = { ...TACTICAL_DEFAULT_PLAN };
    if (action === 'apply') {
      state.tacticalIntelligence.history ||= [];
      state.tacticalIntelligence.lastAppliedWeek = state.academy.week;
      state.tacticalIntelligence.history.unshift({ week: state.academy.week, season: state.academy.season, plan: getTacticalPlan(), read: tacticalAnalystRead(state.match), build: BUILD_INFO.build, at: new Date().toISOString() });
      state.tacticalIntelligence.history = state.tacticalIntelligence.history.slice(0, 40);
      if (state.match) {
        state.match.tacticalPlan = getTacticalPlan();
        state.match.log ||= [];
        state.match.log.push(`Plano tático aplicado: ${tacticalSummaryText()}.`);
        state.match.log = state.match.log.slice(-80);
      } else addLog(`Plano tático aplicado: ${tacticalSummaryText()}.`);
    }
    state.tacticalIntelligence.analyst = tacticalAnalystRead(state.match);
    renderMatch();
    saveState(state);
  } catch (error) {
    state.tacticalIntelligence = previous;
    showSystemError('Ajuste tático cancelado com segurança. O estado anterior foi restaurado.', error);
    renderMatch();
  }
}
function renderMatch() {
  const match = state.match;
  renderBroadcastIntro(match);
  const matchWrap = $('#matchBrandWrap');
  const activeName = state.activeTournament ? state.activeTournament.event.name : (match?.event?.name || '');
  const activeLogo = logoForTournament(activeName);
  if (matchWrap) matchWrap.innerHTML = `<div class="match-brand-actions">${activeLogo ? `<div class="tournament-logo-wrap hero">${logoMarkup(activeLogo,activeName,'tour-logo large','tournament-logo-fallback large')}</div>` : ''}<button class="mini-btn" type="button" onclick="window.openDrawModal('${activeName.replace("'", "&#39;")}')">Ver chave</button></div>`; 
  $('#roundLabel').textContent = state.activeTournament ? `Rodada ${state.activeTournament.rounds[state.activeTournament.roundIndex] || 'fim'}` : (match?.round ? `Rodada ${match.round}` : 'Rodada -');
  $('#tournamentLabel').textContent = state.activeTournament ? state.activeTournament.event.name : (match?.event?.name || 'Nenhum torneio');
  const statsHost = $('#matchStatsPanel');
  const reportHost = $('#matchReportPanel');
  const scoutHost = $('#matchScoutPanel');
  renderTacticalIntelligencePanel(match);
  if (!match) {
    const badge = document.querySelector('.score-card .tour-badge'); if (badge) badge.remove();
    $('#scorePlayer').textContent = '0'; $('#scoreOpponent').textContent = '0'; $('#setLabel').textContent = 'Set 1'; $('#pointLabel').textContent = '0-0';
    $('#matchLog').textContent = state.activeTournament ? `Torneio ativo em ${state.activeTournament.event.name}. Toque em iniciar rodada.` : 'Nenhuma partida em andamento.';
    if (statsHost) statsHost.innerHTML = '<div class="empty-state">Inicie uma partida para ver estatísticas reais ponto a ponto.</div>';
    if (reportHost) reportHost.innerHTML = '<div class="empty-state">Relatório final aparecerá aqui após a partida.</div>';
    if (scoutHost) scoutHost.innerHTML = '<div class="empty-state">O dossiê tático será montado com atleta, adversário, piso e staff.</div>';
    drawCourt();
    hydrateAssetImages();
    return;
  }
  $('#scorePlayer').textContent = match.gamesPlayer;
  $('#scoreOpponent').textContent = match.gamesOpponent;
  $('#setLabel').textContent = `Set ${match.set} • sets ${match.setsPlayer}-${match.setsOpponent}`;
  $('#pointLabel').textContent = match.pointText;
  $('#matchLog').textContent = match.log.slice(-16).join('\n');
  const player = getMatchPlayer(state.roster.find(p => p.id === match.playerId) || {});
  const opp = getMatchPlayer(match.opponent || {});
  const scoreCard = document.querySelector('.score-card');
  if (scoreCard) {
    const old = scoreCard.querySelector('.tour-badge'); if (old) old.remove();
    const badge = document.createElement('div'); badge.className='tour-badge broadcast pro';
    const logo = logoForTournament(match.event.name);
    badge.innerHTML = `${logoImg(logo,'tour-logo',match.event.name)}<div class="copy"><strong>${match.event.name}</strong><div class="event-surface">${match.event.surface} • ${match.round} • Saque: ${currentServerName(match)}</div><div class="set-strip">${match.sets?.length ? match.sets.map((s,i)=>`S${i+1} ${s.player}-${s.opponent}${s.tiebreak ? ` (${s.tiebreak})` : ''}`).join(' • ') : 'Melhor de 3 sets'} • ${match.engineVersion}</div></div>`;
    scoreCard.appendChild(badge);
  }
  const p = match.stats.player, o = match.stats.opponent;
  const rallyAvg = rallyAverage(p, o);
  const momentumLabel = (match.momentum || 0) > 2 ? 'Seu atleta' : (match.momentum || 0) < -2 ? 'Adversário' : 'Neutro';
  if (statsHost) statsHost.innerHTML = `
    <article class="match-stat-card"><span>Aces</span><strong>${p.aces} - ${o.aces}</strong></article>
    <article class="match-stat-card"><span>Duplas faltas</span><strong>${p.doubleFaults} - ${o.doubleFaults}</strong></article>
    <article class="match-stat-card"><span>Winners</span><strong>${p.winners} - ${o.winners}</strong></article>
    <article class="match-stat-card"><span>Erros não forçados</span><strong>${p.unforcedErrors} - ${o.unforcedErrors}</strong></article>
    <article class="match-stat-card"><span>1º saque</span><strong>${statsPct(p.firstServeIn,p.firstServeTotal)} - ${statsPct(o.firstServeIn,o.firstServeTotal)}</strong></article>
    <article class="match-stat-card"><span>Break points</span><strong>${p.breakPointsWon}/${p.breakPoints} - ${o.breakPointsWon}/${o.breakPoints}</strong></article>
    <article class="match-stat-card"><span>Velocidade último saque</span><strong>${match.lastServeSpeed || 0} km/h</strong></article>
    <article class="match-stat-card"><span>Rally médio</span><strong>${rallyAvg} bolas</strong></article>
    <article class="match-stat-card wide"><span>Momentum</span><strong>${momentumLabel} • ${Math.round((match.momentum || 0) * 10) / 10}</strong><div class="momentum-bar"><i style="width:${clamp(50 + (match.momentum || 0) * 5, 5, 95)}%"></i></div></article>
    <article class="match-stat-card wide"><span>Plano tático</span><strong>${tacticalSummaryText(match.tacticalPlan || getTacticalPlan())}</strong></article>`;
  const last = match.lastPoint;
  const replay = (match.replayTape || []).slice(-4).reverse();
  if (scoutHost) scoutHost.innerHTML = `
    <div class="scout-row"><strong>${player.name}</strong><span>SAQ ${Math.round(attrValue(player,'serve'))} • DEV ${Math.round(attrValue(player,'return'))} • MENT ${Math.round(attrValue(player,'composure',attrValue(player,'mental')))}</span></div>
    <div class="scout-row"><strong>${opp.name}</strong><span>SAQ ${Math.round(attrValue(opp,'serve'))} • DEV ${Math.round(attrValue(opp,'return'))} • MENT ${Math.round(attrValue(opp,'composure',attrValue(opp,'mental')))}</span></div>
    <div class="last-point-card"><span>Último ponto</span><strong>${last ? `${last.type} • ${last.speed || '—'} km/h • ${last.rally} bolas` : 'Aguardando'}</strong><p>${last?.text || 'Use simular ponto/game/set/partida para iniciar o rally.'}</p><small>${pointTacticalRead(last, match)}</small></div>
    <div class="last-point-card tactical"><span>Leitura do analista</span><strong>${tacticalSummaryText(match.tacticalPlan || getTacticalPlan())}</strong><p>${tacticalAnalystRead(match)}</p></div>
    <div class="replay-tape">${replay.length ? replay.map(item=>`<div class="replay-line"><strong>${item.text}</strong><span>${item.detail}</span></div>`).join('') : '<div class="replay-line muted">Mini replay aparecerá conforme os pontos forem jogados.</div>'}</div>`;
  if (reportHost) reportHost.innerHTML = match.finished ? createBroadcastReport(match).map(line=>`<div class="report-line">${line}</div>`).join('') : `<div class="report-line">Motor v3.11 ativo: inteligência tática, plano de jogo e leitura do analista conectados à partida.</div><div class="report-line">${broadcastRecommendation(match, player, opp)}</div><div class="report-line">Placar: ${scoreSnapshot(match)} • Estratégia: ${currentStrategy}</div>`;
  const autoBtn = $('#autoMatchBtn');
  if (autoBtn) autoBtn.textContent = autoPlayTimer ? `Auto ${autoPlaySpeed}x ativo` : 'Auto 1x';
  refreshAutoButtons();
  hydrateAssetImages();
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
  processPlayerCareersWeekly();
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

  const surface = surfaceKey(match?.event?.surface || 'hard');
  const surfacePalettes = { clay: ['#8f4a2d', '#d0773f'], grass: ['#0d4d2d', '#2e8f4d'], indoor: ['#202042', '#5151a8'], hard: ['#0e3a69', '#0d6c66'] };
  const palette = surfacePalettes[surface] || surfacePalettes.hard;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, palette[0]);
  g.addColorStop(1, palette[1]);
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
  ctx.fillText(`Estratégia ${currentStrategy.toUpperCase()} • ${tacticalOption('attackPattern', getTacticalPlan().attackPattern).label || 'Tática'} • ${autoLabel}`, 30, 61);
  if (match?.lastPoint) {
    ctx.fillStyle = 'rgba(5,10,18,0.70)';
    ctx.fillRect(w - 340, 16, 318, 72);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 16px Inter, system-ui, sans-serif';
    ctx.fillText(`${match.lastPoint.type} • ${match.lastServeSpeed || 0} km/h`, w - 326, 42);
    ctx.fillStyle = '#c7d8ea';
    ctx.font = '500 13px Inter, system-ui, sans-serif';
    ctx.fillText(`${scoreSnapshot(match)}`, w - 326, 64);
  }
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
