import React from 'react'
import './Header.css'

const SPEEDS = [0, 1, 2, 4]
const SPEED_LABELS = { 0: 'PAUSE', 1: '1×', 2: '2×', 4: '4×' }

export default function Header({ year, speed, onSpeedChange }) {
  return (
    <header className="header">
      <div className="header__title">
        <span className="header__title-icon">🏝</span>
        <span className="header__title-text">Island of Life</span>
      </div>

      <div className="header__year">
        Year <span className="header__year-num">{year}</span>
      </div>

      <div className="header__speed">
        {SPEEDS.map(s => (
          <button
            key={s}
            className={`speed-btn ${speed === s ? 'speed-btn--active' : ''}`}
            onClick={() => onSpeedChange(s)}
          >
            {SPEED_LABELS[s]}
          </button>
        ))}
      </div>
    </header>
  )
}
