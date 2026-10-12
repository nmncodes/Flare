import { CURATED_DRIVERS, ICONIC_MATCHUPS } from './data/drivers.js';
import { getDriverBioAndImage, getAllHistoricalDrivers, fetchLiveDriverStats, calculateDuelMetrics } from './api.js';
import { RadarChart } from './radar.js';

// Application State
const state = {
  driverA: null,
  driverB: null,
  historicalList: [],
  modalTargetSide: 'A', // 'A' or 'B'
  activeModalTab: 'curated',
  radarChart: null
};

// DOM References
const el = {
  // Preset pills
  presetPills: document.getElementById('presetPills'),
  btnRandomBattle: document.getElementById('btnRandomBattle'),
  btnSwapDrivers: document.getElementById('btnSwapDrivers'),

  // Driver A
  cardDriverA: document.getElementById('cardDriverA'),
  btnSelectA: document.getElementById('btnSelectA'),
  flagA: document.getElementById('flagA'),
  numA: document.getElementById('numA'),
  ringA: document.getElementById('ringA'),
  imgA: document.getElementById('imgA'),
  codeA: document.getElementById('codeA'),
  nameA: document.getElementById('nameA'),
  activeYearsA: document.getElementById('activeYearsA'),
  nationalityA: document.getElementById('nationalityA'),
  teamsA: document.getElementById('teamsA'),
  quoteA: document.getElementById('quoteA'),

  // Driver B
  cardDriverB: document.getElementById('cardDriverB'),
  btnSelectB: document.getElementById('btnSelectB'),
  flagB: document.getElementById('flagB'),
  numB: document.getElementById('numB'),
  ringB: document.getElementById('ringB'),
  imgB: document.getElementById('imgB'),
  codeB: document.getElementById('codeB'),
  nameB: document.getElementById('nameB'),
  activeYearsB: document.getElementById('activeYearsB'),
  nationalityB: document.getElementById('nationalityB'),
  teamsB: document.getElementById('teamsB'),
  quoteB: document.getElementById('quoteB'),

  // Versus Hub
  domValA: document.getElementById('domValA'),
  domValB: document.getElementById('domValB'),
  domBarA: document.getElementById('domBarA'),
  domBarB: document.getElementById('domBarB'),
  duelVerdict: document.getElementById('duelVerdict'),

  // Stats table
  statRows: document.getElementById('statRows'),

  // Radar Legend
  legendNameA: document.getElementById('legendNameA'),
  legendNameB: document.getElementById('legendNameB'),

  // Context & Bios
  overlapBox: document.getElementById('overlapBox'),
  bioNameA: document.getElementById('bioNameA'),
  bioTextA: document.getElementById('bioTextA'),
  bioNameB: document.getElementById('bioNameB'),
  bioTextB: document.getElementById('bioTextB'),

  // Modal
  driverModal: document.getElementById('driverModal'),
  modalCloseBtn: document.getElementById('modalCloseBtn'),
  driverSearchInput: document.getElementById('driverSearchInput'),
  clearSearchBtn: document.getElementById('clearSearchBtn'),
  modalDriverList: document.getElementById('modalDriverList'),
  tabBtns: document.querySelectorAll('.tab-btn')
};

// Initialize Application
async function init() {
  state.radarChart = new RadarChart('radarCanvas');

  renderPresetPills();
  bindEventListeners();

  // Load initial matchup from URL hash or default to Hamilton vs Schumacher
  const [initialA, initialB] = parseUrlMatchup();
  await setMatchup(initialA, initialB);

  // Background fetch full historical driver list for search autocomplete
  getAllHistoricalDrivers().then(list => {
    state.historicalList = list;
  });
}

/**
 * Parse URL hash for driver IDs e.g. #hamilton-vs-max_verstappen
 */
function parseUrlMatchup() {
  const hash = window.location.hash.replace('#', '');
  if (hash.includes('-vs-')) {
    const parts = hash.split('-vs-');
    if (parts.length === 2 && parts[0] && parts[1]) {
      return [parts[0], parts[1]];
    }
  }
  return ['hamilton', 'michael_schumacher'];
}

