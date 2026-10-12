'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CURATED_DRIVERS } from '../data/drivers.js';
import { getCrossEraComparison } from '../data/crossEraModel.js';
import { LogoMark, SwapIcon } from './Icons.js';

const PRESETS = [
  { label: 'Senna / Prost', a: 'senna', b: 'prost' },
  { label: 'Hamilton / Vettel', a: 'hamilton', b: 'vettel' },
  { label: 'Schumacher / Hamilton', a: 'michael_schumacher', b: 'hamilton' },
  { label: 'Verstappen / Alonso', a: 'max_verstappen', b: 'alonso' }
];

function DriverSelect({ label, value, onChange, accent }) {
  return (
    <label className="compare-select-group">
      <span className="compare-select-label" style={{ color: accent }}>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {CURATED_DRIVERS.map((driver) => (
          <option key={driver.id} value={driver.id}>{driver.name}</option>
        ))}
      </select>
    </label>
  );
}

function OutcomeCard({ driver, probability, range, side }) {
  const accent = driver.color || (side === 'a' ? '#00a99d' : '#e10600');
  return (
    <article className={`outcome-driver outcome-driver-${side}`} style={{ '--compare-driver': accent }}>
      <div className="outcome-driver-topline">
        <span>{driver.code}</span>
        <span>{driver.profile.era}</span>
      </div>
      <h2>{driver.name}</h2>
      <div className="posterior-block">
        <span>Fitted peak window</span>
        <strong>{driver.profile.tqi}<small>/100</small></strong>
        <em>Peak Elo {driver.rating}</em>
      </div>
      <div className="outcome-probability">
        <strong>{probability}%</strong>
        <span>peak-to-peak edge</span>
      </div>
      <p>{range[0]}–{range[1]}% uncertainty range</p>
    </article>
  );
}

