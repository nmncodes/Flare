import snapshot from './cross-era-snapshot.json' with { type: 'json' };

// The Python pipeline owns the fitted values. This client module deliberately
// contains only comparison presentation logic; it never invents a teammate
// quality multiplier or modifies the underlying rating.
const PROFILES = snapshot.profiles;
const TEAMMATE_EDGES = snapshot.edges;

const SOURCE_CATALOG = [
  {
    id: 'f1db',
    name: 'F1DB',
    scope: '1950–present results, qualifying and classification archive',
    role: 'Canonical bulk source for the fitted teammate network',
    href: 'https://github.com/f1db/f1db'
  },
  {
    id: 'jolpica',
    name: 'Jolpica F1',
    scope: 'Historical Ergast-compatible results and qualifying endpoints',
    role: 'Incremental source and reconciliation check',
    href: 'https://api.jolpi.ca/docs/'
  },
  {
    id: 'openf1',
    name: 'OpenF1',
    scope: '2023–present session, lap, stint and race-control data',
    role: 'Modern session-context enrichment',
    href: 'https://openf1.org/docs/'
  }
];

function expectedScore(ratingA, ratingB) {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

function intervalProbability(ratingA, ratingB, uncertainty) {
  const lower = expectedScore(ratingA - uncertainty, ratingB + uncertainty);
  const upper = expectedScore(ratingA + uncertainty, ratingB - uncertainty);
  return [Math.round(lower * 100), Math.round(upper * 100)];
}

function findEvidenceRoute(start, target) {
  if (start === target) return [];
  const neighbours = new Map();
  TEAMMATE_EDGES.forEach((edge) => {
    neighbours.set(edge.from, [...(neighbours.get(edge.from) || []), { id: edge.to, label: edge.label, observations: edge.observations }]);
    neighbours.set(edge.to, [...(neighbours.get(edge.to) || []), { id: edge.from, label: edge.label, observations: edge.observations }]);
  });
  const queue = [{ id: start, route: [] }];
  const visited = new Set([start]);
  while (queue.length) {
    const current = queue.shift();
    for (const next of neighbours.get(current.id) || []) {
      if (visited.has(next.id)) continue;
      const route = [...current.route, { from: current.id, to: next.id, label: next.label, observations: next.observations }];
      if (next.id === target) return route;
      visited.add(next.id);
      queue.push({ id: next.id, route });
    }
  }
  return null;
}

function fallbackProfile(driver) {
  const starts = Math.max(driver.starts || 0, 1);
  const winRate = (driver.wins || 0) / starts;
  return {
    peakElo: Math.round(1450 + winRate * 350 + (driver.championships || 0) * 22),
    uncertaintyElo: 220,
    tqi: 50,
    pace: 50,
    race: 50,
    execution: 50,
    adaptability: 50,
    peak: 'No fitted peak window',
    era: driver.activeYears || 'Unknown era',
    observations: { windowSeasons: 0 }
  };
}

export function getCrossEraComparison(driverA, driverB) {
  const profileA = PROFILES[driverA.id] || fallbackProfile(driverA);
  const profileB = PROFILES[driverB.id] || fallbackProfile(driverB);
  const ratingA = profileA.peakElo;
  const ratingB = profileB.peakElo;
  const probabilityA = expectedScore(ratingA, ratingB);
  const uncertainty = Math.sqrt(profileA.uncertaintyElo ** 2 + profileB.uncertaintyElo ** 2);
  const route = findEvidenceRoute(driverA.id, driverB.id);
  const isDirect = route?.length === 1;
  const routeEvidence = (route || []).reduce((sum, step) => sum + step.observations, 0);
  const dataScore = !route ? 42 : Math.min(96, Math.round((isDirect ? 72 : 56) + Math.min(24, routeEvidence / 3)));
  const [rangeAStart, rangeAEnd] = intervalProbability(ratingA, ratingB, uncertainty);

  return {
    drivers: [
      { ...driverA, profile: profileA, rating: Math.round(ratingA) },
      { ...driverB, profile: profileB, rating: Math.round(ratingB) }
    ],
    probabilityA: Math.round(probabilityA * 100),
    probabilityB: 100 - Math.round(probabilityA * 100),
    probabilityRangeA: [rangeAStart, rangeAEnd],
    probabilityRangeB: [100 - rangeAEnd, 100 - rangeAStart],
    ratingGap: Math.abs(Math.round(ratingA - ratingB)),
    route,
    isDirect,
    dataScore,
    confidenceLabel: dataScore >= 84 ? 'High network support' : dataScore >= 66 ? 'Moderate network support' : 'Wide uncertainty',
    dimensions: [
      { key: 'pace', name: 'Peak qualifying', weight: 'separate fit', a: profileA.pace, b: profileB.pace },
      { key: 'race', name: 'Peak race pace', weight: 'separate fit', a: profileA.race, b: profileB.race },
      { key: 'execution', name: 'Peak overall', weight: 'combined fit', a: profileA.execution, b: profileB.execution },
      { key: 'adaptability', name: 'Window evidence', weight: 'seasons', a: profileA.adaptability, b: profileB.adaptability }
    ],
    sources: SOURCE_CATALOG,
    model: snapshot.model,
    generatedAt: snapshot.generatedAt,
    observationCount: snapshot.observations.combined
  };
}

export { SOURCE_CATALOG };
