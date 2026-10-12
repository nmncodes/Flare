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
        <div>
          ⚔️ <strong>Direct On-Track Contemporaries:</strong> Both drivers shared the grid during the{' '}
          <strong>{overlapStart}–{overlapEnd}</strong> seasons (approx. {overlapYears} concurrent year{overlapYears > 1 ? 's' : ''}). They fought under the same technical regulations.
        </div>
      );
    } else {
      const gap = overlapStart - overlapEnd;
      overlapContent = (
        <div>
          ⏳ <strong>Cross-Era Fantasy Duel:</strong> These legends raced in different eras, separated by approximately{' '}
          <strong>{gap} seasons</strong>. Comparing them requires normalizing car reliability and points systems across eras.
        </div>
      );
    }
  } else {
    overlapContent = <div>Comparing historical careers across Formula 1 regulations.</div>;
  }

  return (
    <div className="analytics-card era-card">
      <div className="card-inner-header">
        <div>
          <div className="badge-accent">HISTORICAL BENCHMARK</div>
          <h4 className="card-title">Era Overlap & Dossier</h4>
        </div>
      </div>

      <div className="era-status-box" id="overlapBox">
        <div className="overlap-status-title">ERA COMPARISON BENCHMARK</div>
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
