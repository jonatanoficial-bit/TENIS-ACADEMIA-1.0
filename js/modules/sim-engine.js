import {
  addDays,
  clamp,
  formatCurrency,
  formatWeekLabel,
  getCategoryLabel,
  getSurfaceLabel,
  sample,
  sampleSize,
  weightedRoll,
} from '../core/utils.js';
import { ensureFutureCalendar, getCurrentWeekEvents, rebuildRankings } from '../core/state.js';

const categoryDifficulty = {
  FUTURES: 47,
  CHALLENGER: 58,
  ATP250: 68,
  ATP500: 74,
  ATP_MASTERS_1000: 81,
  GRAND_SLAM: 88,
  ATP_FINALS: 93,
  TEAM: 79,
  INVITATIONAL: 83,
  NEXT_GEN: 76,
  SHOWCASE: 70,
};

const roundMaps = {
  FUTURES: [0, 4, 8, 15, 25],
  CHALLENGER: [0, 8, 15, 25, 50, 75],
  ATP250: [0, 12, 25, 45, 90, 250],
  ATP500: [0, 20, 45, 90, 180, 500],
  ATP_MASTERS_1000: [10, 25, 60, 120, 240, 500, 1000],
  GRAND_SLAM: [10, 50, 100, 200, 400, 800, 1200, 2000],
  ATP_FINALS: [200, 400, 800, 1500],
  TEAM: [80, 180, 280, 420, 600],
  INVITATIONAL: [40, 90, 180, 300, 420],
  NEXT_GEN: [120, 250, 450, 750],
  SHOWCASE: [30, 70, 110, 150],
};

const prizeFractions = {
  FUTURES: [0.03, 0.06, 0.09, 0.14, 0.18],
  CHALLENGER: [0.04, 0.08, 0.12, 0.17, 0.24, 0.32],
  ATP250: [0.04, 0.08, 0.12, 0.18, 0.26, 0.38],
  ATP500: [0.05, 0.09, 0.14, 0.21, 0.30, 0.42],
  ATP_MASTERS_1000: [0.03, 0.05, 0.08, 0.12, 0.18, 0.28, 0.40],
  GRAND_SLAM: [0.02, 0.03, 0.05, 0.08, 0.14, 0.22, 0.32, 0.48],
  ATP_FINALS: [0.14, 0.22, 0.32, 0.52],
  TEAM: [0.10, 0.16, 0.24, 0.36, 0.48],
  INVITATIONAL: [0.12, 0.18, 0.28, 0.40, 0.50],
  NEXT_GEN: [0.16, 0.26, 0.38, 0.56],
  SHOWCASE: [0.16, 0.24, 0.32, 0.40],
};

const sponsorTier = (reputation) => {
  if (reputation >= 75) return 'Diamond';
  if (reputation >= 55) return 'Platinum';
  if (reputation >= 35) return 'Gold';
  return 'Bronze';
};

const totalStaffSalary = (state) =>
  Object.values(state.academy.staff).reduce((sum, member) => sum + (member?.salary || 0), 0);

const getStaffAverage = (state) => {
  const list = Object.values(state.academy.staff).filter(Boolean);
  return list.reduce((sum, member) => sum + member.rating, 0) / Math.max(1, list.length);
};

const getFocusBonus = (focus) => {
  switch (focus) {
    case 'serve':
      return { serve: 2.4, return: 0.4, stamina: 0.6, focus: 0.8 };
    case 'return':
      return { serve: 0.6, return: 2.2, stamina: 0.8, focus: 1.0 };
    case 'stamina':
      return { serve: 0.5, return: 0.5, stamina: 2.5, focus: 0.8 };
    case 'focus':
      return { serve: 0.6, return: 0.8, stamina: 0.6, focus: 2.5 };
    default:
      return { serve: 1.0, return: 1.0, stamina: 1.0, focus: 1.0 };
  }
};

