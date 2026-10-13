'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CURATED_DRIVERS } from '../data/drivers.js';
import { getCrossEraComparison } from '../data/crossEraModel.js';
import { getDriverBioAndImage, getFallbackAvatar } from '../api.js';
import { LogoMark, SwapIcon, ShuffleIcon, CountryTag } from './Icons.js';
import Leaderboard from './Leaderboard.js';
import DriverModal from './DriverModal.js';

const PRESETS = [
  { id: 'senna_prost', title: 'Senna vs Prost', badge: '1988–1989', a: 'senna', b: 'prost' },
  { id: 'schumacher_hamilton', title: 'Schumacher vs Hamilton', badge: '7 TITLES', a: 'michael_schumacher', b: 'hamilton' },
  { id: 'hamilton_vettel', title: 'Hamilton vs Vettel', badge: 'HYBRID ERA', a: 'hamilton', b: 'vettel' },
  { id: 'verstappen_alonso', title: 'Verstappen vs Alonso', badge: 'RAW PACE', a: 'max_verstappen', b: 'alonso' },
  { id: 'lauda_hunt', title: 'Lauda vs Hunt', badge: '1976 DUEL', a: 'lauda', b: 'hunt' },
  { id: 'clark_stewart', title: 'Clark vs Stewart', badge: '1960S APEX', a: 'clark', b: 'stewart' }
];

