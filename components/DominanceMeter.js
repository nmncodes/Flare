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
      <>
        ⚖️ <strong>Dead Heat:</strong> Historical metrics rate both drivers in an exceptionally close statistical dead-heat across eras.
      </>
    );
  } else {
    verdictSummary = (
      <>
        ⚡ <strong>Career Edge:</strong> <strong>{edgeDriver.name}</strong> holds the overall career index edge (+{leadDiff}%), powered by superior titles and victory conversion.
      </>
    );
  }

  return (
    <div className="versus-hub">
      <div className="vs-emblem">
        <div className="vs-glow"></div>
        <span className="vs-text">VS</span>
      </div>

      <div className="dominance-meter-card">
        <div className="dom-header">
          <span className="dom-title">⚡ CAREER DOMINANCE INDEX</span>
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
