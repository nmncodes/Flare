'use client';

export default function DriverCard({ driver, bio, side, onOpenModal }) {
  if (!driver) return null;

  const color = driver.color || (side === 'A' ? '#00D2BE' : '#E10600');
  const teamsFormatted = (driver.teams || ['F1 Team']).join(' • ');

  return (
    <article
      className="driver-card"
      id={`cardDriver${side}`}
      style={{ '--driver-color': color }}
    >
      <div className="card-glass-header">
        <div className="driver-badge-group">
          <span className="flag-icon" id={`flag${side}`}>{driver.flag || '🏁'}</span>
          <span className="driver-num-tag" id={`num${side}`}>{driver.number || '-'}</span>
        </div>
        <button
          className="driver-change-btn"
          id={`btnSelect${side}`}
          onClick={() => onOpenModal(side)}
        >
          <span>⇄ Change Driver</span>
        </button>
      </div>

      <div className="driver-portrait-container">
        <div className="portrait-glow-ring" id={`ring${side}`}></div>
        <img
          src={bio?.image || ''}
          alt={`${driver.name} portrait`}
          className="driver-portrait-img"
          id={`img${side}`}
        />
      </div>

      <div className="driver-meta">
        <div className="driver-telemetry-tag" id={`code${side}`}>{driver.code || 'F1'}</div>
        <h2 className="driver-full-name" id={`name${side}`}>{driver.name}</h2>
        <div className="driver-career-span" id={`activeYears${side}`}>{driver.activeYears || 'Historical Driver'}</div>
        <div className="driver-nationality" id={`nationality${side}`}>{driver.nationality || 'International'}</div>
        <div className="team-pills" id={`teams${side}`}>{teamsFormatted}</div>
      </div>

      <div className="driver-quote-box">
        <span className="quote-mark">“</span>
        <p className="quote-text" id={`quote${side}`}>
          &ldquo;{driver.quote || 'Pushing for victory.'}&rdquo;
        </p>
      </div>
    </article>
  );
}
