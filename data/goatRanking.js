/**
 * All-Time / GOAT Composite Elo Ranking Pipeline (JavaScript implementation)
 * 
 * Implements:
 * 1. Step 1: Within-Era Z-Score Normalization (prevents era inflation/deflation)
 * 2. Step 2: Sustained Peak (Z_peak rolling average with small-sample shrinkage) & Prime Longevity (top M with 0-padding)
 * 3. Step 3: Min-Max Normalization to [0, 100]
 * 4. Step 4: 60/40 Weighted Composite GOAT Score & Era-Adjusted Display Elo
 */

import precomputedRankings from './goat-composite-rankings.json' with { type: 'json' };

export const PRECOMPUTED_GOAT_LEADERBOARD = precomputedRankings;

// Quick lookup map by driverId or app_driver_id
export const GOAT_RANKINGS_BY_ID = new Map();
precomputedRankings.forEach((row) => {
  GOAT_RANKINGS_BY_ID.set(row.player_id, row);
  if (row.app_driver_id) {
    GOAT_RANKINGS_BY_ID.set(row.app_driver_id, row);
  }
});

export const DEFAULT_GOAT_CONFIG = {
  topK: 50,
  minMatches: 1,
  peakWindow: 3,
  primeYears: 5,
  peakWeight: 0.6,
  primeWeight: 0.4,
  baseElo: 2000.0,
  eloScale: 150.0,
  minCareerPeriods: 1,
  // Era Penalty System:
  eraPenaltyEnabled: true,
  eraMinWeight: 0.38,
  eraBaseYear: 1950,
  eraReferenceYear: 2026,
  eraCurveGamma: 1.0
};

/**
 * Step 1: Within-Era Z-Score Normalization
 * @param {Array<{playerId: string, period: string|number, elo: number, matchesPlayed?: number, name?: string}>} snapshots
 * @param {typeof DEFAULT_GOAT_CONFIG} config
 */
export function step1WithinEraZScore(snapshots, config = DEFAULT_GOAT_CONFIG) {
  const periodGroups = new Map();

  snapshots.forEach((s) => {
    const matches = s.matchesPlayed ?? 1;
    if (matches < config.minMatches) return;
    if (!periodGroups.has(s.period)) {
      periodGroups.set(s.period, []);
    }
    periodGroups.get(s.period).push(s);
  });

  const baselines = new Map();
  const playerZScores = new Map();

  for (const [period, pSnapshots] of periodGroups.entries()) {
    // Sort descending by raw Elo
    const sorted = [...pSnapshots].sort((a, b) => b.elo - a.elo);
    const topK = sorted.slice(0, config.topK);
    const topKElos = topK.map((s) => s.elo);

    let mu_t = 0;
    let sigma_t = 0;

    if (topKElos.length >= 2) {
      mu_t = topKElos.reduce((acc, v) => acc + v, 0) / topKElos.length;
      const variance = topKElos.reduce((acc, v) => acc + Math.pow(v - mu_t, 2), 0) / (topKElos.length - 1);
      sigma_t = Math.sqrt(variance);
    } else if (topKElos.length === 1) {
      mu_t = topKElos[0];
      sigma_t = 0;
    }

    const safeSigma = sigma_t > 1e-9 ? sigma_t : 0;
    baselines.set(period, { period, mu_t, sigma_t: safeSigma, totalActive: pSnapshots.length });

    // Era talent pool depth multiplier Q(t)
    let eraWeight = 1.0;
    if (config.eraPenaltyEnabled) {
      const match = String(period).match(/\d{4}/);
      if (match) {
        const year = parseInt(match[0], 10);
        const tMin = config.eraBaseYear ?? 1950;
        const tMax = config.eraReferenceYear ?? 2026;
        const span = Math.max(1, tMax - tMin);
        const ratio = Math.max(0, Math.min(1, (year - tMin) / span));
        const gamma = config.eraCurveGamma ?? 1.0;
        const minW = config.eraMinWeight ?? 0.38;
        eraWeight = minW + (1 - minW) * Math.pow(ratio, gamma);
      }
    }

    pSnapshots.forEach((s) => {
      const rawZ = safeSigma > 0 ? (s.elo - mu_t) / safeSigma : 0;
      const z = rawZ * eraWeight;
      if (!playerZScores.has(s.playerId)) {
        playerZScores.set(s.playerId, []);
      }
      playerZScores.get(s.playerId).push({
        playerId: s.playerId,
        period: s.period,
        rawElo: s.elo,
        zScore: z,
        rawZScore: rawZ,
        eraWeight,
        matchesPlayed: s.matchesPlayed ?? 1,
        name: s.name || s.playerId
      });
    });
  }

  // Sort chronologically per player
  for (const records of playerZScores.values()) {
    records.sort((a, b) => String(a.period).localeCompare(String(b.period), undefined, { numeric: true }));
  }

  return { playerZScores, baselines };
}

/**
 * Step 2: Extract Sustained Peak (Z_peak) and Prime Longevity (Z_prime_avg)
 */