function CrossEraDriverCard({ driver, bio, side, probability, range, onOpenModal }) {
  if (!driver) return null;

  const color = driver.color || (side === 'A' ? '#00D2BE' : '#E10600');
  const teamsFormatted = (driver.teams || ['F1 Team']).join(' • ');
  const imgSrc = bio?.image || (driver?.name ? getFallbackAvatar(driver.name) : null);

  return (
    <article
      className="driver-card"
      id={`cardDriver${side}`}
      style={{ '--driver-color': color }}
    >
      <div className="card-glass-header">
        <div className="driver-badge-group">
          <CountryTag nationality={driver.nationality} />
          <span className="driver-num-tag" id={`num${side}`}>#{driver.number || driver.code}</span>
        </div>
        <button
          className="driver-change-btn"
          id={`btnSelect${side}`}
          onClick={() => onOpenModal(side)}
        >
          <SwapIcon size={12} />
          <span>Select Driver</span>
        </button>
      </div>

      <div className="driver-portrait-container">
        {imgSrc && (
          <img
            src={imgSrc}
            alt={`${driver.name} portrait`}
            className="driver-portrait-img"
            id={`img${side}`}
          />
        )}
      </div>

      <div className="driver-meta">
        <div className="driver-telemetry-tag" id={`code${side}`}>
          {driver.code} · {driver.profile?.era || 'ERA'}
        </div>
        <h2 className="driver-full-name" id={`name${side}`}>{driver.name}</h2>
        <div className="driver-career-span" id={`activeYears${side}`}>
          Peak Window: {driver.profile?.peak || driver.activeYears}
        </div>
        <div className="driver-nationality" id={`nationality${side}`}>
          Peak Elo <strong>{driver.rating}</strong> · TQI <strong>{driver.profile?.tqi}/100</strong>
        </div>
        <div className="team-pills" id={`teams${side}`}>{teamsFormatted}</div>
      </div>

      {/* Head-to-Head Model Expectation Block */}
      <div className="dominance-meter-card" style={{ width: '100%', marginTop: '16px' }}>
        <div className="dom-header">
          <span className="dom-title">HEAD-TO-HEAD EDGE</span>
          <div className="dom-values">
            <span
              className={side === 'A' ? 'dom-val-a' : 'dom-val-b'}
              style={{ color }}
            >
              {probability}%
            </span>
          </div>
        </div>

        <div className="dominance-track">
          <div
            className={`dom-bar ${side === 'A' ? 'dom-bar-a' : 'dom-bar-b'}`}
            style={{ width: `${probability}%`, background: color }}
          />
        </div>

        <div className="dominance-verdict" style={{ marginTop: '8px' }}>
          <div className="verdict-content">
            <span className="verdict-badge badge-neutral">
              {range[0]}%–{range[1]}% UNCERTAINTY
            </span>
            <span className="verdict-copy">
              Best sustained 4-year window with empirical-Bayes teammate shrinkage.
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function CompareWorkbench() {
  const [driverAId, setDriverAId] = useState('hamilton');
  const [driverBId, setDriverBId] = useState('vettel');
  const [bioA, setBioA] = useState(null);
  const [bioB, setBioB] = useState(null);
  const [sourceState, setSourceState] = useState({ loading: true, sources: [] });
  const [activePresetId, setActivePresetId] = useState('hamilton_vettel');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTargetSide, setModalTargetSide] = useState('A');

  const byId = useMemo(
    () => new Map(CURATED_DRIVERS.map((driver) => [driver.id, driver])),
    []
  );
  const driverA = byId.get(driverAId) || CURATED_DRIVERS[0];
  const driverB = byId.get(driverBId) || CURATED_DRIVERS[1];
  const comparison = useMemo(
    () => getCrossEraComparison(driverA, driverB),
    [driverA, driverB]
  );

  // Set CSS theme colors and fetch bios
  useEffect(() => {
    const colorA = driverA.color || '#00D2BE';
    const colorB = driverB.color || '#E10600';
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--color-a', colorA);
      document.documentElement.style.setProperty('--color-b', colorB);
    }

    getDriverBioAndImage(driverA.wikiSlug, driverA.name).then(setBioA);
    getDriverBioAndImage(driverB.wikiSlug, driverB.name).then(setBioB);

    const matchedPreset = PRESETS.find(
      (p) =>
        (p.a === driverAId && p.b === driverBId) ||
        (p.a === driverBId && p.b === driverAId)
    );
    setActivePresetId(matchedPreset ? matchedPreset.id : null);
  }, [driverA, driverB, driverAId, driverBId]);

  useEffect(() => {
    let active = true;
    fetch('/api/compare-sources')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Source check unavailable')))
      .then((data) => {
        if (active) setSourceState({ loading: false, sources: data.sources || [] });
      })
      .catch(() => {
        if (active) setSourceState({ loading: false, sources: [] });
      });
    return () => { active = false; };
  }, []);

  const routeNames = (comparison.route || []).map((step) => ({
    ...step,
    fromName: byId.get(step.from)?.name || step.from,
    toName: byId.get(step.to)?.name || step.to
  }));

  const setPreset = (preset) => {
    setActivePresetId(preset.id);
    setDriverAId(preset.a);
    setDriverBId(preset.b);
  };

  const handleSwap = () => {
    setDriverAId(driverBId);
    setDriverBId(driverAId);
  };

  const handleRandomBenchmark = () => {
    const list = CURATED_DRIVERS;
    const idxA = Math.floor(Math.random() * list.length);
    let idxB = Math.floor(Math.random() * list.length);
    while (idxB === idxA) {
      idxB = Math.floor(Math.random() * list.length);
    }
    setDriverAId(list[idxA].id);
    setDriverBId(list[idxB].id);
  };

  const handleOpenModal = (side) => {
    setModalTargetSide(side);
    setIsModalOpen(true);
  };

  const handleSelectDriver = (driverId) => {
    if (modalTargetSide === 'A') {
      setDriverAId(driverId);
    } else {
      setDriverBId(driverId);
    }
    setIsModalOpen(false);
  };

  const leadDiff = Math.abs(comparison.probabilityA - comparison.probabilityB).toFixed(0);
  const leadingDriver = comparison.probabilityA >= comparison.probabilityB ? driverA : driverB;

  return (
    <div className="app-shell">
      {/* 1. Header Navigation */}
      <header className="app-header">
        <div className="brand-group">
          <Link href="/" className="logo-box" aria-label="Flare Home">
            <LogoMark size={24} />
            <span className="logo-text">FLARE</span>
          </Link>
          <span className="app-tagline">Cross-Era Elo Intelligence</span>
        </div>

        <div className="header-actions">
          <Link className="header-btn" href="/" title="Career Labs Head-to-Head Comparison">
            <span>Career Labs</span>
          </Link>
          <Link className="header-btn active" href="/compare" title="Cross-Era Elo Performance Lab">
            <span>Cross Comparison</span>
          </Link>
          <a className="header-btn" href="#leaderboard" title="View all-time F1 peak Elo leaderboard">
            <span>Leaderboard</span>
          </a>
          <button
            className="header-btn btn-random"
            onClick={handleRandomBenchmark}
            title="Load random cross-era benchmark"
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

      {/* 2. Preset Benchmarks Bar */}
      <section className="preset-section">
        <div className="preset-label">ERA BENCHMARKS</div>
        <div className="preset-pills-scroll" id="presetPills">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              className={`preset-pill ${activePresetId === preset.id ? 'active' : ''}`}
              onClick={() => setPreset(preset)}
            >
              <span>{preset.title}</span>
              <span className="pill-badge">{preset.badge}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 3. Hero Introduction Card */}
      <section className="analytics-section compare-hero-card">
        <div className="section-title-bar" style={{ textAlign: 'left', marginBottom: 0 }}>
          <div className="section-title-tag">TEAMMATE-ADJUSTED · CROSS-ERA CALIBRATION</div>
          <h1 className="section-heading" style={{ fontSize: '1.45rem', marginTop: '4px' }}>
            Compare the driver, <span style={{ color: 'var(--f1-red)' }}>not the machinery.</span>
          </h1>
          <p className="section-subtext" style={{ maxWidth: '820px', marginTop: '6px', fontSize: '0.82rem', lineHeight: 1.5 }}>
            A Python-fitted, time-aware Bradley–Terry model isolates driver skill from car superiority using teammate chain networks.
            Each champion is compared at their best sustained four-year window in neutral machinery.
          </p>
        </div>
      </section>

      {/* 4. Main Head-to-Head Comparison Arena */}
      <main className="comparison-arena">
        <CrossEraDriverCard
          driver={comparison.drivers[0]}
          bio={bioA}
          side="A"
          probability={comparison.probabilityA}
          range={comparison.probabilityRangeA}
          onOpenModal={handleOpenModal}
        />

        {/* Center Versus & Expectation Hub */}
        <div className="versus-hub">
          <div className="vs-emblem">
            <span className="vs-text">VS</span>
          </div>

          <div className="dominance-meter-card">
            <div className="dom-header">
              <span className="dom-title">PEAK-TO-PEAK PROBABILITY</span>
              <div className="dom-values">
                <span className="dom-val-a" style={{ color: driverA.color || '#00D2BE' }}>
                  {comparison.probabilityA}%
                </span>
                <span className="dom-split">/</span>
                <span className="dom-val-b" style={{ color: driverB.color || '#E10600' }}>
                  {comparison.probabilityB}%
                </span>
              </div>
            </div>

            <div className="dominance-track">
              <div
                className="dom-bar dom-bar-a"
                style={{ width: `${comparison.probabilityA}%`, background: driverA.color || '#00D2BE' }}
              />
              <div
                className="dom-bar dom-bar-b"
                style={{ width: `${comparison.probabilityB}%`, background: driverB.color || '#E10600' }}
              />
              <div className="dom-notch" />
            </div>

            <div className="dominance-verdict">
              <div className="verdict-content">
                <span className="verdict-badge badge-lead">
                  +{leadDiff}% {leadingDriver.name.split(' ').pop().toUpperCase()} · {comparison.ratingGap} ELO GAP
                </span>
                <span className="verdict-copy">
                  Best sustained 4-year peak in neutral machinery, normalized for teammate calibre.
                </span>
              </div>
            </div>
          </div>
        </div>

        <CrossEraDriverCard
          driver={comparison.drivers[1]}
          bio={bioB}
          side="B"
          probability={comparison.probabilityB}
          range={comparison.probabilityRangeB}
          onOpenModal={handleOpenModal}
        />
      </main>

      {/* 5. Deep Analytics: Model Decomposition & Teammate Graph */}
      <section className="deep-analytics-grid">
        {/* Model Decomposition */}
        <article className="analytics-card">
          <div className="card-inner-header">
            <div>
              <div className="badge-accent">MODEL DECOMPOSITION</div>
              <h4 className="card-title">What Informs the Estimate</h4>
            </div>
            <span className="fia-country-pill">Python Fitted</span>
          </div>

          <p className="card-copy" style={{ fontSize: '0.82rem', color: 'var(--text-body)', lineHeight: 1.5, marginBottom: '16px' }}>
            The fitter derives each driver’s strongest sustained 4-year window with teammate-caliber normalization and empirical-Bayes shrinkage, preventing number-two driver distortion.
          </p>

          <div className="dimension-list" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {comparison.dimensions.map((dimension) => (
              <div className="dimension-row" key={dimension.key}>
                <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 40px', alignItems: 'center', marginBottom: '4px' }}>
                  <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: driverA.color || '#00D2BE' }}>
                    {dimension.a}
                  </strong>
                  <span style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-main)' }}>
                    {dimension.name} <i style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)', fontStyle: 'normal' }}>({dimension.weight})</i>
                  </span>
                  <strong style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: driverB.color || '#E10600' }}>
                    {dimension.b}
                  </strong>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <div className="stat-bar-container stat-bar-container-a">
                    <div
                      className="stat-fill-bar stat-fill-a"
                      style={{ width: `${dimension.a}%`, background: driverA.color || '#00D2BE' }}
                    />
                  </div>
                  <div className="stat-bar-container stat-bar-container-b">
                    <div
                      className="stat-fill-bar stat-fill-b"
                      style={{ width: `${dimension.b}%`, background: driverB.color || '#E10600' }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="formula-note" style={{ marginTop: '20px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem', color: 'var(--text-body)', fontWeight: 700 }}>
              E = 1 / (1 + 10<sup>(R<sub>B</sub> − R<sub>A</sub>) / 400</sup>)
            </code>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Teammate-network normalized Bradley–Terry
            </span>
          </div>
        </article>

        {/* Network Evidence */}
        <article className="analytics-card">
          <div className="card-inner-header">
            <div>
              <div className="badge-accent">TEAMMATE GRAPH</div>
              <h4 className="card-title">How the Eras Connect</h4>
            </div>
            <span className={`fia-country-pill ${comparison.dataScore < 66 ? 'caution' : ''}`}>
              {comparison.confidenceLabel}
            </span>
          </div>

          {routeNames.length ? (
            <ol className="evidence-route" style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
              {routeNames.map((step, index) => (
                <li
                  key={`${step.from}-${step.to}-${step.label}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px 12px',
                    background: 'var(--bg-card-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <span
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      background: 'var(--text-main)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      flexShrink: 0
                    }}
                  >
                    {index + 1}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      {step.fromName} <span style={{ color: 'var(--f1-red)' }}>↔</span> {step.toName}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      {step.label}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div style={{ padding: '16px', background: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', marginTop: '12px' }}>
              <strong style={{ fontSize: '0.84rem', color: 'var(--text-main)' }}>No short teammate chain in this calibration.</strong>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.4 }}>
                The result remains visible, but its uncertainty interval is deliberately wider until more linked observations are calibrated.
              </p>
            </div>
          )}

          <div style={{ marginTop: 'auto', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <span>{comparison.isDirect ? 'Direct teammates' : `${routeNames.length || 'No'} linked teammate hop${routeNames.length === 1 ? '' : 's'}`}</span>
            <strong>{comparison.dataScore}/100 evidence confidence</strong>
          </div>
        </article>
      </section>

      {/* 6. All-Time Peak Elo Leaderboard */}
      <Leaderboard
        onSelectDriverA={setDriverAId}
        onSelectDriverB={setDriverBId}
        selectedDriverAId={driverAId}
        selectedDriverBId={driverBId}
      />

      {/* 7. Deep Analytics: Methodology & Data Stack */}
      <section className="deep-analytics-grid">
        <article className="analytics-card">
          <div className="card-inner-header">
            <div>
              <div className="badge-accent">ERA NORMALISATION</div>
              <h4 className="card-title">Conditions Are Not Eras</h4>
            </div>
          </div>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem', color: 'var(--text-body)', lineHeight: 1.5 }}>
            <li style={{ paddingLeft: '14px', position: 'relative' }}>
              <span style={{ position: 'absolute', left: 0, color: 'var(--f1-red)', fontWeight: 800 }}>•</span>
              Qualifying and race performance are estimated separately before combining into peak rating.
            </li>
            <li style={{ paddingLeft: '14px', position: 'relative' }}>
              <span style={{ position: 'absolute', left: 0, color: 'var(--f1-red)', fontWeight: 800 }}>•</span>
              Teammate quality is normalized so dominating a secondary driver does not inflate a rating over facing World Champions.
            </li>
            <li style={{ paddingLeft: '14px', position: 'relative' }}>
              <span style={{ position: 'absolute', left: 0, color: 'var(--f1-red)', fontWeight: 800 }}>•</span>
              Cross-era matchups apply bridge attenuation so unsupported edges decay gracefully over multi-decade spans.
            </li>
            <li style={{ paddingLeft: '14px', position: 'relative' }}>
              <span style={{ position: 'absolute', left: 0, color: 'var(--f1-red)', fontWeight: 800 }}>•</span>
              Older records receive wider credible intervals when timing depth or network links are thinner.
            </li>
          </ul>
        </article>

        <article className="analytics-card">
          <div className="card-inner-header">
            <div>
              <div className="badge-accent">FREE DATA STACK</div>
              <h4 className="card-title">Sources &amp; Coverage</h4>
            </div>
            <span className="fia-country-pill" style={{ color: sourceState.loading ? 'var(--text-muted)' : 'var(--success-green)' }}>
              {sourceState.loading ? 'Checking Sources' : 'Live Verified'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {comparison.sources.map((source) => {
              const live = sourceState.sources.find((item) => item.id === source.id);
              return (
                <a
                  href={source.href}
                  target="_blank"
                  rel="noreferrer"
                  key={source.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: 'var(--bg-card-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    textDecoration: 'none',
                    color: 'inherit'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: sourceState.loading ? 'var(--text-dim)' : live?.available ? 'var(--success-green)' : 'var(--victory-gold)'
                      }}
                    />
                    <strong style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>{source.name}</strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>({source.scope})</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{source.role}</span>
                </a>
              );
            })}
          </div>

          <p style={{ marginTop: '12px', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
            Uses a versioned fitted Python snapshot so upstream outages cannot silently alter comparison ratings.
          </p>
        </article>
      </section>

      {/* 8. Footer */}
      <footer className="app-footer">
        <div className="footer-credits">
          <p>
            Powered by <strong>Bradley–Terry Python Calibration</strong> &amp;{' '}
            <strong>Jolpica F1 Historical Database</strong>.
          </p>
          <p className="footer-disclaimer">
            Formula 1 and F1 are registered trademarks of Formula One Licensing B.V. Not officially affiliated with FIA or F1.
          </p>
        </div>
      </footer>

      {/* 9. Driver Selection Modal */}
      <DriverModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        targetSide={modalTargetSide}
        curatedDrivers={CURATED_DRIVERS}
        historicalDrivers={[]}
        onSelectDriver={handleSelectDriver}
      />
    </div>
  );
}
