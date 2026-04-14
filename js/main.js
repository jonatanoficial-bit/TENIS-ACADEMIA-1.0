import { loadContentBundle } from './core/content-loader.js';
import { createInitialState, rebuildRankings } from './core/state.js';
import {
  clearGameState,
  loadGameState,
  loadLastView,
  saveGameState,
  saveLastView,
} from './core/storage.js';
import { formatCurrency, getCategoryLabel, getSurfaceLabel } from './core/utils.js';
import {
  advanceWeek,
  applyFeaturedMatchResult,
  getWeeklyEventDigest,
  hireStaffMember,
  prepareFeaturedMatch,
  signProspect,
  summaryToText,
  upgradeFacility,
} from './modules/sim-engine.js';
import {
  renderCalendar,
  renderDashboard,
  renderHero,
  renderMarket,
  renderMatchPanel,
  renderNavigation,
  renderNotifications,
  renderRanking,
  renderTopbar,
  renderTraining,
} from './modules/renderers.js';
import { LiveMatchController } from './modules/match-engine.js';

let appState;
let contentBundle;
let buildInfo;
let matchController;
let hudFrame;

const boot = document.querySelector('#boot-screen');
const views = document.querySelectorAll('.view-panel');
const liveScore = document.querySelector('#match-live-score');
const liveLog = document.querySelector('#match-log-feed');

const pushNotification = (title, message, tone = 'accent') => {
  appState.ui.notifications.unshift({
    id: `note-${Date.now()}`,
    tone,
    title,
    message,
  });
  appState.ui.notifications = appState.ui.notifications.slice(0, 8);
};

const persist = () => {
  saveGameState(appState);
  saveLastView(appState.ui.selectedView);
};

const showView = () => {
  views.forEach((panel) => {
    panel.classList.toggle('is-active', panel.dataset.view === appState.ui.selectedView);
  });
};

const renderHudFromMatch = () => {
  if (!matchController) return;
  const snapshot = matchController.getSnapshot();
  if (!snapshot.queue) {
    liveScore.innerHTML = '<div class="glass-card section-card"><p class="muted">Sem partida ao vivo.</p></div>';
    liveLog.innerHTML = '<div class="glass-card section-card"><p class="muted">O feed do rally aparece aqui quando o Match Center é iniciado.</p></div>';
    return;
  }

  const score = snapshot.score;
  const current = score.tiebreak
    ? `${score.currentPoints.player}-${score.currentPoints.opponent}`
    : `${score.currentGames.player}-${score.currentGames.opponent} games`;

  liveScore.innerHTML = `
    <div class="glass-card section-card live-score-card">
      <div class="section-head"><h3>Placar ao vivo</h3><span>${snapshot.active ? 'Em quadra' : 'Aguardando'}</span></div>
      <div class="split-score">
        <div>
          <strong>${snapshot.queue.playerName}</strong>
          <span>Sets ${score.setWins.player}</span>
        </div>
        <div>
          <strong>${snapshot.queue.opponentName}</strong>
          <span>Sets ${score.setWins.opponent}</span>
        </div>
      </div>
      <div class="match-micro-stats">
        <span>${current}</span>
        <span>${getCategoryLabel(snapshot.queue.category)} · ${getSurfaceLabel(snapshot.queue.surface)}</span>
      </div>
    </div>
  `;

  liveLog.innerHTML = `
    <div class="glass-card section-card">
      <div class="section-head"><h3>Feed do rally</h3><span>${snapshot.stats.longestRally} bolas</span></div>
      <div class="match-log-list">
        ${snapshot.log.map((line) => `<p>${line}</p>`).join('')}
      </div>
    </div>
  `;

  if (snapshot.active) {
    hudFrame = requestAnimationFrame(renderHudFromMatch);
  }
};

const beginLiveMatch = () => {
  const queue = appState.match.queue || prepareFeaturedMatch(appState);
  if (!queue) {
    pushNotification('Não foi possível gerar a partida', 'Sem atleta elegível neste momento.', 'danger');
    persist();
    renderAll();
    return;
  }

  const player = appState.academy.players.find((item) => item.id === queue.playerId);
  const opponent = appState.world.rankings.find((item) => item.id === queue.opponentId);
  if (!player || !opponent) {
    pushNotification('Oponente indisponível', 'Tente gerar um novo confronto.', 'danger');
    return;
  }

  appState.ui.selectedView = 'match';
  showView();
  renderMatchPanel(appState);
  matchController.mount(queue, player, opponent);
  matchController.start();
  cancelAnimationFrame(hudFrame);
  renderHudFromMatch();
  pushNotification('Partida iniciada', `${player.name} encara ${opponent.name} em ${queue.eventName}.`, 'accent');
  persist();
  renderNotifications(appState);
};

const renderAll = () => {
  rebuildRankings(appState);
  renderNavigation(appState);
  renderTopbar(appState, contentBundle, buildInfo);
  renderHero(appState, contentBundle);
  renderDashboard(appState);
  renderTraining(appState);
  renderCalendar(appState);
  renderRanking(appState);
  renderMarket(appState);
  renderMatchPanel(appState);
  renderNotifications(appState);
  showView();
  renderHudFromMatch();
};

