'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { CURATED_DRIVERS, ICONIC_MATCHUPS } from '../data/drivers.js';
import {
  getDriverBioAndImage,
  getAllHistoricalDrivers,
  fetchLiveDriverStats,
  calculateDuelMetrics
} from '../api.js';

import DriverCard from '../components/DriverCard.js';
import DominanceMeter from '../components/DominanceMeter.js';
import TaleOfTheTape from '../components/TaleOfTheTape.js';
import RadarCanvas from '../components/RadarCanvas.js';
import EraBenchmark from '../components/EraBenchmark.js';
import DriverModal from '../components/DriverModal.js';
import { LogoMark, ShuffleIcon, SwapIcon } from '../components/Icons.js';

export default function Home() {
  const [driverA, setDriverA] = useState(null);
  const [driverB, setDriverB] = useState(null);
  const [bioA, setBioA] = useState(null);
  const [bioB, setBioB] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [historicalList, setHistoricalList] = useState([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTargetSide, setModalTargetSide] = useState('A');

  // Active preset pill
  const [activePresetId, setActivePresetId] = useState('goat_debate');

  // Helper to resolve driver by ID
  const resolveDriver = useCallback(async (driverId) => {
    const found = CURATED_DRIVERS.find((d) => d.id === driverId);
    if (found) return found;

    try {
      return await fetchLiveDriverStats(driverId);
    } catch (err) {
      console.error('Failed to resolve driver:', driverId, err);
      return CURATED_DRIVERS[0];
    }
  }, []);

  // Update drivers and metrics
  const setMatchup = useCallback(
    async (idA, idB) => {
      const dA = await resolveDriver(idA);
      const dB = await resolveDriver(idB);

      setDriverA(dA);
      setDriverB(dB);

      const computed = calculateDuelMetrics(dA, dB);
      setMetrics(computed);

      // Set CSS theme colors
      const colorA = dA.color || '#00D2BE';
      const colorB = dB.color || '#E10600';
      if (typeof document !== 'undefined') {
        document.documentElement.style.setProperty('--color-a', colorA);
        document.documentElement.style.setProperty('--color-b', colorB);
      }

      // Update URL hash
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `#${dA.id}-vs-${dB.id}`);
      }

      // Fetch Bios in background
      getDriverBioAndImage(dA.wikiSlug, dA.name).then(setBioA);
      getDriverBioAndImage(dB.wikiSlug, dB.name).then(setBioB);

      // Check if matches an iconic preset
      const match = ICONIC_MATCHUPS.find(
        (m) =>
          (m.driverA === dA.id && m.driverB === dB.id) ||
          (m.driverA === dB.id && m.driverB === dA.id)
      );
      setActivePresetId(match ? match.id : null);
    },
    [resolveDriver]
  );

  // Initialize from URL Hash or default
  useEffect(() => {
    let initialA = 'hamilton';
    let initialB = 'michael_schumacher';

    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '');
      if (hash.includes('-vs-')) {
        const parts = hash.split('-vs-');
        if (parts.length === 2 && parts[0] && parts[1]) {
          initialA = parts[0];
          initialB = parts[1];
        }
      }
    }

    setMatchup(initialA, initialB);

    // Fetch all 850+ drivers in background for search
    getAllHistoricalDrivers().then((list) => {
      setHistoricalList(list || []);
    });
  }, [setMatchup]);

  // Actions
  const handleSwap = () => {
    if (driverA && driverB) {
      setMatchup(driverB.id, driverA.id);
    }
  };

  const handleRandomBattle = () => {
    const list = CURATED_DRIVERS;
    const idxA = Math.floor(Math.random() * list.length);
    let idxB = Math.floor(Math.random() * list.length);
    while (idxB === idxA) {
      idxB = Math.floor(Math.random() * list.length);
    }
    setMatchup(list[idxA].id, list[idxB].id);
  };

  const handleOpenModal = (side) => {
    setModalTargetSide(side);
    setIsModalOpen(true);
  };

  const handleSelectDriver = (driverId) => {
    if (modalTargetSide === 'A') {
      setMatchup(driverId, driverB ? driverB.id : 'michael_schumacher');
    } else {
      setMatchup(driverA ? driverA.id : 'hamilton', driverId);
    }
  };

  return (
    <div className="app-shell">
      {/* 1. Header Navigation */}
      <header className="app-header">
        <div className="brand-group">
          <div className="logo-box">
            <LogoMark size={24} />
            <span className="logo-text">FLARE</span>
          </div>
          <span className="app-tagline">Formula 1 Career Analytics</span>
        </div>

        <div className="header-actions">
          <Link className="header-btn" href="/compare" title="Open the cross-era comparison lab">
            <span>Cross-Era Lab</span>
          </Link>
          <Link className="header-btn" href="/compare#leaderboard" title="View all-time F1 peak Elo leaderboard">
            <span>Leaderboard</span>
          </Link>
          <button
            className="header-btn btn-random"
            onClick={handleRandomBattle}
            title="Load random iconic battle"
          >
            <ShuffleIcon size={14} />
            <span>Random Matchup</span>
          </button>
          <button
            className="header-btn btn-swap"
            onClick={handleSwap}
            title="Swap Driver A and Driver B"
          >
            <SwapIcon size={14} />
            <span>Swap</span>
          </button>
        </div>
      </header>

      {/* 2. Preset Matchup Carousel */}
      <section className="preset-section">
        <div className="preset-label">ICONIC RIVALRIES</div>
        <div className="preset-pills-scroll" id="presetPills">
          {ICONIC_MATCHUPS.map((matchup) => (
            <button
              key={matchup.id}
              className={`preset-pill ${activePresetId === matchup.id ? 'active' : ''}`}
              onClick={() => {
                setActivePresetId(matchup.id);
                setMatchup(matchup.driverA, matchup.driverB);
              }}
            >
              <span>{matchup.title}</span>
              <span className="pill-badge">{matchup.badge}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 3. Main Head-to-Head Arena */}
      <main className="comparison-arena">
        <DriverCard
          driver={driverA}
          bio={bioA}
          side="A"
          onOpenModal={handleOpenModal}
        />

        <DominanceMeter
          driverA={driverA}
          driverB={driverB}
          metrics={metrics}
        />

        <DriverCard
          driver={driverB}
          bio={bioB}
          side="B"
          onOpenModal={handleOpenModal}
        />
      </main>

      {/* 4. Tale of the Tape Stat Rows */}
      {metrics && driverA && driverB && (
        <TaleOfTheTape
          driverA={driverA}
          driverB={driverB}
          metrics={metrics}
        />
      )}

      {/* 5. Deep Analytics: Radar Chart & Era Benchmark */}
      {metrics && driverA && driverB && (
        <section className="deep-analytics-grid">
          {/* Radar Chart */}
          <div className="analytics-card radar-card">
            <div className="card-inner-header">
              <div>
                <div className="badge-accent">6-DIMENSION SPIDER CHART</div>
                <h4 className="card-title">Performance Fingerprint</h4>
              </div>
              <div className="radar-legend">
                <div className="legend-item">
                  <span className="legend-dot dot-a" style={{ background: driverA.color || '#00D2BE' }}></span>
                  <span className="legend-name" id="legendNameA">{driverA.name}</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot dot-b" style={{ background: driverB.color || '#E10600' }}></span>
                  <span className="legend-name" id="legendNameB">{driverB.name}</span>
                </div>
              </div>
            </div>

            <div className="canvas-wrapper">
              <RadarCanvas
                labels={metrics.radarLabels}
                dataA={metrics.radarDataA}
                dataB={metrics.radarDataB}
                colorA={driverA.color || '#00D2BE'}
                colorB={driverB.color || '#E10600'}
              />
            </div>
          </div>

          {/* Era Overlap and Wikipedia Dossier */}
          <EraBenchmark
            driverA={driverA}
            driverB={driverB}
            bioA={bioA}
            bioB={bioB}
          />
        </section>
      )}

      {/* 6. Footer */}
      <footer className="app-footer">
        <div className="footer-credits">
          <p>
            Powered by <strong>Jolpica F1 API</strong> (Community Ergast Successor) &amp;{' '}
            <strong>Wikipedia REST API</strong>.
          </p>
          <p className="footer-disclaimer">
            Formula 1 and F1 are registered trademarks of Formula One Licensing B.V. Not officially affiliated with FIA or F1.
          </p>
        </div>
      </footer>

      {/* 7. Driver Selection Modal */}
      <DriverModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        targetSide={modalTargetSide}
        curatedDrivers={CURATED_DRIVERS}
        historicalDrivers={historicalList}
        onSelectDriver={handleSelectDriver}
      />
    </div>
  );
}
