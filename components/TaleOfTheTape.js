'use client';

import {
  TrophyIcon,
  FlagIcon,
  TrendIcon,
  TimerIcon,
  PodiumIcon,
  TargetIcon,
  BoltIcon,
  GridIcon,
  PointsIcon
} from './Icons.js';

export default function TaleOfTheTape({ driverA, driverB, metrics }) {
  if (!driverA || !driverB || !metrics) return null;

  const stats = [
    {
      name: 'World Championships',
      desc: 'WDC Titles Won',
      valA: driverA.championships,
      valB: driverB.championships,
      displayA: driverA.championships,
      displayB: driverB.championships,
      maxVal: Math.max(driverA.championships, driverB.championships, 1),
      icon: <TrophyIcon size={14} />
    },
    {
      name: 'Grand Prix Wins',
      desc: 'Total Race Victories',
      valA: driverA.wins,
      valB: driverB.wins,
      displayA: driverA.wins,
      displayB: driverB.wins,
      maxVal: Math.max(driverA.wins, driverB.wins, 1),
      icon: <FlagIcon size={14} />
    },
    {
      name: 'Win Rate %',
      desc: 'Victories / Starts',
      valA: parseFloat(metrics.winRateA),
      valB: parseFloat(metrics.winRateB),
      displayA: `${metrics.winRateA}%`,
      displayB: `${metrics.winRateB}%`,
      maxVal: Math.max(parseFloat(metrics.winRateA), parseFloat(metrics.winRateB), 1),
      icon: <TrendIcon size={14} />
    },
    {
      name: 'Pole Positions',
      desc: 'P1 Qualifying Starts',
      valA: driverA.poles,
      valB: driverB.poles,
      displayA: driverA.poles,
      displayB: driverB.poles,
      maxVal: Math.max(driverA.poles, driverB.poles, 1),
      icon: <TimerIcon size={14} />
    },
    {
      name: 'Podium Finishes',
      desc: 'Top 3 Finishes',
      valA: driverA.podiums,
      valB: driverB.podiums,
      displayA: driverA.podiums,
      displayB: driverB.podiums,
      maxVal: Math.max(driverA.podiums, driverB.podiums, 1),
      icon: <PodiumIcon size={14} />
    },
    {
      name: 'Podium Rate %',
      desc: 'Podiums / Starts',
      valA: parseFloat(metrics.podiumRateA),
      valB: parseFloat(metrics.podiumRateB),
      displayA: `${metrics.podiumRateA}%`,
      displayB: `${metrics.podiumRateB}%`,
      maxVal: Math.max(parseFloat(metrics.podiumRateA), parseFloat(metrics.podiumRateB), 1),
      icon: <TargetIcon size={14} />
    },
    {
      name: 'Fastest Laps',
      desc: 'Official Race Fastest Laps',
      valA: driverA.fastestLaps || 0,
      valB: driverB.fastestLaps || 0,
      displayA: driverA.fastestLaps || 0,
      displayB: driverB.fastestLaps || 0,
      maxVal: Math.max(driverA.fastestLaps || 0, driverB.fastestLaps || 0, 1),
      icon: <BoltIcon size={14} />
    },
    {
      name: 'Race Starts',
      desc: 'Grand Prix Participations',
      valA: driverA.starts,
      valB: driverB.starts,
      displayA: driverA.starts,
      displayB: driverB.starts,
      maxVal: Math.max(driverA.starts, driverB.starts, 1),
      icon: <GridIcon size={14} />
    },
    {
      name: 'Career Points',
      desc: 'Official FIA Championship Points',
      valA: driverA.points || 0,
      valB: driverB.points || 0,
      displayA: Math.round(driverA.points || 0).toLocaleString(),
      displayB: Math.round(driverB.points || 0).toLocaleString(),
      maxVal: Math.max(driverA.points || 0, driverB.points || 0, 1),
      icon: <PointsIcon size={14} />
    }
  ];

  return (
    <section className="analytics-section">
      <div className="section-title-bar">
        <div className="section-title-tag">HEAD-TO-HEAD METRICS</div>
        <h3 className="section-heading">Tale of the Tape</h3>
        <p className="section-subtext">Direct statistical comparison normalized across all career starts</p>
      </div>

      <div className="stat-table-card">
        <div className="stat-table-header">
          <div className="table-header-a">{driverA.name}</div>
          <div className="table-header-mid">METRIC BREAKDOWN</div>
          <div className="table-header-b">{driverB.name}</div>
        </div>

        <div className="stat-rows" id="statRows">
          {stats.map((s, idx) => {
            const isWinnerA = s.valA > s.valB;
            const isWinnerB = s.valB > s.valA;
            const pctA = Math.round((s.valA / s.maxVal) * 100);
            const pctB = Math.round((s.valB / s.maxVal) * 100);

            return (
              <div key={idx} className="stat-row">
                {/* Value A */}
                <div className={`stat-val stat-val-a ${isWinnerA ? 'winner' : ''}`}>
                  {s.displayA}
                  {isWinnerA && <span className="winner-pill">P1</span>}
                </div>

                {/* Bar A */}
                <div className="stat-bar-container stat-bar-container-a">
                  <div
                    className="stat-fill-bar stat-fill-a"
                    style={{ width: `${pctA}%` }}
                  ></div>
                </div>

                {/* Center Metric Label */}
                <div className="stat-label-col">
                  <div className="stat-name">
                    <span className="stat-icon-wrapper">{s.icon}</span>
                    <span>{s.name}</span>
                  </div>
                  <div className="stat-desc">{s.desc}</div>
                </div>

                {/* Bar B */}
                <div className="stat-bar-container stat-bar-container-b">
                  <div
                    className="stat-fill-bar stat-fill-b"
                    style={{ width: `${pctB}%` }}
                  ></div>
                </div>

                {/* Value B */}
                <div className={`stat-val stat-val-b ${isWinnerB ? 'winner' : ''}`}>
                  {isWinnerB && <span className="winner-pill">P1</span>}
                  {s.displayB}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