function updateUrlHash() {
  if (state.driverA && state.driverB) {
    history.replaceState(null, '', `#${state.driverA.id}-vs-${state.driverB.id}`);
  }
}

/**
 * Set Driver A and Driver B
 */
async function setMatchup(idA, idB) {
  // Show quick skeleton / pulse effect
  state.driverA = await resolveDriver(idA);
  state.driverB = await resolveDriver(idB);

  updateUrlHash();
  await updateUI();
}

async function resolveDriver(driverId) {
  // Look in curated list first
  const found = CURATED_DRIVERS.find(d => d.id === driverId);
  if (found) return found;

  // Otherwise fetch from Jolpica
  try {
    return await fetchLiveDriverStats(driverId);
  } catch (err) {
    console.error('Failed to resolve driver:', driverId, err);
    return CURATED_DRIVERS[0];
  }
}

/**
 * Render Preset Matchup Pills
 */
function renderPresetPills() {
  el.presetPills.innerHTML = '';
  ICONIC_MATCHUPS.forEach((matchup, idx) => {
    const btn = document.createElement('button');
    btn.className = `preset-pill ${idx === 0 ? 'active' : ''}`;
    btn.innerHTML = `
      <span>${matchup.title}</span>
      <span class="pill-badge">${matchup.badge}</span>
    `;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.preset-pill').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      setMatchup(matchup.driverA, matchup.driverB);
    });
    el.presetPills.appendChild(btn);
  });
}

/**
 * Refresh all UI views with current drivers
 */
async function updateUI() {
  const dA = state.driverA;
  const dB = state.driverB;
  if (!dA || !dB) return;

  const colorA = dA.color || '#00D2BE';
  const colorB = dB.color || '#E10600';

  // Set CSS Custom Properties for dynamic team glowing accents
  document.documentElement.style.setProperty('--color-a', colorA);
  document.documentElement.style.setProperty('--color-b', colorB);
  el.cardDriverA.style.setProperty('--driver-color', colorA);
  el.cardDriverB.style.setProperty('--driver-color', colorB);

  // 1. Driver A Card
  el.nameA.textContent = dA.name;
  el.codeA.textContent = dA.code;
  el.numA.textContent = dA.number;
  el.flagA.textContent = dA.flag || '🏁';
  el.activeYearsA.textContent = dA.activeYears;
  el.nationalityA.textContent = dA.nationality;
  el.teamsA.textContent = (dA.teams || ['F1 Team']).join(' • ');
  el.quoteA.textContent = `"${dA.quote || 'Pushing for victory.'}"`;

  // 2. Driver B Card
  el.nameB.textContent = dB.name;
  el.codeB.textContent = dB.code;
  el.numB.textContent = dB.number;
  el.flagB.textContent = dB.flag || '🏁';
  el.activeYearsB.textContent = dB.activeYears;
  el.nationalityB.textContent = dB.nationality;
  el.teamsB.textContent = (dB.teams || ['F1 Team']).join(' • ');
  el.quoteB.textContent = `"${dB.quote || 'All out attack.'}"`;

  // 3. Parallel fetch portraits and bio summaries
  getDriverBioAndImage(dA.wikiSlug, dA.name).then(bioA => {
    el.imgA.src = bioA.image;
    el.bioNameA.textContent = dA.name;
    el.bioTextA.textContent = bioA.extract;
  });

  getDriverBioAndImage(dB.wikiSlug, dB.name).then(bioB => {
    el.imgB.src = bioB.image;
    el.bioNameB.textContent = dB.name;
    el.bioTextB.textContent = bioB.extract;
  });

  // 4. Compute Metrics
  const metrics = calculateDuelMetrics(dA, dB);

  // Dominance Bar
  el.domValA.textContent = `${metrics.dominancePctA}%`;
  el.domValB.textContent = `${metrics.dominancePctB}%`;
  el.domBarA.style.width = `${metrics.dominancePctA}%`;
  el.domBarB.style.width = `${metrics.dominancePctB}%`;

  // Verdict text
  const edgeDriver = metrics.dominancePctA >= metrics.dominancePctB ? dA : dB;
  const leadDiff = Math.abs(metrics.dominancePctA - metrics.dominancePctB);
  let verdictSummary = '';
  if (leadDiff < 6) {
    verdictSummary = `⚖️ <strong>Dead Heat:</strong> Historical metrics rate both drivers in an exceptionally close statistical dead-heat across eras.`;
  } else {
    verdictSummary = `⚡ <strong>Career Edge:</strong> <strong>${edgeDriver.name}</strong> holds the overall career index edge (+${leadDiff}%), powered by superior titles and victory conversion.`;
  }
  el.duelVerdict.innerHTML = verdictSummary;

  // 5. Tale of the Tape Stat Rows
  renderTaleOfTheTape(dA, dB, metrics);

  // 6. Performance Radar Chart
  el.legendNameA.textContent = dA.name;
  el.legendNameB.textContent = dB.name;
  state.radarChart.update({
    labels: metrics.radarLabels,
    dataA: metrics.radarDataA,
    dataB: metrics.radarDataB,
    colorA: colorA,
    colorB: colorB
  });

  // 7. Historical Context & Era Overlap
  renderEraContext(dA, dB);
}

