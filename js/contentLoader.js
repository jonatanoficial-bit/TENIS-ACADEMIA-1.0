import { BUILD_INFO } from './build.js';
export async function loadJson(path) {
  const versionedPath = path.includes('?') ? `${path}&v=${BUILD_INFO.build}` : `${path}?v=${BUILD_INFO.build}`;
  const res = await fetch(versionedPath, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Falha ao carregar ${path}`);
  return res.json();
}

export async function loadContent() {
  const manifest = await loadJson('content/manifest.json');
  const localDlcs = JSON.parse(localStorage.getItem('ace_local_dlcs') || '[]');
  const packs = [];

  for (const pack of manifest.packs) {
    if (pack.active || isLocalPackEnabled(pack.id)) {
      const content = await loadJson(pack.path);
      packs.push(content);
    }
  }

  for (const localPack of localDlcs) {
    if (localPack.active !== false) packs.push(localPack);
  }

  const merged = {
    manifest,
    academyDefaults: {},
    calendar: [],
    rankingSeed: [],
    starterRoster: [],
    marketTalents: [],
    staffMarket: []
  };

  for (const pack of packs) {
    if (pack.academyDefaults) merged.academyDefaults = { ...merged.academyDefaults, ...pack.academyDefaults };
    if (Array.isArray(pack.calendar)) merged.calendar.push(...pack.calendar);
    if (Array.isArray(pack.rankingSeed)) merged.rankingSeed.push(...pack.rankingSeed);
    if (Array.isArray(pack.starterRoster)) merged.starterRoster.push(...pack.starterRoster);
    if (Array.isArray(pack.marketTalents)) merged.marketTalents.push(...pack.marketTalents);
    if (Array.isArray(pack.staffMarket)) merged.staffMarket.push(...pack.staffMarket);
  }

  try {
    const playerDb = await loadJson('content/base/players.json');
    merged.worldDatabase = playerDb.officialTop100 || [];
    if (merged.worldDatabase.length > merged.rankingSeed.length) {
      merged.rankingSeed = merged.worldDatabase.map(p => ({ rank:p.rank, name:p.name, country:p.countryCode || 'INT', points:p.points, overall:p.overall, age:p.age, style:p.archetype, preferredSurface:p.preferredSurface, serve:p.serve, return:p.return, stamina:p.stamina, mental:p.focus, playerId:p.id }));
    }
  } catch (error) { console.warn('Banco mundial indisponível; usando ranking base.', error); merged.worldDatabase = []; }
  try {
    const tourDb = await loadJson('content/base/tournaments.json');
    const expanded = (tourDb.events || []).map(event => {
      const start = new Date(`${event.startDate}T12:00:00`);
      const yearStart = new Date(`${start.getFullYear()}-01-01T12:00:00`);
      const week = Math.max(1, Math.min(52, Math.ceil((((start - yearStart) / 86400000) + yearStart.getDay() + 1) / 7)));
      const tierMap = { GRAND_SLAM:'Grand Slam', ATP1000:'Masters 1000', ATP500:'ATP 500', ATP250:'ATP 250', CHALLENGER:'Challenger', TEAM:'Seleções', FINALS:'Finals', NEXT_GEN:'Next Gen Finals' };
      return { id:event.id, week, name:event.name, tier:tierMap[event.category] || event.category, category:event.category, surface:event.surface, prize:Math.max(12000, Math.round((event.prizePool || 500000) / Math.max(8,event.drawSize || 32))), prizePool:event.prizePool, minRank:event.entryCutoff || 120, drawSize:event.drawSize || 32, inviteSlots:event.kind === 'major' ? 8 : 2, city:event.city, country:event.country, prestige:event.prestige || 50, winnerPoints:event.winnerPoints || 250, kind:event.kind || 'tour' };
    });
    if (expanded.length > merged.calendar.length) merged.calendar = expanded;
    merged.worldTourSource = 'official-2026-database';
  } catch (error) { console.warn('Calendário mundial expandido indisponível; usando calendário-base.', error); merged.worldTourSource = 'fallback-base'; }
  merged.calendar.sort((a, b) => a.week - b.week);
  merged.rankingSeed.sort((a, b) => a.rank - b.rank);
  return merged;
}

function isLocalPackEnabled(id) {
  const flags = JSON.parse(localStorage.getItem('ace_enabled_dlcs') || '[]');
  return flags.includes(id);
}