const getWeeklyDevelopment = (player, state, content) => {
  const focus = getFocusBonus(player.weeklyFocus);
  const staffPower = getStaffAverage(state) * content.config.progression.staffImpactScale;
  const facilityBonus = state.academy.facilities.courts + state.academy.facilities.science * 0.8;
  const curve = player.developmentCurve || 1;
  const gain = (content.config.progression.trainingGainBase + staffPower + facilityBonus * 0.15) * curve;

  player.serve = clamp(player.serve + focus.serve * gain * 0.08, 40, 99);
  player.return = clamp(player.return + focus.return * gain * 0.08, 40, 99);
  player.stamina = clamp(player.stamina + focus.stamina * gain * 0.08, 40, 99);
  player.focus = clamp(player.focus + focus.focus * gain * 0.08, 40, 99);
  player.overall = clamp(Math.round((player.serve + player.return + player.stamina + player.focus) / 4), 45, 99);
  player.fatigue = clamp((player.fatigue || 0) + content.config.progression.trainingFatigueBase - state.academy.facilities.medical, 0, 70);
  player.fitness = clamp(player.fitness - Math.max(1, player.fatigue * 0.06), 55, 100);
  player.morale = clamp(player.morale + 0.4, 35, 99);
};

const pickDevelopmentCircuit = (player, state) => {
  if (player.liveRank <= 130) {
    return null;
  }
  const challenger = state.world.circuits.development.find((item) => item.category === 'CHALLENGER');
  const futures = state.world.circuits.development.find((item) => item.category === 'FUTURES');
  if (player.liveRank <= 240) {
    return {
      id: `${challenger.id}-${state.profile.currentDate}-${player.id}`,
      name: challenger.name,
      category: challenger.category,
      surface: challenger.surfaceRotation[state.profile.weekIndex % challenger.surfaceRotation.length],
      startDate: state.profile.currentDate,
      endDate: addDays(state.profile.currentDate, 5),
      city: 'Circuito Regional',
      country: 'Global',
      entryCutoff: challenger.entryCutoff,
      prizePool: challenger.basePrize,
      prestige: 44,
      winnerPoints: challenger.winnerPoints,
      drawSize: 32,
      kind: 'development',
    };
  }
  return {
    id: `${futures.id}-${state.profile.currentDate}-${player.id}`,
    name: futures.name,
    category: futures.category,
    surface: futures.surfaceRotation[state.profile.weekIndex % futures.surfaceRotation.length],
    startDate: state.profile.currentDate,
    endDate: addDays(state.profile.currentDate, 4),
    city: 'Circuito Base',
    country: 'Global',
    entryCutoff: futures.entryCutoff,
    prizePool: futures.basePrize,
    prestige: 34,
    winnerPoints: futures.winnerPoints,
    drawSize: 32,
    kind: 'development',
  };
};

const pickBestEventForPlayer = (player, weekEvents, state) => {
  const eligible = weekEvents
    .filter((event) => event.category !== 'TEAM' && event.category !== 'INVITATIONAL')
    .filter((event) => player.liveRank <= event.entryCutoff + state.academy.facilities.scouting * 5)
    .sort((a, b) => b.prestige - a.prestige);

  return eligible[0] || pickDevelopmentCircuit(player, state);
};

