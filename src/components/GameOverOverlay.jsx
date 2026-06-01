import React from 'react'
import narratorThreat from '../assets/sprites/narrator/pose_threat.png'
import './GameOverOverlay.css'

export default function GameOverOverlay({ reason, score, year, onReturn }) {
  return (
    <div className="goo">
      <div className="goo__box">
        <div className="goo__narrator-wrap">
          <img className="goo__narrator" src={narratorThreat} alt="" />
        </div>
        <div className="goo__content">
          <div className="goo__title">Island Reassigned.</div>
          <div className="goo__year">Year {year}</div>
          <div className="goo__reason">{reason}</div>
          <div className="goo__stats">
            <span className="concept-badge">Ecosystem Collapse</span>
            <span className="goo__score">Final health: {score}</span>
          </div>
          <button className="pixel-btn goo__btn" onClick={onReturn}>
            ← Return to Islands
          </button>
        </div>
      </div>
    </div>
  )
}
