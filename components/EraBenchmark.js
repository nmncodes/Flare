'use client';

export default function EraBenchmark({ driverA, driverB, bioA, bioB }) {
  if (!driverA || !driverB) return null;

  const getYears = (str) => {
    if (!str) return [];
    const matches = str.match(/\d{4}/g);
    return matches ? matches.map(Number) : [];
  };

  const yearsA = getYears(driverA.activeYears);
  const yearsB = getYears(driverB.activeYears);

  let overlapContent;
  if (yearsA.length && yearsB.length) {
    const minA = Math.min(...yearsA);
    const maxA = Math.max(...yearsA);
    const minB = Math.min(...yearsB);
    const maxB = Math.max(...yearsB);

    const overlapStart = Math.max(minA, minB);
    const overlapEnd = Math.min(maxA, maxB);

    if (overlapStart <= overlapEnd) {
      const overlapYears = overlapEnd - overlapStart + 1;
      overlapContent = (
        <div className="overlap-detail">
          <span className="era-status-tag tag-contemporary">DIRECT CONTEMPORARIES</span>
          <p>
            Both drivers competed on-track during the <strong>{overlapStart}–{overlapEnd}</strong> seasons ({overlapYears} concurrent year{overlapYears > 1 ? 's' : ''}) under unified FIA sporting regulations.
          </p>
        </div>
      );
    } else {
      const gap = overlapStart - overlapEnd;
      overlapContent = (
        <div className="overlap-detail">
          <span className="era-status-tag tag-cross-era">CROSS-ERA COMPARISON</span>
          <p>
            Raced in distinct regulatory epochs separated by approximately <strong>{gap} seasons</strong>. Performance is evaluated on normalized era dominance.
          </p>
        </div>
      );
    }
  } else {
    overlapContent = (
      <div className="overlap-detail">
        <p>Cross-era Formula 1 career comparison.</p>
      </div>
    );
  }

  return (
    <div className="analytics-card era-card">
      <div className="card-inner-header">
        <div>
          <div className="badge-accent">REGULATION BENCHMARK</div>
          <h4 className="card-title">Era Overlap & Dossier</h4>
        </div>
      </div>

      <div className="era-status-box" id="overlapBox">
        {overlapContent}
      </div>

      <div className="bio-dossiers">
        <div className="bio-item bio-item-a">
          <div className="bio-name-tag" id="bioNameA">{driverA.name}</div>
          <p className="bio-text" id="bioTextA">
            {bioA?.extract || 'Formula 1 racing driver.'}
          </p>
        </div>
        <div className="bio-item bio-item-b">
          <div className="bio-name-tag" id="bioNameB">{driverB.name}</div>
          <p className="bio-text" id="bioTextB">
            {bioB?.extract || 'Formula 1 racing driver.'}
          </p>
        </div>
      </div>
    </div>
  );
}
