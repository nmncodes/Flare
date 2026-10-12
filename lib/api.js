// Jolpica F1 API + Wikipedia Summary API integration with intelligent local caching
import { CURATED_DRIVERS } from './data/drivers.js';

const JOLPICA_BASE = 'https://api.jolpi.ca/ergast/f1';
const WIKI_BASE = 'https://en.wikipedia.org/api/rest_v1/page/summary';

// Cache in memory and localStorage
const cache = {
  wiki: new Map(),
  driversList: null,
  driverStats: new Map()
};

/**
 * Fetch Wikipedia thumbnail portrait and bio excerpt for a driver
 */
export async function getDriverBioAndImage(wikiSlug, fallbackName) {
  if (!wikiSlug) {
    return {
      image: getFallbackAvatar(fallbackName),
      extract: 'Formula 1 racing driver.'
    };
  }

  const cacheKey = `wiki_${wikiSlug}`;
  if (cache.wiki.has(wikiSlug)) return cache.wiki.get(wikiSlug);

  try {
    const saved = localStorage.getItem(cacheKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      cache.wiki.set(wikiSlug, parsed);
      return parsed;
    }
  } catch (e) {
    // localStorage may be disabled
  }

  try {
    const res = await fetch(`${WIKI_BASE}/${encodeURIComponent(wikiSlug)}`);
    if (!res.ok) throw new Error('Wiki fetch failed');
    const data = await res.json();
    const result = {
      image: data.thumbnail?.source || getFallbackAvatar(fallbackName),
      extract: data.extract || data.description || 'Formula 1 racing driver.',
      title: data.title || fallbackName
    };

    cache.wiki.set(wikiSlug, result);
    try {
      localStorage.setItem(cacheKey, JSON.stringify(result));
    } catch (e) {}

    return result;
  } catch (err) {
    const fallback = {
      image: getFallbackAvatar(fallbackName),
      extract: 'Formula 1 Grand Prix racing driver.',
      title: fallbackName
    };
    cache.wiki.set(wikiSlug, fallback);
    return fallback;
  }
}

/**
 * Generate fallback SVG avatar with driver initials and racing helmet aesthetic
 */
