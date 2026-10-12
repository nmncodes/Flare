'use client';

export default function DominanceMeter({ driverA, driverB, metrics }) {
  if (!driverA || !driverB || !metrics) return null;

  const pctA = metrics.dominancePctA;
  const pctB = metrics.dominancePctB;

  const edgeDriver = pctA >= pctB ? driverA : driverB;
  const leadDiff = Math.abs(pctA - pctB);

  let verdictSummary;
  if (leadDiff < 6) {
    verdictSummary = (
      <div className="verdict-content">
        <span className="verdict-badge badge-neutral">PARITY</span>
        <span className="verdict-copy">Statistical dead-heat across normalized career metrics.</span>
      </div>
    );
  } else {
    verdictSummary = (
      <div className="verdict-content">
        <span className="verdict-badge badge-lead">+{leadDiff}% {edgeDriver.name.split(' ').pop().toUpperCase()}</span>
        <span className="verdict-copy">Holds overall career index advantage based on title conversion and victory rate.</span>
      </div>
    );
  }

  return (
    <div className="versus-hub">
      <div className="vs-emblem">
        <span className="vs-text">VS</span>
      </div>

      <div className="dominance-meter-card">
        <div className="dom-header">
          <span className="dom-title">DOMINANCE INDEX</span>
          <div className="dom-values">
            <span className="dom-val-a" id="domValA">{pctA}%</span>
            <span className="dom-split">/</span>
            <span className="dom-val-b" id="domValB">{pctB}%</span>
          </div>
        </div>

        <div className="dominance-track">
          <div
            className="dom-bar dom-bar-a"
            id="domBarA"
            style={{ width: `${pctA}%` }}
          ></div>
          <div
            className="dom-bar dom-bar-b"
            id="domBarB"
            style={{ width: `${pctB}%` }}
          ></div>
          <div className="dom-notch"></div>
        </div>

        <div className="dominance-verdict" id="duelVerdict">
          {verdictSummary}
        </div>
      </div>
    </div>
  );
}