const handleMatchComplete = (result) => {
  const won = applyFeaturedMatchResult(appState, result);
  pushNotification(
    won ? 'Vitória no Match Center' : 'Derrota no Match Center',
    `${result.scoreline || 'Resultado fechado'} · ${won ? 'Bônus aplicado ao atleta.' : 'Moral reduzida, mas experiência registrada.'}`,
    won ? 'success' : 'danger',
  );
  persist();
  renderAll();
};

const handleClick = (event) => {
  const trigger = event.target.closest('[data-nav-view], [data-action], [data-hire-staff], [data-sign-player], [data-upgrade-facility], [data-select-player]');
  if (!trigger) return;

  if (trigger.dataset.navView) {
    appState.ui.selectedView = trigger.dataset.navView;
    persist();
    renderNavigation(appState);
    showView();
    return;
  }

  if (trigger.dataset.selectPlayer) {
    appState.ui.selectedPlayerId = trigger.dataset.selectPlayer;
    persist();
    renderTraining(appState);
    return;
  }

  if (trigger.dataset.hireStaff) {
    const success = hireStaffMember(appState, trigger.dataset.hireStaff);
    pushNotification(
      success ? 'Staff contratado' : 'Contratação recusada',
      success ? 'Novo profissional integrado à academia.' : 'Caixa insuficiente para esta contratação.',
      success ? 'success' : 'danger',
    );
    persist();
    renderAll();
    return;
  }

  if (trigger.dataset.signPlayer) {
    const success = signProspect(appState, trigger.dataset.signPlayer);
    pushNotification(
      success ? 'Atleta contratado' : 'Negociação travou',
      success ? 'Talento adicionado ao elenco da academia.' : 'Caixa insuficiente para fechar o acordo.',
      success ? 'success' : 'danger',
    );
    persist();
    renderAll();
    return;
  }

  if (trigger.dataset.upgradeFacility) {
    const result = upgradeFacility(appState, trigger.dataset.upgradeFacility);
    pushNotification(
      result ? 'Instalação melhorada' : 'Upgrade indisponível',
      result ? `Investimento realizado: ${formatCurrency(result)}.` : 'Você precisa de mais caixa ou já atingiu o nível máximo.',
      result ? 'success' : 'danger',
    );
    persist();
    renderAll();
    return;
  }

  switch (trigger.dataset.action) {
    case 'advance-week': {
      const summary = advanceWeek(appState, contentBundle);
      if (summary) {
        pushNotification('Semana concluída', summaryToText(summary), summary.net >= 0 ? 'success' : 'danger');
      }
      persist();
      renderAll();
      break;
    }
    case 'prepare-match': {
      const queue = prepareFeaturedMatch(appState);
      if (queue) {
        appState.ui.selectedView = 'match';
        pushNotification('Confronto gerado', `${queue.playerName} vs ${queue.opponentName} em ${queue.eventName}.`, 'accent');
      }
      persist();
      renderAll();
      break;
    }
    case 'start-live-match':
      beginLiveMatch();
      break;
    case 'open-admin':
      window.location.href = appState.ui.adminLink;
      break;
    case 'reset-save':
      clearGameState();
      window.location.reload();
      break;
    default:
      break;
  }
};

const handleChange = (event) => {
  const focusSelector = event.target.closest('[data-player-focus]');
  if (!focusSelector) return;
  const player = appState.academy.players.find((item) => item.id === focusSelector.dataset.playerFocus);
  if (!player) return;
  player.weeklyFocus = focusSelector.value;
  persist();
  pushNotification('Treino atualizado', `${player.name} agora foca em ${focusSelector.selectedOptions[0].textContent}.`, 'accent');
  renderNotifications(appState);
};

const handleMatchAction = (event) => {
  const trigger = event.target.closest('[data-match-action]');
  if (!trigger) return;
  matchController.applyAction(trigger.dataset.matchAction);
  renderHudFromMatch();
};

const initialize = async () => {
  buildInfo = await fetch('build/build-info.json', { cache: 'no-store' }).then((response) => response.json());
  contentBundle = await loadContentBundle();

  const saved = loadGameState();
  appState = saved || createInitialState(contentBundle, buildInfo);
  appState.ui.selectedView = loadLastView();
  rebuildRankings(appState);

  const canvas = document.querySelector('#live-match-canvas');
  matchController = new LiveMatchController(canvas, handleMatchComplete);

  document.addEventListener('click', handleClick);
  document.addEventListener('click', handleMatchAction);
  document.addEventListener('change', handleChange);

  renderAll();
  boot.classList.add('is-hidden');

  const weekDigest = getWeeklyEventDigest(appState)[0];
  if (weekDigest) {
    pushNotification('Circuito pronto', `Evento principal carregado: ${weekDigest.name}.`, 'accent');
    renderNotifications(appState);
  }
};

initialize().catch((error) => {
  console.error(error);
  boot.innerHTML = `
    <div class="boot-card glass-card">
      <span class="eyebrow">Falha de inicialização</span>
      <h1>ACE Academy Manager</h1>
      <p>Não foi possível carregar a build. Verifique se você abriu o projeto por um servidor local.</p>
      <pre>${error.message}</pre>
    </div>
  `;
});
