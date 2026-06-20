import {
  formatCompact,
  formatCurrency,
  formatDate,
  getCategoryLabel,
  getSurfaceLabel,
} from '../core/utils.js';
import { getWeeklyEventDigest, summaryToText } from './sim-engine.js';

const toneClass = {
  accent: 'pill-accent',
  success: 'pill-success',
  danger: 'pill-danger',
};

const iconForView = {
  dashboard: '◈',
  training: '⬢',
  calendar: '◫',
  ranking: '◎',
  market: '✦',
  match: '▣',
};

const getStaffList = (state) =>
  Object.entries(state.academy.staff).map(([key, member]) => ({ key, ...member }));

const getAcademyStars = (state) => [...state.academy.players].sort((a, b) => a.liveRank - b.liveRank);

const getHighlightStats = (state) => {
  const bestPlayer = getAcademyStars(state)[0];
  const titles = state.academy.players.reduce((sum, player) => sum + player.titles.length, 0);
  return [
    { label: 'Caixa atual', value: formatCurrency(state.profile.balance) },
    { label: 'Reputação', value: `${state.profile.reputation.toFixed(1)} / 99` },
    { label: 'Fãs', value: formatCompact(state.profile.fans) },
    { label: 'Melhor atleta', value: bestPlayer ? `${bestPlayer.name} #${bestPlayer.liveRank}` : '--' },
    { label: 'Títulos', value: `${titles}` },
    { label: 'Sponsor tier', value: state.profile.sponsorTier },
  ];
};

const metricCard = (item) => `
  <article class="metric-card glass-card">
    <p class="metric-label">${item.label}</p>
    <h3 class="metric-value">${item.value}</h3>
  </article>
`;

const eventCard = (event) => `
  <article class="event-card glass-card">
    <div class="eyebrow-row">
      <span class="badge">${event.categoryLabel}</span>
      <span class="muted">${event.surfaceLabel}</span>
    </div>
    <h4>${event.name}</h4>
    <p>${event.city}, ${event.country}</p>
    <div class="event-meta">
      <span>${formatDate(event.startDate)} - ${formatDate(event.endDate)}</span>
      <span>Cut ${event.entryCutoff}</span>
    </div>
  </article>
`;

const playerCard = (player) => `
  <article class="roster-card glass-card">
    <div class="roster-head">
      <div class="avatar-badge">${player.name
        .split(' ')
        .slice(0, 2)
        .map((chunk) => chunk[0])
        .join('')}</div>
      <div>
        <h4>${player.name}</h4>
        <p>#${player.liveRank} · ${player.age} anos · ${player.archetype}</p>
      </div>
      <span class="badge">OVR ${player.overall}</span>
    </div>
    <div class="attr-grid">
      <div><span>Saque</span><strong>${Math.round(player.serve)}</strong></div>
      <div><span>Devolução</span><strong>${Math.round(player.return)}</strong></div>
      <div><span>Stamina</span><strong>${Math.round(player.stamina)}</strong></div>
      <div><span>Foco</span><strong>${Math.round(player.focus)}</strong></div>
    </div>
    <div class="roster-footer">
      <span>${getSurfaceLabel(player.preferredSurface)}</span>
      <span>${player.points} pts</span>
      <span>Forma ${player.form >= 0 ? '+' : ''}${player.form}</span>
    </div>
  </article>
`;

const trainingCard = (player) => `
  <article class="training-card glass-card">
    <div class="training-head">
      <div>
        <h4>${player.name}</h4>
        <p>#${player.liveRank} · Fit ${player.fitness.toFixed(0)} · Moral ${player.morale.toFixed(0)}</p>
      </div>
      <span class="badge">OVR ${player.overall}</span>
    </div>
    <div class="progress-grid">
      ${[
        ['Saque', player.serve],
        ['Devolução', player.return],
        ['Stamina', player.stamina],
        ['Foco', player.focus],
      ]
        .map(
          ([label, value]) => `
            <label class="progress-row">
              <span>${label}</span>
              <div class="bar"><span style="width:${value}%"></span></div>
              <strong>${Math.round(value)}</strong>
            </label>
          `,
        )
        .join('')}
    </div>
    <div class="training-controls">
      <label>
        Foco semanal
        <select data-player-focus="${player.id}">
          ${[
            ['balanced', 'Balanceado'],
            ['serve', 'Saque'],
            ['return', 'Devolução'],
            ['stamina', 'Stamina'],
            ['focus', 'Foco'],
          ]
            .map(([value, label]) => `<option value="${value}" ${player.weeklyFocus === value ? 'selected' : ''}>${label}</option>`)
            .join('')}
        </select>
      </label>
      <button class="button-secondary" data-select-player="${player.id}">Destacar</button>
    </div>
  </article>
`;