/**
 * Render Stat Comparison Table with Visual Bars
 */
function renderTaleOfTheTape(dA, dB, metrics) {
  const stats = [
    {
      name: 'World Championships',
      desc: 'WDC Titles Won',
      valA: dA.championships,
      valB: dB.championships,
      displayA: dA.championships,
      displayB: dB.championships,
      maxVal: Math.max(dA.championships, dB.championships, 1),
      icon: '🏆'
    },
    {
      name: 'Grand Prix Wins',
      desc: 'Total Race Victories',
      valA: dA.wins,
      valB: dB.wins,
      displayA: dA.wins,
      displayB: dB.wins,
      maxVal: Math.max(dA.wins, dB.wins, 1),
      icon: '🥇'
    },
    {
      name: 'Win Rate %',
      desc: 'Victories / Starts',
      valA: parseFloat(metrics.winRateA),
      valB: parseFloat(metrics.winRateB),
      displayA: `${metrics.winRateA}%`,
      displayB: `${metrics.winRateB}%`,
      maxVal: Math.max(parseFloat(metrics.winRateA), parseFloat(metrics.winRateB), 1),
      icon: '📈'
    },
    {
      name: 'Pole Positions',
      desc: 'P1 Qualifying Starts',
      valA: dA.poles,
      valB: dB.poles,
      displayA: dA.poles,
      displayB: dB.poles,
      maxVal: Math.max(dA.poles, dB.poles, 1),
      icon: '⏱️'
    },
    {
      name: 'Podium Finishes',
      desc: 'Top 3 Finishes',
      valA: dA.podiums,
      valB: dB.podiums,
      displayA: dA.podiums,
      displayB: dB.podiums,
      maxVal: Math.max(dA.podiums, dB.podiums, 1),
      icon: '🥈'
    },
    {
      name: 'Podium Rate %',
      desc: 'Podiums / Starts',
      valA: parseFloat(metrics.podiumRateA),
      valB: parseFloat(metrics.podiumRateB),
      displayA: `${metrics.podiumRateA}%`,
      displayB: `${metrics.podiumRateB}%`,
      maxVal: Math.max(parseFloat(metrics.podiumRateA), parseFloat(metrics.podiumRateB), 1),
      icon: '🎯'
    },
    {
      name: 'Fastest Laps',
      desc: 'Official Race Fastest Laps',
      valA: dA.fastestLaps || 0,
      valB: dB.fastestLaps || 0,
      displayA: dA.fastestLaps || 0,
      displayB: dB.fastestLaps || 0,
      maxVal: Math.max(dA.fastestLaps || 0, dB.fastestLaps || 0, 1),
      icon: '⚡'
    },
    {
      name: 'Race Starts',
      desc: 'Grand Prix Participations',
      valA: dA.starts,
      valB: dB.starts,
      displayA: dA.starts,
      displayB: dB.starts,
      maxVal: Math.max(dA.starts, dB.starts, 1),
      icon: '🏁'
    },
    {
      name: 'Career Points',
      desc: 'Official FIA Championship Points',
      valA: dA.points || 0,
      valB: dB.points || 0,
      displayA: Math.round(dA.points || 0).toLocaleString(),
      displayB: Math.round(dB.points || 0).toLocaleString(),
      maxVal: Math.max(dA.points || 0, dB.points || 0, 1),
      icon: '🔢'
    }
  ];

  el.statRows.innerHTML = '';

  stats.forEach(s => {
    const isWinnerA = s.valA > s.valB;
    const isWinnerB = s.valB > s.valA;
    const pctA = Math.round((s.valA / s.maxVal) * 100);
    const pctB = Math.round((s.valB / s.maxVal) * 100);

    const row = document.createElement('div');
    row.className = 'stat-row';
    row.innerHTML = `
      <!-- Value A -->
      <div class="stat-val stat-val-a ${isWinnerA ? 'winner' : ''}">
        ${s.displayA}
        ${isWinnerA ? '<span class="winner-badge">▲</span>' : ''}
      </div>

      <!-- Bar A -->
      <div class="stat-bar-container stat-bar-container-a">
        <div class="stat-fill-bar stat-fill-a" style="width: ${pctA}%;"></div>
      </div>

      <!-- Center Metric Label -->
      <div class="stat-label-col">
        <div class="stat-name">${s.icon} ${s.name}</div>
        <div class="stat-desc">${s.desc}</div>
      </div>

      <!-- Bar B -->
      <div class="stat-bar-container stat-bar-container-b">
        <div class="stat-fill-bar stat-fill-b" style="width: ${pctB}%;"></div>
      </div>

      <!-- Value B -->
      <div class="stat-val stat-val-b ${isWinnerB ? 'winner' : ''}">
        ${isWinnerB ? '<span class="winner-badge">▲</span>' : ''}
        ${s.displayB}
      </div>
    `;
    el.statRows.appendChild(row);
  });
}

