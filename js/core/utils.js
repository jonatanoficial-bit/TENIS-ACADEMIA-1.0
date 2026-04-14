export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const lerp = (a, b, t) => a + (b - a) * t;

export const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);

export const formatCompact = (value) =>
  new Intl.NumberFormat('pt-BR', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);

export const formatDate = (value) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));

export const formatWeekLabel = (value) => {
  const date = new Date(value);
  const week = getISOWeek(date);
  const month = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(date);
  return `Semana ${week} - ${month[0].toUpperCase()}${month.slice(1)} ${date.getFullYear()}`;
};

export const addDays = (value, days) => {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

export const daysBetween = (a, b) => {
  const d1 = new Date(a);
  const d2 = new Date(b);
  const diff = d2.getTime() - d1.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
};

export const getISOWeek = (date) => {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
};

export const sample = (items) => items[Math.floor(Math.random() * items.length)];

export const sampleSize = (items, size) => {
  const cloned = [...items];
  const picked = [];
  while (cloned.length && picked.length < size) {
    const index = Math.floor(Math.random() * cloned.length);
    picked.push(cloned.splice(index, 1)[0]);
  }
  return picked;
};

export const weightedRoll = (chance) => Math.random() < chance;

export const slugify = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export const deepClone = (value) => JSON.parse(JSON.stringify(value));

export const titleCase = (value) =>
  value
    .split(' ')
    .filter(Boolean)
    .map((chunk) => chunk[0].toUpperCase() + chunk.slice(1).toLowerCase())
    .join(' ');

export const groupBy = (items, resolver) =>
  items.reduce((acc, item) => {
    const key = resolver(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

export const getSurfaceLabel = (surface) => {
  const labels = {
    clay: 'Saibro',
    hard: 'Rápida',
    grass: 'Grama',
    'indoor-hard': 'Indoor',
  };
  return labels[surface] ?? surface;
};

export const getCategoryLabel = (category) => {
  const labels = {
    ATP250: 'ATP 250',
    ATP500: 'ATP 500',
    ATP_MASTERS_1000: 'Masters 1000',
    GRAND_SLAM: 'Grand Slam',
    ATP_FINALS: 'ATP Finals',
    NEXT_GEN: 'Next Gen',
    TEAM: 'Team Event',
    INVITATIONAL: 'Invitacional',
    CHALLENGER: 'Challenger',
    FUTURES: 'Futures',
    SHOWCASE: 'Showcase',
  };
  return labels[category] ?? category;
};