const staffCard = (member) => `
  <article class="staff-card glass-card">
    <span class="badge">RTG ${member.rating}</span>
    <h4>${member.name}</h4>
    <p>${member.department}</p>
    <small>${member.impact}</small>
  </article>
`;

const rankingRow = (entry, highlight = false) => `
  <tr class="${highlight ? 'is-highlight' : ''}">
    <td>#${entry.liveRank}</td>
    <td>${entry.name}</td>
    <td>${entry.age ?? '--'}</td>
    <td>${entry.points}</td>
    <td>${entry.overall}</td>
    <td>${entry.ownership === 'academy' ? 'Academia' : 'Tour'}</td>
  </tr>
`;

const marketPlayerCard = (player) => `
  <article class="market-card glass-card">
    <div class="eyebrow-row">
      <span class="badge">Pot. ${player.potential}</span>
      <span class="muted">${getSurfaceLabel(player.preferredSurface)}</span>
    </div>
    <h4>${player.name}</h4>
    <p>${player.age} anos · ${player.archetype}</p>
    <div class="market-grid">
      <span>Pts ${player.points}</span>
      <span>OVR ${player.overall}</span>
      <span>Salário ${formatCurrency(player.salary)}</span>
    </div>
    <button class="button-primary" data-sign-player="${player.id}">Contratar · ${formatCurrency(player.fee)}</button>
  </article>
`;

const marketStaffCard = (member) => `
  <article class="market-card glass-card">
    <div class="eyebrow-row">
      <span class="badge">${member.role}</span>
      <span class="muted">RTG ${member.rating}</span>
    </div>
    <h4>${member.name}</h4>
    <p>${member.specialty}</p>
    <div class="market-grid">
      <span>Taxa ${formatCurrency(member.signFee)}</span>
      <span>Salário ${formatCurrency(member.salary)}</span>
    </div>
    <button class="button-secondary" data-hire-staff="${member.id}">Assinar</button>
  </article>
`;

const notificationCard = (note) => `
  <article class="toast-card ${toneClass[note.tone] || 'pill-accent'}">
    <strong>${note.title}</strong>
    <p>${note.message}</p>
  </article>
`;

const summaryCard = (state) => {
  const summary = state.profile.lastSummary;
  if (!summary) {
    return `
      <article class="summary-card glass-card">
        <h3>Nenhuma semana simulada ainda</h3>
        <p>Gere uma partida tática ou avance a semana para receber um relatório completo da operação.</p>
      </article>
    `;
  }
  return `
    <article class="summary-card glass-card">
      <div class="eyebrow-row">
        <span class="badge">Resumo mais recente</span>
        <span class="muted">${summary.weekLabel}</span>
      </div>
      <h3>${summary.headline}</h3>
      <p>${summaryToText(summary)}</p>
      <div class="summary-list">
        ${summary.eventSummaries
          .slice(0, 3)
          .map(
            (item) => `
              <div>
                <strong>${item.playerName}</strong>
                <span>${item.stage} · ${item.eventName}</span>
              </div>
            `,
          )
          .join('')}
      </div>
    </article>
  `;
};

const facilityCard = (state) => `
  <article class="facility-card glass-card">
    <h3>Infraestrutura premium</h3>
    <div class="facility-grid">
      ${Object.entries(state.academy.facilities)
        .map(
          ([key, value]) => `
            <div>
              <span>${key}</span>
              <strong>Nível ${value}</strong>
              <button class="button-tertiary" data-upgrade-facility="${key}">Upgrade</button>
            </div>
          `,
        )
        .join('')}
    </div>
  </article>
`;