const simulateEventRun = (player, event, state) => {
  if (!event) {
    return {
      playerId: player.id,
      playerName: player.name,
      eventName: 'Semana de base',
      category: 'TRAINING',
      surface: 'hard',
      roundsWon: 0,
      pointsEarned: 0,
      prizeEarned: 0,
      headline: `${player.name} focou em desenvolvimento interno.`,
      stage: 'Treino fechado',
    };
  }

  const staffBoost = getStaffAverage(state) * 0.08;
  const surfaceBoost = player.preferredSurface === event.surface ? 6.5 : 0;
  const moraleBoost = (player.morale - 50) * 0.12;
  const fitnessBoost = (player.fitness - 60) * 0.1;
  const fatiguePenalty = (player.fatigue || 0) * 0.16;
  const playerScore = player.overall + staffBoost + surfaceBoost + moraleBoost + fitnessBoost - fatiguePenalty + player.form * 0.3;
  const fieldScore = categoryDifficulty[event.category] || 68;
  const roundPoints = roundMaps[event.category] || roundMaps.ATP250;
  const maxRounds = roundPoints.length - 1;

  let roundsWon = 0;
  for (let round = 0; round < maxRounds; round += 1) {
    const chance = clamp(0.19 + (playerScore - fieldScore) / 42 + (maxRounds - round) * 0.015, 0.08, 0.92);
    if (!weightedRoll(chance)) break;
    roundsWon += 1;
  }

  const pointsEarned = roundPoints[roundsWon] ?? 0;
  const payout = Math.round((event.prizePool || 0) * ((prizeFractions[event.category] || [0])[roundsWon] || 0));
  const titleWon = roundsWon === maxRounds;

  player.points += pointsEarned;
  player.fitness = clamp(player.fitness - (8 + roundsWon * 1.5), 48, 100);
  player.fatigue = clamp((player.fatigue || 0) + 6 + roundsWon * 1.2, 0, 92);
  player.morale = clamp(player.morale + (titleWon ? 10 : roundsWon * 2 - 1), 32, 99);
  player.form = clamp((player.form || 0) + (titleWon ? 12 : roundsWon * 3 - 2), -30, 35);
  player.seasonWins += roundsWon;
  player.seasonLosses += titleWon ? 0 : 1;
  if (titleWon) player.titles.push({ name: event.name, year: new Date(event.startDate).getFullYear() });

  const stageLabels = ['1R', '2R', 'QF', 'SF', 'F', 'Título', 'Título', 'Título'];
  const stage = titleWon ? 'Título' : stageLabels[roundsWon] || `R${roundsWon}`;
  const headline = titleWon
    ? `${player.name} conquistou ${event.name} em ${getSurfaceLabel(event.surface)}.`
    : `${player.name} chegou até ${stage} em ${event.name}.`;

  return {
    playerId: player.id,
    playerName: player.name,
    eventId: event.id,
    eventName: event.name,
    category: event.category,
    surface: event.surface,
    roundsWon,
    pointsEarned,
    prizeEarned: payout,
    titleWon,
    stage,
    headline,
  };
};

const fluctuateWorldPlayers = (state, currentEvents) => {
  const boostSurface = sample(currentEvents)?.surface || 'hard';
  state.world.players = state.world.players.map((player, index) => {
    const variance = Math.round((Math.random() - 0.48) * 18);
    const surfaceBonus = player.preferredSurface === boostSurface ? 4 : 0;
    const starBonus = index < 12 && Math.random() > 0.67 ? 12 : 0;
    return {
      ...player,
      points: clamp(player.points + variance + surfaceBonus + starBonus, 0, 18000),
      morale: clamp((player.morale || 70) + Math.round((Math.random() - 0.5) * 6), 40, 98),
      fitness: clamp((player.fitness || 90) + Math.round((Math.random() - 0.5) * 5), 60, 100),
    };
  });
};

const refreshMarkets = (state) => {
  const generatedPlayers = sampleSize(state.world.players.filter((player) => player.rank > 45), 3).map((player, index) => ({
    id: `rot-${player.id}-${state.profile.weekIndex}-${index}`,
    name: player.name,
    age: player.age,
    countryCode: player.countryCode,
    points: Math.max(20, Math.round(player.points * 0.72)),
    overall: clamp(player.overall - 5, 52, 88),
    potential: clamp(player.overall + 10 + (index * 2), 60, 92),
    fee: Math.round(player.marketValue * 0.5),
    salary: 9000 + index * 2500,
    preferredSurface: player.preferredSurface,
    archetype: player.archetype,
  }));

  state.market.playerCandidates = [...state.market.playerCandidates.slice(0, 5), ...generatedPlayers].slice(0, 8);
  state.market.refreshedAtWeek = state.profile.weekIndex;
};

export const prepareFeaturedMatch = (state) => {
  const weekEvents = getCurrentWeekEvents(state);
  const candidates = [...state.academy.players].sort((a, b) => a.liveRank - b.liveRank);
  const selected = candidates[0];
  if (!selected) return null;

  const event = pickBestEventForPlayer(selected, weekEvents, state);
  const targetRank = clamp((selected.liveRank || 180) - 8 + Math.round(Math.random() * 18), 1, state.world.rankings.length);
  const opponentPool = state.world.rankings.filter((player) => player.ownership === 'world');
  const opponent = opponentPool.find((row) => row.liveRank >= targetRank) || opponentPool[targetRank - 1] || opponentPool[0];

  state.match.queue = {
    id: `match-${Date.now()}`,
    playerId: selected.id,
    opponentId: opponent.id,
    playerName: selected.name,
    opponentName: opponent.name,
    eventName: event?.name || 'Partida de Exibição',
    category: event?.category || 'SHOWCASE',
    surface: event?.surface || selected.preferredSurface,
    stakes: {
      bonusPoints: event ? Math.round((event.winnerPoints || 120) * 0.16) : 40,
      moraleSwing: 6,
      formSwing: 8,
      purse: event ? Math.round((event.prizePool || 120000) * 0.06) : 30000,
    },
    generatedAt: new Date().toISOString(),
  };
  return state.match.queue;
};