export function getFallbackAvatar(name) {
  const initials = (name || 'F1')
    .split(' ')
    .map(p => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1e2430" />
        <stop offset="100%" stop-color="#0e1118" />
      </linearGradient>
    </defs>
    <rect width="200" height="200" rx="24" fill="url(#bg)"/>
    <circle cx="100" cy="100" r="70" fill="none" stroke="#e10600" stroke-width="4" stroke-dasharray="8 6"/>
    <text x="100" y="115" font-family="Arial, sans-serif" font-weight="900" font-size="44" fill="#ffffff" text-anchor="middle" letter-spacing="2">${initials}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Fetch all historical drivers from Jolpica for search autocomplete
 */
export async function getAllHistoricalDrivers() {
  if (cache.driversList) return cache.driversList;

  try {
    const saved = localStorage.getItem('jolpica_all_drivers_v1');
    if (saved) {
      cache.driversList = JSON.parse(saved);
      return cache.driversList;
    }
  } catch (e) {}

  try {
    const res = await fetch(`${JOLPICA_BASE}/drivers.json?limit=1000`, {
      headers: { 'User-Agent': 'F1DuelApp/1.0.0' }
    });
    if (!res.ok) throw new Error('Jolpica drivers list failed');
    const data = await res.json();
    const drivers = (data.MRData?.DriverTable?.Drivers || []).map(d => ({
      id: d.driverId,
      name: `${d.givenName} ${d.familyName}`,
      code: d.code || d.familyName.slice(0, 3).toUpperCase(),
      number: d.permanentNumber || '-',
      nationality: d.nationality,
      wikiSlug: d.url ? d.url.split('/').pop() : `${d.givenName}_${d.familyName}`,
      dob: d.dateOfBirth
    }));

    cache.driversList = drivers;
    try {
      localStorage.setItem('jolpica_all_drivers_v1', JSON.stringify(drivers));
    } catch (e) {}
    return drivers;
  } catch (err) {
    console.warn('Using curated drivers as fallback list:', err);
    return CURATED_DRIVERS;
  }
}

/**
 * Fetch live career stats for an arbitrary historical driver from Jolpica
 */
export async function fetchLiveDriverStats(driverId) {
  if (cache.driverStats.has(driverId)) {
    return cache.driverStats.get(driverId);
  }

  // Check if driver is in curated database first for instant stats
  const curated = CURATED_DRIVERS.find(d => d.id === driverId);
  if (curated) {
    cache.driverStats.set(driverId, curated);
    return curated;
  }

  try {
    // Parallel fetch from Jolpica
    const [infoRes, startsRes, winsRes, polesRes] = await Promise.all([
      fetch(`${JOLPICA_BASE}/drivers/${driverId}.json`, { headers: { 'User-Agent': 'F1DuelApp/1.0.0' } }),
      fetch(`${JOLPICA_BASE}/drivers/${driverId}/results.json?limit=1`, { headers: { 'User-Agent': 'F1DuelApp/1.0.0' } }),
      fetch(`${JOLPICA_BASE}/drivers/${driverId}/results/1.json?limit=1`, { headers: { 'User-Agent': 'F1DuelApp/1.0.0' } }),
      fetch(`${JOLPICA_BASE}/drivers/${driverId}/qualifying/1.json?limit=1`, { headers: { 'User-Agent': 'F1DuelApp/1.0.0' } })
    ]);

    const infoData = await infoRes.json();
    const startsData = await startsRes.json();
    const winsData = await winsRes.json();
    const polesData = await polesRes.json();

    const d = infoData.MRData?.DriverTable?.Drivers?.[0] || {};
    const starts = parseInt(startsData.MRData?.total || '0', 10);
    const wins = parseInt(winsData.MRData?.total || '0', 10);
    const poles = parseInt(polesData.MRData?.total || '0', 10);

    const constructed = {
      id: driverId,
      name: `${d.givenName || ''} ${d.familyName || driverId}`.trim(),
      code: d.code || (d.familyName ? d.familyName.slice(0, 3).toUpperCase() : 'F1'),
      number: d.permanentNumber || '-',
      nationality: d.nationality || 'International',
      flag: '🏁',
      dob: d.dateOfBirth || '',
      activeYears: 'Historical Driver',
      championships: 0,
      wins: wins,
      podiums: wins, // conservative baseline
      poles: poles,
      starts: starts,
      points: 0,
      fastestLaps: 0,
      teams: ['Formula 1'],
      wikiSlug: d.url ? d.url.split('/').pop() : `${d.givenName}_${d.familyName}`,
      color: '#E10600',
      quote: 'Pushing to the absolute limit.'
    };

    cache.driverStats.set(driverId, constructed);
    return constructed;
  } catch (err) {
    console.error('Error fetching Jolpica live stats:', err);
    throw err;
  }
}

/**
 * Compute detailed duel analytics and composite ratings between Driver A and Driver B
 */
export function calculateDuelMetrics(driverA, driverB) {
  const winRateA = driverA.starts > 0 ? (driverA.wins / driverA.starts) * 100 : 0;
  const winRateB = driverB.starts > 0 ? (driverB.wins / driverB.starts) * 100 : 0;

  const podiumRateA = driverA.starts > 0 ? (driverA.podiums / driverA.starts) * 100 : 0;
  const podiumRateB = driverB.starts > 0 ? (driverB.podiums / driverB.starts) * 100 : 0;

  const poleRateA = driverA.starts > 0 ? (driverA.poles / driverA.starts) * 100 : 0;
  const poleRateB = driverB.starts > 0 ? (driverB.poles / driverB.starts) * 100 : 0;

  // Composite dominance score calculation
  const scoreA =
    driverA.championships * 25 +
    driverA.wins * 1.5 +
    driverA.podiums * 0.75 +
    driverA.poles * 1.0 +
    winRateA * 1.5 +
    podiumRateA * 0.8;

  const scoreB =
    driverB.championships * 25 +
    driverB.wins * 1.5 +
    driverB.podiums * 0.75 +
    driverB.poles * 1.0 +
    winRateB * 1.5 +
    podiumRateB * 0.8;

  const totalScore = Math.max(scoreA + scoreB, 1);
  const dominancePctA = Math.round((scoreA / totalScore) * 100);
  const dominancePctB = 100 - dominancePctA;

  // Radar chart normalized metrics (0 - 100 scale based on historical maximums)
  const radarLabels = [
    'Championships',
    'Race Wins',
    'Pole Positions',
    'Podium %',
    'Win %',
    'Experience'
  ];

  const maxWdc = 7;
  const maxWins = 105;
  const maxPoles = 104;
  const maxStarts = 400;

  const radarDataA = [
    Math.min(100, Math.round((driverA.championships / maxWdc) * 100)),
    Math.min(100, Math.round((driverA.wins / maxWins) * 100)),
    Math.min(100, Math.round((driverA.poles / maxPoles) * 100)),
    Math.min(100, Math.round(podiumRateA)),
    Math.min(100, Math.round(winRateA * 2)), // 50% win rate = 100
    Math.min(100, Math.round((driverA.starts / maxStarts) * 100))
  ];

  const radarDataB = [
    Math.min(100, Math.round((driverB.championships / maxWdc) * 100)),
    Math.min(100, Math.round((driverB.wins / maxWins) * 100)),
    Math.min(100, Math.round((driverB.poles / maxPoles) * 100)),
    Math.min(100, Math.round(podiumRateB)),
    Math.min(100, Math.round(winRateB * 2)),
    Math.min(100, Math.round((driverB.starts / maxStarts) * 100))
  ];

  return {
    winRateA: winRateA.toFixed(1),
    winRateB: winRateB.toFixed(1),
    podiumRateA: podiumRateA.toFixed(1),
    podiumRateB: podiumRateB.toFixed(1),
    poleRateA: poleRateA.toFixed(1),
    poleRateB: poleRateB.toFixed(1),
    dominancePctA,
    dominancePctB,
    radarLabels,
    radarDataA,
    radarDataB
  };
}