export const renderNavigation = (state) => {
  document.querySelectorAll('[data-nav-view]').forEach((button) => {
    const isActive = button.dataset.navView === state.ui.selectedView;
    button.classList.toggle('is-active', isActive);
    const icon = button.querySelector('.nav-icon');
    if (icon) icon.textContent = iconForView[button.dataset.navView] || '•';
  });
};

export const renderTopbar = (state, content, buildInfo) => {
  const topbarMeta = document.querySelector('#topbar-meta');
  const resourceStrip = document.querySelector('#resource-strip');
  topbarMeta.innerHTML = `
    <div>
      <span class="eyebrow">${content.branding.tagline}</span>
      <h1>${content.branding.title}</h1>
      <p>${state.profile.academyName} · ${state.profile.currentWeekLabel}</p>
    </div>
    <div class="build-chip">v${buildInfo.version} · build ${buildInfo.build}</div>
  `;
  resourceStrip.innerHTML = `
    <div class="resource-pill">
      <span>Caixa</span>
      <strong>${formatCurrency(state.profile.balance)}</strong>
    </div>
    <div class="resource-pill">
      <span>Reputação</span>
      <strong>${state.profile.reputation.toFixed(1)}</strong>
    </div>
    <div class="resource-pill">
      <span>Fãs</span>
      <strong>${formatCompact(state.profile.fans)}</strong>
    </div>
    <div class="resource-pill">
      <span>Tier</span>
      <strong>${state.profile.sponsorTier}</strong>
    </div>
  `;
};

export const renderHero = (state, content) => {
  const digest = getWeeklyEventDigest(state);
  const hero = document.querySelector('#hero-banner');
  const mainEvent = digest[0];
  const heroArt = content.branding.heroImage || './assets/backgrounds/bg-dashboard.svg';
  hero.innerHTML = `
    <div class="hero-copy glass-card hero-main" style="--hero-art:url('${heroArt.replace(/'/g, "%27")}')">
      <span class="eyebrow">Modo Carreira Infinito</span>
      <h2>${content.copy.heroTitle}</h2>
      <p>${content.copy.heroSubtitle}</p>
      <div class="hero-actions-row">
        <button class="button-primary" data-action="advance-week">Avançar semana</button>
        <button class="button-secondary" data-action="prepare-match">Gerar partida tática</button>
        <button class="button-tertiary" data-action="open-admin">Admin</button>
      </div>
    </div>
    <div class="hero-side glass-card">
      <span class="eyebrow">Evento principal da semana</span>
      <h3>${mainEvent ? mainEvent.name : 'Janela interna de preparação'}</h3>
      <p>${mainEvent ? `${mainEvent.categoryLabel} · ${mainEvent.surfaceLabel}` : 'Ajuste treinos, staff e scouting antes da próxima rodada.'}</p>
      <div class="hero-side-meta">
        <span>${mainEvent ? `${mainEvent.city}, ${mainEvent.country}` : 'Semana livre'}</span>
        <span>${mainEvent ? `${formatDate(mainEvent.startDate)} - ${formatDate(mainEvent.endDate)}` : 'Sem data fixa'}</span>
      </div>
    </div>
  `;
};

export const renderDashboard = (state) => {
  const container = document.querySelector('#dashboard-view');
  const events = getWeeklyEventDigest(state);
  container.innerHTML = `
    <section class="section-stack">
      <div class="metric-grid">${getHighlightStats(state).map(metricCard).join('')}</div>
      <div class="split-grid">
        ${summaryCard(state)}
        ${facilityCard(state)}
      </div>
      <div class="dual-grid">
        <section class="glass-card section-card">
          <div class="section-head"><h3>Elenco da academia</h3><span>${state.academy.players.length} atletas</span></div>
          <div class="card-grid compact-grid">${getAcademyStars(state).map(playerCard).join('')}</div>
        </section>
        <section class="glass-card section-card">
          <div class="section-head"><h3>Staff principal</h3><span>Impacto direto no desenvolvimento</span></div>
          <div class="card-grid compact-grid">${getStaffList(state).map(staffCard).join('')}</div>
        </section>
      </div>
      <section class="glass-card section-card">
        <div class="section-head"><h3>Agenda viva</h3><span>${events.length} eventos nesta janela</span></div>
        <div class="card-grid compact-grid">${events.slice(0, 6).map(eventCard).join('')}</div>
      </section>
    </section>
  `;
};