export function step2ExtractPeakAndPrime(playerZScores, config = DEFAULT_GOAT_CONFIG) {
  const w = config.peakWindow;
  const m = config.primeYears;
  const playerMetrics = new Map();

  for (const [playerId, records] of playerZScores.entries()) {
    if (records.length < config.minCareerPeriods) continue;

    const n = records.length;
    const rawElos = records.map((r) => r.rawElo);
    const zVals = records.map((r) => r.zScore);
    const displayName = records.find((r) => r.name)?.name || playerId;

    // 1. Sustained Peak (Z_peak)
    let zPeak = 0;
    let peakWindowLabel = '';

    if (n >= w) {
      let bestRoll = -Infinity;
      let bestLabel = '';
      for (let i = 0; i <= n - w; i++) {
        const slice = records.slice(i, i + w);
        const rollAvg = slice.reduce((acc, r) => acc + r.zScore, 0) / w;
        if (rollAvg > bestRoll) {
          bestRoll = rollAvg;
          const pStart = slice[0].period;
          const pEnd = slice[slice.length - 1].period;
          bestLabel = pStart !== pEnd ? `${pStart}–${pEnd}` : String(pStart);
        }
      }
      zPeak = bestRoll;
      peakWindowLabel = bestLabel;
    } else {
      // Small sample shrinkage penalty toward 0 (shrinkage factor = N / W)
      const meanZ = zVals.reduce((acc, v) => acc + v, 0) / n;
      const shrinkage = n / w;
      zPeak = meanZ * shrinkage;
      const pStart = records[0].period;
      const pEnd = records[records.length - 1].period;
      const span = pStart !== pEnd ? `${pStart}–${pEnd}` : String(pStart);
      peakWindowLabel = `${span} (shrunk ${n}/${w})`;
    }

    // 2. Prime Longevity (Z_prime_avg)
    // Sort descending by Z-score
    const sortedDesc = [...records].sort((a, b) => b.zScore - a.zScore);
    const topPrime = sortedDesc.slice(0, m);
    const topZSum = topPrime.reduce((acc, r) => acc + r.zScore, 0);
    // Missing years padded with 0, divided by M
    const zPrimeAvg = topZSum / m;
    const primePeriods = topPrime.map((r) => r.period);

    // Raw career statistics
    const rawPeakElo = Math.max(...rawElos);
    const rawOverallElo = rawElos.reduce((acc, v) => acc + v, 0) / n;

    playerMetrics.set(playerId, {
      playerId,
      name: displayName,
      rawPeakElo,
      rawOverallElo,
      zPeak,
      zPrimeAvg,
      activePeriodsCount: n,
      peakWindowLabel,
      primePeriods
    });
  }

  return playerMetrics;
}

/**
 * Step 3: Normalize Components to [0, 100]
 */
export function step3NormalizeComponents(playerMetrics) {
  if (playerMetrics.size === 0) return new Map();

  const allPeaks = [];
  const allPrimes = [];

  for (const m of playerMetrics.values()) {
    allPeaks.push(m.zPeak);
    allPrimes.push(m.zPrimeAvg);
  }

  const minPeak = Math.min(...allPeaks);
  const maxPeak = Math.max(...allPeaks);
  const minPrime = Math.min(...allPrimes);
  const maxPrime = Math.max(...allPrimes);

  const normalized = new Map();

  for (const [playerId, data] of playerMetrics.entries()) {
    const normPeak = maxPeak > minPeak ? (100 * (data.zPeak - minPeak)) / (maxPeak - minPeak) : 50;
    const normPrime = maxPrime > minPrime ? (100 * (data.zPrimeAvg - minPrime)) / (maxPrime - minPrime) : 50;

    normalized.set(playerId, {
      ...data,
      normPeak,
      normPrime
    });
  }

  return normalized;
}

/**
 * Step 4: Compute Final Composite GOAT Score & Era-Adjusted Elo
 */
export function step4ComputeCompositeScores(normalizedMetrics, config = DEFAULT_GOAT_CONFIG) {
  const wPeak = config.peakWeight;
  const wPrime = config.primeWeight;
  const baseElo = config.baseElo;
  const scale = config.eloScale;

  const rows = [];

  for (const [playerId, data] of normalizedMetrics.entries()) {
    const compositeScore = wPeak * data.normPeak + wPrime * data.normPrime;
    const weightedZ = wPeak * data.zPeak + wPrime * data.zPrimeAvg;
    const eraAdjustedElo = baseElo + scale * weightedZ;

    rows.push({
      rank: 0,
      playerId,
      name: data.name,
      rawPeakElo: Number(data.rawPeakElo.toFixed(1)),
      rawOverallElo: Number(data.rawOverallElo.toFixed(1)),
      zPeak: Number(data.zPeak.toFixed(4)),
      zPrimeAvg: Number(data.zPrimeAvg.toFixed(4)),
      normPeak: Number(data.normPeak.toFixed(2)),
      normPrime: Number(data.normPrime.toFixed(2)),
      eraAdjustedElo: Number(eraAdjustedElo.toFixed(1)),
      compositeScore: Number(compositeScore.toFixed(2)),
      activePeriodsCount: data.activePeriodsCount,
      peakWindowLabel: data.peakWindowLabel,
      primePeriods: data.primePeriods
    });
  }

  // Sort descending by compositeScore, tie-break by eraAdjustedElo
  rows.sort((a, b) => b.compositeScore - a.compositeScore || b.eraAdjustedElo - a.eraAdjustedElo);

  // Assign 1-indexed rank
  rows.forEach((row, idx) => {
    row.rank = idx + 1;
  });

  return rows;
}

/**
 * End-to-end execution of the 4-step pipeline in JS
 */
export function calculateGOATLeaderboard(snapshots, config = DEFAULT_GOAT_CONFIG) {
  const { playerZScores } = step1WithinEraZScore(snapshots, config);
  const metrics = step2ExtractPeakAndPrime(playerZScores, config);
  const normalized = step3NormalizeComponents(metrics);
  return step4ComputeCompositeScores(normalized, config);
}
