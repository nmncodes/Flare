'use client';

import { getFallbackAvatar } from '../api.js';
import { CountryTag, SwapIcon } from './Icons.js';

export default function DriverCard({ driver, bio, side, onOpenModal }) {
  if (!driver) return null;

  const color = driver.color || (side === 'A' ? '#0d9488' : '#e10600');
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
          <span className="driver-num-tag" id={`num${side}`}>#{driver.number || '-'}</span>
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
        <div className="driver-telemetry-tag" id={`code${side}`}>{driver.code || 'F1'}</div>
        <h2 className="driver-full-name" id={`name${side}`}>{driver.name}</h2>
        <div className="driver-career-span" id={`activeYears${side}`}>{driver.activeYears || 'Historical Driver'}</div>
        <div className="driver-nationality" id={`nationality${side}`}>{driver.nationality || 'International'}</div>
        <div className="team-pills" id={`teams${side}`}>{teamsFormatted}</div>
      </div>

      {driver.quote && (
        <div className="driver-quote-box">
          <p className="quote-text" id={`quote${side}`}>
            {driver.quote}
          </p>
        </div>
      )}
    </article>
  );
}