export const applyFeaturedMatchResult = (state, result) => {
  const queue = state.match.queue;
  if (!queue) return null;

  const player = state.academy.players.find((item) => item.id === queue.playerId);
  if (!player) return null;

  const won = result.winner === 'player';
  player.points += won ? queue.stakes.bonusPoints : Math.max(8, Math.round(queue.stakes.bonusPoints * 0.15));
  player.morale = clamp(player.morale + (won ? queue.stakes.moraleSwing : -queue.stakes.moraleSwing), 30, 99);
  player.form = clamp((player.form || 0) + (won ? queue.stakes.formSwing : -queue.stakes.formSwing), -35, 40);
  player.fitness = clamp(player.fitness - (won ? 6 : 8), 42, 100);
  if (won) {
    state.profile.balance += queue.stakes.purse;
    player.seasonWins += 1;
  } else {
    player.seasonLosses += 1;
  }

  state.match.history.unshift({
    ...queue,
    playedAt: new Date().toISOString(),
    won,
    scoreline: result.scoreline,
    stats: result.stats,
  });

  state.match.queue = null;
  rebuildRankings(state);
  return won;
};

export const hireStaffMember = (state, candidateId) => {
  const candidate = state.market.staffCandidates.find((item) => item.id === candidateId);
  if (!candidate) return false;
  const keyMap = {
    'Treinador Chefe': 'headCoach',
    'Preparacao Fisica': 'fitnessCoach',
    'Departamento Medico': 'physio',
    Financeiro: 'financeDirector',
    Scouting: 'scout',
  };
  const slot = keyMap[candidate.role];
  if (!slot || state.profile.balance < candidate.signFee) return false;
  state.profile.balance -= candidate.signFee;
  state.academy.staff[slot] = {
    name: candidate.name,
    rating: candidate.rating,
    salary: candidate.salary,
    department: candidate.role,
    impact: candidate.specialty,
  };
  return true;
};

export const signProspect = (state, candidateId) => {
  const candidateIndex = state.market.playerCandidates.findIndex((item) => item.id === candidateId);
  if (candidateIndex < 0) return false;
  const candidate = state.market.playerCandidates[candidateIndex];
  if (state.profile.balance < candidate.fee) return false;
  state.profile.balance -= candidate.fee;
  state.academy.players.push({
    ...candidate,
    id: `${candidate.id}-academy`,
    type: 'academy',
    liveRank: 260,
    form: 0,
    weeklyFocus: 'balanced',
    fatigue: 6,
    injuryStatus: 'Saudável',
    titles: [],
    seasonWins: 0,
    seasonLosses: 0,
    contractYears: 3,
  });
  state.market.playerCandidates.splice(candidateIndex, 1);
  rebuildRankings(state);
  return true;
};

export const upgradeFacility = (state, area) => {
  const current = state.academy.facilities[area];
  if (typeof current !== 'number') return false;
  const cost = 120000 * (current + 1);
  if (state.profile.balance < cost || current >= 5) return false;
  state.profile.balance -= cost;
  state.academy.facilities[area] += 1;
  return cost;
};