export const renderTraining = (state) => {
  const container = document.querySelector('#training-view');
  const selected = state.academy.players.find((player) => player.id === state.ui.selectedPlayerId) || state.academy.players[0];
  container.innerHTML = `
    <section class="section-stack">
      <section class="glass-card section-card spotlight-card">
        <div>
          <span class="eyebrow">Atleta em foco</span>
          <h3>${selected.name}</h3>
          <p>#${selected.liveRank} · ${selected.archetype} · Superfície favorita: ${getSurfaceLabel(selected.preferredSurface)}</p>
        </div>
        <div class="spotlight-stats">
          <div><span>Forma</span><strong>${selected.form >= 0 ? '+' : ''}${selected.form}</strong></div>
          <div><span>Fitness</span><strong>${selected.fitness.toFixed(0)}</strong></div>
          <div><span>Moral</span><strong>${selected.morale.toFixed(0)}</strong></div>
          <div><span>Potencial</span><strong>${selected.potential || '--'}</strong></div>
        </div>
      </section>
      <div class="card-grid">
        ${state.academy.players.map(trainingCard).join('')}
      </div>
    </section>
  `;
};

export const renderCalendar = (state) => {
  const container = document.querySelector('#calendar-view');
  const events = getWeeklyEventDigest(state);
  const nextSix = state.world.calendar
    .filter((event) => new Date(event.endDate) >= new Date(state.profile.currentDate))
    .slice()
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
    .slice(0, 10)
    .map((event) => ({
      ...event,
      categoryLabel: getCategoryLabel(event.category),
      surfaceLabel: getSurfaceLabel(event.surface),
    }));

  container.innerHTML = `
    <section class="section-stack">
      <section class="glass-card section-card timeline-card">
        <div class="section-head"><h3>Semana atual</h3><span>${state.profile.currentWeekLabel}</span></div>
        <div class="card-grid compact-grid">${events.length ? events.map(eventCard).join('') : '<p class="muted">Nenhum evento oficial nesta semana.</p>'}</div>
      </section>
      <section class="glass-card section-card">
        <div class="section-head"><h3>Próximas paradas do circuito</h3><span>Calendário anual contínuo</span></div>
        <div class="timeline-list">
          ${nextSix
            .map(
              (event) => `
                <article class="timeline-item">
                  <div>
                    <strong>${event.name}</strong>
                    <span>${event.categoryLabel} · ${event.surfaceLabel}</span>
                  </div>
                  <div>
                    <strong>${formatDate(event.startDate)}</strong>
                    <span>${event.city}, ${event.country}</span>
                  </div>
                </article>
              `,
            )
            .join('')}
        </div>
      </section>
    </section>
  `;
};

export const renderRanking = (state) => {
  const container = document.querySelector('#ranking-view');
  const topRows = state.world.rankings.slice(0, 24);
  const academyIds = new Set(state.academy.players.map((item) => item.id));
  const aroundAcademy = state.world.rankings.filter((entry) => academyIds.has(entry.id));
  container.innerHTML = `
    <section class="section-stack">
      <section class="glass-card section-card">
        <div class="section-head"><h3>Ranking mundial live</h3><span>Base oficial + sim dinâmica</span></div>
        <div class="table-wrap">
          <table class="premium-table">
            <thead>
              <tr><th>Rank</th><th>Nome</th><th>Idade</th><th>Pontos</th><th>OVR</th><th>Origem</th></tr>
            </thead>
            <tbody>
              ${topRows.map((entry) => rankingRow(entry, academyIds.has(entry.id))).join('')}
            </tbody>
          </table>
        </div>
      </section>
      <section class="glass-card section-card">
        <div class="section-head"><h3>Seus atletas no ranking</h3><span>Monitoramento individual</span></div>
        <div class="table-wrap">
          <table class="premium-table">
            <thead>
              <tr><th>Rank</th><th>Nome</th><th>Pontos</th><th>Forma</th><th>Títulos</th></tr>
            </thead>
            <tbody>
              ${aroundAcademy
                .map(
                  (entry) => `
                    <tr class="is-highlight">
                      <td>#${entry.liveRank}</td>
                      <td>${entry.name}</td>
                      <td>${entry.points}</td>
                      <td>${entry.form >= 0 ? '+' : ''}${entry.form}</td>
                      <td>${entry.titles?.length || 0}</td>
                    </tr>
                  `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  `;
};