export default function CompareWorkbench() {
  const [driverAId, setDriverAId] = useState('hamilton');
  const [driverBId, setDriverBId] = useState('vettel');
  const [sourceState, setSourceState] = useState({ loading: true, sources: [] });

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
    setDriverAId(preset.a);
    setDriverBId(preset.b);
  };

  return (
    <main className="app-shell compare-page">
      <header className="app-header compare-nav">
        <div className="brand-group">
          <Link href="/" className="logo-box compare-brand" aria-label="Back to Flare home">
            <LogoMark size={24} />
            <span className="logo-text">FLARE</span>
          </Link>
          <span className="app-tagline">Cross-era performance lab</span>
        </div>
        <nav className="header-actions compare-nav-links" aria-label="Primary navigation">
          <Link className="header-btn" href="/">
            <span>Career Comparison</span>
          </Link>
          <span className="header-btn compare-nav-active">Cross-Era Lab</span>
        </nav>
      </header>

      <section className="compare-hero">
        <div>
          <p className="compare-eyebrow">CROSS-ERA / TEAMMATE-ADJUSTED</p>
          <h1>Compare the driver,<br /><em>not the machinery.</em></h1>
        </div>
        <p className="compare-lede">
          A Python-fitted, time-aware Bradley–Terry model turns same-car results into
          season-level strengths. Each driver is compared at their best sustained four-year
          window—not their rookie or late-career average.
        </p>
      </section>

      <section className="compare-control-panel" aria-label="Choose drivers to compare">
        <div className="compare-presets">
          <span>Start with</span>
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              className={driverAId === preset.a && driverBId === preset.b ? 'selected' : ''}
              onClick={() => setPreset(preset)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="compare-selects">
          <DriverSelect label="DRIVER A" value={driverAId} onChange={setDriverAId} accent={driverA.color || '#008f82'} />
          <button
            className="compare-swap"
            onClick={() => { setDriverAId(driverBId); setDriverBId(driverAId); }}
            aria-label="Swap selected drivers"
            title="Swap selected drivers"
          >
            <SwapIcon size={17} />
          </button>
          <DriverSelect label="DRIVER B" value={driverBId} onChange={setDriverBId} accent={driverB.color || '#e10600'} />
        </div>
      </section>

      <section className="outcome-panel" aria-label="Teammate-adjusted comparison outcome">
        <OutcomeCard
          driver={comparison.drivers[0]}
          probability={comparison.probabilityA}
          range={comparison.probabilityRangeA}
          side="a"
        />
        <div className="outcome-center">
          <div className="outcome-center-label">PEAK-TO-PEAK EXPECTATION</div>
          <div className="outcome-gauge" aria-label={`${driverA.name} ${comparison.probabilityA} percent, ${driverB.name} ${comparison.probabilityB} percent`}>
            <div className="outcome-gauge-a" style={{ width: `${comparison.probabilityA}%`, background: driverA.color || '#008f82' }} />
            <div className="outcome-gauge-b" style={{ width: `${comparison.probabilityB}%`, background: driverB.color || '#e10600' }} />
          </div>
          <p><strong>{comparison.ratingGap} Elo</strong> fitted gap</p>
          <span className="outcome-interpretation">
            Best sustained windows in neutral machinery—not a prediction for one real race.
          </span>
        </div>
        <OutcomeCard
          driver={comparison.drivers[1]}
          probability={comparison.probabilityB}
          range={comparison.probabilityRangeB}
          side="b"
        />
      </section>

      <section className="compare-grid">
        <article className="compare-card performance-card">
          <div className="compare-card-heading">
            <div>
              <p className="compare-eyebrow">MODEL DECOMPOSITION</p>
              <h2>What informs the estimate</h2>
            </div>
            <span className="model-chip">Python fitted</span>
          </div>
          <p className="card-copy">
            The fitter estimates a separate strength for every driver-season, smooths adjacent
            seasons, and derives each driver’s strongest sustained four-year window.
          </p>
          <div className="dimension-list">
            {comparison.dimensions.map((dimension) => (
              <div className="dimension-row" key={dimension.key}>
                <div className="dimension-values">
                  <strong>{dimension.a}</strong>
                  <span>{dimension.name} <i>{dimension.weight}</i></span>
                  <strong>{dimension.b}</strong>
                </div>
                <div className="dimension-bars">
                  <span className="dimension-a"><i style={{ width: `${dimension.a}%`, background: driverA.color || '#008f82' }} /></span>
                  <span className="dimension-b"><i style={{ width: `${dimension.b}%`, background: driverB.color || '#e10600' }} /></span>
                </div>
              </div>
            ))}
          </div>
          <div className="formula-note">
            <code>E = 1 / (1 + 10<sup>(R<sub>B</sub> − R<sub>A</sub>) / 400</sup>)</code>
            <span>Ratings come from the generated Python model snapshot.</span>
          </div>
        </article>

        <article className="compare-card network-card">
          <div className="compare-card-heading">
            <div>
              <p className="compare-eyebrow">NETWORK EVIDENCE</p>
              <h2>How the eras connect</h2>
            </div>
            <span className={`confidence-chip ${comparison.dataScore < 66 ? 'caution' : ''}`}>{comparison.confidenceLabel}</span>
          </div>
          {routeNames.length ? (
            <ol className="evidence-route">
              {routeNames.map((step, index) => (
                <li key={`${step.from}-${step.to}-${step.label}`}>
                  <span className="route-index">{index + 1}</span>
                  <div>
                    <strong>{step.fromName} <i>↔</i> {step.toName}</strong>
                    <p>{step.label}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="network-empty">
              <strong>No short teammate chain in this calibration.</strong>
              <p>The result remains visible, but its range is deliberately wide until more linked observations are added.</p>
            </div>
          )}
          <div className="network-footer">
            <span>{comparison.isDirect ? 'Direct teammates' : `${routeNames.length || 'No'} linked teammate hop${routeNames.length === 1 ? '' : 's'}`}</span>
            <strong>{comparison.dataScore}/100 evidence confidence</strong>
          </div>
        </article>
      </section>

      <section className="compare-grid methodology-grid">
        <article className="compare-card method-card">
          <p className="compare-eyebrow">ERA NORMALISATION</p>
          <h2>Conditions are not eras.</h2>
          <ul>
            <li>Qualifying and race performance are estimated separately before combination.</li>
            <li>Points and raw win totals are contextual evidence, never the comparison outcome.</li>
            <li>Only clean, classified two-car teammate race results enter the race component.</li>
            <li>Older records receive wider intervals when timing depth or network links are thinner.</li>
          </ul>
        </article>
        <article className="compare-card sources-card">
          <div className="compare-card-heading">
            <div>
              <p className="compare-eyebrow">FREE DATA STACK</p>
              <h2>Sources and coverage</h2>
            </div>
            <span className={`source-pulse ${sourceState.loading ? 'checking' : ''}`}>
              {sourceState.loading ? 'Checking' : 'Live status'}
            </span>
          </div>
          <div className="source-list">
            {comparison.sources.map((source) => {
              const live = sourceState.sources.find((item) => item.id === source.id);
              return (
                <a href={source.href} target="_blank" rel="noreferrer" key={source.name}>
                  <span className={`source-dot ${sourceState.loading ? 'pending' : live?.available ? 'online' : 'offline'}`} />
                  <span><strong>{source.name}</strong><small>{source.scope}</small></span>
                  <em>{source.role}</em>
                </a>
              );
            })}
          </div>
          <p className="sources-footnote">
            The screen uses a versioned fitted snapshot so upstream outages cannot silently rewrite a comparison.
            Provider checks above are informational; no key, paid plan or user tracking is required.
          </p>
        </article>
      </section>

      <footer className="compare-footer">
        <span>FLARE / Cross-era lab</span>
        <span>Confidence is part of the answer.</span>
        <Link href="/">Return to career comparison →</Link>
      </footer>
    </main>
  );
}
