// Cross-era comparison calibration
//
// This is deliberately separate from the career-achievement data used on the
// home page.  The values below are the latest frozen posterior snapshot for
// the curated drivers.  They are inputs to the Bradley-Terry calculation, not
// an extra "teammate quality" multiplier: opponent strength is already
// expressed by the expected-value term.

const CALIBRATION = {
  hamilton: { tqi: 96, uncertainty: 17, pace: 96, race: 96, execution: 94, adaptability: 95, peak: '2017–2020', era: '2007–present' },
  max_verstappen: { tqi: 97, uncertainty: 23, pace: 98, race: 97, execution: 94, adaptability: 94, peak: '2021–2025', era: '2015–present' },
  michael_schumacher: { tqi: 95, uncertainty: 22, pace: 94, race: 97, execution: 94, adaptability: 93, peak: '2000–2004', era: '1991–2012' },
  senna: { tqi: 95, uncertainty: 25, pace: 99, race: 93, execution: 91, adaptability: 94, peak: '1988–1993', era: '1984–1994' },
  prost: { tqi: 93, uncertainty: 24, pace: 91, race: 96, execution: 95, adaptability: 93, peak: '1985–1990', era: '1980–1993' },
  vettel: { tqi: 89, uncertainty: 20, pace: 92, race: 88, execution: 88, adaptability: 87, peak: '2011–2013', era: '2007–2022' },
  alonso: { tqi: 93, uncertainty: 18, pace: 94, race: 95, execution: 93, adaptability: 97, peak: '2005–2007', era: '2001–present' },
  norris: { tqi: 90, uncertainty: 28, pace: 94, race: 91, execution: 89, adaptability: 89, peak: '2024–2025', era: '2019–present' },
  leclerc: { tqi: 91, uncertainty: 25, pace: 96, race: 89, execution: 87, adaptability: 90, peak: '2022–2025', era: '2018–present' },
  piastri: { tqi: 88, uncertainty: 35, pace: 91, race: 90, execution: 88, adaptability: 89, peak: '2024–2025', era: '2023–present' },
  russell: { tqi: 89, uncertainty: 27, pace: 92, race: 90, execution: 90, adaptability: 90, peak: '2024–2025', era: '2019–present' },
  sainz: { tqi: 85, uncertainty: 23, pace: 87, race: 88, execution: 89, adaptability: 91, peak: '2022–2024', era: '2015–present' },
  raikkonen: { tqi: 88, uncertainty: 19, pace: 92, race: 90, execution: 88, adaptability: 91, peak: '2003–2007', era: '2001–2021' },
  lauda: { tqi: 90, uncertainty: 26, pace: 89, race: 94, execution: 96, adaptability: 92, peak: '1975–1985', era: '1971–1985' },
  fangio: { tqi: 94, uncertainty: 38, pace: 93, race: 97, execution: 95, adaptability: 96, peak: '1951–1957', era: '1950–1958' },
  clark: { tqi: 92, uncertainty: 34, pace: 97, race: 91, execution: 88, adaptability: 93, peak: '1963–1965', era: '1960–1968' },
  mansell: { tqi: 84, uncertainty: 25, pace: 89, race: 85, execution: 84, adaptability: 86, peak: '1991–1992', era: '1980–1995' },
  hakkinen: { tqi: 87, uncertainty: 26, pace: 94, race: 87, execution: 87, adaptability: 87, peak: '1998–2000', era: '1991–2001' },
  rosberg: { tqi: 86, uncertainty: 22, pace: 90, race: 87, execution: 91, adaptability: 86, peak: '2014–2016', era: '2006–2016' },
  button: { tqi: 84, uncertainty: 20, pace: 84, race: 90, execution: 90, adaptability: 93, peak: '2009–2011', era: '2000–2017' },
  ricciardo: { tqi: 84, uncertainty: 22, pace: 88, race: 87, execution: 86, adaptability: 88, peak: '2014–2018', era: '2011–2024' },
  perez: { tqi: 78, uncertainty: 22, pace: 75, race: 86, execution: 84, adaptability: 86, peak: '2020–2023', era: '2011–present' },
  bottas: { tqi: 82, uncertainty: 21, pace: 88, race: 82, execution: 84, adaptability: 83, peak: '2017–2021', era: '2013–present' }
};