/**
 * Historical Overlap Description
 */
function renderEraContext(dA, dB) {
  const getYears = (str) => {
    if (!str) return [];
    const matches = str.match(/\d{4}/g);
    return matches ? matches.map(Number) : [];
  };

  const yearsA = getYears(dA.activeYears);
  const yearsB = getYears(dB.activeYears);

  let overlapText = '';
  if (yearsA.length && yearsB.length) {
    const minA = Math.min(...yearsA);
    const maxA = Math.max(...yearsA);
    const minB = Math.min(...yearsB);
    const maxB = Math.max(...yearsB);

    const overlapStart = Math.max(minA, minB);
    const overlapEnd = Math.min(maxA, maxB);

    if (overlapStart <= overlapEnd) {
      const overlapYears = overlapEnd - overlapStart + 1;
      overlapText = `⚔️ <strong>Direct On-Track Contemporaries:</strong> Both drivers shared the grid during the <strong>${overlapStart}–${overlapEnd}</strong> seasons (approx. ${overlapYears} concurrent year${overlapYears > 1 ? 's' : ''}). They fought under the same technical regulations.`;
    } else {
      const gap = overlapStart - overlapEnd;
      overlapText = `⏳ <strong>Cross-Era Fantasy Duel:</strong> These legends raced in different eras, separated by approximately <strong>${gap} seasons</strong>. Comparing them requires normalizing car reliability and points systems across eras.`;
    }
  } else {
    overlapText = `Comparing historical careers across Formula 1 regulations.`;
  }

  el.overlapBox.innerHTML = `
    <div class="overlap-status-title">ERA COMPARISON BENCHMARK</div>
    <div>${overlapText}</div>
  `;
}

/**
 * Open Driver Selector Modal
 */
function openModal(side) {
  state.modalTargetSide = side;
  el.driverSearchInput.value = '';
  el.clearSearchBtn.style.display = 'none';
  el.driverModal.style.display = 'flex';
  renderModalList();
  el.driverSearchInput.focus();
}

