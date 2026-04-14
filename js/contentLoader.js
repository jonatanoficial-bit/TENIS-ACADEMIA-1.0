export async function loadJson(path) {
  const res = await fetch(path);
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

  merged.calendar.sort((a, b) => a.week - b.week);
  merged.rankingSeed.sort((a, b) => a.rank - b.rank);
  return merged;
}

function isLocalPackEnabled(id) {
  const flags = JSON.parse(localStorage.getItem('ace_enabled_dlcs') || '[]');
  return flags.includes(id);
}
