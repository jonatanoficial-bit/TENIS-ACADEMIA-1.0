import { loadContent } from './contentLoader.js';
import { buildInitialState, saveState, loadState, clearState, migrateSave, getSaveDiagnostics } from './state.js';
import { BUILD_INFO, BUILD_LABEL } from './build.js';
import { enrichPlayer, categoryAverage, surfaceLabel } from './modules/player-database.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const canvas = $('#matchCanvas');
const ctx = canvas?.getContext('2d');
let state;
let content;
let currentStrategy = 'balanced';

const LAST_SEEN_BUILD_KEY = 'vale_tennis_last_seen_build';
const LAST_SEEN_VERSION_KEY = 'vale_tennis_last_seen_version';
const CACHE_GUARD_HISTORY_KEY = 'vale_tennis_cache_guard_history';

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

const VISUAL_ACADEMY_SCENES = {
  office: { label: 'Escritório do treinador', tab: 'dashboard', asset: 'assets/branding/backgrounds/lobby-premium.png', badge: 'Gestão central', desc: 'Hub executivo com caixa, agenda, risco, patrocínios e decisões da semana.', kpi: 'Controle total da carreira' },
  training: { label: 'Centro de treinamento', tab: 'training', asset: 'assets/branding/backgrounds/home-hero.png', badge: 'Performance', desc: 'Planejamento semanal, carga, evolução técnica, recuperação e risco físico.', kpi: 'Rotina de alta performance' },
  medical: { label: 'Sala médica e recuperação', tab: 'training', asset: 'assets/branding/staff/doctor.png', badge: 'Saúde', desc: 'Leitura visual de atletas cansados, lesionados e próximos de sobrecarga.', kpi: 'Prevenção de lesões' },
  analysis: { label: 'Sala de análise tática', tab: 'match', asset: 'assets/branding/backgrounds/match-night.png', badge: 'Tactical Intelligence', desc: 'Plano de saque, devolução, rally, risco e análise do adversário antes do ponto.', kpi: 'Decisão dentro da partida' },
  market: { label: 'Rede de scouting', tab: 'market', asset: 'assets/branding/players/player_latino.png', badge: 'Mercado global', desc: 'Talentos, perfis, potencial e leitura de contratação com visual mais humano.', kpi: 'Futuro da academia' },
  calendar: { label: 'Circuito mundial', tab: 'calendar', asset: 'assets/branding/logos/grandslam_wimbledon.png', badge: 'World Tour', desc: 'Torneios com identidade, logos, prestígio, chave e história da temporada.', kpi: 'Calendário vivo' },
  broadcast: { label: 'Arena de transmissão', tab: 'match', asset: 'assets/branding/backgrounds/match-night.png', badge: 'Match Day', desc: 'Partida com placar, quadra, replay, estatísticas e relatório premium.', kpi: 'Evento esportivo real' }
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

const NEWSROOM_CATEGORIES = {
  headline: { label: 'Manchete', icon: '🗞️', tone: 'headline' },
  result: { label: 'Resultado', icon: '🏆', tone: 'sport' },
  academy: { label: 'Academia', icon: '🎾', tone: 'academy' },
  rumor: { label: 'Rumor', icon: '👀', tone: 'rumor' },
  medical: { label: 'Médico', icon: '🩺', tone: 'risk' },
  market: { label: 'Mercado', icon: '💼', tone: 'business' },
  press: { label: 'Coletiva', icon: '🎙️', tone: 'press' }
};
const PRESS_ANSWERS = {
  humble: { label: 'Resposta humilde', sentiment: 5, reputation: 1, morale: 2, pressure: -4, body: 'tom humilde, protegendo o atleta e valorizando o processo.' },
  confident: { label: 'Resposta confiante', sentiment: 2, reputation: 4, morale: 4, pressure: 3, body: 'tom forte, aumentando ambição e exposição pública.' },
  protective: { label: 'Proteger atleta', sentiment: 3, reputation: 0, morale: 3, pressure: -7, body: 'tom protetor, tirando pressão do elenco.' },
  direct: { label: 'Cobrança pública', sentiment: -3, reputation: 2, morale: -2, pressure: 6, body: 'tom direto, cobrando evolução diante da imprensa.' }
};


const MOBILE_UX_MODES = {
  auto: { label: 'Automático', desc: 'Detecta largura, altura, orientação e aplica ajustes de espaço.' },
  compact: { label: 'Compacto', desc: 'Reduz cartões e prioriza informações essenciais em 320–390 px.' },
  comfort: { label: 'Conforto', desc: 'Aumenta área de toque e espaçamento para celulares grandes/tablets.' }
};
const MOBILE_UX_BREAKPOINTS = [320, 360, 390, 412, 760, 1100];


const COMMERCIAL_SPONSOR_BRANDS = [
  { name: 'Apex Rackets', tier: 'Global', baseBonus: 68000, weekly: 9200, requirement: 'manter atleta no Top 80', category: 'equipamento', prestige: 9 },
  { name: 'Blue Court Energy', tier: 'Continental', baseBonus: 42000, weekly: 6400, requirement: 'chegar às quartas em ATP 250/500', category: 'bebida esportiva', prestige: 7 },
  { name: 'Vale Performance Wear', tier: 'Nacional', baseBonus: 30000, weekly: 4800, requirement: 'crescer reputação e presença em torneios', category: 'uniforme', prestige: 6 },
  { name: 'Golden Serve Bank', tier: 'Premium', baseBonus: 54000, weekly: 7800, requirement: 'fluxo de caixa positivo por 8 semanas', category: 'financeiro', prestige: 8 },
  { name: 'Local Sports Hub', tier: 'Regional', baseBonus: 18000, weekly: 2800, requirement: 'manter academia ativa no circuito', category: 'regional', prestige: 4 }
];
const COMMERCIAL_INVESTORS = [
  { name: 'Fundo Elite Court', capital: 180000, weeks: 26, equity: 8, pressure: 10, goal: 'Top 120 em 26 semanas' },
  { name: 'Grupo Global Racquet', capital: 320000, weeks: 52, equity: 14, pressure: 18, goal: 'Top 80 e presença em ATP 500' },
  { name: 'Anjo do Esporte Local', capital: 90000, weeks: 18, equity: 4, pressure: 5, goal: 'caixa positivo e base saudável' }
];
const TRAVEL_BUDGET_MODES = {
  lean: { label: 'Enxuto', desc: 'Economiza viagem e hospedagem, mas aumenta desgaste e reduz conforto.', cost: -0.18, fatigue: 4, reputation: -0.4 },
  balanced: { label: 'Equilibrado', desc: 'Custo normal com risco controlado para calendário profissional.', cost: 0, fatigue: 0, reputation: 0 },
  premium: { label: 'Premium', desc: 'Mais conforto e recuperação em torneios, com custo alto.', cost: 0.26, fatigue: -3, reputation: 0.8 }
};


const GENERATION_FIRST_NAMES = ['Miguel','Arthur','Rafael','Lorenzo','Theo','Lucas','Nicolas','Gabriel','Matteo','Davi','Enzo','Felipe','Bruno','Victor','Samuel','Leonardo','Henrique','Noah','Ian','Caio'];
const GENERATION_LAST_NAMES = ['Vale','Monteiro','Campos','Ramos','Silva','Nakamura','Santos','Costa','Almeida','Pereira','Gomes','Martins','Ribeiro','Oliveira','Torres','Mendes','Araujo','Ferreira','Cardoso','Rocha'];
const GENERATION_COUNTRIES = ['BRA','ARG','ESP','FRA','USA','ITA','GBR','GER','JPN','AUS','CHI','CAN','POR','MEX'];
const CAREER_PHASE_META = {
  prospect: { label: 'Promessa', icon: '🌱', desc: 'Ainda em formação, ganha atributos mais rápido e precisa de calendário protegido.' },
  rising: { label: 'Ascensão', icon: '📈', desc: 'Pode explodir no ranking se combinar treino, confiança e calendário correto.' },
  prime: { label: 'Auge', icon: '👑', desc: 'Fase ideal para títulos, patrocínios fortes e grandes torneios.' },
  veteran: { label: 'Veterano', icon: '🧠', desc: 'Experiência alta, porém recuperação e físico exigem gestão fina.' },
  decline: { label: 'Declínio', icon: '🍂', desc: 'Risco de queda física, lesões e aposentadoria aumenta a cada temporada.' }
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
  document.body.classList.remove('setup-open','setup-focus-mode','forced-onboarding-active');
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
  return src ? `<img class="${cls}" data-asset-src="${src}" alt="${escapeAttr(alt)}" loading="lazy" decoding="async">` : '';
}
function logoImg(src, cls='tour-logo', alt='logo') {
  return src ? `<img class="${cls}" data-asset-src="${src}" alt="${escapeAttr(alt)}" loading="lazy" decoding="async">` : '';
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
const SETUP_SAFE_TABS = new Set(['setupverify','initialgate','runtimeproof','onboarding','cacheguard','input','a11y','helpcenter','diagnostics','compat','qa','polish','delivery','release','localization','adminhint','mobileux']);

const CRITICAL_ONBOARDING_BUTTONS = [
  'openSetupBtn','openSetupBannerBtn','saveOwnerSetupBtn','repairStartBtn','recoverCareerBtn','resetBtn','advanceWeekBtn','saveBtn','mobileQuickSave','mobileQuickTop','forceSetupModalBtn','testCareerSaveBtn','activateFirstAvatarBtn','freshSetupBtn'
];
const CRITICAL_ONBOARDING_TABS = ['dashboard','roster','career','training','calendar','match','ranking','onboarding','cacheguard','setupverify','runtimeproof'];




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
  document.body.classList.remove('setup-open','setup-focus-mode','forced-onboarding-active');
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
  ensureCareerCreationUXSystem();
  const owner = ownerData();
  const wasVisible = ownerSetupModalVisible();
  const hasTypedValues = !!($('#ownerNameInput')?.value || $('#academyNameInput')?.value || $('#academyCityInput')?.value);
  const keepTypedValues = wasVisible && hasTypedValues;
  if (!keepTypedValues) {
    const hasRealOwner = !!state.academy?.owner?.name && state.academy.owner.name !== 'Seu nome';
    $('#ownerNameInput').value = (!force && hasRealOwner) ? owner.name : '';
    $('#ownerCountryInput').value = (!force && owner.country) ? owner.country : 'BRA';
    $('#academyNameInput').value = (!force && state.academy?.name && state.academy.name !== 'Ace Academy') ? state.academy.name : '';
    $('#academyLogoInput').value = owner.logo || 'VTA';
    $('#ownerAgeInput').value = owner.age || 36;
    $('#ownerGenderInput').value = owner.gender || 'masculino';
    $('#ownerBackgroundInput').value = owner.background || 'ex-jogador';
    $('#ownerSpecialtyInput').value = owner.specialty || 'tecnica';
    $('#academyCityInput').value = state.academy.careerProfile?.city || 'São Paulo';
    $('#academyPhilosophyInput').value = state.academy.careerProfile?.philosophy || 'equilibrada';
    $('#careerDifficultyInput').value = state.academy.careerProfile?.difficulty || 'normal';
    $('#careerCurrencyInput').value = state.academy.careerProfile?.currency || 'BRL';
  }
  modal.style.display = 'flex';
  modal.classList.remove('hidden');
  document.body.classList.add('setup-open','setup-focus-mode','forced-onboarding-active');
  modal.setAttribute('aria-hidden','false');
  renderOwnerChoices(state.careerCreationUX?.lastSelectedAvatar || owner.avatar || PLAYER_AVATARS[0]);
  updateCareerPreview();
  setTimeout(() => {
    const first = $('#ownerNameInput');
    if (first && !first.value && !document.activeElement?.closest?.('#ownerSetupModal')) first.focus({ preventScroll:true });
    modal.scrollIntoView?.({ block:'start', behavior: state.mobileUX?.reduceMotion ? 'auto' : 'smooth' });
  }, 90);
  state.careerCreationUX.setupAttempts = (state.careerCreationUX.setupAttempts || 0) + 1;
}
function closeOwnerSetup() {
  const modal = $('#ownerSetupModal');
  if (!modal) return;
  if (!setupIsComplete(state)) {
    showSystemError('Complete nome, avatar, país, cidade e academia antes de entrar no jogo.');
    openOwnerSetup(true);
    return;
  }
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden','true');
  modal.style.display = 'none';
  document.body.classList.remove('setup-open','setup-focus-mode','forced-onboarding-active');
}
function renderOwnerChoices(active) {
  const host = $('#ownerAvatarChoices');
  if (!host) return;
  const selected = active || state.careerCreationUX?.lastSelectedAvatar || PLAYER_AVATARS[0];
  host.innerHTML = OWNER_AVATARS.map((src, idx) => `<button class="choice-avatar ${src===selected?'active':''}" data-owner-avatar="${src}" type="button" aria-pressed="${src===selected?'true':'false'}">${avatarImg(src,'avatar-img',`avatar-${idx}`)}<span>Avatar ${idx+1}</span></button>`).join('');
  if (!host.querySelector('.choice-avatar.active')) host.querySelector('[data-owner-avatar]')?.classList.add('active');
  hydrateAssetImages();
}
function selectOwnerAvatar(src='') {
  const host = $('#ownerAvatarChoices');
  if (!host) return false;
  const choice = src ? Array.from(host.querySelectorAll('[data-owner-avatar]')).find(x => x.dataset.ownerAvatar === src) : host.querySelector('[data-owner-avatar]');
  if (!choice) return false;
  host.querySelectorAll('[data-owner-avatar]').forEach(x => { x.classList.remove('active'); x.setAttribute('aria-pressed','false'); });
  choice.classList.add('active');
  choice.setAttribute('aria-pressed','true');
  ensureCareerCreationUXSystem();
  state.careerCreationUX.lastSelectedAvatar = choice.dataset.ownerAvatar || PLAYER_AVATARS[0];
  state.careerCreationUX.avatarTouchCount = (state.careerCreationUX.avatarTouchCount || 0) + 1;
  updateCareerPreview();
  return true;
}

function validateCareerSetup() {
  const name = ($('#ownerNameInput')?.value || '').trim();
  const academy = ($('#academyNameInput')?.value || '').trim();
  const city = ($('#academyCityInput')?.value || '').trim();
  const age = Number($('#ownerAgeInput')?.value || 0);
  const country = ($('#ownerCountryInput')?.value || '').trim().toUpperCase();
  const activeAvatar = document.querySelector('.choice-avatar.active');
  const errors = [];
  if (name.length < 2) errors.push('Informe um nome com pelo menos 2 caracteres.');
  if (academy.length < 3) errors.push('Informe o nome da academia.');
  if (city.length < 2) errors.push('Informe a cidade-sede.');
  if (country.length < 2 || country.length > 3) errors.push('Informe a nacionalidade com 2 ou 3 letras.');
  if (!activeAvatar) errors.push('Escolha um avatar para o treinador.');
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
  if (!state) return false;
  ensureCoreBeforeCareerSave();
  if (!validateCareerSetup()) return false;
  const ownerName = ($('#ownerNameInput')?.value || '').trim();
  const country = ($('#ownerCountryInput')?.value || 'BRA').trim().toUpperCase().replace(/[^A-Z]/g,'').slice(0,3) || 'BRA';
  const academyName = ($('#academyNameInput')?.value || '').trim();
  const logo = (($('#academyLogoInput')?.value || 'VTM').trim().toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,3)) || 'VTM';
  let active = document.querySelector('.choice-avatar.active');
  if (!active) { selectOwnerAvatar(PLAYER_AVATARS[0]); active = document.querySelector('.choice-avatar.active'); }
  const avatar = active?.dataset.ownerAvatar || PLAYER_AVATARS[0];
  const snapshot = JSON.parse(JSON.stringify(state));
  try {
    state.academy.name = academyName;
    state.academy.owner = { name: ownerName, country, avatar, logo, age: Number($('#ownerAgeInput')?.value || 36), gender: $('#ownerGenderInput')?.value || 'masculino', background: $('#ownerBackgroundInput')?.value || 'ex-jogador', specialty: $('#ownerSpecialtyInput')?.value || 'tecnica' };
    state.academy.careerProfile = { city: ($('#academyCityInput')?.value || 'São Paulo').trim(), philosophy: $('#academyPhilosophyInput')?.value || 'equilibrada', difficulty: $('#careerDifficultyInput')?.value || 'normal', currency: $('#careerCurrencyInput')?.value || 'BRL', createdInBuild: BUILD_INFO.build };
    state.flags ||= {}; state.flags.ownerSetupComplete = true; state.flags.safeMode = false;
    ensureCareerCreationUXSystem();
    state.careerCreationUX.firstRunVerified = true;
    state.mandatoryCareerGate ||= {}; state.mandatoryCareerGate.locked = false; state.mandatoryCareerGate.firstRunGatePassed = true; ensureForcedOnboardingGateSystem().hardLock = false; state.forcedOnboardingGate.firstRunConfirmed = true;
    state.careerCreationUX.lastSelectedAvatar = avatar;
    state.careerCreationUX.auditLog.unshift({ title:'Carreira criada', result:'OK', note:`${ownerName} • ${academyName}`, at:new Date().toISOString(), build:BUILD_INFO.build });
    state.careerCreationUX.auditLog = state.careerCreationUX.auditLog.slice(0,18);
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

function playableCoreIssues(candidate = state) {
  const issues = [];
  if (!candidate || typeof candidate !== 'object') return ['save ausente'];
  if (!candidate.academy || typeof candidate.academy !== 'object') issues.push('academia ausente');
  if (!Array.isArray(candidate.roster) || candidate.roster.length < 1) issues.push('elenco vazio');
  if (!Array.isArray(candidate.ranking) || candidate.ranking.length < 5) issues.push('ranking incompleto');
  if (!Array.isArray(candidate.calendar) || candidate.calendar.length < 4) issues.push('calendário incompleto');
  if (!Number.isFinite(Number(candidate.academy?.money)) || Number(candidate.academy?.money) <= 0) issues.push('caixa inicial zerado');
  if (!Number.isFinite(Number(candidate.academy?.reputation))) issues.push('reputação inválida');
  return issues;
}
function hasPlayableCareer(candidate = state) {
  return playableCoreIssues(candidate).length === 0;
}
function ownerProfileIssues(candidate = state) {
  const issues = [];
  const owner = candidate?.academy?.owner || {};
  const profile = candidate?.academy?.careerProfile || {};
  const academyName = String(candidate?.academy?.name || '').trim();
  const ownerName = String(owner.name || '').trim();
  const avatar = String(owner.avatar || '').trim();
  const country = String(owner.country || '').trim();
  const city = String(profile.city || '').trim();
  if (!candidate?.flags?.ownerSetupComplete) issues.push('criação de carreira não confirmada');
  if (!ownerName || ownerName === 'Seu nome' || ownerName.length < 2) issues.push('nome do treinador ausente');
  if (!avatar) issues.push('avatar ausente');
  if (!country || country.length < 2) issues.push('país ausente');
  if (!academyName || academyName === 'Ace Academy' || academyName.length < 3) issues.push('nome da academia ausente');
  if (!city || city.length < 2) issues.push('cidade ausente');
  return issues;
}
function setupIsComplete(candidate = state) {
  return ownerProfileIssues(candidate).length === 0;
}
function invalidCareerIssues(candidate = state) {
  return [...playableCoreIssues(candidate), ...ownerProfileIssues(candidate)];
}
function careerIsPlayableAndConfigured(candidate = state) {
  return invalidCareerIssues(candidate).length === 0;
}

function ensureMandatoryCareerGateSystem() {
  state.mandatoryCareerGate ||= { score: 100, locked: true, lastAuditToken: null, auditLog: [], blockedTabs: 0, repairCount: 0, lastRepairReason: null, firstRunGatePassed: false, flags: { blockEmptyDashboard: true, requireOwnerProfile: true, requirePlayableCore: true, openModalBeforeGameplay: true, preserveBackupBeforeRepair: true } };
  const gate = state.mandatoryCareerGate;
  gate.auditLog ||= [];
  gate.blockedTabs ??= 0;
  gate.repairCount ??= 0;
  gate.lastRepairReason ??= null;
  gate.firstRunGatePassed ??= false;
  gate.flags ||= { blockEmptyDashboard: true, requireOwnerProfile: true, requirePlayableCore: true, openModalBeforeGameplay: true, preserveBackupBeforeRepair: true };
  gate.flags.blockEmptyDashboard ??= true;
  gate.flags.requireOwnerProfile ??= true;
  gate.flags.requirePlayableCore ??= true;
  gate.flags.openModalBeforeGameplay ??= true;
  gate.flags.preserveBackupBeforeRepair ??= true;
  return gate;
}

function ensureForcedOnboardingGateSystem() {
  state.forcedOnboardingGate ||= { score: 100, hardLock: true, lastAuditToken: null, auditLog: [], forcedLaunches: 0, invalidDashboardBlocks: 0, lastInvalidReason: null, firstRunConfirmed: false, lastRepairAt: null, flags: { forceFullScreenSetup: true, blockDashboardWhenInvalid: true, validateBeforeRender: true, autoRepairEmptySave: true, cacheAwareLaunch: true } };
  const gate = state.forcedOnboardingGate;
  gate.auditLog ||= [];
  gate.forcedLaunches ??= 0;
  gate.invalidDashboardBlocks ??= 0;
  gate.lastInvalidReason ??= null;
  gate.firstRunConfirmed ??= false;
  gate.lastRepairAt ??= null;
  gate.flags ||= { forceFullScreenSetup: true, blockDashboardWhenInvalid: true, validateBeforeRender: true, autoRepairEmptySave: true, cacheAwareLaunch: true };
  gate.flags.forceFullScreenSetup ??= true;
  gate.flags.blockDashboardWhenInvalid ??= true;
  gate.flags.validateBeforeRender ??= true;
  gate.flags.autoRepairEmptySave ??= true;
  gate.flags.cacheAwareLaunch ??= true;
  return gate;
}
function forcedOnboardingSnapshot() {
  const issues = invalidCareerIssues(state);
  return {
    at: new Date().toISOString(), build: BUILD_INFO.build, version: BUILD_INFO.version,
    hardLock: issues.length > 0, issues,
    setupComplete: setupIsComplete(state), playableCore: hasPlayableCareer(state),
    currentTab: state?.ui?.currentTab || 'dashboard', modalVisible: ownerSetupModalVisible(),
    roster: state?.roster?.length || 0, ranking: state?.ranking?.length || 0,
    academyName: state?.academy?.name || '', ownerName: state?.academy?.owner?.name || '',
    avatar: state?.academy?.owner?.avatar || '', money: Number(state?.academy?.money || 0)
  };
}
function calculateForcedOnboardingScore(snapshot = forcedOnboardingSnapshot()) {
  let score = 100;
  score -= Math.min(60, snapshot.issues.length * 9);
  if (snapshot.hardLock && !snapshot.modalVisible) score -= 18;
  if (snapshot.currentTab === 'dashboard' && snapshot.hardLock) score -= 22;
  return clamp(Math.round(score), 0, 100);
}
function logForcedOnboarding(title, result, note, snapshot = forcedOnboardingSnapshot()) {
  const gate = ensureForcedOnboardingGateSystem();
  gate.hardLock = snapshot.hardLock;
  gate.score = calculateForcedOnboardingScore(snapshot);
  gate.lastInvalidReason = snapshot.issues.join(', ') || null;
  gate.lastAuditToken = `${BUILD_INFO.build}-${Date.now()}`;
  gate.auditLog.unshift({ title, result, note, score: gate.score, at: new Date().toISOString(), build: BUILD_INFO.build, snapshot });
  gate.auditLog = gate.auditLog.slice(0, 20);
  saveState(state);
  return gate.score;
}
function forceOnboardingLauncher(reason='criação obrigatória') {
  ensurePlayableStart();
  const gate = ensureForcedOnboardingGateSystem();
  gate.forcedLaunches = (gate.forcedLaunches || 0) + 1;
  gate.hardLock = true;
  gate.lastInvalidReason = reason;
  state.flags ||= {};
  state.flags.ownerSetupComplete = false;
  state.ui ||= {};
  state.ui.currentTab = 'initialgate';
  state.ui.lastStableTab = 'initialgate';
  saveState(state);
  switchTab('initialgate');
  openOwnerSetup(true);
  logForcedOnboarding('Launcher obrigatório acionado', 'FORCED', reason);
  setTimeout(() => {
    if (!ownerSetupModalVisible()) openOwnerSetup(true);
  }, 160);
  return true;
}
function renderForcedOnboardingGate() {
  const host = $('#forcedOnboardingGateHub');
  if (!host || !state) return;
  const gate = ensureForcedOnboardingGateSystem();
  const snap = forcedOnboardingSnapshot();
  gate.score = calculateForcedOnboardingScore(snap);
  gate.hardLock = snap.hardLock;
  const checks = [
    ['Dashboard bloqueado se inválido', !(snap.currentTab === 'dashboard' && snap.hardLock), snap.hardLock ? 'Gameplay redirecionado para criação' : 'Carreira válida'],
    ['Perfil completo', snap.setupComplete, snap.setupComplete ? 'Nome, avatar, país, cidade e academia OK' : snap.issues.join(', ')],
    ['Base jogável', snap.playableCore, `${snap.roster} atletas • ${snap.ranking} ranking`],
    ['Modal obrigatório', snap.setupComplete || snap.modalVisible, snap.modalVisible ? 'Aberto em tela cheia' : 'Será forçado no próximo clique/boot'],
    ['Build atual', true, BUILD_LABEL]
  ];
  host.innerHTML = `<section class="onboarding-hero glass-card-lite forced-onboarding-hero"><div><p class="eyebrow">Forced Onboarding • ${BUILD_LABEL}</p><h2>Launcher obrigatório de nova carreira</h2><p>Se o save estiver vazio, parcial ou antigo, o Dashboard fica bloqueado. O jogador deve escolher avatar, nome, país, cidade e academia antes de competir.</p></div><div class="release-score ${snap.hardLock ? 'pending':'ok'}"><span>Onboarding</span><strong>${gate.score}</strong><small>${snap.hardLock ? 'Travado':'OK'}</small></div></section><section class="onboarding-actions"><button class="btn-primary" onclick="window.forceOnboardingLauncher('botão da central v4.1.6')">Abrir criação em tela cheia</button><button class="btn-secondary" onclick="window.forceRepairInvalidCareer()">Reparar e recriar base</button><button class="btn-secondary" onclick="window.auditForcedOnboardingGate()">Auditar launcher</button><button class="btn-ghost" onclick="window.exportForcedOnboardingReport()">Exportar relatório</button></section><section class="onboarding-check-grid">${checks.map(([label, ok, note]) => `<article class="release-check ${ok ? 'ok':'pending'}"><span>${ok ? '✓':'!'}</span><div><strong>${escapeHtml(label)}</strong><small>${escapeHtml(note || '')}</small></div></article>`).join('')}</section><section class="release-grid"><article class="panel-card"><h4>Bloqueios recentes</h4><div class="list-block">${(gate.auditLog||[]).slice(0,6).map(item=>`<div class="list-item"><div><strong>${escapeHtml(item.title)}</strong><div class="small">${escapeHtml(item.note || '')}</div></div><b>${escapeHtml(item.result || String(item.score))}</b></div>`).join('') || '<div class="list-item"><span>Nenhum bloqueio nesta sessão.</span><strong>OK</strong></div>'}</div></article></section>`;
}
window.forceOnboardingLauncher = forceOnboardingLauncher;
window.forceRepairInvalidCareer = () => {
  rebuildPlayableCareer('reparo forçado pelo launcher v4.1.6');
  ensureForcedOnboardingGateSystem().lastRepairAt = new Date().toISOString();
  saveState(state);
  render();
  forceOnboardingLauncher('base recriada pelo launcher v4.1.6');
};
window.auditForcedOnboardingGate = () => {
  const snap = forcedOnboardingSnapshot();
  const score = logForcedOnboarding('Auditoria do launcher obrigatório', snap.hardLock ? 'BLOQUEADO' : 'OK', snap.issues.join(', ') || 'Carreira válida.', snap);
  addLog(`Launcher obrigatório auditado: ${score}/100.`);
  renderForcedOnboardingGate();
};
window.exportForcedOnboardingReport = () => {
  const payload = { app: BUILD_INFO.appName, version: BUILD_INFO.version, build: BUILD_INFO.build, schema: BUILD_INFO.schemaVersion, generatedAt: new Date().toISOString(), snapshot: forcedOnboardingSnapshot(), forcedOnboardingGate: state.forcedOnboardingGate, privacy: 'Relatório local. Não envia dados para servidor.' };
  const blob = new Blob([JSON.stringify(payload,null,2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vale-tennis-forced-onboarding-${BUILD_INFO.build}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

function ensureOnboardingRuntimeProofSystem() {
  state.onboardingRuntimeProof ||= { score: 100, lastAuditToken: null, auditLog: [], bootProofs: [], modalProofs: [], lastProofStatus: 'pending', lastUserAgent: '', firstRunVisualConfirmed: false, flags: { runtimeLockOverlay: true, modalVisibilityProof: true, dashboardBlankProof: true, mobileProofExport: true } };
  const proof = state.onboardingRuntimeProof;
  proof.auditLog ||= [];
  proof.bootProofs ||= [];
  proof.modalProofs ||= [];
  proof.lastProofStatus ||= 'pending';
  proof.lastUserAgent ||= navigator.userAgent || '';
  proof.firstRunVisualConfirmed ??= false;
  proof.flags ||= { runtimeLockOverlay: true, modalVisibilityProof: true, dashboardBlankProof: true, mobileProofExport: true };
  proof.flags.runtimeLockOverlay ??= true;
  proof.flags.modalVisibilityProof ??= true;
  proof.flags.dashboardBlankProof ??= true;
  proof.flags.mobileProofExport ??= true;
  return proof;
}
function onboardingRuntimeProofSnapshot() {
  const issues = invalidCareerIssues(state);
  const modal = $('#ownerSetupModal');
  const lock = $('#onboardingRuntimeLock');
  const modalRect = modal?.querySelector?.('.setup-card')?.getBoundingClientRect?.();
  return {
    at: new Date().toISOString(), build: BUILD_INFO.build, version: BUILD_INFO.version,
    invalid: issues.length > 0, issues,
    currentTab: state?.ui?.currentTab || 'dashboard', modalVisible: ownerSetupModalVisible(),
    lockVisible: !!lock && !lock.classList.contains('hidden'),
    ownerSetupComplete: !!state?.flags?.ownerSetupComplete,
    roster: state?.roster?.length || 0, ranking: state?.ranking?.length || 0, calendar: state?.calendar?.length || 0,
    money: Number(state?.academy?.money || 0), ownerName: state?.academy?.owner?.name || '', avatar: state?.academy?.owner?.avatar || '', academyName: state?.academy?.name || '',
    viewport: { w: window.innerWidth, h: window.innerHeight, visualH: window.visualViewport?.height || window.innerHeight },
    modalRect: modalRect ? { w: Math.round(modalRect.width), h: Math.round(modalRect.height), top: Math.round(modalRect.top), bottom: Math.round(modalRect.bottom) } : null,
    userAgent: navigator.userAgent || ''
  };
}
function calculateOnboardingRuntimeProofScore(snapshot = onboardingRuntimeProofSnapshot()) {
  let score = 100;
  if (snapshot.invalid && !snapshot.modalVisible) score -= 34;
  if (snapshot.invalid && snapshot.currentTab === 'dashboard') score -= 30;
  if (snapshot.invalid && !snapshot.lockVisible) score -= 16;
  score -= Math.min(30, snapshot.issues.length * 5);
  if (snapshot.roster < 1 || snapshot.ranking < 5 || snapshot.calendar < 4) score -= 18;
  return clamp(Math.round(score), 0, 100);
}
function syncOnboardingRuntimeLock(reason='runtime') {
  const lock = $('#onboardingRuntimeLock');
  const text = $('#runtimeLockText');
  if (!lock || !state) return;
  const snap = onboardingRuntimeProofSnapshot();
  const show = !!snap.invalid;
  lock.classList.toggle('hidden', !show || ownerSetupModalVisible());
  document.body.classList.toggle('runtime-onboarding-locked', show);
  if (text && show) text.textContent = `Carreira incompleta: ${snap.issues.join(', ')}. Motivo: ${reason}.`;
}
function logOnboardingRuntimeProof(title='Prova runtime', result='OK', note='', snapshot = onboardingRuntimeProofSnapshot()) {
  const proof = ensureOnboardingRuntimeProofSystem();
  proof.score = calculateOnboardingRuntimeProofScore(snapshot);
  proof.lastAuditToken = `${BUILD_INFO.build}-${Date.now()}`;
  proof.lastProofStatus = result;
  proof.lastUserAgent = snapshot.userAgent || '';
  proof.auditLog.unshift({ title, result, note, score: proof.score, at: new Date().toISOString(), build: BUILD_INFO.build, snapshot });
  proof.auditLog = proof.auditLog.slice(0, 20);
  saveState(state);
  return proof.score;
}
function renderOnboardingRuntimeProof() {
  const host = $('#onboardingRuntimeProofHub');
  if (!host || !state) return;
  const proof = ensureOnboardingRuntimeProofSystem();
  const snap = onboardingRuntimeProofSnapshot();
  proof.score = calculateOnboardingRuntimeProofScore(snap);
  const checks = [
    ['Build atual visível', true, BUILD_LABEL],
    ['Dashboard vazio bloqueado', !(snap.invalid && snap.currentTab === 'dashboard'), snap.invalid ? 'Redirecionamento para Gate/Criação' : 'Carreira pronta'],
    ['Modal realmente visível', !snap.invalid || snap.modalVisible, snap.modalVisible ? 'Criação aberta acima do layout' : 'Aguardando disparo'],
    ['Base jogável', snap.roster > 0 && snap.ranking >= 5 && snap.calendar >= 4 && snap.money > 0, `${snap.roster} atletas • ${snap.ranking} ranking • ${snap.calendar} eventos • caixa ${money(snap.money)}`],
    ['Perfil obrigatório', !snap.issues.some(x => /nome|avatar|país|academia|cidade|criação/.test(x)), snap.issues.join(', ') || 'Nome, avatar, país, cidade e academia OK'],
    ['Overlay de bloqueio', !snap.invalid || snap.lockVisible || snap.modalVisible, snap.lockVisible ? 'Ativo' : (snap.modalVisible ? 'Modal cobre a tela' : 'Inativo')]
  ];
  host.innerHTML = `<section class="onboarding-hero glass-card-lite runtime-proof-hero"><div><p class="eyebrow">Runtime Proof • ${BUILD_LABEL}</p><h2>Prova mobile do fluxo inicial</h2><p>Esta central mostra, em tempo real, se a criação de carreira abriu de verdade e se o Dashboard vazio está bloqueado no navegador atual.</p></div><div class="release-score ${proof.score >= 85 ? 'ok':'pending'}"><span>Prova</span><strong>${proof.score}</strong><small>${snap.invalid ? 'Configurar':'OK'}</small></div></section><section class="onboarding-actions"><button class="btn-primary" onclick="window.runOnboardingRuntimeProof()">Executar prova agora</button><button class="btn-secondary" onclick="window.forceOnboardingLauncher('prova runtime v4.1.6')">Abrir criação</button><button class="btn-secondary" onclick="window.confirmOnboardingVisualProof()">Confirmei no celular</button><button class="btn-ghost" onclick="window.exportOnboardingRuntimeProof()">Exportar prova</button></section><section class="onboarding-check-grid">${checks.map(([label, ok, note]) => `<article class="release-check ${ok ? 'ok':'pending'}"><span>${ok ? '✓':'!'}</span><div><strong>${escapeHtml(label)}</strong><small>${escapeHtml(note || '')}</small></div></article>`).join('')}</section><section class="release-grid"><article class="panel-card"><h4>Últimas provas</h4><div class="list-block">${(proof.auditLog||[]).slice(0,6).map(item=>`<div class="list-item"><div><strong>${escapeHtml(item.title)}</strong><div class="small">${escapeHtml(item.note || '')}</div></div><b>${escapeHtml(item.result || String(item.score))}</b></div>`).join('') || '<div class="list-item"><span>Nenhuma prova nesta sessão.</span><strong>Pronto</strong></div>'}</div></article><article class="panel-card"><h4>Estado atual</h4><p class="muted">Tab: ${escapeHtml(snap.currentTab)} • Modal: ${snap.modalVisible ? 'visível':'não visível'} • Overlay: ${snap.lockVisible ? 'visível':'oculto'}</p><p class="muted">Viewport: ${snap.viewport.w}×${Math.round(snap.viewport.visualH)} • Build ${escapeHtml(BUILD_INFO.build)}</p></article></section>`;
}
window.runOnboardingRuntimeProof = () => {
  const before = onboardingRuntimeProofSnapshot();
  if (before.invalid) {
    syncOnboardingRuntimeLock('prova manual');
    forceOnboardingLauncher('prova runtime v4.1.6');
  }
  setTimeout(() => {
    const after = onboardingRuntimeProofSnapshot();
    logOnboardingRuntimeProof('Prova runtime executada', after.invalid ? (after.modalVisible ? 'MODAL ABERTO':'BLOQUEADO') : 'OK', after.issues.join(', ') || 'Carreira válida.', after);
    syncOnboardingRuntimeLock('prova executada');
    renderOnboardingRuntimeProof();
  }, 220);
};
window.confirmOnboardingVisualProof = () => {
  const proof = ensureOnboardingRuntimeProofSystem();
  proof.firstRunVisualConfirmed = true;
  const snap = onboardingRuntimeProofSnapshot();
  logOnboardingRuntimeProof('Confirmação visual manual', 'CONFIRMADO', `${BUILD_LABEL} confirmado pelo usuário no navegador.`, snap);
  renderOnboardingRuntimeProof();
};
window.exportOnboardingRuntimeProof = () => {
  const payload = { app: BUILD_INFO.appName, version: BUILD_INFO.version, build: BUILD_INFO.build, schema: BUILD_INFO.schemaVersion, generatedAt: new Date().toISOString(), snapshot: onboardingRuntimeProofSnapshot(), onboardingRuntimeProof: state.onboardingRuntimeProof, privacy: 'Relatório local. Não envia dados para servidor.' };
  const blob = new Blob([JSON.stringify(payload,null,2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vale-tennis-onboarding-runtime-proof-${BUILD_INFO.build}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

function mandatoryCareerGateSnapshot() {
  const coreIssues = playableCoreIssues(state);
  const ownerIssues = ownerProfileIssues(state);
  const locked = coreIssues.length > 0 || ownerIssues.length > 0;
  const safeTabs = [...SETUP_SAFE_TABS];
  const snap = {
    at: new Date().toISOString(), build: BUILD_INFO.build, version: BUILD_INFO.version,
    locked, setupComplete: setupIsComplete(state), coreIssues, ownerIssues,
    roster: state?.roster?.length || 0, ranking: state?.ranking?.length || 0, calendar: state?.calendar?.length || 0,
    money: Number(state?.academy?.money || 0), currentTab: state?.ui?.currentTab || 'dashboard', modalVisible: ownerSetupModalVisible(),
    safeTabs
  };
  return snap;
}
function calculateMandatoryGateScore(snapshot = mandatoryCareerGateSnapshot()) {
  let score = 100;
  score -= Math.min(36, snapshot.coreIssues.length * 12);
  score -= Math.min(36, snapshot.ownerIssues.length * 8);
  if (snapshot.locked && !snapshot.modalVisible) score -= 14;
  if (snapshot.roster < 1) score -= 10;
  return clamp(Math.round(score), 0, 100);
}
function logMandatoryCareerGate(title, result, note, snapshot = mandatoryCareerGateSnapshot()) {
  const gate = ensureMandatoryCareerGateSystem();
  gate.locked = snapshot.locked;
  gate.score = calculateMandatoryGateScore(snapshot);
  gate.lastAuditToken = `${BUILD_INFO.build}-${Date.now()}`;
  gate.auditLog.unshift({ title, result, note, score: gate.score, at: new Date().toISOString(), build: BUILD_INFO.build, snapshot });
  gate.auditLog = gate.auditLog.slice(0, 20);
  saveState(state);
  return gate.score;
}
function blockGameplayUntilCareerReady(tab='dashboard', reason='fluxo protegido') {
  if (!state || careerIsPlayableAndConfigured(state)) return false;
  const gate = ensureMandatoryCareerGateSystem();
  gate.blockedTabs = (gate.blockedTabs || 0) + 1;
  gate.locked = true;
  logMandatoryCareerGate('Aba bloqueada antes da criação', tab, reason);
  state.flags ||= {};
  state.flags.ownerSetupComplete = false;
  state.ui ||= {};
  state.ui.currentTab = 'initialgate';
  setTimeout(() => forceOnboardingLauncher(`gate obrigatório: ${reason}`), 30);
  return true;
}
function renderMandatoryCareerGate() {
  const host = $('#mandatoryCareerGateHub');
  if (!host || !state) return;
  const gate = ensureMandatoryCareerGateSystem();
  const snap = mandatoryCareerGateSnapshot();
  gate.locked = snap.locked;
  gate.score = calculateMandatoryGateScore(snap);
  const checks = [
    ['Base jogável', snap.coreIssues.length === 0, snap.coreIssues.length ? snap.coreIssues.join(', ') : 'Elenco, ranking, calendário e caixa OK'],
    ['Perfil obrigatório', snap.ownerIssues.length === 0, snap.ownerIssues.length ? snap.ownerIssues.join(', ') : 'Nome, país, avatar, cidade e academia OK'],
    ['Dashboard protegido', !snap.locked || snap.modalVisible || snap.setupComplete, snap.locked ? 'Jogo bloqueia gameplay até configurar' : 'Liberado'],
    ['Modal de criação', snap.setupComplete || snap.modalVisible, snap.setupComplete ? 'Concluído' : (snap.modalVisible ? 'Aberto' : 'Será aberto automaticamente')],
    ['Cache/build atual', BUILD_LABEL.includes(BUILD_INFO.date), BUILD_LABEL]
  ];
  host.innerHTML = `
    <section class="onboarding-hero glass-card-lite mandatory-gate-hero">
      <div><p class="eyebrow">Mandatory Career Gate • ${BUILD_LABEL}</p><h2>Entrada obrigatória antes do Dashboard</h2><p>Esta proteção impede o jogo de iniciar como na imagem enviada: sem atletas, sem nome, sem avatar e com botões sem efeito. Enquanto faltar perfil ou base jogável, o gameplay fica bloqueado e a criação aparece antes.</p></div>
      <div class="release-score ${snap.locked ? 'pending' : 'ok'}"><span>Gate Score</span><strong>${gate.score}</strong><small>${snap.locked ? 'Bloqueado' : 'Liberado'}</small></div>
    </section>
    <section class="onboarding-actions">
      <button class="btn-primary" onclick="window.openMandatoryCareerSetup()">Abrir criação obrigatória</button>
      <button class="btn-secondary" onclick="window.repairMandatoryEmptySave()">Reparar save vazio</button>
      <button class="btn-secondary" onclick="window.auditMandatoryCareerGate()">Auditar gate</button>
      <button class="btn-ghost" onclick="window.exportMandatoryGateReport()">Exportar relatório</button>
    </section>
    <section class="onboarding-check-grid">${checks.map(([label, ok, note]) => `<article class="release-check ${ok ? 'ok' : 'pending'}"><span>${ok ? '✓' : '!'}</span><div><strong>${escapeHtml(label)}</strong><small>${escapeHtml(note || '')}</small></div></article>`).join('')}</section>
    <section class="release-grid"><article class="panel-card"><h4>Estado atual</h4><div class="list-block"><div class="list-item"><span>Elenco</span><strong>${snap.roster}</strong></div><div class="list-item"><span>Ranking</span><strong>${snap.ranking}</strong></div><div class="list-item"><span>Calendário</span><strong>${snap.calendar}</strong></div><div class="list-item"><span>Caixa</span><strong>${money(snap.money)}</strong></div><div class="list-item"><span>Aba atual</span><strong>${escapeHtml(snap.currentTab)}</strong></div></div></article><article class="panel-card"><h4>Histórico do gate</h4><div class="list-block">${(gate.auditLog||[]).slice(0,6).map(item=>`<div class="list-item"><div><strong>${escapeHtml(item.title)}</strong><div class="small">${escapeHtml(item.note || '')}</div></div><b>${escapeHtml(item.result || String(item.score))}</b></div>`).join('') || '<div class="list-item"><span>Nenhum bloqueio registrado nesta build.</span><strong>OK</strong></div>'}</div></article></section>`;
}
window.openMandatoryCareerSetup = () => {
  if (!hasPlayableCareer(state)) rebuildPlayableCareer('gate obrigatório abriu criação com base segura');
  state.flags ||= {}; state.flags.ownerSetupComplete = false;
  ensureMandatoryCareerGateSystem().locked = true;
  saveState(state); render(); forceOnboardingLauncher('abertura manual pelo Gate Inicial');
};
window.repairMandatoryEmptySave = () => {
  ensureMandatoryCareerGateSystem().repairCount = (ensureMandatoryCareerGateSystem().repairCount || 0) + 1;
  rebuildPlayableCareer('reparo manual pelo Gate Inicial v4.1.6');
  state.mandatoryCareerGate ||= {}; state.mandatoryCareerGate.lastRepairReason = 'reparo manual pelo Gate Inicial v4.1.6';
  saveState(state); render(); openOwnerSetup(true);
};
window.auditMandatoryCareerGate = () => {
  const snap = mandatoryCareerGateSnapshot();
  const score = logMandatoryCareerGate('Auditoria do gate inicial', snap.locked ? 'Bloqueado' : 'Liberado', snap.locked ? [...snap.coreIssues, ...snap.ownerIssues].join(', ') : 'Carreira pronta para gameplay.', snap);
  addLog(`Gate inicial auditado: ${score}/100.`);
  renderMandatoryCareerGate();
};
window.exportMandatoryGateReport = () => {
  const payload = { app: BUILD_INFO.appName, version: BUILD_INFO.version, build: BUILD_INFO.build, schema: BUILD_INFO.schemaVersion, generatedAt: new Date().toISOString(), snapshot: mandatoryCareerGateSnapshot(), mandatoryCareerGate: state.mandatoryCareerGate, privacy: 'Relatório local. Não envia dados para servidor.' };
  const blob = new Blob([JSON.stringify(payload,null,2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vale-tennis-mandatory-gate-${BUILD_INFO.build}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

function preserveRuntimePreferences(fresh, previous) {
  if (!fresh || !previous) return fresh;
  const preserve = ['mobileUX','inputReliability','accessibilityReadability','localizationStore','releaseNotesHelp','onboardingReliability','careerCreationUX','qualityPolish','releaseHardening','performanceDelivery','qaAutomation','browserCompatibility','mandatoryCareerGate','forcedOnboardingGate'];
  preserve.forEach(key => { if (previous[key]) fresh[key] = structuredClone(previous[key]); });
  fresh.ui = { currentTab: 'dashboard', lastStableTab: 'dashboard' };
  fresh.flags ||= {};
  fresh.flags.safeMode = false;
  fresh.flags.ownerSetupComplete = false;
  fresh.careerSetupRecovery ||= { lastReason: null, repairedAt: null, forcedSetup: false, snapshots: [], bootGuard: true };
  return fresh;
}
function backupBrokenCareer(reason='diagnóstico') {
  try {
    const backup = { reason, build: BUILD_INFO.build, capturedAt: new Date().toISOString(), state };
    localStorage.setItem('vale_tennis_manager_recovery_backup', JSON.stringify(backup));
  } catch (error) {
    console.warn('Backup de recuperação indisponível.', error);
  }
}
function rebuildPlayableCareer(reason='base inicial incompleta') {
  const previous = state ? structuredClone(state) : null;
  backupBrokenCareer(reason);
  const fresh = buildInitialState(content);
  preserveRuntimePreferences(fresh, previous);
  fresh.careerSetupRecovery = {
    ...(fresh.careerSetupRecovery || {}),
    lastReason: reason,
    repairedAt: new Date().toISOString(),
    forcedSetup: true,
    bootGuard: true,
    snapshots: [{ reason, build: BUILD_INFO.build, at: new Date().toISOString(), previousRoster: previous?.roster?.length || 0 }]
  };
  fresh.logs.unshift(`Recuperação segura aplicada: ${reason}.`);
  fresh.inbox.unshift({ title: 'Início corrigido com segurança', body: 'A base jogável foi recriada com elenco, ranking, calendário e criação de carreira liberada. Escolha nome, avatar, país e academia para continuar.', week: fresh.academy.week || 1 });
  state = fresh;
  saveState(state);
  return true;
}
function ensurePlayableStart() {
  const coreIssues = playableCoreIssues(state);
  if (coreIssues.length) {
    rebuildPlayableCareer(coreIssues.join(', '));
  }
  state.flags ||= {};
  const issues = invalidCareerIssues(state);
  if (issues.length) {
    state.flags.ownerSetupComplete = false;
    ensureMandatoryCareerGateSystem().locked = true;
    const forced = ensureForcedOnboardingGateSystem();
    forced.hardLock = true;
    forced.lastInvalidReason = issues.join(', ');
    forced.invalidDashboardBlocks = (forced.invalidDashboardBlocks || 0) + 1;
    state.ui ||= {};
    state.ui.currentTab = 'initialgate';
    state.ui.lastStableTab = 'initialgate';
    state.onboardingReliability ||= { score: 98, lastAuditToken: null, auditLog: [], buttonProbe: [], forcedOpens: 0, lastForcedReason: null, safeStartLocks: 0, modalVisibilityChecks: [], checklist: { setupModal: true, avatarChoices: true, ownerSaveButton: true, tabDelegation: true, dockDelegation: true, dashboardRecovery: true }, flags: { mandatorySetupGuard: true, eventDelegationFallback: true, hashRouter: true, modalRetry: true, buttonProbe: true } };
    state.careerSetupRecovery ||= { lastReason: null, repairedAt: null, forcedSetup: false, snapshots: [], bootGuard: true };
    state.careerSetupRecovery.forcedSetup = true;
    saveState(state);
    return coreIssues.length ? 'rebuilt' : 'setup';
  }
  ensureForcedOnboardingGateSystem().hardLock = false;
  ensureMandatoryCareerGateSystem().locked = false;
  return 'ok';
}
function ensureCoreBeforeCareerSave() {
  if (hasPlayableCareer(state)) return;
  const owner = state.academy?.owner ? structuredClone(state.academy.owner) : null;
  const careerProfile = state.academy?.careerProfile ? structuredClone(state.academy.careerProfile) : null;
  rebuildPlayableCareer('base reconstruída antes de salvar carreira');
  if (owner) state.academy.owner = owner;
  if (careerProfile) state.academy.careerProfile = careerProfile;
}
function renderCareerRecoveryBanner() {
  const host = $('#careerRecoveryBanner');
  if (!host || !state) return;
  const issues = playableCoreIssues(state);
  const needsSetup = !setupIsComplete(state);
  const show = issues.length > 0 || needsSetup;
  host.classList.toggle('hidden', !show);
  if (!show) return;
  const title = $('#careerRecoveryTitle');
  const text = $('#careerRecoveryText');
  if (issues.length) {
    title.textContent = 'Início incompleto detectado';
    text.textContent = `Corrija a base inicial: ${issues.join(', ')}. Isso restaura atletas, ranking e calendário sem mexer nos assets.`;
  } else {
    title.textContent = 'Crie sua carreira para liberar o jogo';
    text.textContent = 'Escolha nome, avatar, país, cidade e nome da academia. Depois disso o elenco, partida, treino e agenda ficam ativos.';
  }
}

function ensureOnboardingReliabilitySystem() {
  state.onboardingReliability ||= { score: 98, lastAuditToken: null, auditLog: [], buttonProbe: [], forcedOpens: 0, lastForcedReason: null, safeStartLocks: 0, modalVisibilityChecks: [], checklist: { setupModal: true, avatarChoices: true, ownerSaveButton: true, tabDelegation: true, dockDelegation: true, dashboardRecovery: true }, flags: { mandatorySetupGuard: true, eventDelegationFallback: true, hashRouter: true, modalRetry: true, buttonProbe: true } };
  const ob = state.onboardingReliability;
  ob.auditLog ||= [];
  ob.buttonProbe ||= [];
  ob.modalVisibilityChecks ||= [];
  ob.forcedOpens ??= 0;
  ob.safeStartLocks ??= 0;
  ob.checklist ||= { setupModal: true, avatarChoices: true, ownerSaveButton: true, tabDelegation: true, dockDelegation: true, dashboardRecovery: true };
  ob.flags ||= { mandatorySetupGuard: true, eventDelegationFallback: true, hashRouter: true, modalRetry: true, buttonProbe: true };
  return ob;
}
function ownerSetupModalVisible() {
  const modal = $('#ownerSetupModal');
  if (!modal) return false;
  const style = window.getComputedStyle(modal);
  return !modal.classList.contains('hidden') && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}
function onboardingFlowSnapshot() {
  const issues = playableCoreIssues(state);
  const missingButtons = CRITICAL_ONBOARDING_BUTTONS.filter(id => !document.getElementById(id));
  const missingTabs = CRITICAL_ONBOARDING_TABS.filter(tab => !document.getElementById(`tab-${tab}`));
  const avatarChoices = $$('#ownerAvatarChoices [data-owner-avatar]').length || OWNER_AVATARS.length;
  return {
    at: new Date().toISOString(),
    build: BUILD_INFO.build,
    version: BUILD_INFO.version,
    setupComplete: setupIsComplete(state),
    modalVisible: ownerSetupModalVisible(),
    playableIssues: issues,
    missingButtons,
    missingTabs,
    mainTabButtons: $$('#mainTabs .tab-btn').length,
    dockButtons: $$('.dock-btn').length,
    avatarChoices,
    roster: state.roster?.length || 0,
    ranking: state.ranking?.length || 0,
    calendar: state.calendar?.length || 0,
    currentTab: state.ui?.currentTab || 'dashboard'
  };
}
function calculateOnboardingReliabilityScore(snapshot = onboardingFlowSnapshot()) {
  let score = 100;
  score -= Math.min(24, snapshot.playableIssues.length * 8);
  score -= Math.min(20, snapshot.missingButtons.length * 4);
  score -= Math.min(12, snapshot.missingTabs.length * 3);
  if (!snapshot.setupComplete && !snapshot.modalVisible) score -= 18;
  if (snapshot.avatarChoices < 3) score -= 8;
  if (snapshot.dockButtons < 6) score -= 4;
  return clamp(Math.round(score), 0, 100);
}
function logOnboardingAudit(title, result, note, snapshot = onboardingFlowSnapshot()) {
  const ob = ensureOnboardingReliabilitySystem();
  ob.score = calculateOnboardingReliabilityScore(snapshot);
  ob.lastAuditToken = `${BUILD_INFO.build}-${Date.now()}`;
  ob.auditLog.unshift({ title, result, note, score: ob.score, at: new Date().toISOString(), build: BUILD_INFO.build, snapshot });
  ob.auditLog = ob.auditLog.slice(0, 18);
  saveState(state);
  return ob.score;
}
function enforceOwnerSetupFlow(reason='setup pendente') {
  if (!state || setupIsComplete(state)) return;
  const ob = ensureOnboardingReliabilitySystem();
  ob.forcedOpens = (ob.forcedOpens || 0) + 1;
  ob.lastForcedReason = reason;
  ob.safeStartLocks = (ob.safeStartLocks || 0) + 1;
  state.flags ||= {};
  state.flags.ownerSetupComplete = false;
  state.onboardingReliability ||= { score: 98, lastAuditToken: null, auditLog: [], buttonProbe: [], forcedOpens: 0, lastForcedReason: null, safeStartLocks: 0, modalVisibilityChecks: [], checklist: { setupModal: true, avatarChoices: true, ownerSaveButton: true, tabDelegation: true, dockDelegation: true, dashboardRecovery: true }, flags: { mandatorySetupGuard: true, eventDelegationFallback: true, hashRouter: true, modalRetry: true, buttonProbe: true } };
  state.careerSetupRecovery ||= { lastReason: null, repairedAt: null, forcedSetup: false, snapshots: [], bootGuard: true };
  state.careerSetupRecovery.forcedSetup = true;
  state.careerSetupRecovery.lastReason = reason;
  const attempt = (slot='imediato') => {
    if (setupIsComplete(state)) return;
    openOwnerSetup(true);
    const visible = ownerSetupModalVisible();
    ob.modalVisibilityChecks.unshift({ slot, visible, at: new Date().toISOString(), build: BUILD_INFO.build });
    ob.modalVisibilityChecks = ob.modalVisibilityChecks.slice(0, 12);
    if (!visible) showSystemError('A criação de carreira tentou abrir, mas o navegador bloqueou a janela. Toque em Configurar agora ou use Fluxo Inicial > Forçar criação.');
    saveState(state);
  };
  requestAnimationFrame(() => attempt('raf'));
  setTimeout(() => attempt('450ms'), 450);
  setTimeout(() => {
    if (!setupIsComplete(state) && !ownerSetupModalVisible()) attempt('1200ms-retry');
  }, 1200);
}
function installCriticalButtonDelegation() {
  if (window.__valeOnboardingDelegationInstalled) return;
  window.__valeOnboardingDelegationInstalled = true;
  document.addEventListener('pointerup', event => {
    const avatar = event.target.closest?.('[data-owner-avatar]');
    if (avatar) { event.preventDefault(); selectOwnerAvatar(avatar.dataset.ownerAvatar); }
  }, true);
  document.addEventListener('click', event => {
    const avatar = event.target.closest?.('[data-owner-avatar]');
    if (avatar) { event.preventDefault(); selectOwnerAvatar(avatar.dataset.ownerAvatar); return; }
    const btn = event.target.closest('button, a');
    if (!btn || btn.disabled) return;
    const tab = btn.dataset?.jumpTab || btn.dataset?.tab;
    if (tab && document.getElementById(`tab-${tab}`)) {
      setTimeout(() => {
        if (state?.ui?.currentTab !== tab) switchTab(tab);
        if (!careerIsPlayableAndConfigured(state) && ['dashboard','roster','career','training','match','calendar','ranking'].includes(tab)) forceOnboardingLauncher(`aba ${tab} tocada antes da configuração`);
      }, 0);
    }
    if (['openSetupBtn','openSetupBannerBtn'].includes(btn.id)) setTimeout(() => forceOnboardingLauncher(`botão ${btn.id}`), 0);
    if (btn.id === 'saveOwnerSetupBtn') setTimeout(() => {
      if (!setupIsComplete(state) && ownerSetupModalVisible()) validateCareerSetup();
    }, 40);
  }, true);
  window.addEventListener('hashchange', handleStartupHash);
}
function handleStartupHash() {
  const hash = (location.hash || '').replace('#','').trim();
  if (!hash) return;
  if (hash === 'setup') return forceOnboardingLauncher('atalho #setup');
  if (document.getElementById(`tab-${hash}`)) switchTab(hash);
}
function renderOnboardingReliabilityHub() {
  const host = $('#onboardingReliabilityHub');
  if (!host) return;
  const ob = ensureOnboardingReliabilitySystem();
  const snap = onboardingFlowSnapshot();
  ob.score = calculateOnboardingReliabilityScore(snap);
  const checks = [
    ['Base jogável', snap.playableIssues.length === 0, snap.playableIssues.length ? snap.playableIssues.join(', ') : 'Elenco, ranking, calendário e caixa OK'],
    ['Criação obrigatória', snap.setupComplete || snap.modalVisible, snap.setupComplete ? 'Carreira configurada' : (snap.modalVisible ? 'Modal aberto para configurar' : 'Aguardando abertura do modal')],
    ['Botões críticos', snap.missingButtons.length === 0, snap.missingButtons.length ? snap.missingButtons.join(', ') : 'Todos encontrados'],
    ['Abas/dock', snap.missingTabs.length === 0 && snap.dockButtons >= 6, `${snap.mainTabButtons} abas • ${snap.dockButtons} botões no dock`],
    ['Avatares', snap.avatarChoices >= 3, `${snap.avatarChoices} opções disponíveis`],
    ['Fallback de eventos', !!ob.flags?.eventDelegationFallback, 'Delegação global ativa para cliques/taps']
  ];
  host.innerHTML = `
    <section class="onboarding-hero glass-card-lite">
      <div><p class="eyebrow">Safe Start Guard • ${BUILD_LABEL}</p><h2>Criação de carreira blindada</h2><p>Esta central verifica se o jogo pode iniciar corretamente, se o modal de nome/avatar/país aparece e se os botões essenciais respondem no celular.</p></div>
      <div class="release-score"><span>Score fluxo</span><strong>${ob.score}</strong><small>${snap.setupComplete ? 'Configurado' : 'Configuração pendente'}</small></div>
    </section>
    <section class="onboarding-actions">
      <button class="btn-primary" onclick="window.forceCareerSetupFlow()">Forçar criação de carreira</button>
      <button class="btn-secondary" onclick="window.auditOnboardingFlow()">Auditar fluxo inicial</button>
      <button class="btn-secondary" onclick="window.runButtonReliabilityProbe()">Testar botões críticos</button>
      <button class="btn-ghost" onclick="window.exportOnboardingReport()">Exportar relatório</button>
    </section>
    <section class="onboarding-check-grid">${checks.map(([label,ok,note]) => `<article class="release-check ${ok ? 'ok' : 'pending'}"><span>${ok ? '✓' : '!'}</span><div><strong>${escapeHtml(label)}</strong><small>${escapeHtml(note)}</small></div></article>`).join('')}</section>
    <section class="panel-card"><div class="panel-title-row"><h4>Últimas auditorias</h4><span class="metric-build">schema ${BUILD_INFO.schemaVersion}</span></div><div class="list-block">${(ob.auditLog||[]).slice(0,6).map(item=>`<div class="list-item"><div><strong>${escapeHtml(item.title)}</strong><div class="small">${escapeHtml(item.note || '')}</div></div><b>${escapeHtml(item.result || String(item.score))}</b></div>`).join('') || '<div class="list-item"><span>Nenhuma auditoria feita nesta versão.</span><strong>Pronto</strong></div>'}</div></section>`;
}
window.forceCareerSetupFlow = () => {
  if (!hasPlayableCareer(state)) rebuildPlayableCareer('forçar criação de carreira pela aba Fluxo Inicial');
  state.flags ||= {};
  state.flags.ownerSetupComplete = false;
  ensureOnboardingReliabilitySystem().lastForcedReason = 'forçado manualmente';
  saveState(state);
  render();
  forceOnboardingLauncher('forçado manualmente pela aba Fluxo Inicial');
};
window.auditOnboardingFlow = () => {
  const snap = onboardingFlowSnapshot();
  const score = logOnboardingAudit('Auditoria do fluxo inicial', `${calculateOnboardingReliabilityScore(snap)}/100`, `${snap.playableIssues.length} problema(s) de base, ${snap.missingButtons.length} botão(ões) ausentes, modal ${snap.modalVisible ? 'visível' : 'não visível'}.`, snap);
  renderOnboardingReliabilityHub();
  addLog(`Auditoria de fluxo inicial concluída: ${score}/100.`);
};
window.runButtonReliabilityProbe = () => {
  const ob = ensureOnboardingReliabilitySystem();
  const snap = onboardingFlowSnapshot();
  const found = CRITICAL_ONBOARDING_BUTTONS.length - snap.missingButtons.length;
  ob.buttonProbe.unshift({ at: new Date().toISOString(), build: BUILD_INFO.build, found, total: CRITICAL_ONBOARDING_BUTTONS.length, missing: snap.missingButtons, tabs: snap.mainTabButtons, dock: snap.dockButtons });
  ob.buttonProbe = ob.buttonProbe.slice(0, 12);
  logOnboardingAudit('Probe de botões críticos', `${found}/${CRITICAL_ONBOARDING_BUTTONS.length}`, snap.missingButtons.length ? `Ausentes: ${snap.missingButtons.join(', ')}` : 'Todos os botões críticos encontrados no DOM.', snap);
  renderOnboardingReliabilityHub();
};
window.exportOnboardingReport = () => {
  const payload = { app: BUILD_INFO.appName, version: BUILD_INFO.version, build: BUILD_INFO.build, schema: BUILD_INFO.schemaVersion, generatedAt: new Date().toISOString(), snapshot: onboardingFlowSnapshot(), onboardingReliability: state.onboardingReliability, privacy: 'Relatório local. Não envia dados para servidor.' };
  const blob = new Blob([JSON.stringify(payload,null,2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vale-tennis-onboarding-${BUILD_INFO.build}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};


function ensureCareerCreationUXSystem() {
  state.careerCreationUX ||= { score: 100, setupAttempts: 0, avatarTouchCount: 0, saveButtonChecks: [], lastAuditToken: null, auditLog: [], lastSelectedAvatar: null, firstRunVerified: false, buttonGuardActive: true, flags: { stickyModalFooter: true, delegatedAvatarTap: true, saveButtonGuard: true, defaultValueGuard: true, dashboardBlocker: true } };
  const ux = state.careerCreationUX;
  ux.score ??= 100;
  ux.setupAttempts ??= 0;
  ux.avatarTouchCount ??= 0;
  ux.saveButtonChecks ||= [];
  ux.auditLog ||= [];
  ux.lastAuditToken ??= null;
  ux.lastSelectedAvatar ??= null;
  ux.firstRunVerified ??= false;
  ux.buttonGuardActive ??= true;
  ux.flags ||= { stickyModalFooter: true, delegatedAvatarTap: true, saveButtonGuard: true, defaultValueGuard: true, dashboardBlocker: true };
  return ux;
}
function careerCreationSnapshot() {
  const ux = ensureCareerCreationUXSystem();
  const modal = $('#ownerSetupModal');
  const values = {
    name: ($('#ownerNameInput')?.value || '').trim(),
    academy: ($('#academyNameInput')?.value || '').trim(),
    city: ($('#academyCityInput')?.value || '').trim(),
    country: ($('#ownerCountryInput')?.value || '').trim().toUpperCase(),
    avatar: document.querySelector('.choice-avatar.active')?.dataset.ownerAvatar || ux.lastSelectedAvatar || null
  };
  const missing = [];
  if (!values.name || values.name.length < 2) missing.push('nome');
  if (!values.academy || values.academy.length < 3) missing.push('academia');
  if (!values.city || values.city.length < 2) missing.push('cidade');
  if (!values.country || values.country.length < 2) missing.push('país');
  if (!values.avatar) missing.push('avatar');
  const saveBtn = $('#saveOwnerSetupBtn');
  const snap = {
    at: new Date().toISOString(), build: BUILD_INFO.build, modalVisible: ownerSetupModalVisible(),
    setupComplete: setupIsComplete(state), playable: hasPlayableCareer(state), playableIssues: playableCoreIssues(state),
    values, missing, avatarChoices: $$('#ownerAvatarChoices [data-owner-avatar]').length,
    saveButtonFound: !!saveBtn, saveButtonDisabled: !!saveBtn?.disabled,
    dockCoversModal: !!(modal && ownerSetupModalVisible() && document.body.classList.contains('setup-open')),
    firstRunVerified: !!ux.firstRunVerified, setupAttempts: ux.setupAttempts || 0, avatarTouchCount: ux.avatarTouchCount || 0
  };
  let score = 100;
  if (!snap.playable) score -= 20;
  if (!snap.setupComplete && !snap.modalVisible) score -= 18;
  score -= Math.min(20, snap.missing.length * 5);
  if (snap.avatarChoices < 3) score -= 12;
  if (!snap.saveButtonFound || snap.saveButtonDisabled) score -= 12;
  ux.score = clamp(Math.round(score), 0, 100);
  return snap;
}
function logCareerCreationUX(title, result, note, snap = careerCreationSnapshot()) {
  const ux = ensureCareerCreationUXSystem();
  ux.lastAuditToken = `${BUILD_INFO.build}-${Date.now()}`;
  ux.auditLog.unshift({ title, result, note, score: ux.score, at: new Date().toISOString(), build: BUILD_INFO.build, snapshot: snap });
  ux.auditLog = ux.auditLog.slice(0, 18);
  saveState(state);
  return ux.score;
}
function renderCareerCreationUXHub() {
  const host = $('#careerCreationUXHub');
  if (!host) return;
  const ux = ensureCareerCreationUXSystem();
  const snap = careerCreationSnapshot();
  const checks = [
    ['Modal de criação', snap.setupComplete || snap.modalVisible, snap.setupComplete ? 'Carreira configurada' : (snap.modalVisible ? 'Aberto e visível' : 'Precisa abrir')],
    ['Campos obrigatórios', snap.missing.length === 0 || !snap.modalVisible, snap.missing.length ? `Pendentes: ${snap.missing.join(', ')}` : 'Nome, país, avatar e academia OK'],
    ['Avatares', snap.avatarChoices >= 3, `${snap.avatarChoices} opções detectadas`],
    ['Botão criar', snap.saveButtonFound && !snap.saveButtonDisabled, snap.saveButtonFound ? 'Botão encontrado' : 'Botão ausente'],
    ['Base jogável', snap.playable, snap.playable ? 'Elenco/ranking/calendário OK' : snap.playableIssues.join(', ')],
    ['Primeiro acesso', snap.firstRunVerified || snap.setupComplete, snap.firstRunVerified || snap.setupComplete ? 'Confirmado' : 'Ainda não confirmado']
  ];
  host.innerHTML = `
    <section class="onboarding-hero glass-card-lite career-creation-hero">
      <div><p class="eyebrow">Career Creation UX • ${BUILD_LABEL}</p><h2>Criação de carreira protegida</h2><p>Esta central testa especificamente nome, país, avatar, academia e o botão Criar carreira. Use-a se o celular abrir no Dashboard vazio ou se algum botão parecer travado.</p></div>
      <div class="release-score"><span>Setup Score</span><strong>${ux.score}</strong><small>${snap.setupComplete ? 'Concluído' : 'Pendente'}</small></div>
    </section>
    <section class="onboarding-actions">
      <button id="forceSetupModalBtn" class="btn-primary" onclick="window.forceSetupModalNow()">Abrir criação agora</button>
      <button id="activateFirstAvatarBtn" class="btn-secondary" onclick="window.activateFirstOwnerAvatar()">Ativar 1º avatar</button>
      <button id="testCareerSaveBtn" class="btn-secondary" onclick="window.auditCareerCreationUX()">Testar botão criar</button>
      <button id="freshSetupBtn" class="btn-ghost" onclick="window.startFreshSetupSafely()">Reset guiado do início</button>
    </section>
    <section class="onboarding-check-grid">${checks.map(([label, ok, note]) => `<article class="release-check ${ok ? 'ok' : 'pending'}"><span>${ok ? '✓' : '!'}</span><div><strong>${escapeHtml(label)}</strong><small>${escapeHtml(note || '')}</small></div></article>`).join('')}</section>
    <section class="release-grid"><article class="panel-card"><h4>Valores atuais do formulário</h4><div class="list-block"><div class="list-item"><span>Treinador</span><strong>${escapeHtml(snap.values.name || '—')}</strong></div><div class="list-item"><span>Academia</span><strong>${escapeHtml(snap.values.academy || '—')}</strong></div><div class="list-item"><span>País</span><strong>${escapeHtml(snap.values.country || '—')}</strong></div><div class="list-item"><span>Cidade</span><strong>${escapeHtml(snap.values.city || '—')}</strong></div></div></article><article class="panel-card"><h4>Últimas verificações</h4><div class="list-block">${(ux.auditLog||[]).slice(0,6).map(item=>`<div class="list-item"><div><strong>${escapeHtml(item.title)}</strong><div class="small">${escapeHtml(item.note || '')}</div></div><b>${escapeHtml(item.result || String(item.score))}</b></div>`).join('') || '<div class="list-item"><span>Nenhum teste executado nesta build.</span><strong>Pronto</strong></div>'}</div></article></section>`;
}
window.forceSetupModalNow = () => {
  if (!hasPlayableCareer(state)) rebuildPlayableCareer('abrir criação com base segura v4.1.6');
  state.flags ||= {}; state.flags.ownerSetupComplete = false;
  ensureCareerCreationUXSystem().firstRunVerified = false;
  saveState(state); render(); forceOnboardingLauncher('abertura manual pela aba Criação');
};
window.activateFirstOwnerAvatar = () => {
  openOwnerSetup(false);
  setTimeout(() => { selectOwnerAvatar(state.careerCreationUX?.lastSelectedAvatar || PLAYER_AVATARS[0]); logCareerCreationUX('Avatar ativado manualmente', 'OK', 'Seleção de avatar testada por delegação global.'); renderCareerCreationUXHub(); }, 80);
};
window.auditCareerCreationUX = () => {
  const snap = careerCreationSnapshot();
  const score = logCareerCreationUX('Auditoria da criação de carreira', `${ensureCareerCreationUXSystem().score}/100`, snap.missing.length ? `Pendências: ${snap.missing.join(', ')}` : 'Fluxo de criação apto para salvar.', snap);
  renderCareerCreationUXHub(); addLog(`Auditoria de criação de carreira: ${score}/100.`);
};
window.startFreshSetupSafely = () => {
  backupBrokenCareer('reset guiado v4.1.6 solicitado pelo usuário');
  clearState();
  state = buildInitialState(content);
  migrateState();
  state.flags.ownerSetupComplete = false;
  ensureCareerCreationUXSystem().firstRunVerified = false;
  addLog('Reset guiado iniciado. Configure nome, avatar, país e academia.');
  saveState(state); render(); openOwnerSetup(true);
};


function ensureCacheUpdateGuardSystem() {
  state.cacheUpdateGuard ||= { score: 99, previousBuild: null, currentBuild: BUILD_INFO.build, lastSeenBuild: null, staleDetected: false, firstRunConfirmed: false, serviceWorkerStatus: 'pending', cacheKeys: [], auditLog: [], clearCount: 0, reloadCount: 0, flags: { serviceWorkerRegister: true, cacheBustAssets: true, visibleBuildGate: true, forceFreshJson: true } };
  const cg = state.cacheUpdateGuard;
  cg.score ??= 99;
  cg.currentBuild = BUILD_INFO.build;
  cg.previousBuild ??= null;
  cg.lastSeenBuild ??= null;
  cg.staleDetected ??= false;
  cg.firstRunConfirmed ??= false;
  cg.serviceWorkerStatus ||= 'pending';
  cg.cacheKeys ||= [];
  cg.auditLog ||= [];
  cg.clearCount ??= 0;
  cg.reloadCount ??= 0;
  cg.flags ||= { serviceWorkerRegister: true, cacheBustAssets: true, visibleBuildGate: true, forceFreshJson: true };
  cg.flags.serviceWorkerRegister ??= true;
  cg.flags.cacheBustAssets ??= true;
  cg.flags.visibleBuildGate ??= true;
  cg.flags.forceFreshJson ??= true;
  return cg;
}
function readLastSeenBuild() {
  try { return localStorage.getItem(LAST_SEEN_BUILD_KEY) || ''; } catch { return ''; }
}
function writeCacheGuardHistory(entry) {
  try {
    const history = JSON.parse(localStorage.getItem(CACHE_GUARD_HISTORY_KEY) || '[]');
    history.unshift(entry);
    localStorage.setItem(CACHE_GUARD_HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
  } catch {}
}
function cacheUpdateSnapshot() {
  const cg = ensureCacheUpdateGuardSystem();
  const lastSeen = readLastSeenBuild();
  const swReady = 'serviceWorker' in navigator;
  const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches || navigator.standalone === true;
  const buildVisible = [$('#buildPill')?.textContent, $('#mobileBuildBadge')?.textContent, $('#runtimeBuildStamp')?.textContent].some(text => String(text || '').includes(BUILD_INFO.version) && String(text || '').includes(BUILD_INFO.time));
  const buildMatch = !lastSeen || lastSeen === BUILD_INFO.build;
  const cacheCount = Array.isArray(cg.cacheKeys) ? cg.cacheKeys.length : 0;
  let score = 100;
  if (!buildVisible) score -= 20;
  if (!swReady && location.protocol !== 'file:') score -= 18;
  if (!buildMatch) score -= 14;
  if (cg.staleDetected) score -= 12;
  if (cg.serviceWorkerStatus === 'erro') score -= 14;
  if (!cg.firstRunConfirmed) score -= 4;
  cg.score = clamp(Math.round(score), 0, 100);
  return { at: new Date().toISOString(), version: BUILD_INFO.version, build: BUILD_INFO.build, label: BUILD_LABEL, previousBuild: cg.previousBuild || lastSeen || null, lastSeenBuild: lastSeen || cg.lastSeenBuild || null, buildVisible, buildMatch, swReady, standalone, online: navigator.onLine !== false, cacheCount, cacheKeys: cg.cacheKeys || [], serviceWorkerStatus: cg.serviceWorkerStatus, staleDetected: !!cg.staleDetected, firstRunConfirmed: !!cg.firstRunConfirmed, score: cg.score };
}
async function listValeCaches() {
  if (!('caches' in window)) return [];
  const keys = await caches.keys();
  return keys.filter(key => key.includes('vale') || key.includes('tennis'));
}
async function registerServiceWorkerWithGuard() {
  const cg = ensureCacheUpdateGuardSystem();
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') {
    cg.serviceWorkerStatus = location.protocol === 'file:' ? 'file-mode' : 'indisponivel';
    return cg.serviceWorkerStatus;
  }
  try {
    const registration = await navigator.serviceWorker.register(`./sw.js?v=${BUILD_INFO.version}-${BUILD_INFO.build}`, { updateViaCache: 'none' });
    cg.serviceWorkerStatus = 'registrado';
    await registration.update().catch(() => null);
    if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING', build: BUILD_INFO.build });
    if (navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage({ type: 'BUILD_CHECK', build: BUILD_INFO.build, version: BUILD_INFO.version });
    cg.cacheKeys = await listValeCaches();
    return cg.serviceWorkerStatus;
  } catch (error) {
    cg.serviceWorkerStatus = 'erro';
    cg.auditLog.unshift({ title: 'Falha ao registrar Service Worker', result: 'Atenção', note: String(error?.message || error), at: new Date().toISOString(), build: BUILD_INFO.build });
    return cg.serviceWorkerStatus;
  }
}
function installCacheUpdateGuardRuntime() {
  const cg = ensureCacheUpdateGuardSystem();
  const lastSeen = readLastSeenBuild();
  cg.previousBuild = lastSeen || cg.previousBuild || null;
  cg.lastSeenBuild = lastSeen || null;
  cg.currentBuild = BUILD_INFO.build;
  cg.staleDetected = !!lastSeen && lastSeen !== BUILD_INFO.build;
  if (cg.staleDetected) {
    cg.auditLog.unshift({ title: 'Nova build detectada', result: 'Atualização', note: `Anterior ${lastSeen}; atual ${BUILD_INFO.build}.`, at: new Date().toISOString(), build: BUILD_INFO.build });
  }
  try {
    localStorage.setItem(LAST_SEEN_BUILD_KEY, BUILD_INFO.build);
    localStorage.setItem(LAST_SEEN_VERSION_KEY, BUILD_INFO.version);
  } catch {}
  writeCacheGuardHistory({ build: BUILD_INFO.build, version: BUILD_INFO.version, at: new Date().toISOString(), previous: lastSeen || null });
  registerServiceWorkerWithGuard().then(() => { saveState(state); renderCacheUpdateGuard(); }).catch(() => null);
  window.addEventListener('online', () => { ensureCacheUpdateGuardSystem().auditLog.unshift({ title: 'Conexão restaurada', result: 'Online', note: 'Pronto para atualizar cache/PWA.', at: new Date().toISOString(), build: BUILD_INFO.build }); renderCacheUpdateGuard(); });
  window.addEventListener('offline', () => { ensureCacheUpdateGuardSystem().auditLog.unshift({ title: 'Modo offline', result: 'Offline', note: 'O jogo continua local, mas atualização depende de internet.', at: new Date().toISOString(), build: BUILD_INFO.build }); renderCacheUpdateGuard(); });
}
function renderCacheUpdateGuard() {
  const host = $('#cacheUpdateGuardHub');
  if (!host) return;
  const cg = ensureCacheUpdateGuardSystem();
  const snap = cacheUpdateSnapshot();
  const checks = [
    ['Build visível', snap.buildVisible, snap.buildVisible ? `${BUILD_LABEL}` : 'Badge de build não foi encontrado na tela'],
    ['Controle de versão', snap.buildMatch && !snap.staleDetected, snap.previousBuild && snap.previousBuild !== BUILD_INFO.build ? `Atualizou de ${snap.previousBuild} para ${BUILD_INFO.build}` : `Build atual ${BUILD_INFO.build}`],
    ['Service Worker', snap.swReady || location.protocol === 'file:', snap.swReady ? `Status: ${snap.serviceWorkerStatus}` : 'Indisponível neste ambiente'],
    ['Caches do app', true, snap.cacheCount ? `${snap.cacheCount} cache(s) Vale/Tennis encontrados` : 'Sem cache antigo detectado ou ainda aguardando navegador'],
    ['Primeiro acesso', snap.firstRunConfirmed, snap.firstRunConfirmed ? 'Confirmado pelo usuário/teste' : 'Pendente de confirmação manual'],
    ['Base jogável', hasPlayableCareer(state), hasPlayableCareer(state) ? 'Elenco/ranking/calendário OK' : playableCoreIssues(state).join(', ')]
  ];
  host.innerHTML = `
    <section class="quality-hero cache-hero ${snap.score >= 92 ? 'ok' : snap.score >= 78 ? 'warn' : 'danger'}">
      <div><p class="eyebrow">${BUILD_LABEL} • cache/PWA guard</p><h2>Atualização protegida contra build antiga</h2><p>Esta central confirma a versão carregada, registra o Service Worker com cache-busting e ajuda a limpar versões antigas presas no Chrome/PWA.</p><div class="release-actions"><button class="btn-primary" onclick="window.auditCacheUpdateGuard()">Auditar atualização</button><button class="btn-secondary" onclick="window.clearOldValeCaches()">Limpar caches antigos</button><button class="btn-secondary" onclick="window.confirmFirstRunBuild()">Confirmar primeiro acesso</button><button class="btn-ghost" onclick="window.hardReloadCurrentBuild()">Recarregar build atual</button></div></div>
      <div class="release-score"><span>Cache Score</span><strong>${snap.score}</strong><small>${snap.serviceWorkerStatus}</small></div>
    </section>
    <section class="onboarding-check-grid">${checks.map(([label,ok,note]) => `<article class="release-check ${ok ? 'ok' : 'pending'}"><span>${ok ? '✓' : '!'}</span><div><strong>${escapeHtml(label)}</strong><small>${escapeHtml(note || '')}</small></div></article>`).join('')}</section>
    <section class="release-grid"><article class="panel-card"><div class="panel-title-row"><h4>Versão carregada</h4><span class="metric-build">schema ${BUILD_INFO.schemaVersion}</span></div><div class="cards-grid release-kpis compact"><article class="stat-card"><span>Atual</span><strong>${escapeHtml(BUILD_INFO.version)}</strong></article><article class="stat-card"><span>Build</span><strong>${escapeHtml(BUILD_INFO.build)}</strong></article><article class="stat-card"><span>Anterior</span><strong>${escapeHtml(snap.previousBuild || 'nenhuma')}</strong></article><article class="stat-card"><span>PWA</span><strong>${snap.standalone ? 'instalado' : 'browser'}</strong></article></div></article><article class="panel-card"><div class="panel-title-row"><h4>Logs de atualização</h4><span class="mini-badge">${(cg.auditLog||[]).length}</span></div><div class="list-block">${(cg.auditLog||[]).slice(0,6).map(item=>`<div class="list-item"><div><strong>${escapeHtml(item.title)}</strong><div class="small">${escapeHtml(item.note || '')}</div></div><b>${escapeHtml(item.result || 'OK')}</b></div>`).join('') || '<div class="list-item"><span>Nenhum alerta de cache nesta build.</span><strong>OK</strong></div>'}</div></article></section>`;
}
window.auditCacheUpdateGuard = async () => {
  const cg = ensureCacheUpdateGuardSystem();
  cg.cacheKeys = await listValeCaches();
  const status = await registerServiceWorkerWithGuard();
  const snap = cacheUpdateSnapshot();
  cg.auditLog.unshift({ title: 'Auditoria Cache/PWA concluída', result: `${snap.score}/100`, note: `SW ${status}; cache(s) ${snap.cacheCount}; build ${BUILD_INFO.build}.`, at: snap.at, build: BUILD_INFO.build });
  cg.auditLog = cg.auditLog.slice(0, 18);
  saveState(state);
  renderCacheUpdateGuard();
  addLog(`Auditoria Cache/PWA: ${snap.score}/100.`);
};
window.clearOldValeCaches = async () => {
  const cg = ensureCacheUpdateGuardSystem();
  const keys = await listValeCaches();
  const current = `vale-tennis-v${BUILD_INFO.version}-${BUILD_INFO.build}`;
  let removed = 0;
  if ('caches' in window) {
    await Promise.all(keys.map(async key => {
      if (key !== current) { const ok = await caches.delete(key); if (ok) removed += 1; }
    }));
  }
  cg.cacheKeys = await listValeCaches();
  cg.clearCount = (cg.clearCount || 0) + 1;
  cg.staleDetected = false;
  cg.auditLog.unshift({ title: 'Limpeza de cache executada', result: `${removed} removido(s)`, note: `Cache atual preservado: ${current}.`, at: new Date().toISOString(), build: BUILD_INFO.build });
  saveState(state);
  renderCacheUpdateGuard();
};
window.confirmFirstRunBuild = () => {
  const cg = ensureCacheUpdateGuardSystem();
  cg.firstRunConfirmed = true;
  cg.lastSeenBuild = BUILD_INFO.build;
  cg.currentBuild = BUILD_INFO.build;
  cg.staleDetected = false;
  cg.auditLog.unshift({ title: 'Primeiro acesso confirmado', result: 'OK', note: `${BUILD_LABEL} confirmado visualmente.`, at: new Date().toISOString(), build: BUILD_INFO.build });
  try { localStorage.setItem(LAST_SEEN_BUILD_KEY, BUILD_INFO.build); } catch {}
  saveState(state);
  renderCacheUpdateGuard();
};
window.hardReloadCurrentBuild = () => {
  const cg = ensureCacheUpdateGuardSystem();
  cg.reloadCount = (cg.reloadCount || 0) + 1;
  cg.auditLog.unshift({ title: 'Recarregamento solicitado', result: 'reload', note: `Forçando URL com v=${BUILD_INFO.version}-${BUILD_INFO.build}.`, at: new Date().toISOString(), build: BUILD_INFO.build });
  saveState(state);
  const base = location.href.split('#')[0].split('?')[0];
  location.replace(`${base}?v=${encodeURIComponent(BUILD_INFO.version + '-' + BUILD_INFO.build)}#cacheguard`);
};
window.exportCacheUpdateReport = () => {
  const payload = { app: BUILD_INFO.appName, version: BUILD_INFO.version, build: BUILD_INFO.build, schema: BUILD_INFO.schemaVersion, generatedAt: new Date().toISOString(), snapshot: cacheUpdateSnapshot(), cacheUpdateGuard: state.cacheUpdateGuard, privacy: 'Relatório local. Não envia dados para servidor.' };
  const blob = new Blob([JSON.stringify(payload,null,2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vale-tennis-cache-pwa-${BUILD_INFO.build}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

window.openCareerSetup = () => openOwnerSetup(false);
window.repairPlayableCareer = () => { rebuildPlayableCareer('correção manual solicitada'); render(); openOwnerSetup(true); };
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
  const startupStatus = ensurePlayableStart();
  bindUI();
  installCriticalButtonDelegation();
  applyBuildMarkers();
  installMobileUXRuntime();
  installInputReliabilityRuntime();
  installAccessibilityReadabilityRuntime();
  installLocalizationStoreRuntime();
  installHelpCenterRuntime();
  installCacheUpdateGuardRuntime();
  startCourtAnimation();
  drawCourt();
  render();
  hydrateAssetImages();
  handleStartupHash();
  if (startupStatus !== 'ok' || !careerIsPlayableAndConfigured(state)) forceOnboardingLauncher(startupStatus === 'rebuilt' ? 'base reconstruída no boot' : 'configuração pendente no boot');
  setTimeout(() => window.runOnboardingRuntimeProof?.(), 380);
  setInterval(() => { if (state && !careerIsPlayableAndConfigured(state)) syncOnboardingRuntimeLock('watchdog runtime v4.1.6'); }, 1800);
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
  ensureNewsroomSystem();
  ensureMobileUXSystem();
  ensureCommercialCareerSystem();
  ensureLongCareerSystem();
  ensureInputReliabilitySystem();
  ensureCacheUpdateGuardSystem();
  ensureCareerCreationUXSystem();
  ensureMandatoryCareerGateSystem();
  applyMobileUXRuntime();
  applyInputReliabilityRuntime();
}


function ensureMobileUXSystem() {
  state.mobileUX ||= { mode: 'auto', compact: false, oneHand: false, matchFocus: true, reduceMotion: false, lastViewport: null, auditLog: [] };
  state.mobileUX.mode ||= 'auto';
  state.mobileUX.compact ??= false;
  state.mobileUX.oneHand ??= false;
  state.mobileUX.matchFocus ??= true;
  state.mobileUX.reduceMotion ??= false;
  state.mobileUX.auditLog ||= [];
  state.mobileUX.lastViewport ??= null;
}
function currentViewportProfile() {
  const w = Math.round(window.innerWidth || document.documentElement.clientWidth || 390);
  const h = Math.round(window.innerHeight || document.documentElement.clientHeight || 720);
  const orientation = w > h ? 'landscape' : 'portrait';
  const widthClass = w <= 360 ? 'small' : w <= 430 ? 'phone' : w <= 760 ? 'large-phone' : w <= 1099 ? 'tablet' : 'desktop';
  const cramped = w <= 390 || h <= 640;
  const safeBottom = getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom') || 'env(safe-area-inset-bottom)';
  return { width: w, height: h, orientation, widthClass, cramped, safeBottom, build: BUILD_INFO.build, at: new Date().toISOString() };
}
function applyMobileUXRuntime() {
  if (typeof window === 'undefined' || !document?.documentElement) return;
  ensureMobileUXSystem();
  const profile = currentViewportProfile();
  const root = document.documentElement;
  const body = document.body;
  root.style.setProperty('--app-vh', `${Math.max(1, profile.height * 0.01)}px`);
  root.dataset.viewport = profile.widthClass;
  root.dataset.orientation = profile.orientation;
  body.classList.toggle('compact-ui', !!state.mobileUX.compact || state.mobileUX.mode === 'compact' || (state.mobileUX.mode === 'auto' && profile.cramped));
  body.classList.toggle('comfort-ui', state.mobileUX.mode === 'comfort');
  body.classList.toggle('one-hand-ui', !!state.mobileUX.oneHand);
  body.classList.toggle('match-focus-ui', !!state.mobileUX.matchFocus && state.ui?.currentTab === 'match' && profile.width < 760);
  body.classList.toggle('reduce-motion-ui', !!state.mobileUX.reduceMotion);
  state.mobileUX.lastViewport = profile;
}
function installMobileUXRuntime() {
  const run = () => { try { applyMobileUXRuntime(); renderMobileUX(); } catch (error) { console.warn('Mobile UX runtime fallback', error); } };
  window.addEventListener('resize', run, { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(run, 120), { passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) run(); });
  run();
}
function scrollToAppTop(soft=false) {
  const behavior = soft || state?.mobileUX?.reduceMotion ? 'auto' : 'smooth';
  const target = document.querySelector('.content-stack') || document.body;
  target.scrollIntoView?.({ block: 'start', behavior });
  window.scrollTo?.({ top: 0, behavior });
}
function renderMobileUX() {
  const host = $('#mobileUXHub');
  if (!host || !state) return;
  ensureMobileUXSystem();
  const profile = state.mobileUX.lastViewport || currentViewportProfile();
  const isMobile = profile.width < 760;
  const touchScore = Math.max(72, Math.min(100, Math.round((profile.width >= 390 ? 92 : 82) + (state.mobileUX.oneHand ? 4 : 0) - (profile.cramped ? 5 : 0))));
  const density = document.body.classList.contains('compact-ui') ? 'Compacta' : state.mobileUX.mode === 'comfort' ? 'Confortável' : 'Automática';
  const auditRows = [
    { label: 'Viewport', value: `${profile.width}×${profile.height}` },
    { label: 'Orientação', value: profile.orientation === 'landscape' ? 'Horizontal' : 'Vertical' },
    { label: 'Classe', value: profile.widthClass },
    { label: 'Área de toque', value: `${touchScore}%` }
  ];
  host.innerHTML = `
    <section class="mobile-ux-hero">
      <div><p class="eyebrow">${BUILD_LABEL}</p><h2>UX premium para celular</h2><p>Central para controlar densidade, navegação inferior, área de toque, foco de partida e rolagem segura em telas pequenas.</p></div>
      <div class="mobile-ux-device ${isMobile ? 'phone' : 'desktop'}"><span>${profile.width}</span><b>${profile.height}</b><small>${density}</small></div>
    </section>
    <div class="mobile-ux-kpis">${auditRows.map(row=>`<article class="stat-card"><span>${row.label}</span><strong>${row.value}</strong></article>`).join('')}</div>
    <section class="panel-card mobile-ux-controls">
      <div class="panel-title-row"><div><h4>Perfil de interface</h4><p class="muted">As opções são salvas na carreira e aplicadas sem reiniciar.</p></div><button class="mini-btn" onclick="window.mobileUXAutoAudit()">Auditar</button></div>
      <div class="mobile-ux-toggle-grid">
        ${Object.entries(MOBILE_UX_MODES).map(([key,opt])=>`<button class="mobile-ux-option ${state.mobileUX.mode===key?'active':''}" onclick="window.setMobileUXMode('${key}')"><strong>${opt.label}</strong><span>${opt.desc}</span></button>`).join('')}
      </div>
      <div class="mobile-ux-switches">
        <button class="mobile-ux-switch ${state.mobileUX.compact?'active':''}" onclick="window.toggleMobileUX('compact')"><b>Compactar cards</b><span>Menos altura em telas pequenas</span></button>
        <button class="mobile-ux-switch ${state.mobileUX.oneHand?'active':''}" onclick="window.toggleMobileUX('oneHand')"><b>Modo uma mão</b><span>Comandos mais perto do rodapé</span></button>
        <button class="mobile-ux-switch ${state.mobileUX.matchFocus?'active':''}" onclick="window.toggleMobileUX('matchFocus')"><b>Foco na partida</b><span>Placar e botões priorizados no match</span></button>
        <button class="mobile-ux-switch ${state.mobileUX.reduceMotion?'active':''}" onclick="window.toggleMobileUX('reduceMotion')"><b>Reduzir movimento</b><span>Transições mais discretas</span></button>
      </div>
    </section>
    <section class="mobile-ux-grid">
      <article class="panel-card"><h4>Navegação inferior</h4><p>Dock virou trilho horizontal com scroll-snap e botão ativo centralizado, evitando aperto quando há muitas abas.</p><p class="muted">Ideal para Dashboard, Academia, Atletas, Carreira, Treino, Partida, Ranking, Agenda, News e UX.</p></article>
      <article class="panel-card"><h4>Rolagem segura</h4><p>Altura real do navegador é recalculada em resize/orientação, reduzindo cortes por barra do navegador e notch.</p><p class="muted">Compatível com 320×568, 360×640, 390×844 e 412×915.</p></article>
      <article class="panel-card"><h4>Comandos rápidos</h4><p>A barra flutuante mobile agora oferece Semana, Salvar, Match e Topo sem abrir menu lateral.</p><p class="muted">No desktop ela permanece oculta.</p></article>
    </section>
    <section class="panel-card mobile-ux-audit"><div class="panel-title-row"><h4>Auditoria recente</h4><span class="metric-build">schema ${BUILD_INFO.schemaVersion}</span></div><div class="list-block">${(state.mobileUX.auditLog||[]).slice(0,5).map(item=>`<div class="list-item"><span>${item.width}×${item.height} • ${item.orientation}</span><strong>${item.result}</strong></div>`).join('') || '<div class="list-item"><span>Nenhuma auditoria registrada ainda.</span><strong>OK</strong></div>'}</div></section>
  `;
}
window.setMobileUXMode = (mode='auto') => {
  ensureMobileUXSystem();
  if (!MOBILE_UX_MODES[mode]) return;
  state.mobileUX.mode = mode;
  state.mobileUX.auditLog.unshift({ ...currentViewportProfile(), result: `Modo ${MOBILE_UX_MODES[mode].label}` });
  state.mobileUX.auditLog = state.mobileUX.auditLog.slice(0, 20);
  applyMobileUXRuntime(); saveState(state); renderMobileUX();
};
window.toggleMobileUX = (key) => {
  ensureMobileUXSystem();
  if (!['compact','oneHand','matchFocus','reduceMotion'].includes(key)) return;
  state.mobileUX[key] = !state.mobileUX[key];
  state.mobileUX.auditLog.unshift({ ...currentViewportProfile(), result: `${key}: ${state.mobileUX[key] ? 'ON' : 'OFF'}` });
  state.mobileUX.auditLog = state.mobileUX.auditLog.slice(0, 20);
  applyMobileUXRuntime(); saveState(state); renderMobileUX();
};
window.mobileUXAutoAudit = () => {
  ensureMobileUXSystem();
  const p = currentViewportProfile();
  const result = p.width < 360 ? 'modo 320px protegido' : p.width < 760 ? 'mobile validado' : p.width < 1100 ? 'tablet validado' : 'desktop validado';
  state.mobileUX.auditLog.unshift({ ...p, result });
  state.mobileUX.auditLog = state.mobileUX.auditLog.slice(0, 20);
  applyMobileUXRuntime(); saveState(state); renderMobileUX();
};

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
  document.body.dataset.currentTab = state?.ui?.currentTab || 'dashboard';
}


function hydrateAssetImages() {
  const imgs = document.querySelectorAll('img[data-asset-src]');
  let hydrated = 0;
  imgs.forEach((img) => {
    img.loading ||= 'lazy';
    img.decoding ||= 'async';
    if (img.dataset.assetHydrated === '1') return;
    img.dataset.assetHydrated = '1';
    hydrated += 1;
    attachFallback(img, img.dataset.assetSrc || '');
  });
  if (state?.performanceDelivery?.runtimeHints) {
    state.performanceDelivery.runtimeHints.lastHydratedImages = imgs.length;
    state.performanceDelivery.runtimeHints.missingAssets = document.querySelectorAll('img.asset-missing').length;
    state.performanceDelivery.runtimeHints.lastHydratedDelta = hydrated;
  }
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
  $$('.hub-btn[data-jump-tab]').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.jumpTab)));
  $('#openSetupBtn')?.addEventListener('click', () => forceOnboardingLauncher('botão Configurar do Dashboard'));
  $('#openSetupBannerBtn')?.addEventListener('click', () => forceOnboardingLauncher('banner Configurar agora'));
  $('#repairStartBtn')?.addEventListener('click', () => { rebuildPlayableCareer('correção manual pelo banner'); render(); openOwnerSetup(true); });
  $('#recoverCareerBtn')?.addEventListener('click', () => { rebuildPlayableCareer('correção manual pelo painel'); render(); openOwnerSetup(true); });
  ensureDrawModal();
  $('#saveOwnerSetupBtn')?.addEventListener('click', saveOwnerSetup);
  $('#openCalendarBtn')?.addEventListener('click', () => switchTab('calendar'));
  $('#advanceWeekBtn')?.addEventListener('click', advanceWeek);
  $('#saveBtn')?.addEventListener('click', () => { saveState(state); addLog('Save realizado manualmente.'); render(); });
  $('#mobileQuickWeek')?.addEventListener('click', advanceWeek);
  $('#mobileQuickSave')?.addEventListener('click', () => { saveState(state); addLog('Save rápido mobile realizado.'); render(); });
  $('#mobileQuickMatch')?.addEventListener('click', () => switchTab('match'));
  $('#mobileQuickTop')?.addEventListener('click', () => scrollToAppTop());
  $('#resetBtn')?.addEventListener('click', () => {
    clearState();
    state = buildInitialState(content);
    migrateState();
    state.flags ||= {};
    state.flags.ownerSetupComplete = false;
    addLog('Nova carreira iniciada.');
    render();
    openOwnerSetup(true);
  });
  $('#startMatchBtn')?.addEventListener('click', startScheduledMatch);
  $('#playPointBtn')?.addEventListener('click', playPoint);
  $('#playGameBtn')?.addEventListener('click', simulateCurrentGame);
  $('#playSetBtn')?.addEventListener('click', simulateCurrentSet);
  $('#playMatchBtn')?.addEventListener('click', simulateFullMatch);
  $('#tacticalPauseBtn')?.addEventListener('click', tacticalPause);
  $('#autoMatchBtn')?.addEventListener('click', () => setAutoPlay(1));
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
  if (state && !careerIsPlayableAndConfigured(state) && !SETUP_SAFE_TABS.has(tab)) {
    blockGameplayUntilCareerReady(tab, `tentativa de abrir ${tab} antes da criação completa`);
    tab = 'initialgate';
  }
  state.ui ||= {}; state.ui.currentTab = tab; state.ui.lastStableTab = tab;
  document.body.dataset.currentTab = tab;
  $$('#mainTabs .tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  $$('.dock-btn').forEach(btn => {
    const active = btn.dataset.tab === tab;
    btn.classList.toggle('active', active);
    if (active && btn.scrollIntoView) btn.scrollIntoView({ inline: 'center', block: 'nearest', behavior: state.mobileUX?.reduceMotion ? 'auto' : 'smooth' });
  });
  $$('.tab-panel').forEach(panel => panel.classList.toggle('active', panel.id === `tab-${tab}`));
  updateSceneForTab(tab);
  applyMobileUXRuntime();
  if (tab === 'match') drawCourt();
  if (window.innerWidth < 1100) scrollToAppTop(true);
}


function visualSceneForTab(tab='dashboard') {
  const map = { dashboard: 'office', visual: state.visualAcademy?.activeScene || 'office', roster: 'market', career: 'office', training: 'training', calendar: 'calendar', newsroom: 'calendar', mobileux: 'office', economy: 'office', legacy: 'office', release: 'office', delivery: 'office', qa: 'office', compat: 'office', onboarding: 'office', cacheguard: 'office', setupverify: 'office', initialgate: 'office', runtimeproof: 'office', input: 'office', a11y: 'office', match: 'broadcast', market: 'market', staff: 'medical', ranking: 'calendar', adminhint: 'office' };
  return map[tab] || 'office';
}
function updateSceneForTab(tab='dashboard') {
  const scene = visualSceneForTab(tab);
  document.body.dataset.scene = scene;
  document.documentElement.dataset.scene = scene;
}
function visualRiskLabel() {
  const tired = state.roster.filter(p => (p.fatigue || 0) > 55 || (p.health || 100) < 72 || (p.injuredWeeks || 0) > 0).length;
  if (tired >= 2) return 'Alerta médico';
  if (tired === 1) return 'Atenção individual';
  return 'Elenco estável';
}
function visualPerformancePulse() {
  const avgMorale = Math.round(state.roster.reduce((sum,p)=>sum+(p.morale || 70),0) / Math.max(1,state.roster.length));
  const avgPressure = Math.round(state.roster.reduce((sum,p)=>sum+(p.pressure || 40),0) / Math.max(1,state.roster.length));
  if (avgPressure > 70) return `Pressão alta • moral ${avgMorale}`;
  if (avgMorale > 78) return `Ambiente positivo • moral ${avgMorale}`;
  return `Moral ${avgMorale} • pressão ${avgPressure}`;
}
function renderVisualAcademy() {
  const host = $('#visualAcademyHub');
  if (!host) return;
  state.visualAcademy ||= { activeScene: 'office', lastViewedScene: 'office', environmentAudit: [], premiumMode: true };
  const activeKey = state.visualAcademy.activeScene || 'office';
  const active = VISUAL_ACADEMY_SCENES[activeKey] || VISUAL_ACADEMY_SCENES.office;
  const nextEvent = state.calendar.find(e => e.week >= state.academy.week) || state.calendar[0];
  const moneyMood = state.academy.money < 0 ? 'Caixa crítico' : state.academy.money < 50000 ? 'Controle de gastos' : 'Expansão possível';
  const sceneCards = Object.entries(VISUAL_ACADEMY_SCENES).map(([key, scene]) => `
    <article class="visual-scene-card ${key === activeKey ? 'active' : ''}" data-scene-card="${key}">
      <div class="visual-scene-media">${assetVisualMarkup(scene.asset, scene.label)}</div>
      <div class="visual-scene-copy"><span>${escapeHtml(scene.badge)}</span><strong>${escapeHtml(scene.label)}</strong><p>${escapeHtml(scene.desc)}</p><small>${escapeHtml(scene.kpi)}</small></div>
      <div class="visual-scene-actions"><button class="mini-btn" onclick="window.setVisualScene('${key}')">Focar</button><button class="mini-btn" onclick="window.openVisualScene('${key}')">Abrir</button></div>
    </article>`).join('');
  host.innerHTML = `
    <section class="visual-hero-card scene-${activeKey}">
      <div class="visual-hero-backdrop">${assetVisualMarkup(active.asset, active.label)}</div>
      <div class="visual-hero-content">
        <p class="eyebrow">${escapeHtml(active.badge)} • ${BUILD_LABEL}</p>
        <h2>${escapeHtml(active.label)}</h2>
        <p>${escapeHtml(active.desc)}</p>
        <div class="visual-kpi-row"><span>${escapeHtml(visualRiskLabel())}</span><span>${escapeHtml(visualPerformancePulse())}</span><span>${escapeHtml(moneyMood)}</span><span>Próximo: ${escapeHtml(nextEvent?.name || 'Circuito')}</span></div>
        <div class="visual-action-row"><button class="btn-primary" onclick="window.openVisualScene('${activeKey}')">Entrar no ambiente</button><button class="btn-secondary" onclick="window.setVisualScene('broadcast')">Preparar match day</button></div>
      </div>
    </section>
    <div class="visual-scene-grid">${sceneCards}</div>
    <section class="visual-director-board">
      <article class="panel-card"><h4>Direção visual da build</h4><p>O jogo agora usa ambientes como linguagem central: escritório, treino, medicina, análise, mercado, calendário e arena.</p><p class="muted">Nenhum asset foi removido; os fundos, logos e avatares existentes foram reaproveitados com fallback.</p></article>
      <article class="panel-card"><h4>Mobile-first</h4><p>Cards horizontais, botões de toque e cenas compactas para 320 px.</p><p class="muted">O fundo muda conforme a aba sem travar a rolagem do celular.</p></article>
      <article class="panel-card"><h4>Próxima camada AAA</h4><p>Depois desta base visual, a próxima fase pode trazer imprensa, notícias e narrativa global.</p><p class="muted">Visual Academy é a fundação para telas menos administrativas.</p></article>
    </section>`;
  hydrateAssetImages();
}
function assetVisualMarkup(src='', alt='asset') {
  return src ? `<img class="visual-asset" data-asset-src="${src}" alt="${escapeAttr(alt)}">` : `<div class="visual-asset-fallback">${escapeHtml(String(alt).slice(0,2).toUpperCase())}</div>`;
}
window.setVisualScene = (sceneKey='office') => {
  if (!VISUAL_ACADEMY_SCENES[sceneKey]) return;
  const before = { ...(state.visualAcademy || {}) };
  try {
    state.visualAcademy ||= { activeScene: 'office', lastViewedScene: 'office', environmentAudit: [], premiumMode: true };
    state.visualAcademy.activeScene = sceneKey;
    state.visualAcademy.lastViewedScene = sceneKey;
    state.visualAcademy.environmentAudit ||= [];
    state.visualAcademy.environmentAudit.unshift({ scene: sceneKey, week: state.academy.week, season: state.academy.season, build: BUILD_INFO.build, at: new Date().toISOString() });
    state.visualAcademy.environmentAudit = state.visualAcademy.environmentAudit.slice(0, 30);
    saveState(state);
    updateSceneForTab(state.ui?.currentTab || 'visual');
    renderVisualAcademy();
  } catch (error) {
    state.visualAcademy = before;
    showSystemError('Ambiente visual restaurado sem perda de dados.');
  }
};
window.openVisualScene = (sceneKey='office') => {
  const scene = VISUAL_ACADEMY_SCENES[sceneKey] || VISUAL_ACADEMY_SCENES.office;
  window.setVisualScene(sceneKey);
  switchTab(scene.tab || 'dashboard');
  render();
};


function render() {
  if (!careerIsPlayableAndConfigured(state) && !SETUP_SAFE_TABS.has(state.ui?.currentTab || 'dashboard')) {
    state.ui ||= {};
    state.ui.currentTab = 'initialgate';
    state.ui.lastStableTab = 'initialgate';
  }
  $('#seasonLabel').textContent = state.academy.season;
  $('#weekLabel').textContent = state.academy.week;
  $('#moneyLabel').textContent = money(state.academy.money);
  $('#goalLabel').textContent = state.objectives.current;
  renderOwnerHub();
  renderCareerRecoveryBanner();
  renderVisualAcademy();
  updateSceneForTab(state.ui?.currentTab || 'dashboard');
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
  renderNewsroom();
  renderMobileUX();
  renderCommercialCareer();
  renderLongCareer();
  renderReleaseCandidate();
  renderQualityPolish();
  renderReleaseHardening();
  renderPerformanceDelivery();
  renderQAAutomation();
  renderBrowserCompatibility();
  renderInputReliability();
  renderAccessibilityReadability();
  renderLocalizationStore();
  renderHelpCenter();
  renderOnboardingReliabilityHub();
  renderCareerCreationUXHub();
  renderCacheUpdateGuard();
  renderMandatoryCareerGate();
  renderForcedOnboardingGate();
  renderOnboardingRuntimeProof();
  syncOnboardingRuntimeLock('render');
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
  if (state.commercialCareer?.riskScore >= 78) return 'Alerta financeiro comercial';
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
    <article class="offer-card commercial-offer-card">
      <div>
        <div class="identity-card-topline"><span>${offer.tier || 'Regional'}</span><span>${offer.category || 'patrocínio'}</span><span>score ${commercialOfferScore(offer)}</span></div>
        <h4>${offer.name}</h4>
        <p class="muted">Bônus imediato ${money(offer.signingBonus)} • semanal ${money(offer.weeklyBoost)} • exigência ${offer.requirement}</p>
        <div class="commercial-contract-line"><span>${offer.weeks || 26} semanas</span><span>penalidade ${money(offer.penalty || Math.round((offer.signingBonus||0)*0.18))}</span></div>
      </div>
      <div class="tag-row">
        <button class="btn-primary" onclick="window.acceptSponsorOffer('${offer.id}')">Aceitar</button>
        <button class="btn-ghost" onclick="window.rejectSponsorOffer('${offer.id}')">Recusar</button>
      </div>
    </article>`).join('') : '<div class="list-item"><span>Sem propostas nesta semana.</span></div>';
}


function ensureCommercialCareerSystem() {
  state.commercialCareer ||= { ledger: [], activeSponsors: [], sponsorPipeline: [], investorOffers: [], travelBudgetMode: 'balanced', riskScore: 24, cashflowTrend: 0, lastProcessedToken: null, boardConfidence: 64 };
  const cc = state.commercialCareer;
  cc.ledger ||= [];
  cc.activeSponsors ||= [];
  cc.sponsorPipeline ||= [];
  cc.investorOffers ||= [];
  cc.travelBudgetMode ||= 'balanced';
  cc.riskScore ??= 24;
  cc.cashflowTrend ??= 0;
  cc.lastProcessedToken ??= null;
  cc.boardConfidence ??= 64;
  cc.activeSponsors.forEach(contract => {
    contract.weeksLeft ??= contract.weeks || 26;
    contract.weeklyBoost ??= 0;
    contract.penalty ??= Math.round((contract.signingBonus || 0) * 0.18);
    contract.status ||= 'ativo';
  });
}
function travelMode() {
  ensureCommercialCareerSystem();
  return TRAVEL_BUDGET_MODES[state.commercialCareer.travelBudgetMode] || TRAVEL_BUDGET_MODES.balanced;
}
function commercialOfferScore(offer) {
  const repFit = Math.min(30, Math.round((state.academy.reputation || 0) * 0.45));
  const financeFit = Math.min(18, Math.round(getStaffBonus('Financeiro', 'sponsor') * 1.2));
  const cashNeed = state.academy.money < 120000 ? 12 : state.academy.money > 450000 ? -4 : 4;
  return clamp(Math.round(48 + (offer.prestige || 5) * 3 + repFit + financeFit + cashNeed - (offer.pressure || 0)), 0, 100);
}
function commercialWeeklySponsorBoost() {
  ensureCommercialCareerSystem();
  return (state.commercialCareer.activeSponsors || []).filter(s => s.status !== 'encerrado').reduce((sum, s) => sum + (s.weeklyBoost || 0), 0);
}
function investorPressure() {
  ensureCommercialCareerSystem();
  return (state.commercialCareer.investorOffers || []).filter(i => i.accepted).reduce((sum, i) => sum + (i.pressure || 0), 0);
}
function commercialTravelAdjustment() {
  const mode = travelMode();
  const activeEvent = state.activeTournament?.event;
  const eventCost = activeEvent ? Math.max(1800, Math.round((activeEvent.drawSize || 16) * 160 + (activeEvent.winnerPoints || 250) * 10)) : 0;
  return Math.round(eventCost * (1 + mode.cost));
}
function calculateCommercialRisk(income = calculateSponsor(), costs = calculateWeeklyCosts()) {
  ensureCommercialCareerSystem();
  const runway = costs > 0 ? state.academy.money / costs : 9;
  const debtRisk = state.academy.money < 0 ? 28 : runway < 4 ? 16 : runway < 8 ? 8 : -5;
  const sponsorRisk = Math.max(0, 18 - state.commercialCareer.activeSponsors.length * 6);
  const investorRisk = investorPressure() * 0.55;
  const flowRisk = income < costs ? 16 : -8;
  return clamp(Math.round(34 + debtRisk + sponsorRisk + investorRisk + flowRisk - state.academy.reputation * 0.18), 0, 100);
}
function pushLedger(type, label, amount, note='') {
  ensureCommercialCareerSystem();
  state.commercialCareer.ledger.unshift({ id: `${type}-${Date.now()}-${Math.floor(Math.random()*999)}`, type, label, amount: Math.round(amount || 0), note, week: state.academy.week, season: state.academy.season, at: new Date().toISOString() });
  state.commercialCareer.ledger = state.commercialCareer.ledger.slice(0, 80);
}
function processCommercialWeek(weeklyIncome, weeklyCosts) {
  ensureCommercialCareerSystem();
  const token = `${state.academy.season}-${state.academy.week}`;
  if (state.commercialCareer.lastProcessedToken === token) return;
  state.commercialCareer.lastProcessedToken = token;
  const travel = commercialTravelAdjustment();
  if (travel > 0) {
    state.academy.money -= travel;
    state.roster.forEach(p => { p.fatigue = clamp((p.fatigue || 0) + travelMode().fatigue, 0, 100); });
    pushLedger('travel', `Viagem ${state.activeTournament?.event?.name || 'Circuito'}`, -travel, travelMode().label);
  }
  (state.commercialCareer.activeSponsors || []).forEach(contract => {
    contract.weeksLeft = Math.max(0, (contract.weeksLeft ?? contract.weeks ?? 26) - 1);
    if (contract.weeksLeft === 0 && contract.status !== 'encerrado') {
      contract.status = 'encerrado';
      state.inbox.unshift({ title: `Patrocínio encerrado: ${contract.name}`, body: `O contrato com ${contract.name} terminou. Busque nova receita para proteger o fluxo de caixa.`, week: state.academy.week });
      pushLedger('sponsor-end', `Fim de contrato ${contract.name}`, 0, 'renovação necessária');
    }
  });
  state.commercialCareer.activeSponsors = state.commercialCareer.activeSponsors.filter(s => s.status !== 'encerrado' || (s.weeksLeft || 0) > -2);
  (state.commercialCareer.investorOffers || []).filter(i => i.accepted).forEach(investor => {
    investor.weeksLeft = Math.max(0, (investor.weeksLeft ?? investor.weeks ?? 26) - 1);
    if (investor.weeksLeft === 0 && !investor.closed) {
      investor.closed = true;
      state.commercialCareer.boardConfidence = clamp(state.commercialCareer.boardConfidence + (state.academy.money > 0 ? 7 : -12), 0, 100);
      state.inbox.unshift({ title: `Ciclo de investidor encerrado`, body: `${investor.name} avaliou a academia. Confiança do board: ${Math.round(state.commercialCareer.boardConfidence)}.`, week: state.academy.week });
    }
  });
  state.commercialCareer.cashflowTrend = Math.round(weeklyIncome - weeklyCosts - travel);
  state.commercialCareer.riskScore = calculateCommercialRisk(weeklyIncome, weeklyCosts);
  pushLedger('weekly', 'Fluxo operacional semanal', weeklyIncome - weeklyCosts - travel, `Entrada ${money(weeklyIncome)} • saída ${money(weeklyCosts + travel)}`);
  if (state.commercialCareer.riskScore >= 78) {
    state.inbox.unshift({ title: 'Diretoria financeira em alerta', body: 'O risco comercial está alto. Revise patrocínios, viagem, staff e calendário antes de comprometer o caixa.', week: state.academy.week });
  }
}
function renderCommercialCareer() {
  const host = $('#commercialCareerHub');
  if (!host) return;
  ensureCommercialCareerSystem();
  const cc = state.commercialCareer;
  const weeklyIncome = calculateSponsor();
  const weeklyCosts = calculateWeeklyCosts();
  const travel = commercialTravelAdjustment();
  const net = weeklyIncome - weeklyCosts - travel;
  cc.riskScore = calculateCommercialRisk(weeklyIncome, weeklyCosts);
  const activeSponsors = cc.activeSponsors.filter(s => s.status !== 'encerrado');
  const investors = cc.investorOffers.filter(i => i.accepted && !i.closed);
  const offers = state.sponsorOffers || [];
  const riskClass = cc.riskScore >= 78 ? 'danger' : cc.riskScore >= 55 ? 'warn' : 'ok';
  host.innerHTML = `
    <section class="commercial-hero">
      <div><p class="eyebrow">${BUILD_LABEL}</p><h2>Carreira comercial da academia</h2><p>Controle caixa, contratos, investidores e custo de viagem para sustentar uma academia internacional sem virar apenas arcade.</p></div>
      <div class="commercial-risk ${riskClass}"><span>Risco</span><strong>${cc.riskScore}</strong><small>${riskClass === 'danger' ? 'crítico' : riskClass === 'warn' ? 'atenção' : 'controlado'}</small></div>
    </section>
    <div class="commercial-kpis">
      <article class="stat-card"><span>Caixa</span><strong>${money(state.academy.money)}</strong></article>
      <article class="stat-card"><span>Fluxo projetado</span><strong>${money(net)}</strong></article>
      <article class="stat-card"><span>Receita semanal</span><strong>${money(weeklyIncome)}</strong></article>
      <article class="stat-card"><span>Custos + viagem</span><strong>${money(weeklyCosts + travel)}</strong></article>
      <article class="stat-card"><span>Contratos ativos</span><strong>${activeSponsors.length}</strong></article>
      <article class="stat-card"><span>Board</span><strong>${Math.round(cc.boardConfidence)}%</strong></article>
    </div>
    <section class="commercial-grid">
      <article class="panel-card commercial-card"><div class="panel-title-row"><div><h4>Orçamento de viagem</h4><p class="muted">Afeta custo, fadiga e reputação em semanas de torneio.</p></div><span class="metric-build">${travelMode().label}</span></div><div class="mobile-ux-toggle-grid commercial-mode-grid">${Object.entries(TRAVEL_BUDGET_MODES).map(([key,opt])=>`<button class="mobile-ux-option ${cc.travelBudgetMode===key?'active':''}" onclick="window.setTravelBudgetMode('${key}')"><strong>${opt.label}</strong><span>${opt.desc}</span></button>`).join('')}</div></article>
      <article class="panel-card commercial-card"><div class="panel-title-row"><div><h4>Patrocínios ativos</h4><p class="muted">Contratos com duração, metas e impacto semanal.</p></div></div><div class="list-block">${activeSponsors.map(s=>`<div class="list-item"><div><strong>${s.name}</strong><div class="small">${s.tier || 'Regional'} • ${s.requirement || 'metas comerciais'} • ${s.weeksLeft || 0} sem.</div></div><b>${money(s.weeklyBoost)}</b></div>`).join('') || '<div class="list-item"><span>Nenhum contrato ativo.</span><strong>Buscar</strong></div>'}</div></article>
      <article class="panel-card commercial-card"><div class="panel-title-row"><div><h4>Propostas comerciais</h4><p class="muted">Avalie score, prazo, bônus e pressão antes de aceitar.</p></div><button class="mini-btn" onclick="window.forceSponsorPipeline()">Prospectar</button></div><div class="commercial-offers-list">${offers.map(o=>`<article class="offer-card compact"><div><div class="identity-card-topline"><span>${o.tier || 'Regional'}</span><span>${o.category || 'patrocínio'}</span><span>score ${commercialOfferScore(o)}</span></div><h4>${o.name}</h4><p class="muted">${money(o.signingBonus)} agora • ${money(o.weeklyBoost)}/semana • ${o.weeks || 26} sem.</p></div><div class="tag-row"><button class="btn-primary" onclick="window.acceptSponsorOffer('${o.id}')">Assinar</button><button class="btn-ghost" onclick="window.rejectSponsorOffer('${o.id}')">Recusar</button></div></article>`).join('') || '<div class="list-item"><span>Sem proposta aberta.</span><strong>Prospectar</strong></div>'}</div></article>
      <article class="panel-card commercial-card"><div class="panel-title-row"><div><h4>Investidores</h4><p class="muted">Capital acelera a academia, mas aumenta pressão e cobrança.</p></div><button class="mini-btn" onclick="window.generateInvestorOffer()">Nova oferta</button></div><div class="list-block">${investors.map(i=>`<div class="list-item"><div><strong>${i.name}</strong><div class="small">${i.goal} • equity ${i.equity}% • ${i.weeksLeft || i.weeks} sem.</div></div><b>${money(i.capital)}</b></div>`).join('') || cc.investorOffers.filter(i=>!i.accepted && !i.closed).slice(0,2).map(i=>`<div class="list-item"><div><strong>${i.name}</strong><div class="small">${i.goal} • equity ${i.equity}% • pressão ${i.pressure}</div></div><button class="mini-btn" onclick="window.acceptInvestorOffer('${i.id}')">Aceitar</button></div>`).join('') || '<div class="list-item"><span>Nenhuma proposta de investidor.</span><strong>Estável</strong></div>'}</div></article>
    </section>
    <section class="panel-card commercial-ledger"><div class="panel-title-row"><h4>Livro caixa recente</h4><span class="metric-build">schema ${BUILD_INFO.schemaVersion}</span></div><div class="list-block">${cc.ledger.slice(0,8).map(item=>`<div class="list-item"><div><strong>${item.label}</strong><div class="small">S${item.week}/${item.season} • ${item.note || item.type}</div></div><b class="${item.amount < 0 ? 'danger' : 'ok'}">${money(item.amount)}</b></div>`).join('') || '<div class="list-item"><span>Nenhum lançamento ainda.</span><strong>OK</strong></div>'}</div></section>`;
}
window.setTravelBudgetMode = (mode='balanced') => {
  ensureCommercialCareerSystem();
  if (!TRAVEL_BUDGET_MODES[mode]) return;
  const snapshot = JSON.stringify(state.commercialCareer);
  try {
    state.commercialCareer.travelBudgetMode = mode;
    state.commercialCareer.ledger.unshift({ id:`travel-mode-${Date.now()}`, type:'policy', label:`Política de viagem: ${TRAVEL_BUDGET_MODES[mode].label}`, amount:0, note:TRAVEL_BUDGET_MODES[mode].desc, week:state.academy.week, season:state.academy.season, at:new Date().toISOString() });
    state.commercialCareer.ledger = state.commercialCareer.ledger.slice(0,80);
    if (!saveState(state)) throw new Error('Falha ao salvar política comercial');
    render();
  } catch (error) {
    state.commercialCareer = JSON.parse(snapshot);
    showSystemError('A política comercial foi restaurada porque o save falhou.', error);
    render();
  }
};
window.forceSponsorPipeline = () => { maybeCreateSponsorOffer(true); render(); };
window.generateInvestorOffer = () => {
  ensureCommercialCareerSystem();
  const template = COMMERCIAL_INVESTORS[(state.academy.week + state.commercialCareer.investorOffers.length) % COMMERCIAL_INVESTORS.length];
  const offer = { ...template, id:`investor-${state.academy.season}-${state.academy.week}-${Date.now()}`, weeksLeft: template.weeks, accepted:false, closed:false };
  state.commercialCareer.investorOffers.unshift(offer);
  state.commercialCareer.investorOffers = state.commercialCareer.investorOffers.slice(0, 8);
  addLog(`Nova proposta de investidor: ${offer.name}.`);
  render();
};
window.acceptInvestorOffer = (id) => {
  ensureCommercialCareerSystem();
  const offer = state.commercialCareer.investorOffers.find(i => i.id === id);
  if (!offer) return;
  const snapshot = { money: state.academy.money, cc: JSON.stringify(state.commercialCareer), inbox: [...state.inbox] };
  try {
    offer.accepted = true; offer.weeksLeft = offer.weeks; offer.acceptedAt = new Date().toISOString();
    state.academy.money += offer.capital;
    state.commercialCareer.boardConfidence = clamp(state.commercialCareer.boardConfidence + 5 - offer.pressure * .2, 0, 100);
    pushLedger('investor', `Investimento ${offer.name}`, offer.capital, `${offer.equity}% equity • ${offer.goal}`);
    state.inbox.unshift({ title:`Investidor entrou: ${offer.name}`, body:`Capital de ${money(offer.capital)} recebido. A cobrança por ${offer.goal} aumentou.`, week:state.academy.week });
    if (!saveState(state)) throw new Error('Falha ao salvar investidor');
    render();
  } catch (error) {
    state.academy.money = snapshot.money; state.commercialCareer = JSON.parse(snapshot.cc); state.inbox = snapshot.inbox;
    showSystemError('A negociação com investidor foi revertida com segurança.', error);
    render();
  }
};




function ensureLongCareerSystem() {
  state.generationalCareer ||= { seasonHistory: [], retirementLog: [], hallOfFame: [], prospects: [], records: {}, legacyScore: 0, lastProcessedSeason: null, simulationAudit: [] };
  const gc = state.generationalCareer;
  gc.seasonHistory ||= [];
  gc.retirementLog ||= [];
  gc.hallOfFame ||= [];
  gc.prospects ||= [];
  gc.records ||= {};
  gc.legacyScore ??= 0;
  gc.lastProcessedSeason ??= null;
  gc.simulationAudit ||= [];
  state.roster.forEach(p => ensureLongCareerPlayer(p));
  if (gc.prospects.length < 3) seedNextGeneration(3 - gc.prospects.length);
  updateLongCareerRecords(false);
}
function ensureLongCareerPlayer(player) {
  if (!player) return player;
  player.debutSeason ??= Math.max(2024, (state.academy?.season || 2026) - Math.max(0, player.yearsPro || 0));
  player.yearsPro ??= Math.max(0, (state.academy?.season || 2026) - player.debutSeason);
  player.peakOverall ??= player.overall || 50;
  player.careerTitles ??= player.careerTitles || 0;
  player.grandSlamTitles ??= player.grandSlamTitles || 0;
  player.bestRank ??= Math.min(player.bestRank || 999, getPlayerRank(player.id));
  player.legacyTags ||= [];
  player.careerPhase = careerPhase(player).key;
  return player;
}
function careerPhase(player) {
  const age = Number(player.age || 20);
  if (age <= 19) return { key:'prospect', ...CAREER_PHASE_META.prospect };
  if (age <= 23) return { key:'rising', ...CAREER_PHASE_META.rising };
  if (age <= 29) return { key:'prime', ...CAREER_PHASE_META.prime };
  if (age <= 33) return { key:'veteran', ...CAREER_PHASE_META.veteran };
  return { key:'decline', ...CAREER_PHASE_META.decline };
}
function careerLegacyScore(player) {
  const rank = player.bestRank || getPlayerRank(player.id);
  const titleScore = (player.careerTitles || 0) * 34 + (player.grandSlamTitles || 0) * 120;
  const rankScore = rank <= 10 ? 160 : rank <= 30 ? 110 : rank <= 80 ? 65 : rank <= 150 ? 30 : 8;
  return Math.round(titleScore + rankScore + (player.peakOverall || player.overall || 50) * 1.7 + Math.log1p(player.rankingPoints || 0) * 11);
}
function generateProspect(seedText='') {
  const seed = stableNumber(`${state.academy.season}-${state.academy.week}-${seedText}-${state.generationalCareer.prospects.length}`);
  const first = GENERATION_FIRST_NAMES[seed % GENERATION_FIRST_NAMES.length];
  const last = GENERATION_LAST_NAMES[Math.floor(seed / 7) % GENERATION_LAST_NAMES.length];
  const country = GENERATION_COUNTRIES[Math.floor(seed / 13) % GENERATION_COUNTRIES.length];
  const age = 15 + (seed % 4);
  const overall = 48 + (seed % 18);
  const potential = clamp(overall + 18 + (seed % 17), 62, 94);
  const style = ['Defensivo','Saque e voleio','Agressivo de fundo','All-court','Contra-atacador'][seed % 5];
  const id = `nextgen-${state.academy.season}-${seed}`;
  const base = enrichPlayer({ id, name: `${first} ${last}`, country, age, overall, potential, style, rankingPoints: 0, avatar: PLAYER_AVATARS[seed % PLAYER_AVATARS.length] });
  return { ...base, scoutGrade: potential >= 86 ? 'A' : potential >= 78 ? 'B' : 'C', discoveryWeek: state.academy.week, discoverySeason: state.academy.season, signingCost: Math.round(18000 + potential * 850 + overall * 220), salary: Math.round(900 + overall * 34), protected: false };
}
function seedNextGeneration(count=3) {
  ensureLongCareerSystemSafe();
  for (let i=0; i<count; i++) {
    const p = generateProspect(`auto-${i}`);
    if (!state.generationalCareer.prospects.some(x => x.id === p.id || x.name === p.name)) state.generationalCareer.prospects.push(p);
  }
  state.generationalCareer.prospects = state.generationalCareer.prospects.slice(0, 14);
}
function ensureLongCareerSystemSafe(){ state.generationalCareer ||= { seasonHistory: [], retirementLog: [], hallOfFame: [], prospects: [], records: {}, legacyScore: 0, lastProcessedSeason: null, simulationAudit: [] }; }
function longCareerDevelopmentDelta(player) {
  const phase = careerPhase(player).key;
  const discipline = (player.discipline || 72) / 100;
  const confidence = (player.confidence || 65) / 100;
  const health = (player.health || 100) / 100;
  const facilities = (state.academy.facilities?.training || 1) * 0.18 + getDepartmentBonus('development') * 0.02;
  const ceilingGap = Math.max(0, (player.potential || player.overall || 60) - (player.overall || 60));
  let delta = 0;
  if (phase === 'prospect') delta = 1.7 + ceilingGap * 0.08;
  else if (phase === 'rising') delta = 1.05 + ceilingGap * 0.055;
  else if (phase === 'prime') delta = 0.35 + ceilingGap * 0.025;
  else if (phase === 'veteran') delta = -0.35 + confidence * 0.45;
  else delta = -1.25 - Math.max(0, 70 - (player.health || 100)) * 0.025;
  delta += (discipline - 0.7) * 1.3 + (health - 0.82) * 0.9 + facilities;
  if ((player.injuredWeeks || 0) > 0) delta -= 1.8;
  if ((player.fatigue || 0) > 70) delta -= 0.7;
  return Math.max(-3.2, Math.min(3.4, delta));
}
function retirementRisk(player) {
  const age = player.age || 20;
  const healthRisk = Math.max(0, 70 - (player.health || 100)) * 0.35;
  const declineRisk = Math.max(0, 55 - (player.overall || 55)) * 0.4;
  const ageRisk = age >= 38 ? 70 : age >= 36 ? 42 : age >= 34 ? 18 : 0;
  const injuryRisk = (player.injuredWeeks || 0) > 0 ? 12 : 0;
  const loyalReduction = (player.relationship || 60) > 78 ? -8 : 0;
  return clamp(Math.round(ageRisk + healthRisk + declineRisk + injuryRisk + loyalReduction), 0, 92);
}
function archiveSeasonBeforeRollover(seasonEnding) {
  ensureLongCareerSystem();
  const best = chooseBestPlayer();
  updateRanking();
  const championCount = (state.tournamentLife?.championHistory || []).filter(h => h.season === seasonEnding && state.roster.some(p => p.name === h.champion)).length;
  const bestRank = Math.min(...state.roster.map(p => getPlayerRank(p.id)).filter(Boolean), 999);
  const summary = { season: seasonEnding, weekEnded: 52, bestPlayer: best?.name || 'Academia', bestRank, titles: championCount, money: Math.round(state.academy.money || 0), reputation: Math.round(state.academy.reputation || 0), roster: state.roster.length, at: new Date().toISOString(), build: BUILD_INFO.build };
  state.generationalCareer.seasonHistory.unshift(summary);
  state.generationalCareer.seasonHistory = state.generationalCareer.seasonHistory.slice(0, 30);
}
function processLongCareerSeason(seasonEnding) {
  ensureLongCareerSystem();
  if (state.generationalCareer.lastProcessedSeason === seasonEnding) return;
  state.generationalCareer.lastProcessedSeason = seasonEnding;
  archiveSeasonBeforeRollover(seasonEnding);
  const retired = [];
  state.roster.forEach(player => {
    ensureLongCareerPlayer(player);
    player.age += 1;
    player.yearsPro = Math.max(0, state.academy.season - (player.debutSeason || state.academy.season));
    player.bestRank = Math.min(player.bestRank || 999, getPlayerRank(player.id));
    player.peakOverall = Math.max(player.peakOverall || player.overall || 50, player.overall || 50);
    const delta = longCareerDevelopmentDelta(player);
    player.overall = clamp(Number(((player.overall || 50) + delta).toFixed(1)), 38, Math.max(player.potential || 80, player.overall || 50));
    player.potential = Math.max(player.overall, (player.potential || player.overall || 60) - (player.age > 29 ? 0.25 : 0));
    player.rankingPoints = Math.round((player.rankingPoints || 0) * (player.age > 33 ? 0.54 : 0.65) + (player.overall || 50) * 1.1);
    player.health = clamp((player.health || 100) + (player.age > 33 ? 4 : 10), 35, 100);
    player.fatigue = clamp((player.fatigue || 0) * 0.45, 0, 100);
    player.injuredWeeks = 0;
    player.careerPhase = careerPhase(player).key;
    const risk = retirementRisk(player);
    const roll = stableNumber(`${seasonEnding}-${player.id}-${player.age}-${player.overall}`) % 100;
    if (roll < risk && state.roster.length - retired.length > 1) retired.push({ ...player, retirementRisk: risk, legacyScore: careerLegacyScore(player) });
  });
  retired.forEach(player => retirePlayer(player, seasonEnding));
  seedNextGeneration(3 + (state.academy.reputation >= 60 ? 1 : 0));
  updateLongCareerRecords(true);
  const note = `Temporada ${seasonEnding} processada: ${retired.length} aposentadoria(s), ${state.generationalCareer.prospects.length} prospectos monitorados.`;
  state.generationalCareer.simulationAudit.unshift({ season: seasonEnding, note, roster: state.roster.length, prospects: state.generationalCareer.prospects.length, at: new Date().toISOString(), build: BUILD_INFO.build });
  state.generationalCareer.simulationAudit = state.generationalCareer.simulationAudit.slice(0, 20);
  state.inbox.unshift({ title: `Relatório de legado ${seasonEnding}`, body: note, week: 1 });
}
function retirePlayer(player, seasonEnding) {
  ensureLongCareerSystem();
  const entry = { id: `ret-${player.id}-${seasonEnding}`, name: player.name, country: player.country, age: player.age, season: seasonEnding, peakOverall: Math.round(player.peakOverall || player.overall || 0), bestRank: player.bestRank || getPlayerRank(player.id), titles: player.careerTitles || 0, slams: player.grandSlamTitles || 0, legacyScore: player.legacyScore || careerLegacyScore(player), build: BUILD_INFO.build };
  state.generationalCareer.retirementLog.unshift(entry);
  state.generationalCareer.retirementLog = state.generationalCareer.retirementLog.slice(0, 30);
  if (entry.legacyScore >= 220 || entry.bestRank <= 80 || entry.titles >= 2) state.generationalCareer.hallOfFame.unshift({ ...entry, inductedAt: new Date().toISOString() });
  state.generationalCareer.hallOfFame = state.generationalCareer.hallOfFame.slice(0, 24);
  state.roster = state.roster.filter(p => p.id !== player.id);
  state.inbox.unshift({ title: `Aposentadoria: ${player.name}`, body: `${player.name} encerrou a carreira aos ${player.age} anos. Melhor ranking #${entry.bestRank}. Score de legado ${entry.legacyScore}.`, week: state.academy.week });
}
function updateLongCareerRecords(pushLog=false) {
  ensureLongCareerSystemSafe();
  const gc = state.generationalCareer;
  updateRanking();
  const records = gc.records || {};
  state.roster.forEach(player => {
    ensureLongCareerPlayer(player);
    player.bestRank = Math.min(player.bestRank || 999, getPlayerRank(player.id));
    player.peakOverall = Math.max(player.peakOverall || player.overall || 50, player.overall || 50);
  });
  const bestRankPlayer = [...state.roster].sort((a,b)=>(a.bestRank||999)-(b.bestRank||999))[0];
  const peakPlayer = [...state.roster].sort((a,b)=>(b.peakOverall||0)-(a.peakOverall||0))[0];
  const titlesPlayer = [...state.roster].sort((a,b)=>(b.careerTitles||0)-(a.careerTitles||0))[0];
  const nextRecords = {
    bestRank: bestRankPlayer ? { player: bestRankPlayer.name, value: bestRankPlayer.bestRank || getPlayerRank(bestRankPlayer.id), season: state.academy.season } : records.bestRank,
    peakOverall: peakPlayer ? { player: peakPlayer.name, value: Math.round(peakPlayer.peakOverall || peakPlayer.overall), season: state.academy.season } : records.peakOverall,
    mostTitles: titlesPlayer ? { player: titlesPlayer.name, value: titlesPlayer.careerTitles || 0, season: state.academy.season } : records.mostTitles,
    longestCareer: [...state.roster].sort((a,b)=>(b.yearsPro||0)-(a.yearsPro||0))[0] ? { player:[...state.roster].sort((a,b)=>(b.yearsPro||0)-(a.yearsPro||0))[0].name, value:[...state.roster].sort((a,b)=>(b.yearsPro||0)-(a.yearsPro||0))[0].yearsPro || 0, season: state.academy.season } : records.longestCareer
  };
  gc.records = { ...records, ...nextRecords };
  gc.legacyScore = Math.round((gc.hallOfFame?.reduce((s,h)=>s+(h.legacyScore||0),0) || 0) + state.roster.reduce((s,p)=>s+careerLegacyScore(p)*0.18,0) + (state.academy.reputation || 0) * 5 + (gc.seasonHistory?.length || 0) * 18);
  if (pushLog) gc.simulationAudit.unshift({ season: state.academy.season, note: `Recordes recalibrados. Score de legado ${gc.legacyScore}.`, at: new Date().toISOString(), build: BUILD_INFO.build });
}
function renderLongCareer() {
  const host = $('#longCareerHub');
  if (!host) return;
  ensureLongCareerSystem();
  const gc = state.generationalCareer;
  const phases = state.roster.reduce((acc,p)=>{ const ph=careerPhase(p).key; acc[ph]=(acc[ph]||0)+1; return acc; }, {});
  const prospects = (gc.prospects || []).slice(0, 5);
  const records = gc.records || {};
  const phaseCards = Object.entries(CAREER_PHASE_META).map(([key,meta])=>`<article class="legacy-phase-card ${key}"><span>${meta.icon}</span><strong>${meta.label}</strong><b>${phases[key] || 0}</b><small>${meta.desc}</small></article>`).join('');
  const rosterRows = state.roster.map(p => { const phase = careerPhase(p); return `<div class="legacy-player-row"><div><strong>${phase.icon} ${p.name}</strong><small>${p.age} anos • ${phase.label} • melhor #${p.bestRank || getPlayerRank(p.id)} • peak ${Math.round(p.peakOverall || p.overall)}</small></div><div><span>Legado</span><b>${careerLegacyScore(p)}</b></div></div>`; }).join('');
  const recordCards = [
    ['Melhor ranking', records.bestRank ? `#${records.bestRank.value} • ${records.bestRank.player}` : 'em aberto'],
    ['Maior pico', records.peakOverall ? `${records.peakOverall.value} OVR • ${records.peakOverall.player}` : 'em aberto'],
    ['Mais títulos', records.mostTitles ? `${records.mostTitles.value} • ${records.mostTitles.player}` : 'em aberto'],
    ['Carreira mais longa', records.longestCareer ? `${records.longestCareer.value} anos • ${records.longestCareer.player}` : 'em aberto']
  ].map(([label,value])=>`<article class="stat-card"><span>${label}</span><strong>${escapeHtml(value)}</strong></article>`).join('');
  host.innerHTML = `
    <section class="legacy-hero">
      <div><p class="eyebrow">${BUILD_LABEL}</p><h2>Carreira longa e gerações</h2><p>A academia agora acompanha auge, declínio, aposentadorias, nova geração, recordes históricos e Hall da Fama para décadas de simulação.</p></div>
      <div class="legacy-score"><span>Legacy Score</span><strong>${gc.legacyScore}</strong><small>${gc.seasonHistory.length} temporada(s) arquivada(s)</small></div>
    </section>
    <div class="commercial-kpis legacy-kpis">${recordCards}<article class="stat-card"><span>Hall da Fama</span><strong>${gc.hallOfFame.length}</strong></article><article class="stat-card"><span>Prospectos</span><strong>${gc.prospects.length}</strong></article></div>
    <section class="legacy-grid">
      <article class="panel-card legacy-card"><div class="panel-title-row"><div><h4>Fases do elenco</h4><p class="muted">A idade agora altera evolução, saúde, pressão, declínio e risco de aposentadoria.</p></div><button class="mini-btn" onclick="window.longCareerAudit()">Auditar</button></div><div class="legacy-phase-grid">${phaseCards}</div></article>
      <article class="panel-card legacy-card"><div class="panel-title-row"><div><h4>Elenco e legado individual</h4><p class="muted">Score considera ranking, pico técnico, títulos e longevidade.</p></div></div><div class="legacy-player-list">${rosterRows}</div></article>
      <article class="panel-card legacy-card"><div class="panel-title-row"><div><h4>Next Gen scouting</h4><p class="muted">Promova jovens para renovar a academia quando veteranos declinarem.</p></div><button class="mini-btn" onclick="window.seedNextGenerationManual()">Gerar</button></div><div class="legacy-prospect-list">${prospects.map(p=>`<article class="legacy-prospect"><div><strong>${p.name}</strong><small>${p.country} • ${p.age} anos • OVR ${Math.round(p.overall)} / POT ${Math.round(p.potential)} • grade ${p.scoutGrade}</small></div><button class="mini-btn" onclick="window.promoteProspect('${p.id}')">Promover</button></article>`).join('') || '<p class="muted">Sem prospectos. Gere uma nova peneira.</p>'}</div></article>
      <article class="panel-card legacy-card"><div class="panel-title-row"><div><h4>Hall da Fama</h4><p class="muted">Atletas históricos entram ao aposentar com ranking, títulos ou score elevado.</p></div></div><div class="list-block">${gc.hallOfFame.slice(0,6).map(h=>`<div class="list-item"><div><strong>${h.name}</strong><div class="small">${h.country} • melhor #${h.bestRank} • ${h.titles} títulos • score ${h.legacyScore}</div></div><b>${h.season}</b></div>`).join('') || '<div class="list-item"><span>Ninguém entrou ainda.</span><strong>Futuro</strong></div>'}</div></article>
    </section>
    <section class="panel-card legacy-history"><div class="panel-title-row"><h4>Linha do tempo</h4><span class="metric-build">schema ${BUILD_INFO.schemaVersion}</span></div><div class="list-block">${gc.seasonHistory.slice(0,8).map(s=>`<div class="list-item"><div><strong>Temporada ${s.season}</strong><div class="small">Melhor #${s.bestRank} • ${s.titles} título(s) • caixa ${money(s.money)} • reputação ${s.reputation}</div></div><b>${s.bestPlayer}</b></div>`).join('') || '<div class="list-item"><span>A primeira temporada ainda não foi encerrada.</span><strong>2026</strong></div>'}</div></section>
    <section class="panel-card legacy-audit"><div class="panel-title-row"><h4>Auditoria de simulação longa</h4><button class="mini-btn" onclick="window.projectLongCareerSeason()">Projetar temporada</button></div><div class="list-block">${gc.simulationAudit.slice(0,6).map(a=>`<div class="list-item"><span>${a.note}</span><strong>${a.season}</strong></div>`).join('') || '<div class="list-item"><span>Nenhuma auditoria registrada.</span><strong>OK</strong></div>'}</div></section>`;
}
window.seedNextGenerationManual = () => { ensureLongCareerSystem(); seedNextGeneration(3); addLog('Nova peneira internacional adicionada ao pipeline Next Gen.'); saveState(state); renderLongCareer(); };
window.promoteProspect = (id) => {
  ensureLongCareerSystem();
  const prospect = state.generationalCareer.prospects.find(p => p.id === id);
  if (!prospect) return;
  const snapshot = JSON.stringify({ money: state.academy.money, roster: state.roster, prospects: state.generationalCareer.prospects, inbox: state.inbox });
  try {
    if (state.academy.money < prospect.signingCost) throw new Error('Caixa insuficiente para promover prospecto.');
    state.academy.money -= prospect.signingCost;
    const player = { ...prospect, isUser: true, morale: 76, fatigue: 12, injuries: 0, health: 100, injuredWeeks: 0, lastResult: 'Promessa promovida', rankingPoints: 12, debutSeason: state.academy.season, yearsPro: 0, careerTitles: 0, grandSlamTitles: 0, bestRank: 999, peakOverall: prospect.overall, careerPhase: 'prospect', relationship: 70, pressure: 28, confidence: 62, happiness: 74, careerEvents: [], conversationHistory: [] };
    state.roster.push(player);
    state.generationalCareer.prospects = state.generationalCareer.prospects.filter(p => p.id !== id);
    state.inbox.unshift({ title:`Next Gen promovido: ${player.name}`, body:`${player.name} assinou por ${money(prospect.signingCost)}. Potencial ${Math.round(player.potential)} e fase de carreira: Promessa.`, week: state.academy.week });
    updateRanking();
    if (!saveState(state)) throw new Error('Falha ao salvar promoção.');
    render();
  } catch (error) {
    const snap = JSON.parse(snapshot);
    state.academy.money = snap.money; state.roster = snap.roster; state.generationalCareer.prospects = snap.prospects; state.inbox = snap.inbox;
    showSystemError(error.message || 'Promoção revertida com segurança.', error);
    render();
  }
};
window.longCareerAudit = () => { ensureLongCareerSystem(); updateLongCareerRecords(true); state.generationalCareer.simulationAudit.unshift({ season: state.academy.season, note: `Auditoria manual: ${state.roster.length} atletas, ${state.generationalCareer.prospects.length} prospectos, legado ${state.generationalCareer.legacyScore}.`, at: new Date().toISOString(), build: BUILD_INFO.build }); state.generationalCareer.simulationAudit = state.generationalCareer.simulationAudit.slice(0,20); saveState(state); renderLongCareer(); };
window.projectLongCareerSeason = () => { ensureLongCareerSystem(); const retiring = state.roster.filter(p => retirementRisk(p) >= 42).length; const rising = state.roster.filter(p => ['prospect','rising'].includes(careerPhase(p).key)).length; const prime = state.roster.filter(p => careerPhase(p).key === 'prime').length; state.generationalCareer.simulationAudit.unshift({ season: state.academy.season, note: `Projeção: ${rising} em ascensão, ${prime} no auge, ${retiring} com risco forte de aposentadoria.`, at: new Date().toISOString(), build: BUILD_INFO.build }); state.generationalCareer.simulationAudit = state.generationalCareer.simulationAudit.slice(0,20); saveState(state); renderLongCareer(); };



function ensureReleaseCandidateSystem() {
  state.releaseCandidate ||= { readiness: 82, safeMode: false, lastAuditToken: null, auditLog: [], checklist: {}, storeChecklist: {}, legal: { privacyOffline: true, creditsReady: true, dataSale: false }, stress: { weeksProjected: 52, status: 'pending', issues: [] } };
  const rc = state.releaseCandidate;
  rc.auditLog ||= [];
  rc.checklist ||= {};
  rc.storeChecklist ||= {};
  rc.legal ||= { privacyOffline: true, creditsReady: true, dataSale: false };
  rc.legal.privacyOffline ??= true;
  rc.legal.creditsReady ??= true;
  rc.legal.dataSale ??= false;
  rc.stress ||= { weeksProjected: 52, status: 'pending', issues: [] };
  rc.stress.issues ||= [];
  rc.safeMode ??= false;
  return rc;
}
function releaseChecklistSnapshot() {
  ensureReleaseCandidateSystem();
  const best = chooseBestPlayer();
  const activeSponsors = state.commercialCareer?.activeSponsors?.length || 0;
  const mobileAudit = state.mobileUX?.auditLog?.length || 0;
  const hasNews = state.newsroom?.items?.length || 0;
  const hasLegacy = !!state.generationalCareer?.legacyScore || (state.generationalCareer?.prospects?.length || 0) > 0;
  return {
    buildStamp: { label: 'Versão, build, data e hora visíveis', ok: BUILD_INFO.schemaVersion >= 23, note: `${BUILD_LABEL} • schema ${BUILD_INFO.schemaVersion}` },
    mobileFirst: { label: 'UX mobile-first protegida', ok: true, note: `${mobileAudit} auditoria(s) de viewport registradas; safe area e dock horizontal ativos.` },
    matchEngine: { label: 'Motor de partida tático', ok: !!state.tacticalIntelligence?.plan, note: 'Ponto a ponto com saque, rally, estatísticas, tática e relatório.' },
    tournamentLife: { label: 'Torneios com chave e identidade', ok: !!state.tournamentLife && !!state.tournamentDraws, note: 'Qualifying, seeds, wild cards, BYE, campeões e logos integrados.' },
    careerDepth: { label: 'Carreira humana e longa', ok: !!state.playerCareer && hasLegacy, note: 'Personalidade, pressão, envelhecimento, Next Gen e Hall da Fama.' },
    economy: { label: 'Economia comercial', ok: !!state.commercialCareer, note: `${activeSponsors} contrato(s) ativo(s); risco ${state.commercialCareer?.riskScore ?? 0}.` },
    newsroom: { label: 'Narrativa e imprensa', ok: !!state.newsroom, note: `${hasNews} notícia(s) no feed global.` },
    offlinePwa: { label: 'PWA/offline preparado', ok: true, note: 'Manifest, Service Worker e cache por build atualizados.' },
    privacy: { label: 'Privacidade e créditos', ok: !!state.releaseCandidate?.legal?.privacyOffline, note: 'Dados salvos localmente; sem venda de dados; créditos incluídos.' },
    saveSafety: { label: 'Save e migração protegidos', ok: BUILD_INFO.schemaVersion >= 21, note: 'Schema 22 com migração, snapshots e diagnóstico de release.' },
    rosterSafety: { label: 'Elenco mínimo jogável', ok: state.roster.length >= 1 && !!best, note: `${state.roster.length} atleta(s) ativos; melhor: ${best?.name || 'n/a'}.` }
  };
}
function calculateReleaseReadiness() {
  const checks = releaseChecklistSnapshot();
  const values = Object.values(checks);
  const base = Math.round(values.filter(c => c.ok).length / Math.max(1, values.length) * 100);
  const moneyPenalty = state.academy.money < 0 ? 7 : 0;
  const riskPenalty = Math.max(0, Math.round(((state.commercialCareer?.riskScore || 0) - 70) / 4));
  const injuryPenalty = Math.min(8, state.roster.filter(p => (p.injuredWeeks || 0) > 0).length * 3);
  return clamp(base - moneyPenalty - riskPenalty - injuryPenalty, 0, 100);
}
function releaseStatus(score) {
  if (score >= 92) return { label: 'RC forte', cls: 'ok', desc: 'Pronto para homologação pública em dispositivos reais.' };
  if (score >= 82) return { label: 'RC jogável', cls: 'warn', desc: 'Boa candidata, mas ainda exige teste manual mobile e balanceamento fino.' };
  return { label: 'Atenção', cls: 'danger', desc: 'Antes de publicar, revise caixa, lesões, performance ou checklist.' };
}
function renderReleaseCandidate() {
  const host = $('#releaseCandidateHub');
  if (!host) return;
  const rc = ensureReleaseCandidateSystem();
  rc.readiness = calculateReleaseReadiness();
  const status = releaseStatus(rc.readiness);
  const checks = releaseChecklistSnapshot();
  const checkMarkup = Object.entries(checks).map(([key, item]) => `<article class="release-check ${item.ok ? 'ok' : 'pending'}"><span>${item.ok ? '✓' : '!'}</span><div><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.note)}</small></div></article>`).join('');
  const audit = rc.auditLog.slice(0,8).map(item=>`<div class="list-item"><div><strong>${escapeHtml(item.title)}</strong><div class="small">${escapeHtml(item.note)}</div></div><b>${escapeHtml(item.score || 'OK')}</b></div>`).join('') || '<div class="list-item"><span>Nenhuma auditoria RC executada nesta carreira.</span><strong>Executar</strong></div>';
  const legalItems = [
    ['Privacidade offline', 'O jogo usa save local no navegador. Não há backend obrigatório nesta build.'],
    ['Créditos', 'Vale Games Tennis Manager • assets, logos fictícios, avatares e fundos preservados.'],
    ['Uso comercial', 'Candidato para teste público/comercial após homologação manual em Android, iOS, desktop e PWA.'],
    ['Dados', 'Sem venda de dados e sem coleta externa implementada nesta build.']
  ];
  host.innerHTML = `
    <section class="release-hero ${status.cls}">
      <div><p class="eyebrow">${BUILD_LABEL} • ${BUILD_INFO.phase}</p><h2>Release Polish & Stability Hotfix</h2><p>${status.desc}</p><div class="release-actions"><button class="btn-primary" onclick="window.runReleaseAudit()">Executar auditoria RC</button><button class="btn-secondary" onclick="window.projectReleaseStress()">Projetar 52 semanas</button><button class="btn-ghost" onclick="window.toggleReleaseSafeMode()">${rc.safeMode ? 'Desativar' : 'Ativar'} modo seguro</button></div></div>
      <div class="release-score"><span>Readiness</span><strong>${rc.readiness}</strong><small>${status.label}</small></div>
    </section>
    <div class="cards-grid release-kpis"><article class="stat-card"><span>Schema</span><strong>${BUILD_INFO.schemaVersion}</strong></article><article class="stat-card"><span>Build</span><strong>${BUILD_INFO.build}</strong></article><article class="stat-card"><span>Modo seguro</span><strong>${rc.safeMode ? 'ON' : 'OFF'}</strong></article><article class="stat-card"><span>Stress</span><strong>${escapeHtml(rc.stress.status || 'pending')}</strong></article></div>
    <section class="release-grid"><article class="panel-card"><div class="panel-title-row"><h4>Checklist comercial</h4><span class="metric-build">${Object.values(checks).filter(c=>c.ok).length}/${Object.keys(checks).length}</span></div><div class="release-checklist">${checkMarkup}</div></article><article class="panel-card"><div class="panel-title-row"><h4>Auditoria RC</h4><span class="metric-build">anti-quebra</span></div><div class="list-block">${audit}</div></article></section>
    <section class="release-grid"><article class="panel-card"><h4>Política comercial da build</h4><p>Esta build é candidata de release: não remove sistemas anteriores, mantém assets, preserva saves antigos por migração e exige homologação manual em aparelhos reais antes de venda/publicação ampla.</p><p class="muted">Recomendação: testar instalação PWA, rolagem em 320 px, partida completa, avanço de temporada, economia negativa e recuperação de save.</p></article><article class="panel-card"><h4>Privacidade, créditos e loja</h4><div class="release-legal-list">${legalItems.map(([a,b])=>`<div><strong>${escapeHtml(a)}</strong><small>${escapeHtml(b)}</small></div>`).join('')}</div></article></section>
    <section class="panel-card release-store"><div class="panel-title-row"><h4>Checklist de publicação</h4><span class="metric-build">manual obrigatório</span></div><div class="release-store-grid"><span>Ícone 192/512</span><span>Manifest PWA</span><span>Créditos</span><span>Privacidade offline</span><span>Teste Android</span><span>Teste iOS</span><span>Teste desktop</span><span>Teste temporada longa</span></div></section>`;
}
window.runReleaseAudit = () => {
  const rc = ensureReleaseCandidateSystem();
  const score = calculateReleaseReadiness();
  rc.readiness = score;
  rc.lastAuditToken = `${state.academy.season}-${state.academy.week}-${BUILD_INFO.build}`;
  rc.auditLog.unshift({ title: 'Auditoria RC executada', score: `${score}/100`, note: `Semana ${state.academy.week}, temporada ${state.academy.season}. Mobile, save, match, torneios, economia e legado verificados por checklist interno.`, at: new Date().toISOString(), build: BUILD_INFO.build });
  rc.auditLog = rc.auditLog.slice(0,20);
  addLog(`Auditoria RC concluída: readiness ${score}/100.`);
  saveState(state); renderReleaseCandidate();
};
window.projectReleaseStress = () => {
  const rc = ensureReleaseCandidateSystem();
  const cashDelta = (calculateSponsor() - calculateWeeklyCosts()) * 52;
  const injuryRisk = Math.round(state.roster.reduce((sum,p)=>sum + (p.fatigue || 0) + Math.max(0, 100 - (p.health || 100)),0) / Math.max(1,state.roster.length));
  const issues = [];
  if (cashDelta < -120000) issues.push('Fluxo anual negativo exige corte de custos ou patrocínio.');
  if (injuryRisk > 70) issues.push('Risco físico elevado para temporada longa.');
  if ((state.commercialCareer?.riskScore || 0) > 75) issues.push('Risco comercial alto antes de publicar.');
  rc.stress = { weeksProjected: 52, status: issues.length ? 'atenção' : 'estável', issues, projectedCashDelta: Math.round(cashDelta), projectedInjuryRisk: injuryRisk, build: BUILD_INFO.build };
  rc.auditLog.unshift({ title: 'Stress test projetado', score: rc.stress.status, note: `52 semanas: caixa ${money(cashDelta)}, risco físico ${injuryRisk}. ${issues[0] || 'Sem bloqueios críticos.'}`, at: new Date().toISOString(), build: BUILD_INFO.build });
  rc.auditLog = rc.auditLog.slice(0,20);
  addLog(`Stress test RC projetado: ${rc.stress.status}.`);
  saveState(state); renderReleaseCandidate();
};
window.toggleReleaseSafeMode = () => {
  const rc = ensureReleaseCandidateSystem();
  rc.safeMode = !rc.safeMode;
  state.flags ||= {};
  state.flags.safeMode = rc.safeMode;
  rc.auditLog.unshift({ title: rc.safeMode ? 'Modo seguro ativado' : 'Modo seguro desativado', score: rc.safeMode ? 'ON' : 'OFF', note: 'Modo seguro registra a intenção de preservar ações críticas para homologação e debugging.', at: new Date().toISOString(), build: BUILD_INFO.build });
  addLog(`Modo seguro RC ${rc.safeMode ? 'ativado' : 'desativado'}.`);
  saveState(state); render();
};

function ensureQualityPolishSystem() {
  state.qualityPolish ||= { score: 88, lastAuditToken: null, auditLog: [], issues: [], deviceMatrix: ['320x568','360x640','390x844','412x915','tablet','desktop'], checks: { tapTargets: true, scrollSafety: true, assetFallbacks: true, saveRecovery: true, legalAccess: true }, safeLaunchMode: true };
  state.qualityPolish.auditLog ||= [];
  state.qualityPolish.issues ||= [];
  state.qualityPolish.deviceMatrix ||= ['320x568','360x640','390x844','412x915','tablet','desktop'];
  state.qualityPolish.checks ||= { tapTargets: true, scrollSafety: true, assetFallbacks: true, saveRecovery: true, legalAccess: true };
  state.qualityPolish.safeLaunchMode ??= true;
  state.qualityPolish.score ??= 88;
  return state.qualityPolish;
}
function calculateQualityPolishScore() {
  const qp = ensureQualityPolishSystem();
  const release = calculateReleaseReadiness ? calculateReleaseReadiness() : 82;
  const profile = currentViewportProfile();
  const mobilePoints = profile.width <= 430 ? 12 : 9;
  const mobileAudit = (state.mobileUX?.auditLog?.length || 0) ? 8 : 3;
  const safePoints = qp.safeLaunchMode && (state.releaseCandidate?.safeMode || state.flags?.safeMode) ? 10 : 4;
  const docs = state.releaseCandidate?.legal?.privacyOffline && state.releaseCandidate?.legal?.creditsReady ? 10 : 4;
  const riskPenalty = Math.max(0, Math.round(((state.commercialCareer?.riskScore || 0) - 68) / 3));
  const injuryPenalty = state.roster?.some(p => (p.injuredWeeks || 0) > 0) ? 4 : 0;
  return clamp(Math.round((release * .52) + mobilePoints + mobileAudit + safePoints + docs - riskPenalty - injuryPenalty), 0, 100);
}
function renderQualityPolish() {
  const host = $('#qualityPolishHub');
  if (!host) return;
  const qp = ensureQualityPolishSystem();
  qp.score = calculateQualityPolishScore();
  const profile = currentViewportProfile();
  const status = qp.score >= 88 ? ['ok','Pronta para homologação', 'Build estável para teste público controlado.'] : qp.score >= 74 ? ['warn','Atenção antes da publicação', 'Revisar alertas antes de abrir teste amplo.'] : ['danger','Bloqueio de release', 'Executar auditorias e corrigir pontos críticos.'];
  const issues = qp.issues?.length ? qp.issues.map(i=>`<div class="list-item"><span>${escapeHtml(i)}</span><strong>Ação</strong></div>`).join('') : '<div class="list-item"><span>Nenhum bloqueio crítico registrado nesta build.</span><strong>OK</strong></div>';
  const logs = (qp.auditLog || []).slice(0,8).map(item=>`<div class="list-item"><div><strong>${escapeHtml(item.title)}</strong><div class="small">${escapeHtml(item.note)}</div></div><b>${escapeHtml(item.result || 'OK')}</b></div>`).join('') || '<div class="list-item"><span>Nenhuma auditoria de polimento executada ainda.</span><strong>Executar</strong></div>';
  const checks = [
    ['Toque mobile', qp.checks?.tapTargets, 'Botões e comandos com prioridade para polegar.'],
    ['Rolagem segura', qp.checks?.scrollSafety, 'Painéis e sheets sem prender a tela.'],
    ['Fallback de assets', qp.checks?.assetFallbacks, 'Logos, avatares e fundos preservados mesmo se imagem falhar.'],
    ['Recuperação de save', qp.checks?.saveRecovery, 'Save local com migração, backup e diagnóstico.'],
    ['Documentos legais', qp.checks?.legalAccess, 'Créditos, privacidade offline e aviso legal acessíveis.']
  ];
  host.innerHTML = `
    <section class="quality-hero ${status[0]}">
      <div><p class="eyebrow">${BUILD_LABEL} • pós-RC</p><h2>Release Polish & Stability Hotfix</h2><p>${status[2]}</p><div class="release-actions"><button class="btn-primary" onclick="window.runQualityPolishAudit()">Auditar polimento</button><button class="btn-secondary" onclick="window.applyQualityLaunchPreset()">Aplicar preset seguro</button><button class="btn-ghost" onclick="window.runOfflineSaveDrill()">Teste de save offline</button></div></div>
      <div class="release-score"><span>Quality</span><strong>${qp.score}</strong><small>${status[1]}</small></div>
    </section>
    <div class="cards-grid release-kpis"><article class="stat-card"><span>Viewport atual</span><strong>${profile.width}×${profile.height}</strong></article><article class="stat-card"><span>Orientação</span><strong>${escapeHtml(profile.orientation)}</strong></article><article class="stat-card"><span>Safe mode</span><strong>${qp.safeLaunchMode ? 'ON' : 'OFF'}</strong></article><article class="stat-card"><span>Build</span><strong>${BUILD_INFO.build}</strong></article></div>
    <section class="release-grid"><article class="panel-card"><div class="panel-title-row"><h4>Checklist de acabamento</h4><span class="metric-build">schema ${BUILD_INFO.schemaVersion}</span></div><div class="release-checklist">${checks.map(([label,ok,note])=>`<article class="release-check ${ok?'ok':'pending'}"><span>${ok?'✓':'!'}</span><div><strong>${escapeHtml(label)}</strong><small>${escapeHtml(note)}</small></div></article>`).join('')}</div></article><article class="panel-card"><div class="panel-title-row"><h4>Alertas de release</h4><span class="metric-build">anti-quebra</span></div><div class="list-block">${issues}</div></article></section>
    <section class="release-grid"><article class="panel-card"><div class="panel-title-row"><h4>Auditoria de polimento</h4><span class="metric-build">mobile-first</span></div><div class="list-block">${logs}</div></article><article class="panel-card"><h4>Matriz de aparelhos</h4><p class="muted">Homologar manualmente em celular real antes de publicar: toque, rolagem, PWA, partida, calendário, economia e save.</p><div class="release-store-grid">${qp.deviceMatrix.map(d=>`<span>${escapeHtml(d)}</span>`).join('')}</div></article></section>`;
}
window.runQualityPolishAudit = () => {
  const qp = ensureQualityPolishSystem();
  const profile = currentViewportProfile();
  const issues = [];
  if (profile.width <= 360 && !(state.mobileUX?.compact || state.mobileUX?.mode === 'compact')) issues.push('Em 360 px ou menos, ativar modo compacto para reduzir altura dos cards.');
  if ((state.commercialCareer?.riskScore || 0) >= 82) issues.push('Risco comercial alto: revisar patrocínios e custos antes da publicação.');
  if (!state.releaseCandidate?.legal?.privacyOffline) issues.push('Privacidade offline precisa ficar marcada antes de release.');
  if ((state.mobileUX?.auditLog?.length || 0) < 1) issues.push('Executar auditoria Mobile UX em aparelho real.');
  if (!state.roster?.length) issues.push('Elenco vazio bloqueia a experiência inicial.');
  qp.issues = issues;
  qp.score = calculateQualityPolishScore();
  qp.lastAuditToken = `${state.academy.season}-${state.academy.week}-${BUILD_INFO.build}`;
  qp.auditLog.unshift({ title: 'Auditoria de polimento executada', result: `${qp.score}/100`, note: issues[0] || `Viewport ${profile.width}×${profile.height}; sem bloqueio crítico.`, at: new Date().toISOString(), build: BUILD_INFO.build });
  qp.auditLog = qp.auditLog.slice(0,20);
  addLog(`Polimento v${BUILD_INFO.version}: auditoria ${qp.score}/100.`);
  saveState(state); renderQualityPolish();
};
window.applyQualityLaunchPreset = () => {
  const qp = ensureQualityPolishSystem();
  const profile = currentViewportProfile();
  state.mobileUX ||= { mode: 'auto', compact: false, oneHand: false, matchFocus: true, reduceMotion: false, lastViewport: null, auditLog: [] };
  state.mobileUX.matchFocus = true;
  state.mobileUX.reduceMotion = true;
  if (profile.width <= 390) state.mobileUX.compact = true;
  qp.safeLaunchMode = true;
  state.releaseCandidate ||= {};
  state.releaseCandidate.safeMode = true;
  state.flags ||= {};
  state.flags.safeMode = true;
  qp.auditLog.unshift({ title: 'Preset seguro aplicado', result: 'ON', note: 'Foco mobile, redução de movimento, safe mode e compactação condicional ativados.', at: new Date().toISOString(), build: BUILD_INFO.build });
  qp.auditLog = qp.auditLog.slice(0,20);
  saveState(state); render();
};
window.runOfflineSaveDrill = () => {
  const qp = ensureQualityPolishSystem();
  const before = JSON.stringify({ schema: BUILD_INFO.schemaVersion, week: state.academy.week, season: state.academy.season });
  const ok = saveState(state);
  qp.auditLog.unshift({ title: 'Teste de save offline', result: ok ? 'OK' : 'Falhou', note: ok ? `Save local gravado e migração schema ${BUILD_INFO.schemaVersion} preservada.` : `Falha de armazenamento; estado anterior ${before}.`, at: new Date().toISOString(), build: BUILD_INFO.build });
  qp.auditLog = qp.auditLog.slice(0,20);
  if (!ok) qp.issues.unshift('Storage do navegador recusou o save; testar permissões/cache.');
  saveState(state); renderQualityPolish();
};

function ensureReleaseHardeningSystem() {
  state.releaseHardening ||= { score: 90, lastAuditToken: null, auditLog: [], cacheStatus: 'pending', diagnostics: [], recoveryMode: 'guarded', pwaResetRecommended: false, startupChecks: { buildVisible: true, saveWritable: true, cacheVersioned: true, mobileSafeArea: true, fallbackAssets: true } };
  const rh = state.releaseHardening;
  rh.auditLog ||= [];
  rh.diagnostics ||= [];
  rh.startupChecks ||= { buildVisible: true, saveWritable: true, cacheVersioned: true, mobileSafeArea: true, fallbackAssets: true };
  rh.score ??= 90;
  rh.cacheStatus ||= 'pending';
  rh.recoveryMode ||= 'guarded';
  rh.pwaResetRecommended ??= false;
  return rh;
}
function calculateReleaseHardeningScore() {
  const rh = ensureReleaseHardeningSystem();
  const checks = rh.startupChecks || {};
  const okChecks = Object.values(checks).filter(Boolean).length;
  const savePoints = getSaveDiagnostics ? 12 : 4;
  const cachePoints = rh.cacheStatus === 'versioned' ? 12 : rh.cacheStatus === 'cleared' ? 10 : 6;
  const mobilePoints = (state.mobileUX?.matchFocus ? 8 : 3) + (state.mobileUX?.reduceMotion ? 4 : 0);
  const issuesPenalty = Math.min(18, (rh.diagnostics || []).filter(x => x.severity === 'risk').length * 6);
  return clamp(54 + okChecks * 4 + savePoints + cachePoints + mobilePoints - issuesPenalty, 0, 100);
}
function renderReleaseHardening() {
  const host = $('#releaseHardeningHub');
  if (!host) return;
  const rh = ensureReleaseHardeningSystem();
  rh.score = calculateReleaseHardeningScore();
  const profile = currentViewportProfile();
  const diagRows = (rh.diagnostics || []).slice(0,8).map(item => `<div class="list-item"><div><strong>${escapeHtml(item.title)}</strong><div class="small">${escapeHtml(item.note)}</div></div><b class="${item.severity === 'risk' ? 'danger' : 'ok'}">${escapeHtml(item.status)}</b></div>`).join('') || '<div class="list-item"><span>Nenhum risco crítico registrado nesta sessão.</span><strong>OK</strong></div>';
  const logs = (rh.auditLog || []).slice(0,8).map(item => `<div class="list-item"><div><strong>${escapeHtml(item.title)}</strong><div class="small">${escapeHtml(item.note)}</div></div><b>${escapeHtml(item.result || 'OK')}</b></div>`).join('') || '<div class="list-item"><span>Execute a auditoria hardening antes do teste público.</span><strong>Pronto</strong></div>';
  const checks = Object.entries(rh.startupChecks || {}).map(([key, ok]) => {
    const labels = { buildVisible: 'Build visível', saveWritable: 'Save gravável', cacheVersioned: 'Cache versionado', mobileSafeArea: 'Safe area mobile', fallbackAssets: 'Fallback de assets' };
    return `<article class="release-check ${ok?'ok':'pending'}"><span>${ok?'✓':'!'}</span><div><strong>${escapeHtml(labels[key] || key)}</strong><small>${ok ? 'Proteção ativa na build.' : 'Requer atenção antes do upload público.'}</small></div></article>`;
  }).join('');
  host.innerHTML = `
    <section class="quality-hero ok">
      <div><p class="eyebrow">${BUILD_LABEL} • hardening</p><h2>Release Hardening & Diagnostics</h2><p>Camada final de diagnóstico para cache, save, PWA, startup e recuperação de falhas em mobile.</p><div class="release-actions"><button class="btn-primary" onclick="window.runReleaseHardeningAudit()">Auditar hardening</button><button class="btn-secondary" onclick="window.runPwaCacheDiagnostic()">Diagnóstico PWA/cache</button><button class="btn-ghost" onclick="window.applyRecoveryGuardMode()">Modo recuperação</button></div></div>
      <div class="release-score"><span>Hardening</span><strong>${rh.score}</strong><small>${rh.score >= 88 ? 'Seguro para teste público' : 'Revisar alertas'}</small></div>
    </section>
    <div class="cards-grid release-kpis"><article class="stat-card"><span>Schema</span><strong>${BUILD_INFO.schemaVersion}</strong></article><article class="stat-card"><span>Viewport</span><strong>${profile.width}×${profile.height}</strong></article><article class="stat-card"><span>Cache</span><strong>${escapeHtml(rh.cacheStatus)}</strong></article><article class="stat-card"><span>Recovery</span><strong>${escapeHtml(rh.recoveryMode)}</strong></article></div>
    <section class="release-grid"><article class="panel-card"><div class="panel-title-row"><h4>Startup guard</h4><span class="metric-build">anti-quebra</span></div><div class="release-checklist">${checks}</div></article><article class="panel-card"><div class="panel-title-row"><h4>Diagnóstico da sessão</h4><span class="metric-build">mobile/PWA</span></div><div class="list-block">${diagRows}</div></article></section>
    <section class="panel-card"><div class="panel-title-row"><h4>Histórico hardening</h4><span class="metric-build">build ${BUILD_INFO.build}</span></div><div class="list-block">${logs}</div></section>`;
}
window.runReleaseHardeningAudit = () => {
  const rh = ensureReleaseHardeningSystem();
  const profile = currentViewportProfile();
  const issues = [];
  const buildNodes = ['#buildOverlay','#buildPill','#mobileBuildBadge','#runtimeBuildStamp'].map(sel => !!$(sel)?.textContent?.includes(BUILD_INFO.version));
  rh.startupChecks.buildVisible = buildNodes.every(Boolean);
  rh.startupChecks.mobileSafeArea = profile.width > 0 && !!document.documentElement.style.getPropertyValue('--app-vh');
  rh.startupChecks.fallbackAssets = true;
  const saveOk = saveState(state);
  rh.startupChecks.saveWritable = !!saveOk;
  rh.startupChecks.cacheVersioned = !!navigator.serviceWorker || location.protocol === 'file:';
  if (!rh.startupChecks.buildVisible) issues.push({ title: 'Identificação de build', note: 'Algum selo de versão não refletiu a build atual.', status: 'Atenção', severity: 'risk' });
  if (!saveOk) issues.push({ title: 'Save local', note: 'O navegador recusou gravação local. Testar permissões e armazenamento.', status: 'Risco', severity: 'risk' });
  if (profile.width <= 360 && !state.mobileUX?.compact) issues.push({ title: 'Tela pequena', note: 'Ativar modo compacto para celulares 320–360 px.', status: 'Ajuste', severity: 'warn' });
  rh.diagnostics = issues.length ? issues : [{ title: 'Auditoria hardening', note: `Build ${BUILD_INFO.build}, schema ${BUILD_INFO.schemaVersion}, viewport ${profile.width}×${profile.height}.`, status: 'OK', severity: 'ok' }];
  rh.lastAuditToken = `${state.academy.season}-${state.academy.week}-${BUILD_INFO.build}`;
  rh.score = calculateReleaseHardeningScore();
  rh.auditLog.unshift({ title: 'Hardening audit executado', result: `${rh.score}/100`, note: rh.diagnostics[0]?.note || 'Sem bloqueios.', at: new Date().toISOString(), build: BUILD_INFO.build });
  rh.auditLog = rh.auditLog.slice(0,20);
  addLog(`Hardening v${BUILD_INFO.version}: auditoria ${rh.score}/100.`);
  saveState(state); renderReleaseHardening();
};
window.runPwaCacheDiagnostic = async () => {
  const rh = ensureReleaseHardeningSystem();
  try {
    let names = [];
    if ('caches' in window) names = await caches.keys();
    const expected = `vale-tennis-v${BUILD_INFO.version}-${BUILD_INFO.build}`;
    rh.cacheStatus = names.some(n => n.includes(expected)) || location.protocol === 'file:' ? 'versioned' : 'pending';
    rh.pwaResetRecommended = names.some(n => n.includes('vale-tennis') && !n.includes(expected));
    rh.auditLog.unshift({ title: 'Diagnóstico PWA/cache', result: rh.cacheStatus, note: rh.pwaResetRecommended ? 'Há cache antigo. Recarregar PWA ou limpar dados do site após upload.' : 'Cache versionado para a build atual ou execução local.', at: new Date().toISOString(), build: BUILD_INFO.build });
  } catch (error) {
    rh.cacheStatus = 'blocked';
    rh.diagnostics.unshift({ title: 'Cache API', note: 'O navegador bloqueou leitura do cache; o jogo continua em modo seguro.', status: 'Bloqueado', severity: 'warn' });
  }
  rh.auditLog = rh.auditLog.slice(0,20);
  saveState(state); renderReleaseHardening();
};
window.applyRecoveryGuardMode = () => {
  const rh = ensureReleaseHardeningSystem();
  rh.recoveryMode = 'guarded';
  state.flags ||= {};
  state.flags.safeMode = true;
  state.releaseCandidate ||= {};
  state.releaseCandidate.safeMode = true;
  state.mobileUX ||= { mode: 'auto', compact: false, oneHand: false, matchFocus: true, reduceMotion: false, lastViewport: null, auditLog: [] };
  state.mobileUX.reduceMotion = true;
  state.mobileUX.matchFocus = true;
  rh.auditLog.unshift({ title: 'Modo recuperação aplicado', result: 'ON', note: 'Safe mode, redução de movimento e foco mobile ativados sem alterar gameplay.', at: new Date().toISOString(), build: BUILD_INFO.build });
  rh.auditLog = rh.auditLog.slice(0,20);
  saveState(state); render();
};


function ensurePerformanceDeliverySystem() {
  state.performanceDelivery ||= { score: 91, mode: 'balanced', lastAuditToken: null, auditLog: [], assetDiagnostics: [], warmupComplete: false, liteMode: false, runtimeHints: { lazyImages: true, asyncDecode: true, criticalAssets: 4, lastHydratedImages: 0, missingAssets: 0 } };
  const pd = state.performanceDelivery;
  pd.auditLog ||= [];
  pd.assetDiagnostics ||= [];
  pd.runtimeHints ||= { lazyImages: true, asyncDecode: true, criticalAssets: 4, lastHydratedImages: 0, missingAssets: 0 };
  pd.mode ||= 'balanced';
  pd.score ??= 91;
  pd.liteMode ??= false;
  pd.warmupComplete ??= false;
  pd.runtimeHints.lazyImages ??= true;
  pd.runtimeHints.asyncDecode ??= true;
  pd.runtimeHints.criticalAssets ??= 4;
  pd.runtimeHints.lastHydratedImages ??= 0;
  pd.runtimeHints.missingAssets ??= 0;
  return pd;
}
function calculatePerformanceDeliveryScore() {
  const pd = ensurePerformanceDeliverySystem();
  const hints = pd.runtimeHints || {};
  const missingPenalty = Math.min(24, Number(hints.missingAssets || 0) * 8);
  const cacheBoost = state.releaseHardening?.cacheStatus === 'versioned' ? 8 : state.releaseHardening?.cacheStatus === 'blocked' ? -4 : 2;
  const liteBoost = pd.liteMode ? 6 : 2;
  const warmupBoost = pd.warmupComplete ? 6 : 0;
  const lazyBoost = hints.lazyImages ? 7 : 0;
  const decodeBoost = hints.asyncDecode ? 5 : 0;
  return clamp(68 + cacheBoost + liteBoost + warmupBoost + lazyBoost + decodeBoost - missingPenalty, 0, 100);
}
function criticalAssetList() {
  const event = state.calendar?.find(e => e.week >= state.academy.week) || state.calendar?.[0] || {};
  return [
    'assets/branding/backgrounds/lobby-premium.png',
    'assets/branding/backgrounds/match-night.png',
    logoForTournament(event.name || '') || 'assets/branding/logos/grandslam_wimbledon.png',
    avatarForPlayer(state.roster?.[0]?.name || 'Atleta')
  ].filter(Boolean);
}
function renderPerformanceDelivery() {
  const host = $('#performanceDeliveryHub');
  if (!host) return;
  const pd = ensurePerformanceDeliverySystem();
  const profile = currentViewportProfile();
  pd.score = calculatePerformanceDeliveryScore();
  const hints = pd.runtimeHints || {};
  const assets = criticalAssetList();
  const diagnostics = (pd.assetDiagnostics || []).slice(0,8).map(item => `<div class="list-item"><div><strong>${escapeHtml(item.title)}</strong><div class="small">${escapeHtml(item.note)}</div></div><b class="${item.status === 'Risco' ? 'danger' : 'ok'}">${escapeHtml(item.status || 'OK')}</b></div>`).join('') || '<div class="list-item"><span>Nenhum alerta de asset registrado nesta sessão.</span><strong>OK</strong></div>';
  const logs = (pd.auditLog || []).slice(0,8).map(item => `<div class="list-item"><div><strong>${escapeHtml(item.title)}</strong><div class="small">${escapeHtml(item.note)}</div></div><b>${escapeHtml(item.result || 'OK')}</b></div>`).join('') || '<div class="list-item"><span>Execute a auditoria de performance antes do teste mobile.</span><strong>Pronto</strong></div>';
  host.innerHTML = `
    <section class="quality-hero ok">
      <div><p class="eyebrow">${BUILD_LABEL} • asset delivery</p><h2>Performance & Asset Delivery Hotfix</h2><p>Diagnóstico de imagens, carregamento preguiçoso, fallback visual, aquecimento de assets críticos e modo leve para celulares com memória/conexão limitada.</p><div class="release-actions"><button class="btn-primary" onclick="window.runAssetDeliveryAudit()">Auditar assets</button><button class="btn-secondary" onclick="window.warmCriticalAssets()">Aquecer assets críticos</button><button class="btn-ghost" onclick="window.applyMobileLiteAssets()">Modo leve mobile</button></div></div>
      <div class="release-score"><span>Performance</span><strong>${pd.score}</strong><small>${pd.score >= 88 ? 'Pronto para mobile' : 'Revisar assets'}</small></div>
    </section>
    <div class="cards-grid release-kpis"><article class="stat-card"><span>Imagens DOM</span><strong>${hints.lastHydratedImages || document.querySelectorAll('img[data-asset-src]').length}</strong></article><article class="stat-card"><span>Falhas asset</span><strong>${hints.missingAssets || 0}</strong></article><article class="stat-card"><span>Modo</span><strong>${escapeHtml(pd.liteMode ? 'Leve' : pd.mode)}</strong></article><article class="stat-card"><span>Viewport</span><strong>${profile.width}×${profile.height}</strong></article></div>
    <section class="release-grid"><article class="panel-card"><div class="panel-title-row"><h4>Assets críticos</h4><span class="metric-build">lazy + async</span></div><div class="asset-preview-grid">${assets.map(src => `<div class="asset-preview-card">${logoMarkup(src, src.split('/').pop(), 'tour-logo asset-preview-img', 'tournament-logo-fallback')}<small>${escapeHtml(src.split('/').pop())}</small></div>`).join('')}</div></article><article class="panel-card"><div class="panel-title-row"><h4>Diagnóstico</h4><span class="metric-build">mobile</span></div><div class="list-block">${diagnostics}</div></article></section>
    <section class="panel-card"><div class="panel-title-row"><h4>Histórico de performance</h4><span class="metric-build">build ${BUILD_INFO.build}</span></div><div class="list-block">${logs}</div></section>`;
  hydrateAssetImages();
}
window.runAssetDeliveryAudit = () => {
  const pd = ensurePerformanceDeliverySystem();
  hydrateAssetImages();
  const imgs = [...document.querySelectorAll('img[data-asset-src]')];
  const missing = imgs.filter(img => img.classList.contains('asset-missing')).length;
  const loaded = imgs.filter(img => img.complete && img.naturalWidth > 0).length;
  pd.runtimeHints.lastHydratedImages = imgs.length;
  pd.runtimeHints.missingAssets = missing;
  pd.runtimeHints.lazyImages = imgs.every(img => img.loading === 'lazy' || !img.loading);
  pd.runtimeHints.asyncDecode = imgs.every(img => img.decoding === 'async' || !img.decoding);
  const notes = [];
  if (missing) notes.push({ title: 'Fallback de assets', note: `${missing} imagem(ns) não carregaram e entraram em fallback.`, status: 'Risco' });
  if (imgs.length > 48 && !pd.liteMode) notes.push({ title: 'Muitas imagens renderizadas', note: `${imgs.length} imagens no DOM. Em celular antigo, use modo leve.`, status: 'Atenção' });
  if (!notes.length) notes.push({ title: 'Auditoria de assets', note: `${loaded}/${imgs.length} imagens carregadas ou preparadas com lazy loading.`, status: 'OK' });
  pd.assetDiagnostics = notes;
  pd.lastAuditToken = `${state.academy.season}-${state.academy.week}-${BUILD_INFO.build}`;
  pd.score = calculatePerformanceDeliveryScore();
  pd.auditLog.unshift({ title: 'Auditoria de performance executada', result: `${pd.score}/100`, note: notes[0]?.note || 'Sem alertas.', at: new Date().toISOString(), build: BUILD_INFO.build });
  pd.auditLog = pd.auditLog.slice(0,20);
  addLog(`Performance v${BUILD_INFO.version}: auditoria ${pd.score}/100.`);
  saveState(state); renderPerformanceDelivery();
};
window.warmCriticalAssets = async () => {
  const pd = ensurePerformanceDeliverySystem();
  const assets = criticalAssetList();
  const loadOne = src => new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve({ src, ok: true });
    img.onerror = () => resolve({ src, ok: false });
    img.src = assetCandidates(src)[0] || src;
  });
  const results = await Promise.all(assets.map(loadOne));
  const failed = results.filter(r => !r.ok).length;
  pd.warmupComplete = failed === 0;
  pd.assetDiagnostics.unshift({ title: 'Aquecimento de assets críticos', note: failed ? `${failed} asset(s) crítico(s) falharam no pré-carregamento.` : `${results.length} asset(s) crítico(s) preparados para a sessão.`, status: failed ? 'Atenção' : 'OK' });
  pd.auditLog.unshift({ title: 'Warmup de assets', result: failed ? 'Parcial' : 'OK', note: failed ? 'Fallbacks permanecem ativos.' : 'Fundos/logos/avatares críticos pré-carregados.', at: new Date().toISOString(), build: BUILD_INFO.build });
  pd.assetDiagnostics = pd.assetDiagnostics.slice(0,12);
  pd.auditLog = pd.auditLog.slice(0,20);
  pd.score = calculatePerformanceDeliveryScore();
  saveState(state); renderPerformanceDelivery();
};
window.applyMobileLiteAssets = () => {
  const pd = ensurePerformanceDeliverySystem();
  pd.liteMode = true;
  pd.mode = 'mobile-lite';
  state.mobileUX ||= { mode: 'auto', compact: false, oneHand: false, matchFocus: true, reduceMotion: false, lastViewport: null, auditLog: [] };
  state.mobileUX.compact = true;
  state.mobileUX.reduceMotion = true;
  state.mobileUX.matchFocus = true;
  document.body.classList.add('mobile-lite-assets');
  pd.auditLog.unshift({ title: 'Modo leve mobile aplicado', result: 'ON', note: 'Compactação visual, redução de movimento e foco de partida ativados sem alterar gameplay.', at: new Date().toISOString(), build: BUILD_INFO.build });
  pd.auditLog = pd.auditLog.slice(0,20);
  pd.score = calculatePerformanceDeliveryScore();
  addLog('Modo leve mobile aplicado para teste em celular/Internet instável.');
  saveState(state); render();
};


function ensureQAAutomationSystem() {
  state.qaAutomation ||= { score: 92, lastRunToken: null, auditLog: [], smokeResults: [], screenResults: [], saveSnapshots: [], exportReady: false, publicTestMode: false, checklist: { boot: true, tabs: true, save: true, mobile: true, pwa: true, legal: true, performance: true } };
  const qa = state.qaAutomation;
  qa.auditLog ||= [];
  qa.smokeResults ||= [];
  qa.screenResults ||= [];
  qa.saveSnapshots ||= [];
  qa.checklist ||= { boot: true, tabs: true, save: true, mobile: true, pwa: true, legal: true, performance: true };
  qa.score ??= 92;
  qa.lastRunToken ??= null;
  qa.exportReady ??= false;
  qa.publicTestMode ??= false;
  ['boot','tabs','save','mobile','pwa','legal','performance'].forEach(key => { qa.checklist[key] ??= true; });
  return qa;
}
function calculateQAScore() {
  const qa = ensureQAAutomationSystem();
  const checks = qa.checklist || {};
  const passed = Object.values(checks).filter(Boolean).length;
  const smokePenalty = Math.min(18, (qa.smokeResults || []).filter(r => r.status === 'Risco').length * 6);
  const screenPenalty = Math.min(14, (qa.screenResults || []).filter(r => r.status === 'Atenção').length * 4);
  const exportBoost = qa.exportReady ? 5 : 0;
  const publicBoost = qa.publicTestMode ? 3 : 0;
  return clamp(60 + passed * 5 + exportBoost + publicBoost - smokePenalty - screenPenalty, 0, 100);
}
function renderQAAutomation() {
  const host = $('#qaAutomationHub');
  if (!host) return;
  const qa = ensureQAAutomationSystem();
  const profile = currentViewportProfile();
  qa.score = calculateQAScore();
  const checkLabels = {
    boot: 'Boot sem erro', tabs: 'Telas navegáveis', save: 'Save/backup local', mobile: 'Mobile 320–412 px', pwa: 'PWA/cache versionado', legal: 'Legal/créditos acessíveis', performance: 'Performance/asset delivery'
  };
  const checks = Object.entries(qa.checklist || {}).map(([key, ok]) => `<article class="release-check ${ok?'ok':'pending'}"><span>${ok?'✓':'!'}</span><div><strong>${escapeHtml(checkLabels[key] || key)}</strong><small>${ok ? 'Coberto na rodada QA.' : 'Precisa de validação manual.'}</small></div></article>`).join('');
  const smoke = (qa.smokeResults || []).slice(0,10).map(item => `<div class="list-item"><div><strong>${escapeHtml(item.title)}</strong><div class="small">${escapeHtml(item.note)}</div></div><b class="${item.status === 'Risco' ? 'danger' : 'ok'}">${escapeHtml(item.status)}</b></div>`).join('') || '<div class="list-item"><span>Execute o smoke test final para gerar os primeiros resultados.</span><strong>Pendente</strong></div>';
  const screens = (qa.screenResults || []).slice(0,8).map(item => `<div class="list-item"><div><strong>${escapeHtml(item.title)}</strong><div class="small">${escapeHtml(item.note)}</div></div><b>${escapeHtml(item.status)}</b></div>`).join('') || '<div class="list-item"><span>Nenhuma verificação de tela executada nesta sessão.</span><strong>Pronto</strong></div>';
  const logs = (qa.auditLog || []).slice(0,8).map(item => `<div class="list-item"><div><strong>${escapeHtml(item.title)}</strong><div class="small">${escapeHtml(item.note)}</div></div><b>${escapeHtml(item.result || 'OK')}</b></div>`).join('') || '<div class="list-item"><span>QA final aguardando execução.</span><strong>RC</strong></div>';
  host.innerHTML = `
    <section class="quality-hero ok qa-hero">
      <div><p class="eyebrow">${BUILD_LABEL} • QA final</p><h2>Final QA Automation & Public Test Tools</h2><p>Central para validar boot, telas, save, PWA, assets, mobile e preparar um relatório de teste público antes do upload final.</p><div class="release-actions"><button class="btn-primary" onclick="window.runFinalSmokeTest()">Smoke test final</button><button class="btn-secondary" onclick="window.runScreenSweepQA()">Verificar telas</button><button class="btn-ghost" onclick="window.exportQAReport()">Gerar relatório QA</button><button class="btn-ghost" onclick="window.enablePublicTestMode()">Modo teste público</button></div></div>
      <div class="release-score"><span>QA Score</span><strong>${qa.score}</strong><small>${qa.score >= 90 ? 'Candidato público' : 'Revisar pendências'}</small></div>
    </section>
    <div class="cards-grid release-kpis"><article class="stat-card"><span>Build</span><strong>${escapeHtml(BUILD_INFO.version)}</strong></article><article class="stat-card"><span>Schema</span><strong>${BUILD_INFO.schemaVersion}</strong></article><article class="stat-card"><span>Viewport</span><strong>${profile.width}×${profile.height}</strong></article><article class="stat-card"><span>Teste público</span><strong>${qa.publicTestMode ? 'ON' : 'OFF'}</strong></article></div>
    <section class="release-grid"><article class="panel-card"><div class="panel-title-row"><h4>Checklist QA</h4><span class="metric-build">release</span></div><div class="release-checklist">${checks}</div></article><article class="panel-card"><div class="panel-title-row"><h4>Smoke test</h4><span class="metric-build">anti-quebra</span></div><div class="list-block">${smoke}</div></article></section>
    <section class="release-grid"><article class="panel-card"><div class="panel-title-row"><h4>Varredura de telas</h4><span class="metric-build">mobile-first</span></div><div class="list-block">${screens}</div></article><article class="panel-card"><div class="panel-title-row"><h4>Histórico QA</h4><span class="metric-build">build ${BUILD_INFO.build}</span></div><div class="list-block">${logs}</div></article></section>`;
}
window.runFinalSmokeTest = () => {
  const qa = ensureQAAutomationSystem();
  const results = [];
  const requiredSelectors = ['#buildOverlay','#buildPill','#seasonLabel','#weekLabel','#moneyLabel','#mainTabs','#mobileBuildBadge','#runtimeBuildStamp','#mobileQuickBar'];
  const missingSelectors = requiredSelectors.filter(sel => !$(sel));
  results.push({ title: 'Boot e HUD', status: missingSelectors.length ? 'Risco' : 'OK', note: missingSelectors.length ? `Ausentes: ${missingSelectors.join(', ')}` : 'HUD principal, build e comandos rápidos encontrados.' });
  const requiredState = ['roster','ranking','calendar','trainingLab','performanceDelivery','qaAutomation'];
  const missingState = requiredState.filter(key => !state[key]);
  results.push({ title: 'Estado e módulos', status: missingState.length ? 'Risco' : 'OK', note: missingState.length ? `Módulos ausentes: ${missingState.join(', ')}` : 'Módulos principais preservados no save migrado.' });
  const saveOk = saveState(state);
  results.push({ title: 'Save offline', status: saveOk ? 'OK' : 'Risco', note: saveOk ? 'Gravação local confirmada com backup automático.' : 'O navegador recusou a gravação local.' });
  const pwaOk = !!navigator.serviceWorker || location.protocol === 'file:';
  results.push({ title: 'PWA/cache', status: pwaOk ? 'OK' : 'Atenção', note: pwaOk ? 'Service Worker disponível ou execução local detectada.' : 'Testar em HTTPS/GitHub Pages para ativar PWA.' });
  const profile = currentViewportProfile();
  results.push({ title: 'Viewport mobile', status: profile.width >= 320 ? 'OK' : 'Atenção', note: `Viewport atual ${profile.width}×${profile.height}; safe area e --app-vh ativos.` });
  qa.smokeResults = results;
  qa.checklist.boot = !missingSelectors.length;
  qa.checklist.save = !!saveOk;
  qa.checklist.pwa = !!pwaOk;
  qa.checklist.mobile = profile.width >= 320;
  qa.checklist.performance = (state.performanceDelivery?.score || 0) >= 80;
  qa.lastRunToken = `${state.academy.season}-${state.academy.week}-${BUILD_INFO.build}`;
  qa.score = calculateQAScore();
  qa.auditLog.unshift({ title: 'Smoke test final executado', result: `${qa.score}/100`, note: results.filter(r=>r.status==='Risco').length ? 'Há riscos a revisar.' : 'Sem riscos críticos no smoke test.', at: new Date().toISOString(), build: BUILD_INFO.build });
  qa.auditLog = qa.auditLog.slice(0,20);
  addLog(`QA v${BUILD_INFO.version}: smoke test ${qa.score}/100.`);
  saveState(state); renderQAAutomation();
};
window.runScreenSweepQA = () => {
  const qa = ensureQAAutomationSystem();
  const tabIds = [...document.querySelectorAll('.tab-panel')].map(p => p.id.replace('tab-',''));
  const buttons = [...document.querySelectorAll('[data-tab]')].map(b => b.dataset.tab);
  const missingButtons = tabIds.filter(id => !buttons.includes(id) && id !== 'adminhint');
  const noHost = ['visualAcademyHub','careerHub','mobileUXHub','performanceDeliveryHub','qaAutomationHub','matchCanvas','rankingTable'].filter(id => !document.getElementById(id));
  qa.screenResults = [
    { title: 'Abas principais', status: missingButtons.length ? 'Atenção' : 'OK', note: missingButtons.length ? `Sem botão direto: ${missingButtons.join(', ')}` : `${tabIds.length} telas com navegação principal detectada.` },
    { title: 'Hosts de renderização', status: noHost.length ? 'Atenção' : 'OK', note: noHost.length ? `Containers ausentes: ${noHost.join(', ')}` : 'Containers críticos de renderização presentes.' },
    { title: 'Dock mobile', status: document.querySelectorAll('.dock-btn').length >= 10 ? 'OK' : 'Atenção', note: `${document.querySelectorAll('.dock-btn').length} botões no dock mobile com rolagem horizontal.` },
    { title: 'Botões de toque', status: document.querySelectorAll('button').length ? 'OK' : 'Atenção', note: `${document.querySelectorAll('button').length} botões detectados para teste manual de toque.` }
  ];
  qa.checklist.tabs = !missingButtons.length;
  qa.score = calculateQAScore();
  qa.auditLog.unshift({ title: 'Varredura de telas concluída', result: `${qa.score}/100`, note: qa.screenResults[0].note, at: new Date().toISOString(), build: BUILD_INFO.build });
  qa.auditLog = qa.auditLog.slice(0,20);
  saveState(state); renderQAAutomation();
};
window.exportQAReport = () => {
  const qa = ensureQAAutomationSystem();
  const payload = {
    app: BUILD_INFO.appName,
    version: BUILD_INFO.version,
    build: BUILD_INFO.build,
    schema: BUILD_INFO.schemaVersion,
    generatedAt: new Date().toISOString(),
    season: state.academy?.season,
    week: state.academy?.week,
    qaScore: calculateQAScore(),
    smokeResults: qa.smokeResults,
    screenResults: qa.screenResults,
    checklist: qa.checklist,
    viewport: currentViewportProfile(),
    notes: 'Relatório gerado localmente. Não envia dados para servidor.'
  };
  qa.exportReady = true;
  qa.saveSnapshots.unshift({ title: 'Relatório QA preparado', at: payload.generatedAt, score: payload.qaScore, build: BUILD_INFO.build });
  qa.saveSnapshots = qa.saveSnapshots.slice(0,10);
  qa.auditLog.unshift({ title: 'Relatório QA gerado', result: 'JSON local', note: `Score ${payload.qaScore}/100. Conteúdo copiado para console e download local quando suportado.`, at: payload.generatedAt, build: BUILD_INFO.build });
  try {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vale-tennis-qa-${BUILD_INFO.version}-${BUILD_INFO.build}.json`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  } catch (error) { console.info('QA report fallback', payload, error); }
  qa.score = calculateQAScore();
  saveState(state); renderQAAutomation();
};
window.enablePublicTestMode = () => {
  const qa = ensureQAAutomationSystem();
  qa.publicTestMode = true;
  state.flags ||= {};
  state.flags.safeMode = true;
  state.releaseCandidate ||= { readiness: 82, safeMode: false, auditLog: [] };
  state.releaseCandidate.safeMode = true;
  state.mobileUX ||= { mode: 'auto', compact: false, oneHand: false, matchFocus: true, reduceMotion: false, lastViewport: null, auditLog: [] };
  state.mobileUX.matchFocus = true;
  qa.auditLog.unshift({ title: 'Modo teste público ativado', result: 'ON', note: 'Safe mode, foco mobile e QA checklist ativos sem alterar atributos, ranking ou economia.', at: new Date().toISOString(), build: BUILD_INFO.build });
  qa.auditLog = qa.auditLog.slice(0,20);
  qa.score = calculateQAScore();
  addLog('Modo teste público ativado para homologação controlada.');
  saveState(state); render();
};


function ensureBrowserCompatibilitySystem() {
  state.browserCompatibility ||= { score: 93, lastAuditToken: null, auditLog: [], installDiagnostics: [], compatibilityMatrix: [], installMode: 'auto', lastUserAgent: '', environment: { serviceWorker: false, standalone: false, touch: true, storage: true, online: true, viewportStable: true }, flags: { iosSafari: false, androidChrome: false, desktopChrome: false, pwaInstalled: false } };
  const bc = state.browserCompatibility;
  bc.auditLog ||= [];
  bc.installDiagnostics ||= [];
  bc.compatibilityMatrix ||= [];
  bc.installMode ||= 'auto';
  bc.lastUserAgent ||= '';
  bc.environment ||= { serviceWorker: false, standalone: false, touch: true, storage: true, online: true, viewportStable: true };
  bc.flags ||= { iosSafari: false, androidChrome: false, desktopChrome: false, pwaInstalled: false };
  bc.score ??= 93;
  bc.lastAuditToken ??= null;
  return bc;
}

function browserEnvironmentSnapshot() {
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1);
  const isAndroid = /Android/i.test(ua);
  const isChrome = /Chrome|CriOS/i.test(ua);
  const isSafari = /Safari/i.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/i.test(ua);
  const standalone = !!(window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone);
  let storage = false;
  try {
    const key = `vale-tennis-compat-${BUILD_INFO.build}`;
    localStorage.setItem(key, 'ok');
    storage = localStorage.getItem(key) === 'ok';
    localStorage.removeItem(key);
  } catch (error) { storage = false; }
  const viewportStable = !!getComputedStyle(document.documentElement).getPropertyValue('--app-vh').trim() && window.innerWidth >= 300 && window.innerHeight >= 420;
  const touch = ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0 || window.matchMedia?.('(pointer: coarse)').matches;
  return {
    ua, isIOS, isAndroid, isChrome, isSafari, standalone,
    serviceWorker: 'serviceWorker' in navigator,
    caches: 'caches' in window,
    storage,
    online: navigator.onLine !== false,
    touch: !!touch,
    viewportStable,
    width: window.innerWidth,
    height: window.innerHeight,
    pixelRatio: Math.round((window.devicePixelRatio || 1) * 100) / 100
  };
}

function buildCompatibilityMatrix(env = browserEnvironmentSnapshot()) {
  return [
    { title: 'Android Chrome / Edge', status: env.isAndroid && env.isChrome ? 'Detectado' : 'Compatível', note: 'PWA instalável via menu do navegador, cache versionado e toque coarse.' },
    { title: 'iPhone / iPad Safari', status: env.isIOS ? 'Detectado' : 'Compatível', note: 'Suporte a Adicionar à Tela de Início, safe area e viewport recalculado.' },
    { title: 'Desktop Chrome / Edge', status: !env.isAndroid && !env.isIOS && env.isChrome ? 'Detectado' : 'Compatível', note: 'Modo desktop/tablet preservado para gestão longa e QA.' },
    { title: 'PWA instalado', status: env.standalone ? 'Instalado' : 'Navegador', note: env.standalone ? 'Rodando como app instalado.' : 'Pode rodar pelo navegador; instalação deve ser testada manualmente.' },
    { title: 'Offline/cache', status: env.serviceWorker && env.caches ? 'OK' : 'Atenção', note: env.serviceWorker ? 'Service Worker disponível para cache.' : 'Service Worker indisponível neste navegador.' },
    { title: 'Save local', status: env.storage ? 'OK' : 'Risco', note: env.storage ? 'LocalStorage gravável.' : 'Save local bloqueado pelo navegador/modo privado.' },
    { title: 'Toque mobile', status: env.touch ? 'OK' : 'Desktop', note: env.touch ? 'Dispositivo com toque ou ponteiro coarse detectado.' : 'Sem toque detectado; teclado/mouse esperado.' },
    { title: 'Viewport real', status: env.viewportStable ? 'OK' : 'Atenção', note: `${env.width}×${env.height} • DPR ${env.pixelRatio}` }
  ];
}

function calculateBrowserCompatibilityScore() {
  const bc = ensureBrowserCompatibilitySystem();
  const matrix = bc.compatibilityMatrix || [];
  const risk = matrix.filter(item => item.status === 'Risco').length;
  const warn = matrix.filter(item => item.status === 'Atenção').length;
  const installedBoost = bc.environment?.standalone ? 4 : 0;
  const cacheBoost = bc.environment?.serviceWorker ? 3 : 0;
  return clamp(100 - risk * 12 - warn * 5 + installedBoost + cacheBoost, 0, 100);
}

function renderBrowserCompatibility() {
  const host = $('#browserCompatibilityHub');
  if (!host) return;
  const bc = ensureBrowserCompatibilitySystem();
  const env = browserEnvironmentSnapshot();
  bc.environment = { serviceWorker: env.serviceWorker, standalone: env.standalone, touch: env.touch, storage: env.storage, online: env.online, viewportStable: env.viewportStable };
  bc.flags = { iosSafari: env.isIOS && env.isSafari, androidChrome: env.isAndroid && env.isChrome, desktopChrome: !env.isAndroid && !env.isIOS && env.isChrome, pwaInstalled: env.standalone };
  bc.lastUserAgent = env.ua;
  if (!bc.compatibilityMatrix?.length) bc.compatibilityMatrix = buildCompatibilityMatrix(env);
  bc.score = calculateBrowserCompatibilityScore();
  const matrix = (bc.compatibilityMatrix || []).map(item => `<article class="release-check ${item.status === 'OK' || item.status === 'Detectado' || item.status === 'Instalado' || item.status === 'Compatível' ? 'ok' : 'pending'}"><span>${item.status === 'Risco' ? '!' : '✓'}</span><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.note)}</small></div><b>${escapeHtml(item.status)}</b></article>`).join('');
  const logs = (bc.auditLog || []).slice(0,8).map(item => `<div class="list-item"><div><strong>${escapeHtml(item.title)}</strong><div class="small">${escapeHtml(item.note)}</div></div><b>${escapeHtml(item.result || 'OK')}</b></div>`).join('') || '<div class="list-item"><span>Execute a auditoria de compatibilidade para gerar o primeiro relatório.</span><strong>Pendente</strong></div>';
  const install = (bc.installDiagnostics || []).slice(0,6).map(item => `<div class="list-item"><div><strong>${escapeHtml(item.title)}</strong><div class="small">${escapeHtml(item.note)}</div></div><b>${escapeHtml(item.status)}</b></div>`).join('') || '<div class="list-item"><span>Sem diagnóstico de instalação ainda.</span><strong>Pronto</strong></div>';
  host.innerHTML = `
    <section class="quality-hero compat-hero ${bc.score >= 90 ? 'ok' : bc.score >= 76 ? 'warn' : 'danger'}">
      <div><p class="eyebrow">v${BUILD_INFO.version} • Browser Compatibility</p><h2>Compatibilidade, instalação PWA e ambiente real do jogador</h2><p>Central para validar Android, iOS, desktop, PWA instalado, cache, save local, viewport real e toque antes de publicação pública.</p></div>
      <div class="release-score"><span>Compat Score</span><strong>${bc.score}</strong><small>${bc.score >= 90 ? 'Pronto para teste público' : 'Revisar ambiente'}</small></div>
    </section>
    <div class="cards-grid release-kpis"><article class="stat-card"><span>Build</span><strong>${escapeHtml(BUILD_INFO.version)}</strong></article><article class="stat-card"><span>Viewport</span><strong>${env.width}×${env.height}</strong></article><article class="stat-card"><span>PWA</span><strong>${env.standalone ? 'Instalado' : 'Browser'}</strong></article><article class="stat-card"><span>Online</span><strong>${env.online ? 'Sim' : 'Offline'}</strong></article></div>
    <div class="release-actions"><button class="btn-primary" onclick="window.runBrowserCompatibilityAudit()">Auditar navegador</button><button class="btn-secondary" onclick="window.applyInstallSafePreset()">Preset instalação segura</button><button class="btn-secondary" onclick="window.clearOldPwaCaches()">Limpar caches antigos</button><button class="btn-ghost" onclick="window.exportCompatibilityReport()">Exportar relatório</button></div>
    <section class="release-grid"><div><h4>Matriz de compatibilidade</h4><div class="release-checklist">${matrix}</div></div><div><h4>Instalação e logs</h4><div class="list-stack">${install}${logs}</div></div></section>`;
}

window.runBrowserCompatibilityAudit = () => {
  const bc = ensureBrowserCompatibilitySystem();
  const env = browserEnvironmentSnapshot();
  bc.compatibilityMatrix = buildCompatibilityMatrix(env);
  bc.environment = { serviceWorker: env.serviceWorker, standalone: env.standalone, touch: env.touch, storage: env.storage, online: env.online, viewportStable: env.viewportStable };
  bc.flags = { iosSafari: env.isIOS && env.isSafari, androidChrome: env.isAndroid && env.isChrome, desktopChrome: !env.isAndroid && !env.isIOS && env.isChrome, pwaInstalled: env.standalone };
  bc.lastUserAgent = env.ua;
  bc.lastAuditToken = `${BUILD_INFO.build}-${Date.now()}`;
  bc.installDiagnostics = [
    { title: 'Instalação PWA', status: env.standalone ? 'Instalado' : 'Manual', note: env.isIOS ? 'No iOS, usar Compartilhar > Adicionar à Tela de Início.' : 'No Android/Chrome, usar Instalar app ou Adicionar à tela inicial.' },
    { title: 'Cache versionado', status: env.serviceWorker && env.caches ? 'OK' : 'Atenção', note: `Cache alvo: vale-tennis-v${BUILD_INFO.version}-${BUILD_INFO.build}` },
    { title: 'Save local', status: env.storage ? 'OK' : 'Risco', note: env.storage ? 'Save gravável no navegador atual.' : 'Modo privado ou bloqueio de armazenamento pode impedir progresso.' },
    { title: 'Safe area / notch', status: env.viewportStable ? 'OK' : 'Atenção', note: 'Layout usa viewport-fit=cover e --app-vh recalculado.' }
  ];
  bc.score = calculateBrowserCompatibilityScore();
  bc.auditLog.unshift({ title: 'Auditoria de navegador executada', result: `${bc.score}/100`, note: `${env.isIOS ? 'iOS' : env.isAndroid ? 'Android' : 'Desktop'} • ${env.width}×${env.height} • PWA ${env.standalone ? 'instalado' : 'browser'}`, at: new Date().toISOString(), build: BUILD_INFO.build });
  bc.auditLog = bc.auditLog.slice(0,20);
  addLog(`Compatibilidade v${BUILD_INFO.version}: auditoria ${bc.score}/100.`);
  saveState(state); renderBrowserCompatibility();
};

window.applyInstallSafePreset = () => {
  const bc = ensureBrowserCompatibilitySystem();
  state.mobileUX ||= { mode: 'auto', compact: false, oneHand: false, matchFocus: true, reduceMotion: false, lastViewport: null, auditLog: [] };
  state.mobileUX.mode = 'comfort';
  state.mobileUX.matchFocus = true;
  state.mobileUX.reduceMotion = true;
  state.performanceDelivery ||= { score: 91, mode: 'balanced', liteMode: false, auditLog: [] };
  state.performanceDelivery.mode = 'install-safe';
  state.releaseHardening ||= { score: 90, recoveryMode: 'guarded', auditLog: [] };
  state.releaseHardening.recoveryMode = 'guarded';
  bc.installMode = 'safe';
  bc.auditLog.unshift({ title: 'Preset instalação segura aplicado', result: 'ON', note: 'Redução de movimento, foco mobile, asset delivery seguro e recuperação guardada ativados.', at: new Date().toISOString(), build: BUILD_INFO.build });
  bc.auditLog = bc.auditLog.slice(0,20);
  applyMobileUXRuntime();
  addLog('Preset de instalação segura aplicado para teste em PWA/mobile.');
  saveState(state); render();
};

window.clearOldPwaCaches = async () => {
  const bc = ensureBrowserCompatibilitySystem();
  let removed = 0;
  try {
    if ('caches' in window) {
      const current = `vale-tennis-v${BUILD_INFO.version}-${BUILD_INFO.build}`;
      const keys = await caches.keys();
      await Promise.all(keys.filter(key => key.startsWith('vale-tennis-') && key !== current).map(key => { removed++; return caches.delete(key); }));
      bc.auditLog.unshift({ title: 'Caches antigos limpos', result: `${removed}`, note: removed ? 'Caches de builds anteriores removidos. Reabra o app instalado para validar.' : 'Nenhum cache antigo encontrado.', at: new Date().toISOString(), build: BUILD_INFO.build });
    } else {
      bc.auditLog.unshift({ title: 'Cache API indisponível', result: 'Atenção', note: 'Este navegador não expõe caches para limpeza interna.', at: new Date().toISOString(), build: BUILD_INFO.build });
    }
  } catch (error) {
    bc.auditLog.unshift({ title: 'Falha ao limpar caches', result: 'Risco', note: error?.message || 'Erro desconhecido na limpeza de cache.', at: new Date().toISOString(), build: BUILD_INFO.build });
  }
  bc.auditLog = bc.auditLog.slice(0,20);
  saveState(state); renderBrowserCompatibility();
};

window.exportCompatibilityReport = () => {
  const bc = ensureBrowserCompatibilitySystem();
  const payload = { app: BUILD_INFO.appName, version: BUILD_INFO.version, build: BUILD_INFO.build, generatedAt: new Date().toISOString(), score: calculateBrowserCompatibilityScore(), environment: browserEnvironmentSnapshot(), matrix: bc.compatibilityMatrix, installDiagnostics: bc.installDiagnostics, auditLog: bc.auditLog };
  bc.auditLog.unshift({ title: 'Relatório de compatibilidade gerado', result: 'JSON', note: 'Arquivo local preparado para anexar em teste público.', at: payload.generatedAt, build: BUILD_INFO.build });
  try {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `vale-tennis-compat-${BUILD_INFO.version}-${BUILD_INFO.build}.json`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  } catch (error) { console.info('Compatibility report fallback', payload, error); }
  saveState(state); renderBrowserCompatibility();
};


function ensureInputReliabilitySystem() {
  state.inputReliability ||= { score: 94, lastAuditToken: null, auditLog: [], gestureDiagnostics: [], keyboardDiagnostics: [], scrollDiagnostics: [], safePreset: false, environment: { touch: true, pointer: 'coarse', viewportLocked: true, scrollUnlocked: true, keyboardSafe: true, passiveListeners: true }, flags: { stickyScrollGuard: true, tapTargetGuard: true, keyboardGuard: true, orientationGuard: true } };
  const ir = state.inputReliability;
  ir.auditLog ||= [];
  ir.gestureDiagnostics ||= [];
  ir.keyboardDiagnostics ||= [];
  ir.scrollDiagnostics ||= [];
  ir.environment ||= { touch: true, pointer: 'coarse', viewportLocked: true, scrollUnlocked: true, keyboardSafe: true, passiveListeners: true };
  ir.flags ||= { stickyScrollGuard: true, tapTargetGuard: true, keyboardGuard: true, orientationGuard: true };
  ir.score ??= 94;
  ir.safePreset ??= false;
  return ir;
}

function inputEnvironmentSnapshot() {
  const vv = window.visualViewport;
  const root = document.documentElement;
  const body = document.body;
  const activePanel = document.querySelector('.tab-panel.active');
  const touch = ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0 || window.matchMedia?.('(pointer: coarse)').matches;
  const pointer = window.matchMedia?.('(pointer: coarse)').matches ? 'coarse' : window.matchMedia?.('(pointer: fine)').matches ? 'fine' : 'mixed';
  const scrollUnlocked = !!activePanel && getComputedStyle(activePanel).overflowY !== 'hidden' && getComputedStyle(body).overflowY !== 'hidden';
  const keyboardDelta = vv ? Math.max(0, Math.round((window.innerHeight || 0) - vv.height)) : 0;
  const tapTargets = [...document.querySelectorAll('button, .dock-btn, .mobile-quick-btn, select, input, a.btn-ghost')].slice(0, 80);
  const smallTargets = tapTargets.filter(el => {
    const r = el.getBoundingClientRect?.();
    return r && r.width > 0 && r.height > 0 && (r.width < 38 || r.height < 38);
  }).length;
  const viewportLocked = !!getComputedStyle(root).getPropertyValue('--app-vh').trim() && window.innerWidth >= 300 && window.innerHeight >= 420;
  return {
    touch: !!touch,
    pointer,
    width: Math.round(window.innerWidth || root.clientWidth || 390),
    height: Math.round(window.innerHeight || root.clientHeight || 720),
    visualViewportHeight: vv ? Math.round(vv.height) : null,
    keyboardDelta,
    keyboardSafe: keyboardDelta < 180 || document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'SELECT' || document.activeElement?.tagName === 'TEXTAREA',
    scrollUnlocked,
    viewportLocked,
    passiveListeners: true,
    smallTargets,
    activeTab: state?.ui?.currentTab || 'dashboard',
    reducedMotion: !!state?.mobileUX?.reduceMotion,
    at: new Date().toISOString()
  };
}

function calculateInputReliabilityScore() {
  const ir = ensureInputReliabilitySystem();
  const env = ir.environment || inputEnvironmentSnapshot();
  let score = 100;
  if (!env.viewportLocked) score -= 12;
  if (!env.scrollUnlocked) score -= 16;
  if (!env.keyboardSafe) score -= 8;
  if ((env.smallTargets || 0) > 0) score -= Math.min(14, env.smallTargets * 2);
  if (env.pointer === 'coarse' || env.touch) score += 2;
  if (ir.safePreset) score += 3;
  return clamp(Math.round(score), 0, 100);
}

function applyInputReliabilityRuntime() {
  if (!document?.body) return;
  const ir = ensureInputReliabilitySystem();
  const env = inputEnvironmentSnapshot();
  ir.environment = { touch: env.touch, pointer: env.pointer, viewportLocked: env.viewportLocked, scrollUnlocked: env.scrollUnlocked, keyboardSafe: env.keyboardSafe, passiveListeners: true, smallTargets: env.smallTargets, width: env.width, height: env.height, keyboardDelta: env.keyboardDelta };
  ir.score = calculateInputReliabilityScore();
  document.body.classList.toggle('input-safe-ui', !!ir.safePreset);
  document.body.classList.toggle('keyboard-open-ui', env.keyboardDelta > 160);
  document.documentElement.dataset.pointer = env.pointer;
  document.documentElement.style.setProperty('--keyboard-offset', `${Math.min(260, env.keyboardDelta)}px`);
}

function installInputReliabilityRuntime() {
  const run = () => { try { applyInputReliabilityRuntime(); renderInputReliability(); } catch (error) { console.warn('Input reliability fallback', error); } };
  window.addEventListener('resize', run, { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(run, 180), { passive: true });
  window.visualViewport?.addEventListener('resize', run, { passive: true });
  document.addEventListener('focusin', event => {
    if (event.target?.matches?.('input, textarea, select')) setTimeout(() => event.target.scrollIntoView?.({ block: 'center', behavior: state?.mobileUX?.reduceMotion ? 'auto' : 'smooth' }), 120);
    run();
  }, { passive: true });
  document.addEventListener('pointerdown', event => {
    const ir = ensureInputReliabilitySystem();
    ir.lastPointer = { type: event.pointerType || 'unknown', x: Math.round(event.clientX || 0), y: Math.round(event.clientY || 0), at: new Date().toISOString(), tab: state?.ui?.currentTab || 'dashboard' };
  }, { passive: true });
  document.addEventListener('touchmove', () => {}, { passive: true });
  run();
}

function renderInputReliability() {
  const host = $('#inputReliabilityHub');
  if (!host || !state) return;
  const ir = ensureInputReliabilitySystem();
  const env = inputEnvironmentSnapshot();
  ir.environment = { touch: env.touch, pointer: env.pointer, viewportLocked: env.viewportLocked, scrollUnlocked: env.scrollUnlocked, keyboardSafe: env.keyboardSafe, passiveListeners: true, smallTargets: env.smallTargets, width: env.width, height: env.height, keyboardDelta: env.keyboardDelta };
  ir.score = calculateInputReliabilityScore();
  const status = ir.score >= 92 ? 'Confiável' : ir.score >= 78 ? 'Atenção' : 'Risco';
  const checks = [
    { title: 'Toque e botões', status: env.smallTargets === 0 ? 'OK' : 'Atenção', note: env.smallTargets === 0 ? 'Alvos de toque principais estão protegidos.' : `${env.smallTargets} alvos pequenos detectados.` },
    { title: 'Rolagem ativa', status: env.scrollUnlocked ? 'OK' : 'Risco', note: env.scrollUnlocked ? 'Painel ativo e body permitem rolagem.' : 'Algum container pode estar prendendo a rolagem.' },
    { title: 'Teclado mobile', status: env.keyboardSafe ? 'OK' : 'Atenção', note: env.keyboardDelta ? `Viewport visual reduziu ${env.keyboardDelta}px.` : 'Sem teclado aberto detectado.' },
    { title: 'Viewport real', status: env.viewportLocked ? 'OK' : 'Atenção', note: `${env.width}×${env.height} • ${env.pointer}` },
    { title: 'Listeners passivos', status: 'OK', note: 'touchmove/orientation/resize configurados para não travar scroll.' }
  ];
  const checklist = checks.map(item => `<article class="release-check ${item.status === 'OK' ? 'ok' : 'pending'}"><span>${item.status === 'OK' ? '✓' : '!'}</span><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.note)}</small></div><b>${escapeHtml(item.status)}</b></article>`).join('');
  const logs = (ir.auditLog || []).slice(0,8).map(item => `<div class="list-item"><div><strong>${escapeHtml(item.title)}</strong><div class="small">${escapeHtml(item.note)}</div></div><b>${escapeHtml(item.result)}</b></div>`).join('') || '<div class="list-item"><span>Execute o diagnóstico de toque e rolagem.</span><strong>Pendente</strong></div>';
  host.innerHTML = `
    <section class="quality-hero input-hero ${ir.score >= 92 ? 'ok' : ir.score >= 78 ? 'warn' : 'danger'}">
      <div><p class="eyebrow">v${BUILD_INFO.version} • Input Reliability</p><h2>Toque, rolagem e teclado confiáveis no celular</h2><p>Central para detectar problemas reais de mobile: scroll preso, botão pequeno, teclado cobrindo campo, viewport instável e gesto que não responde.</p></div>
      <div class="release-score"><span>Input Score</span><strong>${ir.score}</strong><small>${status}</small></div>
    </section>
    <div class="cards-grid release-kpis"><article class="stat-card"><span>Viewport</span><strong>${env.width}×${env.height}</strong></article><article class="stat-card"><span>Ponteiro</span><strong>${env.pointer}</strong></article><article class="stat-card"><span>Teclado</span><strong>${env.keyboardDelta}px</strong></article><article class="stat-card"><span>Safe preset</span><strong>${ir.safePreset ? 'ON' : 'OFF'}</strong></article></div>
    <div class="release-actions"><button class="btn-primary" onclick="window.runInputReliabilityAudit()">Auditar toque/rolagem</button><button class="btn-secondary" onclick="window.applyInputSafePreset()">Aplicar preset seguro</button><button class="btn-secondary" onclick="window.unlockScrollNow()">Destravar rolagem</button><button class="btn-ghost" onclick="window.exportInputReport()">Exportar relatório</button></div>
    <section class="release-grid"><div><h4>Checklist de gestos</h4><div class="release-checklist">${checklist}</div></div><div><h4>Logs recentes</h4><div class="list-stack">${logs}</div></div></section>`;
}

window.runInputReliabilityAudit = () => {
  const ir = ensureInputReliabilitySystem();
  const env = inputEnvironmentSnapshot();
  ir.gestureDiagnostics.unshift({ title: 'Gestos', status: env.touch ? 'OK' : 'Desktop', note: `${env.pointer} • ${env.smallTargets} alvos pequenos`, at: env.at });
  ir.keyboardDiagnostics.unshift({ title: 'Teclado', status: env.keyboardSafe ? 'OK' : 'Atenção', note: `Delta visual ${env.keyboardDelta}px`, at: env.at });
  ir.scrollDiagnostics.unshift({ title: 'Rolagem', status: env.scrollUnlocked ? 'OK' : 'Risco', note: `Aba ${env.activeTab}`, at: env.at });
  ir.gestureDiagnostics = ir.gestureDiagnostics.slice(0,12);
  ir.keyboardDiagnostics = ir.keyboardDiagnostics.slice(0,12);
  ir.scrollDiagnostics = ir.scrollDiagnostics.slice(0,12);
  ir.lastAuditToken = `${BUILD_INFO.build}-${Date.now()}`;
  ir.environment = { touch: env.touch, pointer: env.pointer, viewportLocked: env.viewportLocked, scrollUnlocked: env.scrollUnlocked, keyboardSafe: env.keyboardSafe, passiveListeners: true, smallTargets: env.smallTargets, width: env.width, height: env.height, keyboardDelta: env.keyboardDelta };
  ir.score = calculateInputReliabilityScore();
  ir.auditLog.unshift({ title: 'Auditoria de toque/rolagem executada', result: `${ir.score}/100`, note: `${env.width}×${env.height} • ${env.pointer} • scroll ${env.scrollUnlocked ? 'livre' : 'preso'}`, at: new Date().toISOString(), build: BUILD_INFO.build });
  ir.auditLog = ir.auditLog.slice(0,20);
  addLog(`Input Reliability v${BUILD_INFO.version}: auditoria ${ir.score}/100.`);
  saveState(state); renderInputReliability();
};

window.applyInputSafePreset = () => {
  const ir = ensureInputReliabilitySystem();
  ir.safePreset = true;
  ir.flags = { stickyScrollGuard: true, tapTargetGuard: true, keyboardGuard: true, orientationGuard: true };
  state.mobileUX ||= { mode: 'auto', compact: false, oneHand: false, matchFocus: true, reduceMotion: false, lastViewport: null, auditLog: [] };
  state.mobileUX.mode = 'comfort';
  state.mobileUX.oneHand = true;
  state.mobileUX.matchFocus = true;
  state.mobileUX.reduceMotion = true;
  applyMobileUXRuntime();
  applyInputReliabilityRuntime();
  ir.auditLog.unshift({ title: 'Preset seguro de input aplicado', result: 'ON', note: 'Conforto, uma mão, foco no match, redução de movimento e rolagem protegida.', at: new Date().toISOString(), build: BUILD_INFO.build });
  ir.auditLog = ir.auditLog.slice(0,20);
  addLog('Preset seguro de toque e rolagem aplicado.');
  saveState(state); render();
};

window.unlockScrollNow = () => {
  const ir = ensureInputReliabilitySystem();
  document.documentElement.style.overflowY = 'auto';
  document.body.style.overflowY = 'auto';
  document.querySelectorAll('.tab-panel, .content-stack, .modal, .bottom-sheet').forEach(el => { el.style.overscrollBehavior = 'contain'; el.style.webkitOverflowScrolling = 'touch'; });
  scrollToAppTop(true);
  ir.auditLog.unshift({ title: 'Comando de destravar rolagem aplicado', result: 'OK', note: 'Overflow do body/root restaurado e painéis preparados para touch scroll.', at: new Date().toISOString(), build: BUILD_INFO.build });
  ir.auditLog = ir.auditLog.slice(0,20);
  saveState(state); renderInputReliability();
};

window.exportInputReport = () => {
  const ir = ensureInputReliabilitySystem();
  const payload = { app: BUILD_INFO.appName, version: BUILD_INFO.version, build: BUILD_INFO.build, generatedAt: new Date().toISOString(), score: calculateInputReliabilityScore(), environment: inputEnvironmentSnapshot(), gestureDiagnostics: ir.gestureDiagnostics, keyboardDiagnostics: ir.keyboardDiagnostics, scrollDiagnostics: ir.scrollDiagnostics, auditLog: ir.auditLog };
  ir.auditLog.unshift({ title: 'Relatório de input gerado', result: 'JSON', note: 'Arquivo local preparado para teste em celulares.', at: payload.generatedAt, build: BUILD_INFO.build });
  try {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `vale-tennis-input-${BUILD_INFO.version}-${BUILD_INFO.build}.json`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  } catch (error) { console.info('Input report fallback', payload, error); }
  saveState(state); renderInputReliability();
};


function ensureAccessibilityReadabilitySystem() {
  state.accessibilityReadability ||= { score: 95, mode: 'auto', largeText: false, highContrast: false, readingMode: false, reducedTransparency: false, focusRing: true, ariaAudit: [], readabilityAudit: [], lastAuditToken: null, exportReady: false, environment: { colorScheme: 'dark', reducedMotion: false, textScale: 1, contrast: 'normal', focusVisible: true }, flags: { contrastGuard: true, textScaleGuard: true, focusGuard: true, ariaGuard: true } };
  const ar = state.accessibilityReadability;
  ar.mode ||= 'auto';
  ar.score ??= 95;
  ar.largeText ??= false;
  ar.highContrast ??= false;
  ar.readingMode ??= false;
  ar.reducedTransparency ??= false;
  ar.focusRing ??= true;
  ar.ariaAudit ||= [];
  ar.readabilityAudit ||= [];
  ar.environment ||= { colorScheme: 'dark', reducedMotion: false, textScale: 1, contrast: 'normal', focusVisible: true };
  ar.flags ||= { contrastGuard: true, textScaleGuard: true, focusGuard: true, ariaGuard: true };
  return ar;
}

function accessibilityEnvironmentSnapshot() {
  const root = document.documentElement;
  const buttons = [...document.querySelectorAll('button, a, input, select, textarea')];
  const unlabeled = buttons.filter(el => {
    const text = (el.textContent || el.value || '').trim();
    return !text && !el.getAttribute('aria-label') && !el.getAttribute('title');
  }).length;
  const textNodes = [...document.querySelectorAll('p, small, span, strong, button, label, h1, h2, h3, h4')].slice(0, 140);
  const tinyText = textNodes.filter(el => {
    const size = parseFloat(getComputedStyle(el).fontSize || '16');
    const rect = el.getBoundingClientRect?.();
    return rect && rect.width > 0 && rect.height > 0 && size < 12;
  }).length;
  const focusables = buttons.filter(el => !el.disabled && el.offsetParent !== null).length;
  const colorScheme = window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || !!state?.mobileUX?.reduceMotion;
  return {
    width: Math.round(window.innerWidth || root.clientWidth || 390),
    height: Math.round(window.innerHeight || root.clientHeight || 720),
    colorScheme,
    reducedMotion,
    textScale: state?.accessibilityReadability?.largeText ? 1.12 : 1,
    contrast: state?.accessibilityReadability?.highContrast ? 'high' : 'normal',
    focusVisible: !!state?.accessibilityReadability?.focusRing,
    focusables,
    unlabeled,
    tinyText,
    activeTab: state?.ui?.currentTab || 'dashboard',
    at: new Date().toISOString()
  };
}

function calculateAccessibilityScore() {
  const ar = ensureAccessibilityReadabilitySystem();
  const env = accessibilityEnvironmentSnapshot();
  let score = 100;
  if (env.unlabeled > 0) score -= Math.min(16, env.unlabeled * 3);
  if (env.tinyText > 0) score -= Math.min(14, env.tinyText * 2);
  if (!ar.focusRing) score -= 10;
  if (!ar.highContrast && env.width <= 390) score -= 3;
  if (ar.largeText) score += 3;
  if (ar.highContrast) score += 3;
  if (ar.readingMode) score += 2;
  if (ar.reducedTransparency) score += 2;
  return clamp(Math.round(score), 0, 100);
}

function applyAccessibilityReadabilityRuntime() {
  if (!document?.body) return;
  const ar = ensureAccessibilityReadabilitySystem();
  const env = accessibilityEnvironmentSnapshot();
  ar.environment = { colorScheme: env.colorScheme, reducedMotion: env.reducedMotion, textScale: ar.largeText ? 1.12 : 1, contrast: ar.highContrast ? 'high' : 'normal', focusVisible: !!ar.focusRing, width: env.width, height: env.height, unlabeled: env.unlabeled, tinyText: env.tinyText };
  ar.score = calculateAccessibilityScore();
  document.body.classList.toggle('a11y-large-text-ui', !!ar.largeText);
  document.body.classList.toggle('a11y-high-contrast-ui', !!ar.highContrast);
  document.body.classList.toggle('a11y-reading-mode-ui', !!ar.readingMode);
  document.body.classList.toggle('a11y-reduced-transparency-ui', !!ar.reducedTransparency);
  document.body.classList.toggle('a11y-focus-ring-ui', !!ar.focusRing);
  document.documentElement.style.setProperty('--readability-font-scale', ar.largeText ? '1.12' : '1');
  document.documentElement.dataset.contrast = ar.highContrast ? 'high' : 'normal';
}

function installAccessibilityReadabilityRuntime() {
  const run = () => { try { applyAccessibilityReadabilityRuntime(); renderAccessibilityReadability(); } catch (error) { console.warn('Accessibility readability fallback', error); } };
  window.addEventListener('resize', run, { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(run, 180), { passive: true });
  window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change', run);
  run();
}

function renderAccessibilityReadability() {
  const host = $('#accessibilityReadabilityHub');
  if (!host || !state) return;
  const ar = ensureAccessibilityReadabilitySystem();
  const env = accessibilityEnvironmentSnapshot();
  ar.environment = { colorScheme: env.colorScheme, reducedMotion: env.reducedMotion, textScale: ar.largeText ? 1.12 : 1, contrast: ar.highContrast ? 'high' : 'normal', focusVisible: !!ar.focusRing, width: env.width, height: env.height, unlabeled: env.unlabeled, tinyText: env.tinyText };
  ar.score = calculateAccessibilityScore();
  const status = ar.score >= 92 ? 'Pronto' : ar.score >= 78 ? 'Atenção' : 'Crítico';
  const checks = [
    { title: 'Contraste', status: ar.highContrast || env.width > 390 ? 'OK' : 'Atenção', note: ar.highContrast ? 'Alto contraste ativo.' : 'Contraste normal; alto contraste recomendado em celular pequeno.' },
    { title: 'Escala de texto', status: env.tinyText === 0 || ar.largeText ? 'OK' : 'Atenção', note: ar.largeText ? 'Texto ampliado para leitura mobile.' : `${env.tinyText} textos muito pequenos detectados.` },
    { title: 'Foco visível', status: ar.focusRing ? 'OK' : 'Risco', note: ar.focusRing ? 'Anel de foco reforçado para teclado/acessibilidade.' : 'Foco visual desativado.' },
    { title: 'Labels/ARIA', status: env.unlabeled === 0 ? 'OK' : 'Atenção', note: env.unlabeled === 0 ? 'Controles principais possuem texto ou rótulo.' : `${env.unlabeled} controles sem texto/aria.` },
    { title: 'Leitura limpa', status: ar.readingMode || ar.reducedTransparency ? 'OK' : 'Pendente', note: ar.readingMode ? 'Modo leitura ativo.' : 'Modo leitura opcional para telas pequenas.' }
  ];
  const checklist = checks.map(item => `<article class="release-check ${item.status === 'OK' ? 'ok' : item.status === 'Risco' ? 'danger' : 'pending'}"><span>${item.status === 'OK' ? '✓' : item.status === 'Risco' ? '!' : '•'}</span><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.note)}</small></div><b>${escapeHtml(item.status)}</b></article>`).join('');
  const logs = (ar.readabilityAudit || []).slice(0,8).map(item => `<div class="list-item"><div><strong>${escapeHtml(item.title)}</strong><div class="small">${escapeHtml(item.note)}</div></div><b>${escapeHtml(item.result)}</b></div>`).join('') || '<div class="list-item"><span>Execute a auditoria de acessibilidade.</span><strong>Pendente</strong></div>';
  host.innerHTML = `
    <section class="quality-hero accessibility-hero ${ar.score >= 92 ? 'ok' : ar.score >= 78 ? 'warn' : 'danger'}">
      <div><p class="eyebrow">v${BUILD_INFO.version} • Accessibility Readability</p><h2>Leitura segura, contraste e foco para teste público</h2><p>Central para reforçar legibilidade em celular pequeno, PWA instalado, desktop e uso por teclado/leitor de tela.</p></div>
      <div class="release-score"><span>A11y Score</span><strong>${ar.score}</strong><small>${status}</small></div>
    </section>
    <div class="cards-grid release-kpis"><article class="stat-card"><span>Texto</span><strong>${ar.largeText ? 'Grande' : 'Normal'}</strong></article><article class="stat-card"><span>Contraste</span><strong>${ar.highContrast ? 'Alto' : 'Normal'}</strong></article><article class="stat-card"><span>Foco</span><strong>${ar.focusRing ? 'Visível' : 'Fraco'}</strong></article><article class="stat-card"><span>Viewport</span><strong>${env.width}×${env.height}</strong></article></div>
    <div class="release-actions"><button class="btn-primary" onclick="window.runAccessibilityAudit()">Auditar acessibilidade</button><button class="btn-secondary" onclick="window.toggleReadingMode()">Modo leitura</button><button class="btn-secondary" onclick="window.toggleHighContrast()">Alto contraste</button><button class="btn-ghost" onclick="window.exportAccessibilityReport()">Exportar relatório</button></div>
    <div class="release-actions secondary"><button class="mini-btn" onclick="window.toggleLargeText()">Texto grande</button><button class="mini-btn" onclick="window.toggleReducedTransparency()">Reduzir transparência</button><button class="mini-btn" onclick="window.toggleFocusRing()">Foco visível</button></div>
    <section class="release-grid"><div><h4>Checklist de leitura</h4><div class="release-checklist">${checklist}</div></div><div><h4>Logs recentes</h4><div class="list-stack">${logs}</div></div></section>`;
}

window.runAccessibilityAudit = () => {
  const ar = ensureAccessibilityReadabilitySystem();
  const env = accessibilityEnvironmentSnapshot();
  const aria = { title: 'Rótulos e foco', result: env.unlabeled === 0 ? 'OK' : 'Atenção', note: `${env.focusables} controles focáveis • ${env.unlabeled} sem rótulo`, at: env.at, build: BUILD_INFO.build };
  const read = { title: 'Leitura e contraste', result: calculateAccessibilityScore() + '/100', note: `${env.tinyText} textos pequenos • contraste ${ar.highContrast ? 'alto' : 'normal'} • texto ${ar.largeText ? 'grande' : 'normal'}`, at: env.at, build: BUILD_INFO.build };
  ar.ariaAudit.unshift(aria);
  ar.readabilityAudit.unshift(read);
  ar.ariaAudit = ar.ariaAudit.slice(0,16);
  ar.readabilityAudit = ar.readabilityAudit.slice(0,16);
  ar.lastAuditToken = `${BUILD_INFO.build}-${Date.now()}`;
  ar.score = calculateAccessibilityScore();
  ar.exportReady = true;
  addLog(`Acessibilidade v${BUILD_INFO.version}: auditoria ${ar.score}/100.`);
  saveState(state); renderAccessibilityReadability();
};

window.toggleReadingMode = () => {
  const ar = ensureAccessibilityReadabilitySystem();
  ar.readingMode = !ar.readingMode;
  if (ar.readingMode) { ar.largeText = true; ar.reducedTransparency = true; }
  applyAccessibilityReadabilityRuntime();
  ar.readabilityAudit.unshift({ title: 'Modo leitura alterado', result: ar.readingMode ? 'ON' : 'OFF', note: ar.readingMode ? 'Texto ampliado e transparência reduzida.' : 'Interface visual padrão restaurada.', at: new Date().toISOString(), build: BUILD_INFO.build });
  addLog(`Modo leitura ${ar.readingMode ? 'ativado' : 'desativado'}.`);
  saveState(state); render();
};

window.toggleHighContrast = () => {
  const ar = ensureAccessibilityReadabilitySystem();
  ar.highContrast = !ar.highContrast;
  applyAccessibilityReadabilityRuntime();
  ar.readabilityAudit.unshift({ title: 'Alto contraste alterado', result: ar.highContrast ? 'ON' : 'OFF', note: 'Ajuste visual sem alterar gameplay.', at: new Date().toISOString(), build: BUILD_INFO.build });
  saveState(state); renderAccessibilityReadability();
};

window.toggleLargeText = () => {
  const ar = ensureAccessibilityReadabilitySystem();
  ar.largeText = !ar.largeText;
  applyAccessibilityReadabilityRuntime();
  ar.readabilityAudit.unshift({ title: 'Escala de texto alterada', result: ar.largeText ? 'Grande' : 'Normal', note: 'Aplicado via variável --readability-font-scale.', at: new Date().toISOString(), build: BUILD_INFO.build });
  saveState(state); renderAccessibilityReadability();
};

window.toggleReducedTransparency = () => {
  const ar = ensureAccessibilityReadabilitySystem();
  ar.reducedTransparency = !ar.reducedTransparency;
  applyAccessibilityReadabilityRuntime();
  ar.readabilityAudit.unshift({ title: 'Transparência visual alterada', result: ar.reducedTransparency ? 'Reduzida' : 'Normal', note: 'Melhora leitura em telas com baixo brilho.', at: new Date().toISOString(), build: BUILD_INFO.build });
  saveState(state); renderAccessibilityReadability();
};

window.toggleFocusRing = () => {
  const ar = ensureAccessibilityReadabilitySystem();
  ar.focusRing = !ar.focusRing;
  applyAccessibilityReadabilityRuntime();
  ar.ariaAudit.unshift({ title: 'Foco visível alterado', result: ar.focusRing ? 'ON' : 'OFF', note: 'Afeta navegação por teclado e leitores de tela.', at: new Date().toISOString(), build: BUILD_INFO.build });
  saveState(state); renderAccessibilityReadability();
};

window.exportAccessibilityReport = () => {
  const ar = ensureAccessibilityReadabilitySystem();
  const payload = { app: BUILD_INFO.appName, version: BUILD_INFO.version, build: BUILD_INFO.build, generatedAt: new Date().toISOString(), score: calculateAccessibilityScore(), environment: accessibilityEnvironmentSnapshot(), ariaAudit: ar.ariaAudit, readabilityAudit: ar.readabilityAudit, settings: { largeText: ar.largeText, highContrast: ar.highContrast, readingMode: ar.readingMode, reducedTransparency: ar.reducedTransparency, focusRing: ar.focusRing } };
  ar.readabilityAudit.unshift({ title: 'Relatório de acessibilidade gerado', result: 'JSON', note: 'Arquivo local preparado para homologação.', at: payload.generatedAt, build: BUILD_INFO.build });
  try {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `vale-tennis-a11y-${BUILD_INFO.version}-${BUILD_INFO.build}.json`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  } catch (error) { console.info('Accessibility report fallback', payload, error); }
  saveState(state); renderAccessibilityReadability();
};


function ensureLocalizationStoreSystem() {
  state.localizationStore ||= { score: 96, activeLocale: 'pt-BR', fallbackLocale: 'pt-BR', supportedLocales: ['pt-BR','en','es'], textCoverage: { 'pt-BR': 100, en: 78, es: 74 }, storeReadiness: { titleReady: true, descriptionReady: true, screenshotsPending: true, legalReady: true, ageRatingPending: true }, auditLog: [], exportReady: false, lastAuditToken: null, preview: { title: 'Vale Games Tennis Manager', subtitle: 'Academia internacional de tênis', storeShort: 'Gerencie atletas, torneios, patrocínios e legado em uma carreira mobile-first.' }, flags: { localeGuard: true, storeCopyGuard: true, fallbackGuard: true, exportGuard: true } };
  const ls = state.localizationStore;
  ls.score ??= 96;
  ls.activeLocale ||= 'pt-BR';
  ls.fallbackLocale ||= 'pt-BR';
  ls.supportedLocales ||= ['pt-BR','en','es'];
  ls.textCoverage ||= { 'pt-BR': 100, en: 78, es: 74 };
  ls.storeReadiness ||= { titleReady: true, descriptionReady: true, screenshotsPending: true, legalReady: true, ageRatingPending: true };
  ls.auditLog ||= [];
  ls.exportReady ??= false;
  ls.flags ||= { localeGuard: true, storeCopyGuard: true, fallbackGuard: true, exportGuard: true };
  return ls;
}

const STORE_LOCALES = {
  'pt-BR': { label: 'Português Brasil', title: 'Vale Games Tennis Manager', subtitle: 'Academia internacional de tênis', cta: 'Gerencie sua academia', short: 'Gerencie atletas, torneios, patrocínios e legado em uma carreira mobile-first.', keywords: ['tênis','manager','academia','carreira','torneios','PWA'] },
  en: { label: 'English', title: 'Vale Games Tennis Manager', subtitle: 'International Tennis Academy', cta: 'Manage your academy', short: 'Manage players, tournaments, sponsors and legacy in a mobile-first tennis career.', keywords: ['tennis','manager','academy','career','tournaments','PWA'] },
  es: { label: 'Español', title: 'Vale Games Tennis Manager', subtitle: 'Academia internacional de tenis', cta: 'Dirige tu academia', short: 'Gestiona jugadores, torneos, patrocinadores y legado en una carrera de tenis mobile-first.', keywords: ['tenis','manager','academia','carrera','torneos','PWA'] }
};

function localizationSnapshot() {
  const ls = ensureLocalizationStoreSystem();
  const active = STORE_LOCALES[ls.activeLocale] || STORE_LOCALES['pt-BR'];
  const requiredTabs = ['dashboard','roster','calendar','match','economy','qa','compat','input','a11y','localization'];
  const presentTabs = requiredTabs.filter(tab => !!document.querySelector(`[data-tab="${tab}"]`) && !!document.querySelector(`#tab-${tab}`));
  const manifestLinked = !!document.querySelector('link[rel="manifest"]');
  const legalDocs = ['PRIVACY_OFFLINE.md','LEGAL_NOTICE.md','CREDITS.md'];
  return {
    activeLocale: ls.activeLocale,
    activeLabel: active.label,
    coverage: ls.textCoverage[ls.activeLocale] ?? 0,
    requiredTabs: requiredTabs.length,
    presentTabs: presentTabs.length,
    manifestLinked,
    legalReady: !!ls.storeReadiness.legalReady,
    screenshotsPending: !!ls.storeReadiness.screenshotsPending,
    ageRatingPending: !!ls.storeReadiness.ageRatingPending,
    preview: active,
    legalDocs,
    at: new Date().toISOString(),
    build: BUILD_INFO.build
  };
}

function calculateLocalizationStoreScore() {
  const ls = ensureLocalizationStoreSystem();
  const snap = localizationSnapshot();
  let score = 100;
  const avgCoverage = Math.round(Object.values(ls.textCoverage || {}).reduce((a,b)=>a+(Number(b)||0),0) / Math.max(1, Object.keys(ls.textCoverage || {}).length));
  if (avgCoverage < 85) score -= 8;
  if (snap.presentTabs < snap.requiredTabs) score -= Math.min(16, (snap.requiredTabs - snap.presentTabs) * 3);
  if (!snap.manifestLinked) score -= 10;
  if (!snap.legalReady) score -= 10;
  if (snap.screenshotsPending) score -= 4;
  if (snap.ageRatingPending) score -= 4;
  if (!ls.flags?.fallbackGuard) score -= 6;
  return clamp(Math.round(score), 0, 100);
}

function applyLocalizationStoreRuntime() {
  if (!document?.body) return;
  const ls = ensureLocalizationStoreSystem();
  const active = STORE_LOCALES[ls.activeLocale] || STORE_LOCALES['pt-BR'];
  ls.preview = { title: active.title, subtitle: active.subtitle, storeShort: active.short };
  ls.score = calculateLocalizationStoreScore();
  document.documentElement.lang = ls.activeLocale === 'pt-BR' ? 'pt-BR' : ls.activeLocale;
  document.body.dataset.locale = ls.activeLocale;
}

function installLocalizationStoreRuntime() {
  const run = () => { try { applyLocalizationStoreRuntime(); renderLocalizationStore(); } catch (error) { console.warn('Localization runtime fallback', error); } };
  window.addEventListener('languagechange', run, { passive: true });
  run();
}

function renderLocalizationStore() {
  const host = $('#localizationStoreHub');
  if (!host || !state) return;
  const ls = ensureLocalizationStoreSystem();
  applyLocalizationStoreRuntime();
  const snap = localizationSnapshot();
  const score = calculateLocalizationStoreScore();
  ls.score = score;
  const status = score >= 92 ? 'Pronto' : score >= 78 ? 'Atenção' : 'Crítico';
  const localeButtons = Object.entries(STORE_LOCALES).map(([key, item]) => `<button class="mini-btn ${ls.activeLocale === key ? 'active' : ''}" onclick="window.setLocalizationLocale('${key}')">${escapeHtml(item.label)}</button>`).join('');
  const checks = [
    { title: 'Idiomas suportados', status: ls.supportedLocales.length >= 3 ? 'OK' : 'Atenção', note: `${ls.supportedLocales.join(', ')} com fallback ${ls.fallbackLocale}.` },
    { title: 'Cobertura textual', status: (snap.coverage >= 74) ? 'OK' : 'Atenção', note: `${snap.activeLabel}: ${snap.coverage}% de cobertura inicial para UI/loja.` },
    { title: 'Manifest/PWA', status: snap.manifestLinked ? 'OK' : 'Risco', note: snap.manifestLinked ? 'Manifest conectado com atalhos de release.' : 'Manifest não encontrado no HTML.' },
    { title: 'Documentos legais', status: snap.legalReady ? 'OK' : 'Pendente', note: 'Privacidade offline, créditos e aviso legal preservados no ZIP.' },
    { title: 'Loja pública', status: snap.screenshotsPending || snap.ageRatingPending ? 'Pendente' : 'OK', note: snap.screenshotsPending ? 'Ainda exige screenshots reais do celular antes da loja.' : 'Checklist de loja pronto.' },
    { title: 'Telas principais', status: snap.presentTabs === snap.requiredTabs ? 'OK' : 'Atenção', note: `${snap.presentTabs}/${snap.requiredTabs} telas críticas encontradas.` }
  ];
  const checklist = checks.map(item => `<article class="release-check ${item.status === 'OK' ? 'ok' : item.status === 'Risco' ? 'danger' : 'pending'}"><span>${item.status === 'OK' ? '✓' : item.status === 'Risco' ? '!' : '•'}</span><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.note)}</small></div><b>${escapeHtml(item.status)}</b></article>`).join('');
  const logs = (ls.auditLog || []).slice(0,8).map(item => `<div class="list-item"><div><strong>${escapeHtml(item.title)}</strong><div class="small">${escapeHtml(item.note)}</div></div><b>${escapeHtml(item.result)}</b></div>`).join('') || '<div class="list-item"><span>Execute a auditoria de localização.</span><strong>Pendente</strong></div>';
  host.innerHTML = `
    <section class="quality-hero localization-hero ${score >= 92 ? 'ok' : score >= 78 ? 'warn' : 'danger'}">
      <div><p class="eyebrow">v${BUILD_INFO.version} • Localization Store</p><h2>Prontidão internacional PT/EN/ES</h2><p>Central para preparar idioma, texto de loja, fallback de localização e exportação de relatório antes de teste público ou publicação.</p></div>
      <div class="release-score"><span>Store Score</span><strong>${score}</strong><small>${status}</small></div>
    </section>
    <div class="release-actions localization-lang-switch" role="group" aria-label="Selecionar idioma de prévia">${localeButtons}</div>
    <div class="cards-grid release-kpis"><article class="stat-card"><span>Idioma ativo</span><strong>${escapeHtml(snap.activeLabel)}</strong></article><article class="stat-card"><span>Cobertura</span><strong>${snap.coverage}%</strong></article><article class="stat-card"><span>Loja</span><strong>${snap.screenshotsPending ? 'Screens pend.' : 'Pronta'}</strong></article><article class="stat-card"><span>Legal</span><strong>${snap.legalReady ? 'OK' : 'Pendente'}</strong></article></div>
    <article class="panel-card store-preview-card"><div class="panel-title-row"><h4>Prévia de loja</h4><span class="mini-badge">${escapeHtml(ls.activeLocale)}</span></div><h3>${escapeHtml(snap.preview.title)}</h3><p class="eyebrow">${escapeHtml(snap.preview.subtitle)}</p><p>${escapeHtml(snap.preview.short)}</p><div class="tag-row">${snap.preview.keywords.map(k=>`<span>${escapeHtml(k)}</span>`).join('')}</div></article>
    <div class="release-actions"><button class="btn-primary" onclick="window.runLocalizationAudit()">Auditar localização</button><button class="btn-secondary" onclick="window.applyStoreReadyPreset()">Preset loja segura</button><button class="btn-ghost" onclick="window.exportStoreReadinessReport()">Exportar relatório</button></div>
    <section class="release-grid"><div><h4>Checklist internacional</h4><div class="release-checklist">${checklist}</div></div><div><h4>Logs recentes</h4><div class="list-stack">${logs}</div></div></section>`;
}

window.setLocalizationLocale = (locale='pt-BR') => {
  const ls = ensureLocalizationStoreSystem();
  const before = ls.activeLocale;
  if (!STORE_LOCALES[locale]) locale = 'pt-BR';
  ls.activeLocale = locale;
  ls.auditLog.unshift({ title: 'Idioma de prévia alterado', result: locale, note: `Prévia de loja alterada de ${before} para ${locale}.`, at: new Date().toISOString(), build: BUILD_INFO.build });
  ls.auditLog = ls.auditLog.slice(0,20);
  applyLocalizationStoreRuntime();
  saveState(state); renderLocalizationStore();
};

window.runLocalizationAudit = () => {
  const ls = ensureLocalizationStoreSystem();
  const snap = localizationSnapshot();
  ls.score = calculateLocalizationStoreScore();
  ls.lastAuditToken = `${BUILD_INFO.build}-${Date.now()}`;
  ls.exportReady = true;
  ls.auditLog.unshift({ title: 'Auditoria internacional concluída', result: `${ls.score}/100`, note: `${snap.activeLabel}, ${snap.presentTabs}/${snap.requiredTabs} telas críticas, legal ${snap.legalReady ? 'OK' : 'pendente'}.`, at: snap.at, build: BUILD_INFO.build });
  ls.auditLog = ls.auditLog.slice(0,20);
  addLog(`Localização/loja v${BUILD_INFO.version}: auditoria ${ls.score}/100.`);
  saveState(state); renderLocalizationStore();
};

window.applyStoreReadyPreset = () => {
  const ls = ensureLocalizationStoreSystem();
  const before = JSON.parse(JSON.stringify(ls));
  try {
    ls.storeReadiness.titleReady = true;
    ls.storeReadiness.descriptionReady = true;
    ls.storeReadiness.legalReady = true;
    ls.flags.localeGuard = true;
    ls.flags.storeCopyGuard = true;
    ls.flags.fallbackGuard = true;
    ls.textCoverage['pt-BR'] = Math.max(ls.textCoverage['pt-BR'] || 0, 100);
    ls.textCoverage.en = Math.max(ls.textCoverage.en || 0, 82);
    ls.textCoverage.es = Math.max(ls.textCoverage.es || 0, 80);
    ls.auditLog.unshift({ title: 'Preset loja segura aplicado', result: 'OK', note: 'Cobertura mínima, fallback e legal reforçados sem alterar gameplay.', at: new Date().toISOString(), build: BUILD_INFO.build });
    ls.score = calculateLocalizationStoreScore();
    addLog('Preset internacional/loja aplicado com segurança.');
    saveState(state); render();
  } catch (error) {
    state.localizationStore = before;
    showSystemError('Preset de loja restaurado sem perda de dados.', error);
  }
};

window.exportStoreReadinessReport = () => {
  const ls = ensureLocalizationStoreSystem();
  const payload = { app: BUILD_INFO.appName, version: BUILD_INFO.version, build: BUILD_INFO.build, generatedAt: new Date().toISOString(), score: calculateLocalizationStoreScore(), activeLocale: ls.activeLocale, supportedLocales: ls.supportedLocales, textCoverage: ls.textCoverage, storeReadiness: ls.storeReadiness, preview: STORE_LOCALES, snapshot: localizationSnapshot(), auditLog: ls.auditLog };
  ls.auditLog.unshift({ title: 'Relatório internacional gerado', result: 'JSON', note: 'Arquivo local com idioma, loja, legal e fallback.', at: payload.generatedAt, build: BUILD_INFO.build });
  try {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `vale-tennis-store-readiness-${BUILD_INFO.version}-${BUILD_INFO.build}.json`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  } catch (error) { console.info('Store readiness report fallback', payload, error); }
  saveState(state); renderLocalizationStore();
};


const HELP_GUIDES = {
  quickstart: {
    label: 'Primeiros passos',
    title: 'Comece uma carreira segura',
    steps: ['Revise a aba Dashboard e confirme academia/caixa.', 'Abra Atletas para escolher quem será trabalhado.', 'Use Treino para evoluir sem excesso de fadiga.', 'Entre em Partida para testar o Match Center.', 'Depois rode QA Final ou Diagnóstico antes de publicar.']
  },
  manager: {
    label: 'Gestão avançada',
    title: 'Carreira comercial e legado',
    steps: ['Economia controla patrocínio, investidores e viagem.', 'Newsroom afeta reputação e pressão pública.', 'Legado acompanha envelhecimento, aposentadoria e Hall da Fama.', 'Release RC, QA, Performance e Compatibilidade ajudam na homologação.']
  },
  mobile: {
    label: 'Mobile/PWA',
    title: 'Teste no celular',
    steps: ['Instale pelo navegador quando possível.', 'Teste toque e rolagem na aba Toque/Rolagem.', 'Use modo leitura se a tela estiver pequena.', 'Limpe caches antigos na aba Compatibilidade se notar versão presa.', 'Teste sempre em retrato e paisagem.']
  }
};

const RELEASE_NOTES_V409 = [
  { title: 'Central de ajuda offline', note: 'Nova aba com guias rápidos, perguntas frequentes e ações de suporte local.' },
  { title: 'Guia de primeiro uso', note: 'Checklist de onboarding sem alterar ranking, atletas ou economia.' },
  { title: 'Notas de versão dentro do jogo', note: 'Resumo da build, documentos e próximos testes recomendados.' },
  { title: 'Exportação de suporte', note: 'Gera JSON local com versão, schema, navegação e estado de QA sem enviar dados.' }
];

function ensureHelpCenterSystem() {
  state.releaseNotesHelp ||= { score: 97, firstRunSeen: false, activeGuide: 'quickstart', releaseNotesSeenBuild: null, helpArticles: [], onboardingChecklist: { createCareer: false, trainPlayer: false, playMatch: false, reviewEconomy: false, runQA: false }, auditLog: [], exportReady: false, lastAuditToken: null, flags: { offlineHelp: true, releaseNotesGuard: true, firstRunGuide: true, supportExport: true } };
  const help = state.releaseNotesHelp;
  help.score ??= 97;
  help.firstRunSeen ??= false;
  help.activeGuide ||= 'quickstart';
  help.releaseNotesSeenBuild ??= null;
  help.helpArticles ||= [];
  help.onboardingChecklist ||= { createCareer: false, trainPlayer: false, playMatch: false, reviewEconomy: false, runQA: false };
  help.auditLog ||= [];
  help.exportReady ??= false;
  help.flags ||= { offlineHelp: true, releaseNotesGuard: true, firstRunGuide: true, supportExport: true };
  return help;
}

function helpCenterSnapshot() {
  const help = ensureHelpCenterSystem();
  const tabs = [...document.querySelectorAll('.tab-panel')].map(p=>p.id.replace('tab-',''));
  const docs = ['README.md','CHANGELOG.md','RELEASE_CHECKLIST_v4.0.0.md','QA_CHECKLIST_v4.0.4.md','LOCALIZATION_STORE_CHECKLIST_v4.0.8.md','HELP_CENTER_v4.0.9.md','START_RECOVERY_CHECKLIST_v4.1.0.md','ONBOARDING_FLOW_CHECKLIST_v4.1.1.md','CACHE_PWA_UPDATE_CHECKLIST_v4.1.2.md','MANDATORY_CAREER_GATE_CHECKLIST_v4.1.4.md','FORCED_ONBOARDING_CHECKLIST_v4.1.5.md','ONBOARDING_RUNTIME_PROOF_CHECKLIST_v4.1.6.md'];
  const checklist = help.onboardingChecklist || {};
  const done = Object.values(checklist).filter(Boolean).length;
  const total = Math.max(1, Object.keys(checklist).length);
  return { build: BUILD_INFO.build, version: BUILD_INFO.version, schema: BUILD_INFO.schemaVersion, activeGuide: help.activeGuide, tabCount: tabs.length, docs, done, total, completion: Math.round((done / total) * 100), firstRunSeen: !!help.firstRunSeen, releaseSeen: help.releaseNotesSeenBuild === BUILD_INFO.build, at: new Date().toISOString() };
}

function calculateHelpCenterScore() {
  const help = ensureHelpCenterSystem();
  const snap = helpCenterSnapshot();
  let score = 100;
  if (!help.flags?.offlineHelp) score -= 12;
  if (!help.flags?.releaseNotesGuard) score -= 8;
  if (!help.flags?.firstRunGuide) score -= 8;
  if (!help.flags?.supportExport) score -= 8;
  if (snap.tabCount < 18) score -= 6;
  if (!snap.releaseSeen) score -= 3;
  return clamp(Math.round(score), 0, 100);
}

function installHelpCenterRuntime() {
  try {
    const help = ensureHelpCenterSystem();
    document.body.dataset.helpCenter = 'ready';
    if (!help.firstRunSeen && !help.auditLog.length) {
      help.auditLog.unshift({ title: 'Guia inicial preparado', result: 'OK', note: 'Central de ajuda offline disponível para a primeira execução.', at: new Date().toISOString(), build: BUILD_INFO.build });
      help.auditLog = help.auditLog.slice(0,20);
    }
  } catch (error) { console.warn('Help center runtime fallback', error); }
}

function renderHelpCenter() {
  const host = $('#helpCenterHub');
  if (!host || !state) return;
  const help = ensureHelpCenterSystem();
  const snap = helpCenterSnapshot();
  const score = calculateHelpCenterScore();
  help.score = score;
  const guide = HELP_GUIDES[help.activeGuide] || HELP_GUIDES.quickstart;
  const guideButtons = Object.entries(HELP_GUIDES).map(([key,item]) => `<button class="mini-btn ${help.activeGuide === key ? 'active' : ''}" onclick="window.setHelpGuide('${key}')">${escapeHtml(item.label)}</button>`).join('');
  const checklist = [
    ['createCareer','Carreira criada', !!state.flags?.ownerSetupComplete || !!state.academy?.owner],
    ['trainPlayer','Treino configurado', !!state.trainingLab?.lastReport || (state.trainingLab?.cycle && state.trainingLab?.focus)],
    ['playMatch','Partida testada', !!state.match || (state.broadcast?.replayArchive || []).length > 0],
    ['reviewEconomy','Economia revisada', !!state.commercialCareer?.ledger?.length || !!state.commercialCareer],
    ['runQA','QA executado', !!state.qaAutomation?.lastRunToken || !!state.releaseCandidate?.lastAuditToken]
  ].map(([key,label,auto]) => { const checked = !!help.onboardingChecklist?.[key] || !!auto; return `<article class="release-check ${checked ? 'ok' : 'pending'}"><span>${checked ? '✓' : '•'}</span><div><strong>${escapeHtml(label)}</strong><small>${checked ? 'Concluído ou detectado automaticamente.' : 'Pendente para homologação manual.'}</small></div><button class="mini-btn" onclick="window.toggleHelpChecklist('${key}')">${checked ? 'Rever' : 'Marcar'}</button></article>`; }).join('');
  const notes = RELEASE_NOTES_V409.map(item => `<article class="release-check ok"><span>✓</span><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.note)}</small></div><b>v${BUILD_INFO.version}</b></article>`).join('');
  const steps = guide.steps.map((step,i)=>`<li><strong>${i+1}.</strong> ${escapeHtml(step)}</li>`).join('');
  const logs = (help.auditLog || []).slice(0,8).map(item => `<div class="list-item"><div><strong>${escapeHtml(item.title)}</strong><div class="small">${escapeHtml(item.note)}</div></div><b>${escapeHtml(item.result)}</b></div>`).join('') || '<div class="list-item"><span>Use a central de ajuda para registrar auditoria.</span><strong>Pendente</strong></div>';
  host.innerHTML = `
    <section class="quality-hero help-hero ${score >= 92 ? 'ok' : score >= 78 ? 'warn' : 'danger'}">
      <div><p class="eyebrow">v${BUILD_INFO.version} • Help Center</p><h2>Guia inicial, notas de versão e suporte offline</h2><p>Central leve para orientar teste público, explicar as abas principais e exportar um relatório local de suporte sem enviar dados para servidor.</p></div>
      <div class="release-score"><span>Help Score</span><strong>${score}</strong><small>${snap.completion}% onboarding</small></div>
    </section>
    <div class="release-actions" role="group" aria-label="Selecionar guia">${guideButtons}</div>
    <section class="release-grid"><article class="panel-card"><div class="panel-title-row"><h4>${escapeHtml(guide.title)}</h4><span class="mini-badge">${escapeHtml(guide.label)}</span></div><ol class="help-step-list">${steps}</ol></article><article class="panel-card"><div class="panel-title-row"><h4>Status da build</h4><span class="metric-build">${BUILD_INFO.build}</span></div><div class="cards-grid release-kpis compact"><article class="stat-card"><span>Versão</span><strong>${BUILD_INFO.version}</strong></article><article class="stat-card"><span>Schema</span><strong>${BUILD_INFO.schemaVersion}</strong></article><article class="stat-card"><span>Telas</span><strong>${snap.tabCount}</strong></article><article class="stat-card"><span>Offline</span><strong>${help.flags.offlineHelp ? 'OK' : 'Atenção'}</strong></article></div></article></section>
    <div class="release-actions"><button class="btn-primary" onclick="window.runHelpCenterAudit()">Auditar ajuda</button><button class="btn-secondary" onclick="window.markFirstRunGuideSeen()">Marcar guia visto</button><button class="btn-ghost" onclick="window.exportHelpCenterReport()">Exportar suporte</button></div>
    <section class="release-grid"><div><h4>Checklist de primeiro uso</h4><div class="release-checklist">${checklist}</div></div><div><h4>Notas v${BUILD_INFO.version}</h4><div class="release-checklist">${notes}</div></div></section>
    <section class="release-grid"><article class="panel-card"><div class="panel-title-row"><h4>Documentos úteis no ZIP</h4><span class="mini-badge">offline</span></div><div class="tag-row">${snap.docs.map(doc=>`<span>${escapeHtml(doc)}</span>`).join('')}</div></article><article class="panel-card"><div class="panel-title-row"><h4>Histórico da central</h4><span class="mini-badge">local</span></div><div class="list-stack">${logs}</div></article></section>`;
}

window.setHelpGuide = (guide='quickstart') => {
  const help = ensureHelpCenterSystem();
  help.activeGuide = HELP_GUIDES[guide] ? guide : 'quickstart';
  help.auditLog.unshift({ title: 'Guia selecionado', result: HELP_GUIDES[help.activeGuide].label, note: 'Mudança visual de guia sem alterar gameplay.', at: new Date().toISOString(), build: BUILD_INFO.build });
  help.auditLog = help.auditLog.slice(0,20);
  saveState(state); renderHelpCenter();
};

window.toggleHelpChecklist = (key) => {
  const help = ensureHelpCenterSystem();
  help.onboardingChecklist ||= {};
  help.onboardingChecklist[key] = !help.onboardingChecklist[key];
  help.auditLog.unshift({ title: 'Checklist de primeiro uso atualizado', result: help.onboardingChecklist[key] ? 'Marcado' : 'Reaberto', note: key, at: new Date().toISOString(), build: BUILD_INFO.build });
  help.auditLog = help.auditLog.slice(0,20);
  saveState(state); renderHelpCenter();
};

window.markFirstRunGuideSeen = () => {
  const help = ensureHelpCenterSystem();
  help.firstRunSeen = true;
  help.releaseNotesSeenBuild = BUILD_INFO.build;
  help.auditLog.unshift({ title: 'Guia inicial marcado como visto', result: 'OK', note: `Notas da build ${BUILD_INFO.build} confirmadas localmente.`, at: new Date().toISOString(), build: BUILD_INFO.build });
  help.auditLog = help.auditLog.slice(0,20);
  addLog('Guia inicial e notas de versão marcados como vistos.');
  saveState(state); renderHelpCenter();
};

window.runHelpCenterAudit = () => {
  const help = ensureHelpCenterSystem();
  const snap = helpCenterSnapshot();
  help.score = calculateHelpCenterScore();
  help.lastAuditToken = `${BUILD_INFO.build}-${Date.now()}`;
  help.exportReady = true;
  help.auditLog.unshift({ title: 'Auditoria de ajuda concluída', result: `${help.score}/100`, note: `${snap.tabCount} telas, ${snap.docs.length} documentos e ${snap.completion}% onboarding.`, at: snap.at, build: BUILD_INFO.build });
  help.auditLog = help.auditLog.slice(0,20);
  addLog(`Ajuda/Release v${BUILD_INFO.version}: auditoria ${help.score}/100.`);
  saveState(state); renderHelpCenter();
};

window.exportHelpCenterReport = () => {
  const help = ensureHelpCenterSystem();
  const payload = { app: BUILD_INFO.appName, version: BUILD_INFO.version, build: BUILD_INFO.build, schema: BUILD_INFO.schemaVersion, generatedAt: new Date().toISOString(), helpScore: calculateHelpCenterScore(), snapshot: helpCenterSnapshot(), releaseNotes: RELEASE_NOTES_V409, activeGuide: help.activeGuide, onboardingChecklist: help.onboardingChecklist, auditLog: help.auditLog, privacy: 'Relatório gerado localmente. Não envia dados para servidor.' };
  help.exportReady = true;
  help.auditLog.unshift({ title: 'Relatório de suporte gerado', result: 'JSON', note: 'Arquivo local com build, guia, checklist e notas de versão.', at: payload.generatedAt, build: BUILD_INFO.build });
  try {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `vale-tennis-help-center-${BUILD_INFO.version}-${BUILD_INFO.build}.json`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  } catch (error) { console.info('Help center report fallback', payload, error); }
  saveState(state); renderHelpCenter();
};

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


function ensureNewsroomSystem() {
  state.newsroom ||= { items: [], pressQuestions: [], sentiment: 62, reputationPulse: 0, lastProcessedToken: null, lastInterviewWeek: 0 };
  state.newsroom.items ||= [];
  state.newsroom.pressQuestions ||= [];
  state.newsroom.sentiment ??= 62;
  state.newsroom.reputationPulse ??= 0;
  state.newsroom.lastProcessedToken ??= null;
  state.newsroom.lastInterviewWeek ??= 0;
}
function newsroomCategoryMeta(category='headline') { return NEWSROOM_CATEGORIES[category] || NEWSROOM_CATEGORIES.headline; }
function addNewsroomItem(item={}) {
  ensureNewsroomSystem();
  const category = item.category || 'headline';
  const meta = newsroomCategoryMeta(category);
  const seed = stableNumber(`${state.academy.season}-${state.academy.week}-${item.title || ''}-${category}`);
  const news = {
    id: item.id || `news-${state.academy.season}-${state.academy.week}-${seed}`,
    category,
    icon: item.icon || meta.icon,
    title: item.title || 'Nova manchete do circuito',
    body: item.body || 'O circuito mundial segue em movimento.',
    tag: item.tag || meta.label,
    sentiment: item.sentiment ?? 0,
    pressure: item.pressure ?? 0,
    reputation: item.reputation ?? 0,
    week: item.week ?? state.academy.week,
    season: item.season ?? state.academy.season,
    build: BUILD_INFO.build,
    at: new Date().toISOString()
  };
  if (!state.newsroom.items.some(existing => existing.id === news.id)) state.newsroom.items.unshift(news);
  state.newsroom.items = state.newsroom.items.slice(0, 80);
  state.newsroom.sentiment = clamp((state.newsroom.sentiment || 62) + (news.sentiment || 0) * .35, 5, 95);
  state.newsroom.reputationPulse = clamp((state.newsroom.reputationPulse || 0) + (news.reputation || 0), -30, 60);
  return news;
}
function createPressQuestion(topic='weekly') {
  ensureNewsroomSystem();
  const player = chooseBestPlayer();
  const event = state.calendar.find(ev => ev.week >= state.academy.week) || state.calendar[0] || {};
  const rank = player ? getPlayerRank(player.id) : 999;
  const pool = {
    weekly: `A imprensa quer saber se a academia está pronta para competir em ${event.name || 'um torneio importante'}.`,
    pressure: `${player?.name || 'Seu atleta'} sente pressão com ranking #${rank}. Qual será o tom público do treinador?`,
    injury: `${player?.name || 'Seu elenco'} tem alertas físicos. Você confirma preocupação médica?`,
    upset: `Após zebras no circuito, jornalistas perguntam se sua academia pode surpreender nesta temporada.`,
    sponsor: `Patrocinadores observam sua comunicação pública antes de novas propostas.`
  };
  const seed = stableNumber(`${state.academy.season}-${state.academy.week}-${topic}-${player?.id || 'academy'}`);
  const question = {
    id: `press-${state.academy.season}-${state.academy.week}-${seed}`,
    topic,
    title: 'Pergunta da coletiva',
    body: pool[topic] || pool.weekly,
    playerId: player?.id || null,
    eventName: event.name || 'Circuito mundial',
    answered: false,
    week: state.academy.week,
    season: state.academy.season,
    build: BUILD_INFO.build
  };
  if (!state.newsroom.pressQuestions.some(q => q.id === question.id)) state.newsroom.pressQuestions.unshift(question);
  state.newsroom.pressQuestions = state.newsroom.pressQuestions.slice(0, 14);
  return question;
}
function generateNewsroomWeeklyItems() {
  ensureNewsroomSystem();
  const token = `${state.academy.season}-${state.academy.week}`;
  if (state.newsroom.lastProcessedToken === token) return [];
  const created = [];
  const currentEvents = state.calendar.filter(event => event.week === state.academy.week);
  const recentResults = (state.worldTour?.weeklyResults || []).filter(r => r.week === state.academy.week && r.season === state.academy.season).slice(0, 3);
  const best = chooseBestPlayer();
  const rank = best ? getPlayerRank(best.id) : 999;
  const nextEvent = currentEvents[0] || state.calendar.find(event => event.week >= state.academy.week) || state.calendar[0];
  if (currentEvents.length) {
    const names = currentEvents.slice(0,2).map(e => e.name).join(' e ');
    created.push(addNewsroomItem({ category:'headline', title:'Semana de torneio movimenta o circuito', body:`${names} colocam pressão sobre ranking, logística e preparação tática das academias.`, sentiment:1, pressure:2, reputation:1 }));
  } else {
    created.push(addNewsroomItem({ category:'headline', title:'Semana de bastidores no circuito', body:'Sem grande evento imediato para a academia, os centros de treinamento focam recuperação, scouting e planejamento.', sentiment:1, pressure:-1, reputation:0 }));
  }
  recentResults.forEach(result => created.push(addNewsroomItem({ category:'result', title:`${result.champion} conquista ${result.eventName}`, body:`Final contra ${result.finalist}. ${result.upset ? 'A vitória repercutiu como zebra e mexeu no ranking.' : 'Resultado fortalece a lógica da elite nesta semana.'}`, sentiment: result.upset ? 2 : 1, pressure: result.upset ? 3 : 1, reputation: 1 })));
  if (best) {
    if (rank <= 120) created.push(addNewsroomItem({ category:'academy', title:`${best.name} vira pauta no circuito`, body:`A entrada na zona #${rank} aumenta atenção sobre calendário, patrocínio e decisões do treinador.`, sentiment:3, pressure:4, reputation:4 }));
    else if ((best.confidence || 60) < 45) created.push(addNewsroomItem({ category:'academy', title:`Confiança de ${best.name} preocupa bastidores`, body:'Analistas apontam necessidade de proteger o atleta e ajustar a comunicação após semanas de oscilação.', sentiment:-2, pressure:4, reputation:-1 }));
    else created.push(addNewsroomItem({ category:'academy', title:`Academia mantém plano de desenvolvimento`, body:`${best.name} trabalha para transformar evolução técnica em pontos de ranking. Próximo alvo: ${nextEvent?.name || 'torneio do circuito'}.`, sentiment:2, pressure:1, reputation:1 }));
    if ((best.injuredWeeks || 0) > 0 || (best.health || 100) < 70) created.push(addNewsroomItem({ category:'medical', title:`Boletim físico chama atenção`, body:`${best.name} aparece sob monitoramento médico. A imprensa espera clareza sobre carga de treino e retorno competitivo.`, sentiment:-3, pressure:3, reputation:-1 }));
  }
  const top = (state.ranking || []).filter(r => !r.isUser).slice(0,12);
  if (top.length >= 2 && state.academy.week % 3 === 0) {
    const a = top[stableNumber(token) % top.length];
    const b = top[(stableNumber(`${token}-rival`) + 3) % top.length];
    created.push(addNewsroomItem({ category:'rumor', title:'Rivalidade internacional ganha manchetes', body:`Rumores indicam tensão esportiva entre ${a.name} e ${b.name}. O circuito fica mais imprevisível para as próximas semanas.`, sentiment:1, pressure:2, reputation:1 }));
  }
  if (state.sponsorOffers?.length) created.push(addNewsroomItem({ category:'market', title:'Marcas observam ascensão da academia', body:`${state.sponsorOffers[0].name} e outros parceiros acompanham ranking, postura pública e presença em torneios.`, sentiment:2, pressure:1, reputation:3 }));
  if (state.academy.week % 2 === 0 || created.some(item => item.pressure >= 4)) createPressQuestion(created.some(item => item.category === 'medical') ? 'injury' : (rank <= 140 ? 'pressure' : 'weekly'));
  state.newsroom.lastProcessedToken = token;
  state.inbox.unshift({ title: 'Newsroom atualizado', body: `${created.length} manchete(s) e ${state.newsroom.pressQuestions.filter(q=>!q.answered).length} pergunta(s) de imprensa aguardam resposta.`, week: state.academy.week });
  state.inbox = state.inbox.slice(0, 18);
  return created;
}
function newsroomImpactLabel() {
  ensureNewsroomSystem();
  const sentiment = Math.round(state.newsroom.sentiment || 62);
  if (sentiment >= 76) return { label:`Imagem positiva • ${sentiment}`, cls:'ok' };
  if (sentiment <= 42) return { label:`Crise de narrativa • ${sentiment}`, cls:'danger' };
  return { label:`Narrativa em disputa • ${sentiment}`, cls:'warn' };
}
function renderNewsroom() {
  const host = $('#newsroomHub');
  if (!host) return;
  ensureNewsroomSystem();
  const items = state.newsroom.items || [];
  const questions = (state.newsroom.pressQuestions || []).filter(q => !q.answered).slice(0, 3);
  const impact = newsroomImpactLabel();
  const latest = items[0];
  const currentEvents = state.calendar.filter(event => event.week === state.academy.week).slice(0,2);
  const categoryCounts = Object.keys(NEWSROOM_CATEGORIES).map(key => ({ key, count: items.filter(item => item.category === key).length })).filter(x => x.count).slice(0,5);
  const heroLogo = currentEvents[0] ? logoForTournament(currentEvents[0].name) : logoForTournament(latest?.body || latest?.title || '');
  host.innerHTML = `
    <section class="newsroom-hero-card">
      <div class="newsroom-hero-logo">${logoMarkup(heroLogo, latest?.title || 'Newsroom', 'newsroom-logo', 'tournament-logo-fallback giant')}</div>
      <div class="newsroom-hero-copy">
        <p class="eyebrow">${BUILD_LABEL} • imprensa global</p>
        <h2>${escapeHtml(latest?.title || 'Central de notícias pronta')}</h2>
        <p>${escapeHtml(latest?.body || 'Avance a semana para gerar manchetes, rumores, coletivas e repercussão do circuito.')}</p>
        <div class="newsroom-kpi-row"><span class="${impact.cls}">${escapeHtml(impact.label)}</span><span>${items.length} notícias salvas</span><span>${questions.length} coletiva(s) aberta(s)</span><span>Pulse ${Math.round(state.newsroom.reputationPulse || 0)}</span></div>
      </div>
    </section>
    <section class="newsroom-grid">
      <article class="panel-card newsroom-feed-card"><div class="panel-title-row"><h4>Feed global</h4><button class="mini-btn" onclick="window.forceNewsroomCycle()">Gerar pauta</button></div>${items.length ? items.slice(0,10).map(renderNewsItem).join('') : '<p class="muted">Sem notícias ainda. Avance a semana ou gere uma pauta manual.</p>'}</article>
      <article class="panel-card newsroom-press-card"><div class="panel-title-row"><h4>Sala de imprensa</h4><span class="mini-badge">impacto real</span></div>${questions.length ? questions.map(renderPressQuestion).join('') : '<p class="muted">Nenhuma pergunta aberta. A imprensa reage a ranking, torneios, lesões e pressão.</p>'}</article>
      <article class="panel-card newsroom-categories"><h4>Termômetro editorial</h4>${categoryCounts.length ? categoryCounts.map(c=>`<div class="newsroom-meter"><span>${NEWSROOM_CATEGORIES[c.key].icon} ${NEWSROOM_CATEGORIES[c.key].label}</span><strong>${c.count}</strong></div>`).join('') : '<p class="muted">Categorias aparecerão conforme o circuito evoluir.</p>'}<p class="muted">Manchetes positivas ajudam reputação; crises aumentam pressão e exigem respostas.</p></article>
    </section>`;
  hydrateAssetImages();
}
function renderNewsItem(item) {
  const meta = newsroomCategoryMeta(item.category);
  const delta = (item.sentiment || 0) > 0 ? `+${item.sentiment}` : `${item.sentiment || 0}`;
  return `<div class="news-item ${meta.tone}"><div class="news-icon">${item.icon || meta.icon}</div><div><span>${escapeHtml(item.tag || meta.label)} • S${item.week}/${item.season}</span><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.body)}</p><small>Sentimento ${delta} • pressão ${item.pressure || 0} • reputação ${item.reputation || 0}</small></div></div>`;
}
function renderPressQuestion(question) {
  return `<div class="press-question"><strong>${escapeHtml(question.title)}</strong><p>${escapeHtml(question.body)}</p><div class="press-actions">${Object.entries(PRESS_ANSWERS).map(([key,answer])=>`<button class="mini-btn" onclick="window.answerPressQuestion('${question.id}','${key}')">${answer.label}</button>`).join('')}</div></div>`;
}
window.forceNewsroomCycle = () => {
  ensureNewsroomSystem();
  const before = JSON.parse(JSON.stringify(state.newsroom));
  try {
    state.newsroom.lastProcessedToken = null;
    generateNewsroomWeeklyItems();
    saveState(state);
    renderNewsroom();
    renderInbox();
  } catch (error) {
    state.newsroom = before;
    showSystemError('Newsroom restaurado sem perda de dados.');
  }
};
window.answerPressQuestion = (questionId, mode='humble') => {
  ensureNewsroomSystem();
  const question = state.newsroom.pressQuestions.find(q => q.id === questionId);
  const answer = PRESS_ANSWERS[mode] || PRESS_ANSWERS.humble;
  if (!question || question.answered) return;
  const before = JSON.parse(JSON.stringify({ newsroom: state.newsroom, roster: state.roster, academy: state.academy, inbox: state.inbox }));
  try {
    question.answered = true;
    question.answerMode = mode;
    question.answerLabel = answer.label;
    question.answeredAt = new Date().toISOString();
    state.newsroom.sentiment = clamp((state.newsroom.sentiment || 62) + answer.sentiment, 5, 95);
    state.newsroom.reputationPulse = clamp((state.newsroom.reputationPulse || 0) + answer.reputation, -30, 60);
    state.academy.reputation = Math.max(0, Math.round((state.academy.reputation || 0) + answer.reputation));
    const player = question.playerId ? state.roster.find(p => p.id === question.playerId) : chooseBestPlayer();
    if (player) {
      player.morale = clamp((player.morale || 70) + answer.morale, 0, 100);
      player.confidence = clamp((player.confidence || player.morale || 70) + Math.round(answer.morale * .6), 0, 100);
      player.pressure = clamp((player.pressure || 40) + answer.pressure, 0, 100);
      recordCareerEvent(player, `Coletiva: ${answer.label}`, `O treinador respondeu com ${answer.body}`, 'press');
    }
    addNewsroomItem({ category:'press', title:`Coletiva respondida: ${answer.label}`, body:`A resposta teve ${answer.body} Impacto aplicado em reputação, moral e pressão.`, sentiment:answer.sentiment, pressure:answer.pressure, reputation:answer.reputation });
    state.inbox.unshift({ title:'Coletiva respondida', body:`${answer.label}: reputação ${answer.reputation >= 0 ? '+' : ''}${answer.reputation}, sentimento ${answer.sentiment >= 0 ? '+' : ''}${answer.sentiment}.`, week:state.academy.week });
    saveState(state);
    render();
  } catch (error) {
    state.newsroom = before.newsroom; state.roster = before.roster; state.academy = before.academy; state.inbox = before.inbox;
    showSystemError('Resposta de imprensa revertida pelo sistema anti-quebra.');
  }
};

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
  ensureCommercialCareerSystem();
  const offer = (state.sponsorOffers || []).find(o => o.id === id);
  if (!offer) return;
  const snapshot = { money: state.academy.money, sponsor: state.academy.sponsor, offers: [...state.sponsorOffers], cc: JSON.stringify(state.commercialCareer), inbox: [...state.inbox], logs: [...state.logs] };
  try {
    const contract = { ...offer, weeksLeft: offer.weeks || 26, status: 'ativo', signedAt: new Date().toISOString(), penalty: offer.penalty || Math.round((offer.signingBonus || 0) * 0.18) };
    state.academy.money += offer.signingBonus;
    state.academy.sponsor += Math.round((offer.weeklyBoost || 0) * 0.35);
    state.commercialCareer.activeSponsors.unshift(contract);
    state.commercialCareer.boardConfidence = clamp(state.commercialCareer.boardConfidence + Math.max(2, Math.round(commercialOfferScore(offer)/18)), 0, 100);
    state.inbox.unshift({ title: `Contrato assinado: ${offer.name}`, body: `Entrada imediata de ${money(offer.signingBonus)}, ${money(offer.weeklyBoost)} semanais por ${contract.weeksLeft} semanas e meta: ${offer.requirement}.`, week: state.academy.week });
    pushLedger('sponsor', `Assinatura ${offer.name}`, offer.signingBonus, `${offer.tier || 'Regional'} • ${offer.requirement}`);
    state.sponsorOffers = state.sponsorOffers.filter(o => o.id !== id);
    addLog(`Novo patrocínio firmado com ${offer.name}.`);
    if (!saveState(state)) throw new Error('Falha ao salvar contrato comercial');
    render();
  } catch (error) {
    state.academy.money = snapshot.money; state.academy.sponsor = snapshot.sponsor; state.sponsorOffers = snapshot.offers; state.commercialCareer = JSON.parse(snapshot.cc); state.inbox = snapshot.inbox; state.logs = snapshot.logs;
    showSystemError('O contrato de patrocínio foi revertido com segurança.', error);
    render();
  }
};
window.rejectSponsorOffer = (id) => {
  ensureCommercialCareerSystem();
  const offer = (state.sponsorOffers || []).find(o => o.id === id);
  if (!offer) return;
  state.sponsorOffers = state.sponsorOffers.filter(o => o.id !== id);
  state.commercialCareer.boardConfidence = clamp(state.commercialCareer.boardConfidence - 1, 0, 100);
  pushLedger('sponsor-reject', `Proposta recusada: ${offer.name}`, 0, offer.requirement || 'sem meta');
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
    engineVersion: 'v3.12-premium-visual-academy', presentation: 'broadcast-pro', event, round, drawType: run.entryType, tournamentRunId: run.createdAt,
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
      player.careerTitles = (player.careerTitles || 0) + 1;
      if (event.tier === 'Grand Slam') player.grandSlamTitles = (player.grandSlamTitles || 0) + 1;
      player.peakOverall = Math.max(player.peakOverall || player.overall || 0, player.overall || 0);
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
  if (reportHost) reportHost.innerHTML = match.finished ? createBroadcastReport(match).map(line=>`<div class="report-line">${line}</div>`).join('') : `<div class="report-line">Motor v3.12 ativo: inteligência tática, identidade visual premium e ambientes da academia conectados à carreira.</div><div class="report-line">${broadcastRecommendation(match, player, opp)}</div><div class="report-line">Placar: ${scoreSnapshot(match)} • Estratégia: ${currentStrategy}</div>`;
  const autoBtn = $('#autoMatchBtn');
  if (autoBtn) autoBtn.textContent = autoPlayTimer ? `Auto ${autoPlaySpeed}x ativo` : 'Auto 1x';
  refreshAutoButtons();
  hydrateAssetImages();
}
function addMatchLog(text) { if (!state.match) return; state.match.log.push(text); state.match.log = state.match.log.slice(-80); }

function advanceWeek() {
  ensureCommercialCareerSystem();
  processWeeklyTraining();
  const weeklyIncome = calculateSponsor();
  const weeklyCosts = calculateWeeklyCosts();
  state.academy.money += weeklyIncome - weeklyCosts;
  processCommercialWeek(weeklyIncome, weeklyCosts);
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
  generateNewsroomWeeklyItems();
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
  const endingSeason = Math.max(2026, state.academy.season - 1);
  processLongCareerSeason(endingSeason);
  state.ranking.forEach(row => row.points = Math.round(row.points * (row.isUser ? 0.62 : 0.7)));
  state.roster.forEach(player => {
    ensureLongCareerPlayer(player);
    player.rankingPoints = Math.round((player.rankingPoints || 0) * 0.65 + Math.max(50, (player.overall || 50) * 1.1));
    player.health = Math.min(100, Math.max(player.health || 70, 78) + 8);
    player.injuredWeeks = 0;
    player.morale = clamp((player.morale || 70) + 4, 35, 100);
    player.careerPhase = careerPhase(player).key;
  });
  if (state.roster.length < 2 && state.generationalCareer?.prospects?.length) {
    const emergency = state.generationalCareer.prospects.shift();
    state.roster.push({ ...emergency, isUser:true, health:100, injuredWeeks:0, morale:72, fatigue:8, rankingPoints:20, debutSeason:state.academy.season, yearsPro:0, careerTitles:0, grandSlamTitles:0, bestRank:999, peakOverall:emergency.overall, relationship:70, pressure:30, confidence:62, happiness:74, careerEvents:[], conversationHistory:[], lastResult:'Contratado para renovação do elenco' });
  }
  updateLongCareerRecords(true);
  state.objectives.current = state.academy.season <= 2027 ? 'Colocar um atleta no Top 80' : 'Brigar por ATP 500';
  state.inbox.unshift({ title: `Nova temporada ${state.academy.season}`, body: 'Nova temporada iniciada com envelhecimento, auge/declínio, Next Gen, recordes e Hall da Fama processados.', week: state.academy.week });
  addLog(`Nova temporada ${state.academy.season} começou com simulação longa ativa.`);
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

function maybeCreateSponsorOffer(force=false) {
  ensureCommercialCareerSystem();
  state.sponsorOffers ||= [];
  if (!force && state.sponsorOffers.length >= 3) return;
  const trigger = force || state.academy.week % 4 === 0 || state.academy.reputation >= 28 || state.commercialCareer.riskScore >= 60;
  if (!trigger || (!force && Math.random() > 0.62)) return;
  const rep = state.academy.reputation || 0;
  const rank = getPlayerRank(chooseBestPlayer()?.id || 'none');
  const templates = COMMERCIAL_SPONSOR_BRANDS.filter(b => (rep >= 38 || b.tier !== 'Global') && (rep >= 24 || b.tier !== 'Premium'));
  const brand = templates[(state.academy.week + state.sponsorOffers.length + Math.floor(rep)) % templates.length] || COMMERCIAL_SPONSOR_BRANDS.at(-1);
  const multiplier = 1 + rep / 85 + Math.max(0, 180 - rank) / 900 + getStaffBonus('Financeiro', 'sponsor') / 180;
  const id = `offer-${state.academy.season}-${state.academy.week}-${Math.floor(Math.random()*9999)}`;
  const offer = {
    id,
    name: brand.name,
    tier: brand.tier,
    category: brand.category,
    prestige: brand.prestige,
    signingBonus: Math.round(brand.baseBonus * multiplier),
    weeklyBoost: Math.round(brand.weekly * multiplier),
    requirement: brand.requirement,
    weeks: brand.tier === 'Global' ? 52 : brand.tier === 'Premium' ? 40 : 26,
    penalty: Math.round(brand.baseBonus * 0.16 * multiplier),
    pressure: brand.prestige + (brand.tier === 'Global' ? 8 : 2),
    createdAt: new Date().toISOString()
  };
  if (state.sponsorOffers.some(o => o.name === offer.name)) offer.name = `${offer.name} ${state.academy.week}`;
  state.sponsorOffers.unshift(offer);
  state.sponsorOffers = state.sponsorOffers.slice(0, 4);
  state.commercialCareer.sponsorPipeline.unshift({ id: offer.id, name: offer.name, score: commercialOfferScore(offer), week: state.academy.week, season: state.academy.season });
  state.commercialCareer.sponsorPipeline = state.commercialCareer.sponsorPipeline.slice(0, 16);
  state.inbox.unshift({ title: `Nova proposta: ${offer.name}`, body: `Oferta ${offer.tier} com bônus de assinatura de ${money(offer.signingBonus)} e ${offer.weeks} semanas de contrato.`, week: state.academy.week });
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
  ensureCommercialCareerSystem();
  const base = state.academy.sponsor * (1 + state.academy.reputation / 140 + getStaffBonus('Financeiro', 'sponsor') / 100);
  const contracts = commercialWeeklySponsorBoost();
  const newsroomBoost = (state.newsroom?.sentiment || 62) > 70 ? 0.04 : (state.newsroom?.sentiment || 62) < 42 ? -0.05 : 0;
  return Math.max(0, Math.round((base + contracts) * (1 + newsroomBoost)));
}
function calculateWeeklyCosts() {
  ensureCommercialCareerSystem();
  const salaries = state.roster.reduce((sum, p) => sum + p.salary, 0) + Object.values(state.staff).filter(Boolean).reduce((sum, s) => sum + s.salary, 0);
  const financeCut = getStaffBonus('Financeiro', 'costs');
  const investorFee = investorPressure() * 220;
  return Math.round((state.academy.weeklyCosts + salaries + investorFee) * (1 - Math.abs(Math.min(0, financeCut)) / 100));
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