function closeModal() {
  el.driverModal.style.display = 'none';
}

/**
 * Render Driver List inside Modal
 */
function renderModalList(filterText = '') {
  el.modalDriverList.innerHTML = '';
  const query = filterText.trim().toLowerCase();

  let list = [];
  if (state.activeModalTab === 'curated') {
    list = CURATED_DRIVERS;
  } else {
    list = state.historicalList.length ? state.historicalList : CURATED_DRIVERS;
  }

  const filtered = list.filter(d => {
    if (!query) return true;
    return (
      d.name.toLowerCase().includes(query) ||
      (d.code && d.code.toLowerCase().includes(query)) ||
      (d.nationality && d.nationality.toLowerCase().includes(query))
    );
  });

  if (filtered.length === 0) {
    el.modalDriverList.innerHTML = `
      <div style="padding: 24px; text-align: center; color: var(--text-dim);">
        No matching driver found. Try searching by surname or code (e.g. "Senna", "HAM").
      </div>
    `;
    return;
  }

  filtered.slice(0, 50).forEach(d => {
    const isCurated = CURATED_DRIVERS.some(cd => cd.id === d.id);
    const item = document.createElement('div');
    item.className = 'modal-driver-item';
    item.innerHTML = `
      <div class="driver-item-left">
        <span class="driver-item-flag">${d.flag || '🏁'}</span>
        <div class="driver-item-info">
          <div class="driver-item-name">${d.name}</div>
          <div class="driver-item-sub">${d.code || 'F1'} • ${d.nationality || 'Grand Prix'}</div>
        </div>
      </div>
      <div class="driver-item-badges">
        ${d.championships ? `<span class="wdc-pill">🏆 ${d.championships}x WDC</span>` : ''}
        ${isCurated ? '<span style="font-size:0.65rem; color:var(--neon-cyan);">★ Legend</span>' : ''}
      </div>
    `;

    item.addEventListener('click', async () => {
      closeModal();
      if (state.modalTargetSide === 'A') {
        state.driverA = await resolveDriver(d.id);
      } else {
        state.driverB = await resolveDriver(d.id);
      }
      updateUrlHash();
      updateUI();
    });

    el.modalDriverList.appendChild(item);
  });
}

/**
 * Event Listeners
 */
function bindEventListeners() {
  // Modal buttons
  el.btnSelectA.addEventListener('click', () => openModal('A'));
  el.btnSelectB.addEventListener('click', () => openModal('B'));
  el.modalCloseBtn.addEventListener('click', closeModal);

  // Close modal on background click or ESC
  el.driverModal.addEventListener('click', (e) => {
    if (e.target === el.driverModal) closeModal();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && el.driverModal.style.display !== 'none') {
      closeModal();
    }
  });

  // Modal tabs
  el.tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      el.tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeModalTab = btn.dataset.tab;
      renderModalList(el.driverSearchInput.value);
    });
  });

  // Search input
  el.driverSearchInput.addEventListener('input', (e) => {
    const val = e.target.value;
    el.clearSearchBtn.style.display = val ? 'block' : 'none';
    renderModalList(val);
  });

  el.clearSearchBtn.addEventListener('click', () => {
    el.driverSearchInput.value = '';
    el.clearSearchBtn.style.display = 'none';
    renderModalList('');
    el.driverSearchInput.focus();
  });

  // Swap Drivers Button
  el.btnSwapDrivers.addEventListener('click', () => {
    const temp = state.driverA;
    state.driverA = state.driverB;
    state.driverB = temp;
    updateUrlHash();
    updateUI();
  });

  // Random Duel Roller
  el.btnRandomBattle.addEventListener('click', () => {
    const pool = CURATED_DRIVERS;
    const idxA = Math.floor(Math.random() * pool.length);
    let idxB = Math.floor(Math.random() * pool.length);
    while (idxB === idxA) {
      idxB = Math.floor(Math.random() * pool.length);
    }
    setMatchup(pool[idxA].id, pool[idxB].id);
  });
}

// Start Application
init();
