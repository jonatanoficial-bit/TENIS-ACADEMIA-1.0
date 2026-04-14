import {
  loadAdminOverrides,
  loadCustomPackages,
  loadPackageState,
} from './storage.js';
import { deepClone } from './utils.js';

const mergeDeep = (base, patch) => {
  if (!patch) return base;
  const output = Array.isArray(base) ? [...base] : { ...base };
  Object.entries(patch).forEach(([key, value]) => {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof output[key] === 'object' &&
      output[key] !== null &&
      !Array.isArray(output[key])
    ) {
      output[key] = mergeDeep(output[key], value);
    } else {
      output[key] = deepClone(value);
    }
  });
  return output;
};

const loadJson = async (path) => {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Falha ao carregar ${path}`);
  }
  return response.json();
};

const mergePlayers = (payload, data) => {
  if (data.officialTop100) payload.officialTop100.push(...data.officialTop100);
  if (data.academyProspects) payload.academyProspects.push(...data.academyProspects);
  if (data.prospectMarket) payload.prospectMarket.push(...data.prospectMarket);
  if (data.academyAdds) payload.academyProspects.push(...data.academyAdds);
  if (data.prospectMarketAdds) payload.prospectMarket.push(...data.prospectMarketAdds);
};

const mergeStaff = (payload, data) => {
  if (data.current) payload.current = mergeDeep(payload.current, data.current);
  if (data.market) payload.market.push(...data.market);
};

const mergeTournaments = (payload, data) => {
  if (data.events) payload.events.push(...data.events);
  if (data.circuits?.development) {
    payload.circuits.development.push(...data.circuits.development);
  }
};

const applyPayload = (aggregate, type, data) => {
  if (!data) return;
  switch (type) {
    case 'players':
      mergePlayers(aggregate.players, data);
      break;
    case 'staff':
      mergeStaff(aggregate.staff, data);
      break;
    case 'tournaments':
      mergeTournaments(aggregate.tournaments, data);
      break;
    case 'copy':
      aggregate.copy = mergeDeep(aggregate.copy, data);
      break;
    case 'branding':
      aggregate.branding = mergeDeep(aggregate.branding, data);
      break;
    case 'config':
      aggregate.config = mergeDeep(aggregate.config, data);
      break;
    default:
      break;
  }
};

const loadPackageFiles = async (entryPath, packageMeta) => {
  const packageConfig = await loadJson(entryPath);
  const baseDir = entryPath.split('/').slice(0, -1).join('/');
  const payload = {};

  if (packageConfig.files) {
    await Promise.all(
      Object.entries(packageConfig.files).map(async ([key, fileName]) => {
        const path = `${baseDir}/${fileName}`;
        payload[key] = await loadJson(path);
      }),
    );
  }

  return {
    meta: {
      ...packageMeta,
      ...packageConfig,
    },
    payload,
  };
};

const normalizeCustomPackage = (pkg) => ({
  id: pkg.id || pkg.manifest?.id,
  name: pkg.name || pkg.manifest?.name,
  version: pkg.version || pkg.manifest?.version || '0.0.1',
  enabled: pkg.enabled ?? pkg.manifest?.enabled ?? true,
  type: pkg.type || pkg.manifest?.type || 'custom',
  payload: pkg.payload || pkg.data || pkg.packageData || {},
  source: 'local',
});

export const loadContentBundle = async () => {
  const manifest = await loadJson('content/manifest.json');
  const packageState = loadPackageState();
  const customPackages = loadCustomPackages().map(normalizeCustomPackage);
  const adminOverrides = loadAdminOverrides();

  const aggregate = {
    manifest,
    packages: [],
    players: {
      officialTop100: [],
      academyProspects: [],
      prospectMarket: [],
    },
    staff: {
      current: {},
      market: [],
    },
    tournaments: {
      season: 2026,
      events: [],
      circuits: { development: [] },
    },
    copy: {},
    branding: {},
    config: {},
    adminOverrides,
  };

  for (const pkg of manifest.packages) {
    const effectiveEnabled = packageState[pkg.id] ?? pkg.enabled;
    if (!effectiveEnabled) {
      aggregate.packages.push({ ...pkg, enabled: false, source: 'filesystem' });
      continue;
    }

    const loaded = await loadPackageFiles(pkg.entry, pkg);
    aggregate.packages.push({ ...loaded.meta, enabled: true, source: 'filesystem' });
    Object.entries(loaded.payload).forEach(([type, data]) => applyPayload(aggregate, type, data));
  }

  customPackages.forEach((pkg) => {
    const effectiveEnabled = packageState[pkg.id] ?? pkg.enabled;
    aggregate.packages.push({ ...pkg, enabled: effectiveEnabled });
    if (!effectiveEnabled) return;
    Object.entries(pkg.payload).forEach(([type, data]) => applyPayload(aggregate, type, data));
  });

  if (adminOverrides.copy) aggregate.copy = mergeDeep(aggregate.copy, adminOverrides.copy);
  if (adminOverrides.branding) aggregate.branding = mergeDeep(aggregate.branding, adminOverrides.branding);
  if (adminOverrides.config) aggregate.config = mergeDeep(aggregate.config, adminOverrides.config);

  return aggregate;
};
