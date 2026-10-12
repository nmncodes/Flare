'use client';

import { useState, useMemo } from 'react';
import { CURATED_DRIVERS } from '../data/drivers.js';
import snapshot from '../data/cross-era-snapshot.json' with { type: 'json' };

const ERA_TABS = [
  { id: 'all', label: 'All Eras' },
  { id: 'modern', label: 'Modern (2010s–Present)' },
  { id: 'v10', label: 'V10 / V8 (1990s–2000s)' },
  { id: 'classic', label: 'Classic / Turbo (1970s–1980s)' },
  { id: 'historic', label: 'Golden Age (1950s–1960s)' }
];

const SORT_OPTIONS = [
  { id: 'peakElo', label: 'Peak Elo' },
  { id: 'pace', label: 'Qualifying Pace' },
  { id: 'race', label: 'Race Pace' },
  { id: 'execution', label: 'Peak Overall' },
  { id: 'adaptability', label: 'Adaptability' },
  { id: 'wdc', label: 'Championships' },
  { id: 'wins', label: 'Race Wins' }
];

export default function Leaderboard({
  onSelectDriverA,
  onSelectDriverB,
  selectedDriverAId,
  selectedDriverBId
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeEra, setActiveEra] = useState('all');
  const [sortBy, setSortBy] = useState('peakElo');

  // Combine curated driver biographical data with snapshot profiles
  const allDrivers = useMemo(() => {
    return CURATED_DRIVERS.map((driver) => {
      const profile = snapshot.profiles[driver.id] || {};
      const peakYearMatch = String(profile.peak || driver.activeYears).match(/\d{4}/);
      const startYear = peakYearMatch ? parseInt(peakYearMatch[0], 10) : 2000;

      let eraCategory = 'modern';
      if (startYear < 1970) eraCategory = 'historic';
      else if (startYear < 1990) eraCategory = 'classic';
      else if (startYear < 2010) eraCategory = 'v10';

      return {
        id: driver.id,
        name: driver.name,
        code: driver.code,
        flag: driver.flag,
        nationality: driver.nationality,
        color: driver.color || '#e10600',
        activeYears: driver.activeYears,
        wdc: driver.championships || 0,
        wins: driver.wins || 0,
        poles: driver.poles || 0,
        podiums: driver.podiums || 0,
        peakElo: profile.peakElo || 1500,
        uncertaintyElo: profile.uncertaintyElo || 50,
        tqi: profile.tqi || 50,
        pace: profile.pace || 50,
        race: profile.race || 50,
        execution: profile.execution || 50,
        adaptability: profile.adaptability || 50,
        peak: profile.peak || driver.activeYears,
        eraCategory
      };
    });
  }, []);

  // Filter and sort drivers
  const filteredDrivers = useMemo(() => {
    return allDrivers
      .filter((d) => {
        // Search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = d.name.toLowerCase().includes(q);
          const matchCode = d.code.toLowerCase().includes(q);
          const matchNat = d.nationality.toLowerCase().includes(q);
          if (!matchName && !matchCode && !matchNat) return false;
        }
        // Era filter
        if (activeEra !== 'all' && d.eraCategory !== activeEra) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (b[sortBy] !== a[sortBy]) {
          return b[sortBy] - a[sortBy];
        }
        // Fallback tie-breaker: peak Elo then wins
        if (b.peakElo !== a.peakElo) return b.peakElo - a.peakElo;
        return b.wins - a.wins;
      });
  }, [allDrivers, searchQuery, activeEra, sortBy]);

  // Overall absolute top 3 for the podium showcase (always by Peak Elo)
  const topThree = useMemo(() => {
    return [...allDrivers].sort((a, b) => b.peakElo - a.peakElo).slice(0, 3);
  }, [allDrivers]);

  const handleSelectA = (id) => {
    if (onSelectDriverA) onSelectDriverA(id);
    const element = document.querySelector('.compare-hero');
    if (element) element.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSelectB = (id) => {
    if (onSelectDriverB) onSelectDriverB(id);
    const element = document.querySelector('.compare-hero');
    if (element) element.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section id="leaderboard" className="leaderboard-section" aria-label="All-Time F1 Driver Peak Elo Leaderboard">
      <div className="leaderboard-header">
        <div>
          <p className="compare-eyebrow">ALL-TIME BENCHMARK RANKINGS</p>
          <h2>All-Time Peak Elo Leaderboard</h2>
          <p className="leaderboard-subtitle">
            All 23 curated drivers ranked by peak Elo across their best sustained 4-year window.
            Calibrated for teammate quality, competitive depth, and neutral machinery.
          </p>
        </div>
        <div className="leaderboard-stats-chip">
          <span>Field Baseline <strong>1500 Elo</strong></span>
          <span>•</span>
          <span>Apex Peak <strong>{topThree[0]?.peakElo} Elo</strong></span>
        </div>
      </div>

      {/* Podium Showcase (Top 3) */}
      <div className="podium-grid">
        {topThree.map((driver, index) => {
          const rank = index + 1;
          const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';
          const podiumClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : 'bronze';
          const isA = driver.id === selectedDriverAId;
          const isB = driver.id === selectedDriverBId;

          return (
            <article key={driver.id} className={`podium-card podium-${podiumClass}`} style={{ '--podium-accent': driver.color }}>
              <div className="podium-topline">
                <span className="podium-medal">{medal} Rank #{rank}</span>
                <span className="podium-era">{driver.peak}</span>
              </div>
              <div className="podium-driver-info">
                <span className="podium-flag">{driver.flag}</span>
                <div>
                  <h3>{driver.name}</h3>
                  <span className="podium-sub">{driver.wdc}x World Champion · {driver.wins} Wins</span>
                </div>
              </div>
              <div className="podium-elo-block">
                <div className="podium-elo-val">
                  <strong>{driver.peakElo}</strong>
                  <span>Peak Elo</span>
                </div>
                <div className="podium-stats-mini">
                  <span>Quali: <strong>{driver.pace}</strong></span>
                  <span>Race: <strong>{driver.race}</strong></span>
                  <span>Overall: <strong>{driver.execution}</strong></span>
                </div>
              </div>
              <div className="podium-actions">
                <button
                  className={`btn-podium ${isA ? 'active-a' : ''}`}
                  onClick={() => handleSelectA(driver.id)}
                  title="Compare as Driver A"
                >
                  {isA ? 'Active Driver A' : 'Set as Driver A'}
                </button>
                <button
                  className={`btn-podium ${isB ? 'active-b' : ''}`}
                  onClick={() => handleSelectB(driver.id)}
                  title="Compare as Driver B"
                >
                  {isB ? 'Active Driver B' : 'Set as Driver B'}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {/* Controls: Search, Sort, Era Tabs */}
      <div className="leaderboard-controls">
        <div className="leaderboard-search-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search driver by name, code, or country…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Filter drivers by name"
          />
          {searchQuery && (
            <button className="clear-search" onClick={() => setSearchQuery('')} aria-label="Clear search">
              ×
            </button>
          )}
        </div>

        <div className="leaderboard-sort-group">
          <label htmlFor="leaderboard-sort-select">Sort by:</label>
          <select
            id="leaderboard-sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Era Filter Tabs */}
      <div className="leaderboard-era-tabs" role="tablist" aria-label="Filter leaderboard by era">
        {ERA_TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeEra === tab.id}
            className={`era-tab-btn ${activeEra === tab.id ? 'active' : ''}`}
            onClick={() => setActiveEra(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Leaderboard Table */}
      <div className="leaderboard-table-container">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th className="th-rank">Rank</th>
              <th className="th-driver">Driver</th>
              <th className="th-era">Peak Window</th>
              <th className="th-elo">Peak Elo</th>
              <th className="th-metric">Qualifying</th>
              <th className="th-metric">Race Pace</th>
              <th className="th-metric">Execution</th>
              <th className="th-metric">Adaptability</th>
              <th className="th-trophies">Championships</th>
              <th className="th-actions">Compare</th>
            </tr>
          </thead>
          <tbody>
            {filteredDrivers.map((driver, index) => {
              const rank = index + 1;
              const isSelectedA = driver.id === selectedDriverAId;
              const isSelectedB = driver.id === selectedDriverBId;
              const isTopThree = rank <= 3 && sortBy === 'peakElo' && activeEra === 'all' && !searchQuery;
              const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;

              // Relative progress bar for Elo (1500 baseline up to 1760 max)
              const eloPct = Math.max(10, Math.min(100, Math.round(((driver.peakElo - 1500) / 260) * 100)));

              return (
                <tr
                  key={driver.id}
                  className={`leaderboard-row ${isSelectedA ? 'row-active-a' : ''} ${isSelectedB ? 'row-active-b' : ''}`}
                  style={{ '--driver-accent': driver.color }}
                >
                  <td className="td-rank">
                    {isTopThree && medal ? (
                      <span className="rank-medal">{medal}</span>
                    ) : (
                      <span className="rank-number">#{rank}</span>
                    )}
                  </td>
                  <td className="td-driver">
                    <div className="driver-cell">
                      <span className="driver-accent-bar" style={{ background: driver.color }} />
                      <span className="driver-flag">{driver.flag}</span>
                      <div className="driver-name-group">
                        <strong>{driver.name}</strong>
                        <span className="driver-code">{driver.code} · {driver.nationality}</span>
                      </div>
                    </div>
                  </td>
                  <td className="td-era">
                    <span className="era-badge">{driver.peak}</span>
                  </td>
                  <td className="td-elo">
                    <div className="elo-cell">
                      <div className="elo-number-row">
                        <strong>{driver.peakElo}</strong>
                        <small className="tqi-badge">TQI {driver.tqi}</small>
                      </div>
                      <div className="elo-meter-bar">
                        <div className="elo-meter-fill" style={{ width: `${eloPct}%`, background: driver.color }} />
                      </div>
                    </div>
                  </td>
                  <td className="td-metric">
                    <div className="metric-pill">
                      <strong>{driver.pace}</strong>
                      <span className="metric-bar"><i style={{ width: `${driver.pace}%`, background: driver.color }} /></span>
                    </div>
                  </td>
                  <td className="td-metric">
                    <div className="metric-pill">
                      <strong>{driver.race}</strong>
                      <span className="metric-bar"><i style={{ width: `${driver.race}%`, background: driver.color }} /></span>
                    </div>
                  </td>
                  <td className="td-metric">
                    <div className="metric-pill">
                      <strong>{driver.execution}</strong>
                      <span className="metric-bar"><i style={{ width: `${driver.execution}%`, background: driver.color }} /></span>
                    </div>
                  </td>
                  <td className="td-metric">
                    <div className="metric-pill">
                      <strong>{driver.adaptability}</strong>
                      <span className="metric-bar"><i style={{ width: `${driver.adaptability}%`, background: driver.color }} /></span>
                    </div>
                  </td>
                  <td className="td-trophies">
                    <div className="trophies-cell">
                      {driver.wdc > 0 ? (
                        <span className="wdc-badge">🏆 {driver.wdc}x WDC</span>
                      ) : (
                        <span className="wins-only-badge">{driver.wins} Wins</span>
                      )}
                    </div>
                  </td>
                  <td className="td-actions">
                    <div className="row-actions">
                      <button
                        className={`action-btn btn-a ${isSelectedA ? 'active' : ''}`}
                        onClick={() => handleSelectA(driver.id)}
                        title={`Select ${driver.name} as Driver A`}
                      >
                        {isSelectedA ? 'Driver A' : 'VS A'}
                      </button>
                      <button
                        className={`action-btn btn-b ${isSelectedB ? 'active' : ''}`}
                        onClick={() => handleSelectB(driver.id)}
                        title={`Select ${driver.name} as Driver B`}
                      >
                        {isSelectedB ? 'Driver B' : 'VS B'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredDrivers.length === 0 && (
          <div className="leaderboard-empty">
            <p>No drivers found matching &quot;{searchQuery}&quot; in this era.</p>
          </div>
        )}
      </div>

      <div className="leaderboard-footer-note">
        <span>Showing {filteredDrivers.length} of {allDrivers.length} calibrated drivers</span>
        <span>•</span>
        <span>Click <strong>VS A</strong> or <strong>VS B</strong> on any driver to load them directly into the Cross-Era Workbench above.</span>
      </div>
    </section>
  );
}