export const renderMarket = (state) => {
  const container = document.querySelector('#market-view');
  container.innerHTML = `
    <section class="section-stack">
      <section class="glass-card section-card">
        <div class="section-head"><h3>Jovens talentos</h3><span>Mercado filtrado pelo seu scouting</span></div>
        <div class="card-grid compact-grid">${state.market.playerCandidates.map(marketPlayerCard).join('')}</div>
      </section>
      <section class="glass-card section-card">
        <div class="section-head"><h3>Mercado de staff</h3><span>Substitua peças-chave sem mexer no core</span></div>
        <div class="card-grid compact-grid">${state.market.staffCandidates.map(marketStaffCard).join('')}</div>
      </section>
    </section>
  `;
};

export const renderMatchPanel = (state) => {
  const summary = document.querySelector('#match-summary');
  const status = document.querySelector('#match-live-status');
  const history = document.querySelector('#match-history');
  const queue = state.match.queue;
  summary.innerHTML = queue
    ? `
      <div class="glass-card match-card-head">
        <span class="eyebrow">Partida pronta</span>
        <h3>${queue.playerName} vs ${queue.opponentName}</h3>
        <p>${queue.eventName} · ${getCategoryLabel(queue.category)} · ${getSurfaceLabel(queue.surface)}</p>
        <div class="match-stakes">
          <span>Bonus ${queue.stakes.bonusPoints} pts</span>
          <span>Bolsa ${formatCurrency(queue.stakes.purse)}</span>
        </div>
        <div class="hero-actions-row">
          <button class="button-primary" data-action="start-live-match">Iniciar partida</button>
          <button class="button-secondary" data-action="prepare-match">Regenerar confronto</button>
        </div>
      </div>
    `
    : `
      <div class="glass-card match-card-head empty">
        <span class="eyebrow">Match Center</span>
        <h3>Nenhuma partida gerada</h3>
        <p>Crie uma partida tática da semana para ativar o simulador 2D e influenciar o rendimento do seu principal atleta.</p>
        <button class="button-primary" data-action="prepare-match">Gerar partida agora</button>
      </div>
    `;

  status.innerHTML = `
    <div class="glass-card status-card">
      <h4>Status ao vivo</h4>
      <p>${queue ? 'Use os botões táticos durante os rallies para mudar o momentum.' : 'Assim que uma partida for gerada, este painel recebe o feed ao vivo.'}</p>
      <div class="match-actions-grid">
        <button class="button-tertiary" data-match-action="motivate">Motivar</button>
        <button class="button-tertiary" data-match-action="attack">Risco alto</button>
        <button class="button-tertiary" data-match-action="calm">Ajuste fino</button>
        <button class="button-tertiary" data-match-action="physio">Fisio</button>
      </div>
    </div>
  `;

  history.innerHTML = `
    <div class="glass-card section-card">
      <div class="section-head"><h3>Histórico do Match Center</h3><span>${state.match.history.length} partidas</span></div>
      <div class="timeline-list">
        ${state.match.history.length
          ? state.match.history
              .slice(0, 6)
              .map(
                (item) => `
                  <article class="timeline-item">
                    <div>
                      <strong>${item.playerName} vs ${item.opponentName}</strong>
                      <span>${item.eventName}</span>
                    </div>
                    <div>
                      <strong>${item.won ? 'Vitória' : 'Derrota'}</strong>
                      <span>${item.scoreline}</span>
                    </div>
                  </article>
                `,
              )
              .join('')
          : '<p class="muted">Nenhuma partida concluída ainda.</p>'}
      </div>
    </div>
  `;
};

export const renderNotifications = (state) => {
  const wrapper = document.querySelector('#notifications');
  wrapper.innerHTML = state.ui.notifications.slice(0, 4).map(notificationCard).join('');
};
