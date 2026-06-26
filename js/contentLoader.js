import { BUILD_INFO } from './build.js';
export async function loadJson(path) {
  const versionedPath = path.includes('?') ? `${path}&v=${BUILD_INFO.build}` : `${path}?v=${BUILD_INFO.build}`;
  const res = await fetch(versionedPath, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Falha ao carregar ${path}`);
  return res.json();
}

export function getFallbackContent(reason = null) {
  const academyDefaults = {
    name: 'Vale Tennis Academy', city: 'São Paulo', country: 'BRA', season: 2026, week: 1,
    reputation: 12, sponsor: 12000, money: 250000, cash: 250000, weeklyCosts: 14500, currency: '$', philosophy: 'Formação competitiva mobile-first'
  };
  const starterRoster = [
    { id:'vale-starter-1', name:'Lucas Andrade', country:'BRA', countryCode:'BRA', age:19, rank:162, rankingPoints:320, overall:66, potential:82, style:'All court', preferredSurface:'hard', serve:66, return:64, forehand:68, backhand:63, stamina:70, mental:68, focus:68 },
    { id:'vale-starter-2', name:'Mateus Silva', country:'BRA', countryCode:'BRA', age:22, rank:214, rankingPoints:210, overall:63, potential:76, style:'Defensivo', preferredSurface:'clay', serve:60, return:66, forehand:64, backhand:65, stamina:74, mental:66, focus:66 },
    { id:'vale-starter-3', name:'Rafael Costa', country:'POR', countryCode:'POR', age:18, rank:258, rankingPoints:150, overall:61, potential:84, style:'Saque e forehand', preferredSurface:'grass', serve:70, return:58, forehand:69, backhand:57, stamina:64, mental:62, focus:62 }
  ];
  const rankingSeed = Array.from({ length: 40 }, (_, i) => ({
    id:`fallback-rank-${i+1}`, rank:i+1, name:['Novak Novakic','Carlos Rivera','Jan Müller','Daniil Petrov','Jannik Rossi','Stefanos Nikos','Andrey Volkov','Casper Nord','Taylor Brooks','Alex Mina'][i%10] + ` ${i+1}`,
    country:['SRB','ESP','GER','RUS','ITA','GRE','RUS','NOR','USA','AUS'][i%10], countryCode:['SRB','ESP','GER','RUS','ITA','GRE','RUS','NOR','USA','AUS'][i%10],
    points: 9000 - i*150, rankingPoints: 9000 - i*150, overall: Math.max(72, 94 - Math.floor(i/3)), age: 21 + (i%13), style:['All court','Defensivo','Agressivo','Saque e voleio'][i%4], preferredSurface:['hard','clay','grass','indoor'][i%4], serve:75+(i%12), return:74+(i%10), stamina:76+(i%9), mental:75+(i%11), focus:75+(i%11)
  }));
  const calendar = [
    { id:'fallback-brisbane', week:1, name:'Brisbane Open', tier:'ATP 250', category:'ATP250', surface:'hard', prize:22000, prizePool:700000, minRank:220, drawSize:32, inviteSlots:2, city:'Brisbane', country:'AUS', prestige:45, winnerPoints:250, kind:'tour' },
    { id:'fallback-australian', week:3, name:'Australian Open', tier:'Grand Slam', category:'GRAND_SLAM', surface:'hard', prize:120000, prizePool:50000000, minRank:128, drawSize:128, inviteSlots:8, city:'Melbourne', country:'AUS', prestige:98, winnerPoints:2000, kind:'major' },
    { id:'fallback-rio', week:8, name:'Rio Open', tier:'ATP 500', category:'ATP500', surface:'clay', prize:42000, prizePool:2100000, minRank:160, drawSize:32, inviteSlots:3, city:'Rio de Janeiro', country:'BRA', prestige:68, winnerPoints:500, kind:'tour' },
    { id:'fallback-indianwells', week:11, name:'Indian Wells Masters', tier:'Masters 1000', category:'ATP1000', surface:'hard', prize:88000, prizePool:9600000, minRank:140, drawSize:96, inviteSlots:4, city:'Indian Wells', country:'USA', prestige:90, winnerPoints:1000, kind:'masters' },
    { id:'fallback-roland', week:22, name:'Roland Garros', tier:'Grand Slam', category:'GRAND_SLAM', surface:'clay', prize:120000, prizePool:50000000, minRank:128, drawSize:128, inviteSlots:8, city:'Paris', country:'FRA', prestige:98, winnerPoints:2000, kind:'major' },
    { id:'fallback-wimbledon', week:27, name:'Wimbledon', tier:'Grand Slam', category:'GRAND_SLAM', surface:'grass', prize:120000, prizePool:50000000, minRank:128, drawSize:128, inviteSlots:8, city:'London', country:'GBR', prestige:100, winnerPoints:2000, kind:'major' },
    { id:'fallback-usopen', week:36, name:'US Open', tier:'Grand Slam', category:'GRAND_SLAM', surface:'hard', prize:120000, prizePool:50000000, minRank:128, drawSize:128, inviteSlots:8, city:'New York', country:'USA', prestige:98, winnerPoints:2000, kind:'major' }
  ];
  const staffMarket = [
    { id:'staff-coach-1', name:'Henrique Prado', role:'Tecnico', quality:72, salary:3200, specialty:'Base técnica' },
    { id:'staff-doctor-1', name:'Dra. Camila Reis', role:'Fisioterapeuta', quality:70, salary:2800, specialty:'Prevenção de lesões' },
    { id:'staff-scout-1', name:'Miguel Torres', role:'Scouting', quality:68, salary:2500, specialty:'América do Sul' }
  ];
  const marketTalents = [
    { id:'market-1', name:'João Lima', country:'BRA', age:17, rank:420, rankingPoints:32, overall:55, potential:83, style:'Agressivo', preferredSurface:'clay', salary:900, value:18000 },
    { id:'market-2', name:'Nicolás Vega', country:'ARG', age:18, rank:390, rankingPoints:45, overall:57, potential:81, style:'Defensivo', preferredSurface:'clay', salary:1100, value:22000 }
  ];
  return { manifest:{ packs:[], fallback:true, reason:String(reason?.message || reason || 'conteúdo embutido') }, academyDefaults, calendar, rankingSeed, starterRoster, marketTalents, staffMarket, worldDatabase: rankingSeed, worldTourSource:'embedded-fallback-v4.8.2' };
}

export async function loadContent() {
  try {
    return await loadContentFromFiles();
  } catch (error) {
    console.warn('Conteúdo externo indisponível. Usando fallback embutido para não travar o lobby.', error);
    return getFallbackContent(error);
  }
}

async function loadContentFromFiles() {
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
  const fallback = getFallbackContent('pacote incompleto');
  if (!merged.academyDefaults || !merged.academyDefaults.name) merged.academyDefaults = fallback.academyDefaults;
  if (!Array.isArray(merged.calendar) || merged.calendar.length < 1) merged.calendar = fallback.calendar;
  if (!Array.isArray(merged.rankingSeed) || merged.rankingSeed.length < 8) merged.rankingSeed = fallback.rankingSeed;
  if (!Array.isArray(merged.starterRoster) || merged.starterRoster.length < 1) merged.starterRoster = fallback.starterRoster;
  if (!Array.isArray(merged.marketTalents) || merged.marketTalents.length < 1) merged.marketTalents = fallback.marketTalents;
  if (!Array.isArray(merged.staffMarket) || merged.staffMarket.length < 1) merged.staffMarket = fallback.staffMarket;
  return merged;
}

function isLocalPackEnabled(id) {
  const flags = JSON.parse(localStorage.getItem('ace_enabled_dlcs') || '[]');
  return flags.includes(id);
}