export const advanceWeek = (state, content) => {
  if (state.profile.gameOver) return null;

  ensureFutureCalendar(state);
  rebuildRankings(state);
  const weekEvents = getCurrentWeekEvents(state);
  const currentTopEvent = [...weekEvents].sort((a, b) => b.prestige - a.prestige)[0] || null;
  const sponsorIncome = Math.round(
    content.config.economy.sponsorBaseWeekly + state.profile.reputation * 1800 + (state.academy.staff.financeDirector?.rating || 60) * 420,
  );
  const facilityCost = content.config.economy.facilityCostWeekly + state.academy.facilities.courts * 18000 + state.academy.facilities.science * 14000;
  const youthProgram = content.config.economy.youthProgramCostWeekly + state.academy.facilities.scouting * 8000;
  const staffCost = totalStaffSalary(state);
  const trainingCost = state.academy.players.length * content.config.economy.trainingCostPerSession * 4;
  const expenses = facilityCost + youthProgram + staffCost + trainingCost;

  const eventSummaries = [];
  state.academy.players = state.academy.players.map((player) => {
    getWeeklyDevelopment(player, state, content);
    const event = pickBestEventForPlayer(player, weekEvents, state);
    const summary = simulateEventRun(player, event, state);
    eventSummaries.push(summary);
    return player;
  });

  state.profile.balance += sponsorIncome - expenses + eventSummaries.reduce((sum, item) => sum + item.prizeEarned, 0);
  state.profile.reputation = clamp(
    state.profile.reputation + eventSummaries.reduce((sum, item) => sum + (item.titleWon ? 2.8 : item.roundsWon * 0.45), 0),
    1,
    99,
  );
  state.profile.fans = clamp(
    Math.round(state.profile.fans + state.profile.reputation * 120 + eventSummaries.reduce((sum, item) => sum + item.roundsWon * 320, 0)),
    1000,
    9000000,
  );
  state.profile.sponsorTier = sponsorTier(state.profile.reputation);

  fluctuateWorldPlayers(state, weekEvents);
  rebuildRankings(state);

  state.profile.lastSummary = {
    weekLabel: state.profile.currentWeekLabel,
    headline: currentTopEvent
      ? `Semana girou em torno de ${currentTopEvent.name}.`
      : 'Semana dedicada ao desenvolvimento interno.',
    eventSummaries,
    sponsorIncome,
    expenses,
    net: sponsorIncome - expenses + eventSummaries.reduce((sum, item) => sum + item.prizeEarned, 0),
  };

  state.finance.lastRevenue = sponsorIncome + eventSummaries.reduce((sum, item) => sum + item.prizeEarned, 0);
  state.finance.lastExpenses = expenses;
  state.finance.cashflow.unshift({
    weekLabel: state.profile.currentWeekLabel,
    revenue: state.finance.lastRevenue,
    expenses: state.finance.lastExpenses,
    net: state.profile.lastSummary.net,
  });
  state.finance.cashflow = state.finance.cashflow.slice(0, 8);

  if (state.profile.weekIndex - state.market.refreshedAtWeek >= 3) {
    refreshMarkets(state);
  }

  const nextDate = addDays(state.profile.currentDate, 7);
  state.profile.currentDate = nextDate;
  state.profile.weekIndex += 1;
  state.profile.currentWeekLabel = formatWeekLabel(nextDate);
  state.profile.year = new Date(nextDate).getFullYear();
  state.match.queue = null;

  if (state.profile.balance <= content.config.economy.bankruptcyThreshold) {
    state.profile.gameOver = true;
    state.ui.notifications.unshift({
      id: `bankruptcy-${Date.now()}`,
      tone: 'danger',
      title: 'Falência da academia',
      message: 'O caixa entrou em colapso. Você pode reiniciar o save ou importar um backup.',
    });
  } else {
    const bestEvent = eventSummaries.slice().sort((a, b) => b.pointsEarned - a.pointsEarned)[0];
    state.ui.notifications.unshift({
      id: `week-${Date.now()}`,
      tone: bestEvent?.titleWon ? 'success' : 'accent',
      title: state.profile.lastSummary.headline,
      message: bestEvent
        ? `${bestEvent.playerName}: ${bestEvent.stage} em ${bestEvent.eventName} (+${bestEvent.pointsEarned} pts).`
        : 'Treinos concluídos com sucesso.',
    });
    state.ui.notifications = state.ui.notifications.slice(0, 8);
  }

  return state.profile.lastSummary;
};

export const summaryToText = (summary) => {
  if (!summary) return 'Sem resumo disponível.';
  return `${summary.weekLabel} | Receita ${formatCurrency(summary.revenue ?? summary.sponsorIncome)} | Despesas ${formatCurrency(summary.expenses)} | Saldo ${formatCurrency(summary.net)}`;
};

export const getWeeklyEventDigest = (state) => {
  const weekEvents = getCurrentWeekEvents(state);
  if (!weekEvents.length) return [];
  return weekEvents
    .slice()
    .sort((a, b) => b.prestige - a.prestige)
    .map((event) => ({
      ...event,
      surfaceLabel: getSurfaceLabel(event.surface),
      categoryLabel: getCategoryLabel(event.category),
    }));
};