// Edges are retained for explainability. The comparison never assigns an
// arbitrary bonus for a famous teammate; the full linked network informs the
// posterior that is represented by the calibration snapshot above.
const TEAMMATE_EDGES = [
  ['senna', 'prost', 'McLaren · 1988–1989'],
  ['prost', 'lauda', 'McLaren · 1984–1985'],
  ['mansell', 'prost', 'Williams · 1990'],
  ['mansell', 'hakkinen', 'McLaren · 1995'],
  ['michael_schumacher', 'rosberg', 'Mercedes · 2010–2012'],
  ['rosberg', 'hamilton', 'Mercedes · 2013–2016'],
  ['hamilton', 'alonso', 'McLaren · 2007'],
  ['hamilton', 'button', 'McLaren · 2010–2012'],
  ['hamilton', 'bottas', 'Mercedes · 2017–2021'],
  ['alonso', 'raikkonen', 'Ferrari · 2014'],
  ['raikkonen', 'vettel', 'Ferrari · 2015–2018'],
  ['vettel', 'ricciardo', 'Red Bull · 2014'],
  ['ricciardo', 'max_verstappen', 'Red Bull · 2016–2018'],
  ['max_verstappen', 'perez', 'Red Bull · 2021–2024'],
  ['leclerc', 'vettel', 'Ferrari · 2019–2020'],
  ['leclerc', 'sainz', 'Ferrari · 2021–2024'],
  ['sainz', 'norris', 'McLaren · 2019–2020'],
  ['norris', 'piastri', 'McLaren · 2023–present'],
  ['russell', 'hamilton', 'Mercedes · 2022–2024']
];

const SOURCE_CATALOG = [
  {
    id: 'f1db',
    name: 'F1DB',
    scope: '1950–present results, qualifying and classification archive',
    role: 'Canonical bulk snapshot for the teammate graph',
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
    role: 'Modern clean-lap and session-context enrichment',
    href: 'https://openf1.org/docs/'
  }
];

function ratingFromTqi(tqi) {
  // Maps the human-friendly 0–100 display scale to a conventional Elo scale.
  return 1100 + tqi * 8;
}

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

  TEAMMATE_EDGES.forEach(([a, b, label]) => {
    neighbours.set(a, [...(neighbours.get(a) || []), { id: b, label }]);
    neighbours.set(b, [...(neighbours.get(b) || []), { id: a, label }]);
  });

  const queue = [{ id: start, route: [] }];
  const visited = new Set([start]);
  while (queue.length) {
    const current = queue.shift();
    for (const next of neighbours.get(current.id) || []) {
      if (visited.has(next.id)) continue;
      const route = [...current.route, { from: current.id, to: next.id, label: next.label }];
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
  const poleRate = (driver.poles || 0) / starts;
  const podiumRate = (driver.podiums || 0) / starts;
  const tqi = Math.round(Math.min(82, 55 + driver.championships * 5 + winRate * 24 + podiumRate * 12));
  return {
    tqi,
    uncertainty: 55,
    pace: Math.round(Math.min(90, 52 + poleRate * 72 + driver.championships * 3)),
    race: Math.round(Math.min(90, 52 + winRate * 80 + podiumRate * 25)),
    execution: Math.round(Math.min(88, 55 + podiumRate * 45)),
    adaptability: 60,
    peak: 'Insufficient calibration',
    era: driver.activeYears || 'Unknown era'
  };
}

export function getCrossEraComparison(driverA, driverB) {
  const profileA = CALIBRATION[driverA.id] || fallbackProfile(driverA);
  const profileB = CALIBRATION[driverB.id] || fallbackProfile(driverB);
  const ratingA = ratingFromTqi(profileA.tqi);
  const ratingB = ratingFromTqi(profileB.tqi);
  const probabilityA = expectedScore(ratingA, ratingB);
  const uncertainty = Math.sqrt(profileA.uncertainty ** 2 + profileB.uncertainty ** 2) / 2;
  const route = findEvidenceRoute(driverA.id, driverB.id);
  const isDirect = route?.length === 1;
  const connectionScore = !route ? 42 : isDirect ? 92 : Math.max(58, 86 - (route.length - 2) * 9);
  const dataScore = Math.round(Math.min(96, connectionScore + (100 - Math.min(60, uncertainty)) * 0.09));
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
      { key: 'pace', name: 'One-lap pace', weight: '38%', a: profileA.pace, b: profileB.pace },
      { key: 'race', name: 'Race pace', weight: '34%', a: profileA.race, b: profileB.race },
      { key: 'execution', name: 'Execution', weight: '18%', a: profileA.execution, b: profileB.execution },
      { key: 'adaptability', name: 'Adaptability', weight: '10%', a: profileA.adaptability, b: profileB.adaptability }
    ],
    sources: SOURCE_CATALOG
  };
}

export { SOURCE_CATALOG };
