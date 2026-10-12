'use client';

import { useState, useMemo } from 'react';

export default function DriverModal({
  isOpen,
  onClose,
  targetSide,
  curatedDrivers,
  historicalDrivers,
  onSelectDriver
}) {
  const [activeTab, setActiveTab] = useState('curated');
  const [searchQuery, setSearchQuery] = useState('');

  const displayList = useMemo(() => {
    const list = activeTab === 'curated' ? curatedDrivers : (historicalDrivers.length ? historicalDrivers : curatedDrivers);
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;

    return list.filter(d =>
      (d.name && d.name.toLowerCase().includes(q)) ||
      (d.code && d.code.toLowerCase().includes(q)) ||
      (d.nationality && d.nationality.toLowerCase().includes(q))
    );
  }, [activeTab, curatedDrivers, historicalDrivers, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" style={{ display: 'flex' }} onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h3 className="modal-title">Select Driver {targetSide}</h3>
            <p className="modal-subtitle">Choose from Hall of Fame legends or search all 850+ historical drivers</p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Search Input */}
        <div className="modal-search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="driver-search-input"
            placeholder="Search driver by name, country, or code..."
            autoComplete="off"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          {searchQuery && (
            <button
              className="clear-search-btn"
              style={{ display: 'block' }}
              onClick={() => setSearchQuery('')}
            >
              ✕
            </button>
          )}
        </div>

        {/* Category Tabs */}
        <div className="modal-tabs">
          <button
            className={`tab-btn ${activeTab === 'curated' ? 'active' : ''}`}
            onClick={() => setActiveTab('curated')}
          >
            ⭐ Curated Legends (Instant)
          </button>
          <button
            className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            🌍 All Historical Drivers (850+)
          </button>
        </div>

        {/* Driver List */}
        <div className="modal-driver-list">
          {displayList.length === 0 ? (
            <div className="modal-empty-state">
              <span className="empty-icon">🏎️</span>
              <p>No drivers found matching &quot;{searchQuery}&quot;</p>
            </div>
          ) : (
            displayList.map((driver) => {
              const isCurated = typeof driver.wins === 'number';
              return (
                <div
                  key={driver.id}
                  className="driver-pick-item"
                  onClick={() => {
                    onSelectDriver(driver.id);
                    onClose();
                  }}
                >
                  <div className="pick-flag">{driver.flag || '🏁'}</div>
                  <div className="pick-info">
                    <div className="pick-name">
                      {driver.name}{' '}
                      <span className="pick-code">({driver.code})</span>
                    </div>
                    <div className="pick-sub">
                      {driver.activeYears || 'Historical Driver'} • {driver.nationality}
                    </div>
                  </div>
                  {isCurated && (
                    <div className="pick-stats">
                      <span className="pick-stat-pill">🏆 {driver.championships}</span>
                      <span className="pick-stat-pill">🥇 {driver.wins}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
