import React from 'react'
import { EVENTS } from '../simulation/engine.js'
import { SPECIES } from '../data/species.js'
import { SPRITE_ICONS } from '../utils/spriteIcons.js'
import './EventsPanel.css'

const SPECIES_META = Object.fromEntries(SPECIES.map(s => [s.id, s]))

const TROPHIC_COLOR = {
  'Apex Predator':        '#ef5350',
  'Tertiary Consumer':    '#ff7043',
  'Secondary Consumer':   '#ffa726',
  'Primary Consumer':     '#66bb6a',
  'Herbivore Migration':  '#66bb6a',
  'Omnivore':             '#ab8e5a',
  'Producer':             '#4caf50',
  'Primary Producer':     '#4caf50',
  'Decomposer':           '#ce93d8',
}

const CALM = { title: 'Calm conditions', desc: 'No active events. The ecosystem is stable.' }
const CAUSE_LABEL = { starvation: 'starvation', predation: 'predated', age: 'old age', inbreeding: 'inbreeding' }

export default function EventsPanel({ nextArrival, pops = {}, livePops = {}, event, log = [], pressure = 0, deathLog = [] }) {
  const activeDef = event ? EVENTS[event.id] : null
  const envDisplay = activeDef
    ? { title: activeDef.title, desc: activeDef.desc, concept: activeDef.concept }
    : CALM

  const pressureLevel = pressure >= 80 ? 'high' : pressure >= 50 ? 'med' : null

  // Compute arrival progress
  let progress = null
  if (nextArrival?.progressOf) {
    const p = nextArrival.progressOf(pops, livePops)
    progress = { ...p, pct: Math.min(100, Math.round((p.current / p.needed) * 100)) }
  }

  const sp = nextArrival ? SPECIES_META[nextArrival.spId] : null
  const trophicColor = sp ? (TROPHIC_COLOR[nextArrival.concept] ?? '#a09080') : null

  return (
    <div className="events-panel">

      {/* ── Next arrival ─────────────────────────────────────────── */}
      <div className="ep-section pixel-box">
        <div className="ep-section__head">
          <span className="section-label">Next Arrival</span>
          {nextArrival && <span className="concept-badge" style={{ borderColor: trophicColor, color: trophicColor }}>{nextArrival.concept}</span>}
        </div>

        {nextArrival && sp ? (
          <div className="ep-arrival">
            <div className="ep-arrival__preview">
              <img src={SPRITE_ICONS[nextArrival.spId]} className="ep-arrival__emoji" style={{ imageRendering: 'pixelated' }} alt={nextArrival.spId} />
              <div className="ep-arrival__info">
                <span className="ep-arrival__name">{nextArrival.label}</span>
                <span className="ep-arrival__msg">{nextArrival.message}</span>
              </div>
            </div>

            <div className="ep-arrival__condition">
              <span className="ep-arrival__cond-label">Waiting for</span>
              <span className="ep-arrival__trigger">{nextArrival.trigger}</span>
            </div>

            {progress && (
              <div className="ep-arrival__progress">
                <div className="ep-arrival__prog-bar">
                  <div
                    className="ep-arrival__prog-fill"
                    style={{ width: `${progress.pct}%`, background: trophicColor ?? 'var(--color-accent)' }}
                  />
                </div>
                <span className="ep-arrival__prog-nums">
                  {progress.current} / {progress.needed} {progress.unit} — {progress.pct}%
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="ep-arrival ep-arrival--done">
              <span className="ep-arrival__name">All species have arrived</span>
          </div>
        )}
      </div>

      {/* ── Environment ──────────────────────────────────────────── */}
      <div className={`ep-section pixel-box ${activeDef ? 'ep-section--event' : ''}`}>
        <div className="ep-section__head">
          <span className="section-label">Environment</span>
          {activeDef && <span className="concept-badge">{envDisplay.concept}</span>}
        </div>
        <div className="ep-env">
          <div className="ep-env__text">
            <span className="ep-env__title">{envDisplay.title}</span>
            <span className="ep-env__desc">{envDisplay.desc}</span>
          </div>
        </div>
        {activeDef && (
          <div className="ep-env__ticks">{event.ticksLeft} tick{event.ticksLeft !== 1 ? 's' : ''} remaining</div>
        )}
        {!activeDef && pressureLevel && (
          <div className={`ep-pressure ep-pressure--${pressureLevel}`}>
            <div className="ep-pressure__text">
              <span className="ep-pressure__label">
                {pressureLevel === 'high' ? 'Environmental pressure critical' : 'Environmental pressure rising'}
              </span>
              <div className="ep-pressure__bar-wrap">
                <div className="ep-pressure__bar" style={{ width: `${pressure}%` }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Death log ────────────────────────────────────────────── */}
      {deathLog.length > 0 && (
        <div className="ep-section pixel-box">
          <span className="section-label">Recent Deaths</span>
          <span className="concept-badge" style={{ marginLeft: 6, marginBottom: 6, display:'inline-block' }}>Population Dynamics</span>
          <div className="ep-log">
            {deathLog.slice(0, 14).map((entry, i) => {
              const sp = SPECIES_META[entry.spId]
              return (
                <div key={i} className="ep-log__row">
                  <span className="ep-log__title">
                    {entry.count} {sp?.name ?? entry.spId} — {CAUSE_LABEL[entry.cause] ?? entry.cause}
                  </span>
                  <span className="ep-log__year">Yr {entry.year}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Event log ────────────────────────────────────────────── */}
      {log.length > 0 && (
        <div className="ep-section pixel-box">
          <span className="section-label">Event History</span>
          <div className="ep-log">
            {log.map((entry, i) => (
              <div key={i} className="ep-log__row">
                <span className="ep-log__title">{entry.title}</span>
                <span className="ep-log__year">Yr {entry.year}</span>
                {entry.concept && <span className="concept-badge">{entry.concept}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
