import { addDays, clamp, deepClone, formatWeekLabel, slugify } from './utils.js';

const FIRST_NAMES = ['Leo', 'Mateo', 'Kai', 'Noah', 'Davi', 'Oliver', 'Hugo', 'Milan', 'Theo', 'Viktor', 'Adrian', 'Gael', 'Nicolas', 'Bruno', 'Enrico', 'Liam', 'Rafael', 'Tomas', 'Elias', 'Santiago'];
const LAST_NAMES = ['Rossi', 'Pereira', 'Muller', 'Kovac', 'Santos', 'Petrenko', 'Silva', 'Costa', 'Durand', 'Soler', 'Navarro', 'Moretti', 'Duarte', 'Popescu', 'Larsen', 'Nowak', 'Jensen', 'Vega', 'Costa', 'Mendes'];
const SURFACES = ['hard', 'clay', 'indoor-hard', 'hard', 'clay', 'grass'];
const ARCHETYPES = ['Baseliner', 'Aggressive Baseliner', 'Counter Puncher', 'Big Server', 'All Court'];

const createSyntheticWorldPlayers = (count = 160) =>
  Array.from({ length: count }).map((_, index) => {
    const first = FIRST_NAMES[index % FIRST_NAMES.length];
    const last = LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length];
    const name = `${first} ${last}`;
    const points = Math.max(6, Math.round(620 - index * 3.7));
    const overall = clamp(67 - Math.floor(index / 9), 48, 68);
    return {
      id: `syn-${slugify(name)}-${index}`,
      rank: 101 + index,
      name,
      age: 18 + (index % 15),
      points,
      countryCode: '',
      overall,
      archetype: ARCHETYPES[index % ARCHETYPES.length],
      preferredSurface: SURFACES[index % SURFACES.length],
      serve: clamp(overall + (index % 6) - 2, 45, 86),
      return: clamp(overall + ((index + 3) % 6) - 3, 45, 84),
      stamina: clamp(overall + ((index + 1) % 5), 48, 88),
      focus: clamp(overall + ((index + 2) % 4) - 1, 47, 86),
      morale: 66,
      fitness: 88,
      salaryDemand: 0,
      marketValue: points * 1200,
      type: 'synthetic',
    };
  });

const derivePackageFlags = (packages) =>
  packages.reduce((acc, pkg) => {
    acc[pkg.id] = pkg.enabled;
    return acc;
  }, {});

export const createInitialState = (content, buildInfo) => {
  const worldPlayers = [
    ...deepClone(content.players.officialTop100),
    ...createSyntheticWorldPlayers(),
  ];

  const academyPlayers = deepClone(content.players.academyProspects).map((player) => ({
    ...player,
    type: 'academy',
    form: 0,
    weeklyFocus: 'balanced',
    fatigue: 8,
    injuryStatus: 'Saudável',
    titles: [],
    seasonWins: 0,
    seasonLosses: 0,
  }));

  const staff = deepClone(content.staff.current);
  const staffMarket = deepClone(content.staff.market);
  const currentDate = content.config.defaults.startingDate;

  const state = {
    meta: {
      appName: buildInfo.appName,
      version: buildInfo.version,
      build: buildInfo.build,
      builtAt: buildInfo.builtAt,
      createdAt: new Date().toISOString(),
      enabledPackages: derivePackageFlags(content.packages),
    },
    profile: {
      academyName: content.config.defaults.academyName,
      managerName: content.config.defaults.managerName,
      balance: content.config.defaults.startingBalance,
      reputation: content.config.defaults.startingReputation,
      fans: content.config.defaults.startingFans,
      currentDate,
      currentWeekLabel: formatWeekLabel(currentDate),
      weekIndex: 0,
      year: new Date(currentDate).getFullYear(),
      gameOver: false,
      sponsorTier: 'Bronze',
      lastSummary: null,
    },
    academy: {
      players: academyPlayers,
      staff,
      facilities: {
        courts: 2,
        science: 1,
        medical: 1,
        scouting: 1,
        finance: 1,
      },
      trainingBudget: 1,
      scoutingBudget: 1,
      youthBudget: 1,
    },
    world: {
      players: worldPlayers,
      calendar: deepClone(content.tournaments.events),
      circuits: deepClone(content.tournaments.circuits),
      rankings: [],
      news: [],
    },
    market: {
      playerCandidates: deepClone(content.players.prospectMarket),
      staffCandidates: staffMarket,
      refreshedAtWeek: 0,
    },
    match: {
      queue: null,
      live: null,
      history: [],
    },
    finance: {
      cashflow: [],
      lastRevenue: 0,
      lastExpenses: 0,
      sponsorIncome: content.config.economy.sponsorBaseWeekly,
    },
    ui: {
      selectedView: 'dashboard',
      selectedPlayerId: academyPlayers[0]?.id || null,
      notifications: [
        {
          id: 'welcome',
          tone: 'accent',
          title: 'Build Alpha carregada',
          message: 'Sua academia começa em abril de 2026 com dados ATP atuais e base pronta para expansões.',
        },
      ],
      adminLink: 'admin.html',
    },
    settings: {
      autosave: true,
      motion: 'smooth',
    },
  };

  rebuildRankings(state);
  return state;
};

export const rebuildRankings = (state) => {
  const combined = [
    ...state.world.players.map((player) => ({ ...player, ownership: 'world' })),
    ...state.academy.players.map((player) => ({ ...player, ownership: 'academy' })),
  ];

  combined.sort((a, b) => b.points - a.points || b.overall - a.overall || a.name.localeCompare(b.name));
  state.world.rankings = combined.map((player, index) => ({
    ...player,
    liveRank: index + 1,
  }));

  state.academy.players = state.academy.players.map((player) => {
    const row = state.world.rankings.find((entry) => entry.id === player.id);
    return {
      ...player,
      liveRank: row?.liveRank ?? 999,
    };
  });
};

export const getCurrentWeekEvents = (state) => {
  const current = new Date(state.profile.currentDate);
  const weekEnd = new Date(addDays(state.profile.currentDate, 6));
  return state.world.calendar.filter((event) => {
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    return start <= weekEnd && end >= current;
  });
};

export const ensureFutureCalendar = (state) => {
  const currentYear = state.profile.year;
  const maxYear = Math.max(...state.world.calendar.map((event) => new Date(event.startDate).getFullYear()));
  if (currentYear < maxYear) return;

  const sourceYear = currentYear;
  const cloneSeed = state.world.calendar
    .filter((event) => new Date(event.startDate).getFullYear() === sourceYear)
    .map((event) => deepClone(event));

  const nextYear = sourceYear + 1;
  cloneSeed.forEach((event) => {
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    start.setFullYear(nextYear);
    end.setFullYear(nextYear);
    state.world.calendar.push({
      ...event,
      id: `${event.id.split('-').slice(0, -1).join('-')}-${nextYear}`,
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    });
  });
};
