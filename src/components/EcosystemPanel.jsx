import React from 'react'
import { EVENTS, K } from '../simulation/engine.js'
import { SPRITE_ICONS } from '../utils/spriteIcons.js'
import './EcosystemPanel.css'

// ── Food Web SVG diagram ─────────────────────────────────────────────

const FW_NODES = [
  { id: 'hawk',    x: 200, y: 28,  r: 22, name: 'Hawk',    level: 'Apex'       },
  { id: 'frog',    x: 68,  y: 100, r: 22, name: 'Frog',    level: 'Secondary'  },
  { id: 'boar',    x: 200, y: 100, r: 22, name: 'Boar',    level: 'Secondary'  },
  { id: 'monitor', x: 332, y: 100, r: 22, name: 'Monitor', level: 'Secondary'  },
  { id: 'deer',    x: 86,  y: 178, r: 22, name: 'Deer',    level: 'Primary'    },
  { id: 'firefly', x: 200, y: 178, r: 17, name: 'Firefly', level: 'Primary'    },
  { id: 'beetle',  x: 314, y: 178, r: 22, name: 'Beetle',  level: 'Primary'    },
  { id: 'grass',   x: 82,  y: 252, r: 22, name: 'Grass',   level: 'Producer'   },
  { id: 'tree',    x: 232, y: 252, r: 22, name: 'Fig Tree', level: 'Producer'  },
  { id: 'fungi',   x: 158, y: 292, r: 16, name: 'Fungi',   level: 'Decomposer' },
]

const FW_NODE_MAP = Object.fromEntries(FW_NODES.map(n => [n.id, n]))

// Arrows go from prey → predator (energy flow direction)
const FW_EDGES = [
  { from: 'grass',   to: 'deer'    },
  { from: 'grass',   to: 'boar'    },
  { from: 'firefly', to: 'frog'    },
  { from: 'tree',   to: 'beetle'  },
  { from: 'tree',   to: 'boar'    },
  { from: 'beetle', to: 'frog'    },
  { from: 'beetle', to: 'boar'    },
  { from: 'beetle', to: 'monitor' },
  { from: 'deer',   to: 'hawk'    },
  { from: 'frog',   to: 'hawk'    },
  { from: 'frog',   to: 'monitor', curved: true },  // same-row edge — arc below
  { from: 'boar',   to: 'monitor', curved: true, curveUp: true },  // same-row — arc above
]

const FW_COLORS = {
  grass: '#4caf50', tree: '#2e7d32', fungi: '#ab47bc',
  beetle: '#c46200', deer: '#c8a070', frog: '#00acc1',
  boar: '#bf8a50', monitor: '#5ca048', hawk: '#e85040',
  firefly: '#c8e832',
}

function fwNodeState(id, arrivedSpecies, pops) {
  if (!arrivedSpecies?.has(id)) return 'pending'
  if ((pops[id] ?? 0) < 1)    return 'extinct'
  return 'alive'
}

function fwEdgePts(fromN, toN) {
  const dx = toN.x - fromN.x, dy = toN.y - fromN.y
  const dist = Math.sqrt(dx * dx + dy * dy) || 1
  const ux = dx / dist, uy = dy / dist
  return {
    x1: fromN.x + ux * fromN.r,
    y1: fromN.y + uy * fromN.r,
    x2: toN.x - ux * (toN.r + 5),
    y2: toN.y - uy * (toN.r + 5),
  }
}

function FoodWebDiagram({ pops, arrivedSpecies }) {
  return (
    <svg viewBox="0 0 400 322" width="100%" style={{ display: 'block' }}>
      <defs>
        <marker id="fw-arr-live" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
          <polygon points="0,0 5,2.5 0,5" fill="rgba(120,80,40,0.55)" />
        </marker>
        <marker id="fw-arr-dead" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
          <polygon points="0,0 5,2.5 0,5" fill="rgba(160,80,60,0.35)" />
        </marker>
      </defs>

      {/* Level row labels — right side */}
      {[
        { label: 'Apex',       y: 28  },
        { label: 'Secondary',  y: 100 },
        { label: 'Primary',    y: 178 },
        { label: 'Producer',   y: 252 },
        { label: 'Decomposer', y: 292 },
      ].map(({ label, y }) => (
        <text key={label} x={397} y={y + 3} textAnchor="end" fontSize={5}
          fill="rgba(120,90,60,0.38)" fontFamily="'Press Start 2P', monospace">
          {label}
        </text>
      ))}

      {/* Edges */}
      {FW_EDGES.map(edge => {
        const fromN = FW_NODE_MAP[edge.from]
        const toN   = FW_NODE_MAP[edge.to]
        const srcState = fwNodeState(edge.from, arrivedSpecies, pops)
        const dstState = fwNodeState(edge.to, arrivedSpecies, pops)
        if (srcState === 'pending' || dstState === 'pending') return null

        const alive  = srcState === 'alive' && dstState === 'alive'
        const pts    = fwEdgePts(fromN, toN)
        const stroke = alive ? 'rgba(120,80,40,0.45)' : 'rgba(160,80,60,0.22)'
        const marker = alive ? 'url(#fw-arr-live)' : 'url(#fw-arr-dead)'
        const dash   = alive ? '' : '3,3'

        if (edge.curved) {
          const mx = (fromN.x + toN.x) / 2
          const curveDir = edge.curveUp ? -32 : 32
          const my = (fromN.y + toN.y) / 2 + curveDir
          return (
            <path key={`${edge.from}-${edge.to}`}
              d={`M ${pts.x1},${pts.y1} Q ${mx},${my} ${pts.x2},${pts.y2}`}
              fill="none" stroke={stroke} strokeWidth={alive ? 1.4 : 0.9}
              strokeDasharray={dash} markerEnd={marker}
            />
          )
        }

        return (
          <line key={`${edge.from}-${edge.to}`}
            x1={pts.x1} y1={pts.y1} x2={pts.x2} y2={pts.y2}
            stroke={stroke} strokeWidth={alive ? 1.4 : 0.9}
            strokeDasharray={dash} markerEnd={marker}
          />
        )
      })}

      {/* Nodes */}
      {FW_NODES.map(node => {
        const { id, x, y, r, name } = node
        const state  = fwNodeState(id, arrivedSpecies, pops)
        const color  = state === 'alive'   ? FW_COLORS[id]
                     : state === 'extinct' ? '#8d6e63'
                     :                      '#d4c4b8'
        const opacity = state === 'pending' ? 0.28 : 1
        const pop     = state === 'alive' ? Math.round(pops[id] ?? 0) : null
        const isFungi = id === 'fungi'
        const iconSize = r * 1.55

        return (
          <g key={id} opacity={opacity}>
            <circle cx={x} cy={y} r={r}
              fill={color}
              stroke={state === 'extinct' ? '#c62828' : 'rgba(60,40,20,0.35)'}
              strokeWidth={state === 'extinct' ? 2 : 1.5}
              strokeDasharray={isFungi ? '4,2' : ''}
            />
            {state === 'extinct'
              ? <text x={x} y={y + 4} textAnchor="middle" dominantBaseline="middle" fontSize={14} fill="rgba(255,255,255,0.75)">✕</text>
              : SPRITE_ICONS[id]
                ? <image href={SPRITE_ICONS[id]} x={x - iconSize/2} y={y - iconSize/2} width={iconSize} height={iconSize} style={{ imageRendering: 'pixelated' }} />
                : null
            }
            <text x={x} y={y + r + 9} textAnchor="middle" fontSize={5}
              fill="var(--color-text)" fontFamily="'Press Start 2P', monospace">
              {name}
            </text>
            {pop !== null && (
              <text x={x} y={y + r + 17} textAnchor="middle" fontSize={5}
                fill="var(--color-text-dim)" fontFamily="'Press Start 2P', monospace">
                {pop}
              </text>
            )}
          </g>
        )
      })}

      {/* Legend */}
      <g transform="translate(4, 308)">
        <circle cx={5}  cy={4} r={4} fill="#4caf50" opacity={0.9} />
        <text x={12} y={7} fontSize={5} fill="rgba(120,90,60,0.6)">alive</text>
        <circle cx={50} cy={4} r={4} fill="#d4c4b8" opacity={0.5} />
        <text x={57} y={7} fontSize={5} fill="rgba(120,90,60,0.6)">pending</text>
        <circle cx={105} cy={4} r={4} fill="#8d6e63" stroke="#c62828" strokeWidth={1.2} />
        <text x={112} y={7} fontSize={5} fill="rgba(120,90,60,0.6)">extinct</text>
        <text x={165} y={7} fontSize={5} fill="rgba(120,90,60,0.5)">→ energy flow</text>
      </g>
    </svg>
  )
}

const POP_DISPLAY = [
  { id: 'grass',   color: '#4caf50' },
  { id: 'tree',    color: '#2e7d32' },
  { id: 'fungi',   color: '#ce93d8' },
  { id: 'beetle',  color: '#8d6e63' },
  { id: 'deer',    color: '#a5d6a7' },
  { id: 'frog',    color: '#66bb6a' },
  { id: 'boar',    color: '#bf8a50' },
  { id: 'monitor', color: '#78909c' },
  { id: 'hawk',    color: '#ff7043' },
]

const CALM = { title: 'Calm conditions', desc: 'No active events. The island is stable.', concept: null }

export default function EcosystemPanel({ event, log = [], deadMatter = 0, pops = {}, arrivedSpecies }) {
  const activeDef = event ? EVENTS[event.id] : null
  const display   = activeDef
    ? { title: activeDef.title, desc: activeDef.desc, concept: activeDef.concept }
    : CALM

  return (
    <div className="ecosystem-panel">

      {/* Active event */}
      <div className={`event-banner pixel-box ${activeDef ? 'event-banner--active' : ''}`}>
        <span className="section-label">Active Event</span>
        <div className="event-banner__content">
          <div>
            <div className="event-banner__title">{display.title}</div>
            <div className="event-banner__desc">{display.desc}</div>
          </div>
        </div>
        {activeDef && (
          <div className="event-banner__meta">
            <span className="concept-badge">{display.concept}</span>
            <span className="event-banner__ticks">{event.ticksLeft} ticks left</span>
          </div>
        )}
      </div>

      {/* Population bars */}
      <div className="eco-pops pixel-box">
        <div className="eco-pops__header">
          <span className="section-label">Populations</span>
          <span className="concept-badge">Carrying Capacity</span>
          <span className="concept-badge">Logistic Growth</span>
        </div>
        {POP_DISPLAY.filter(({ id }) => !arrivedSpecies || arrivedSpecies.has(id)).map(({ id, color }) => {
          const pop = pops[id] ?? 0
          const cap = K[id] ?? 300
          const pct = Math.min(100, (pop / cap) * 100)
          const extinct = pop < 1
          return (
            <div key={id} className="eco-pop-row">
              <img src={SPRITE_ICONS[id]} className="eco-pop-row__emoji" style={{ imageRendering: 'pixelated' }} alt={id} />
              <div className="eco-pop-row__track">
                <div
                  className="eco-pop-row__fill"
                  style={{ width: `${pct}%`, background: extinct ? '#6a5a50' : color }}
                />
                <div className="eco-pop-row__cap-line" />
              </div>
              <span className={`eco-pop-row__val ${extinct ? 'eco-pop-row__val--extinct' : ''}`}>
                {extinct ? 'EXT' : Math.round(pop)}
              </span>
              <span className="eco-pop-row__cap">/{cap}</span>
            </div>
          )
        })}
        <div className="eco-pops__hint">Bar = current · Line = carrying capacity K</div>
      </div>

      {/* Dead matter */}
      <div className="dead-matter pixel-box">
        <span className="section-label">Dead Matter</span>
        <div className="dead-matter__row">
          <div className="dead-matter__bar">
            <div className="dead-matter__fill" style={{ width: `${Math.min(100, deadMatter / 6)}%` }} />
          </div>
          <span className="dead-matter__val">{Math.round(deadMatter)}</span>
          <span className="concept-badge">Decomposition</span>
        </div>
        <div className="dead-matter__hint">Fungi break down dead matter → nutrients → producer growth</div>
      </div>

      {/* Food web */}
      <div className="food-web pixel-box">
        <span className="section-label">Food Web</span>
        <div className="food-web__badges">
          <span className="concept-badge">Trophic Levels</span>
          <span className="concept-badge">Energy Flow</span>
          <span className="concept-badge">Autotrophs / Heterotrophs</span>
        </div>
        <FoodWebDiagram pops={pops} arrivedSpecies={arrivedSpecies} />
      </div>

      {/* Event log */}
      {log.length > 0 && (
        <div className="event-log pixel-box">
          <span className="section-label">Event Log</span>
          <div className="event-log__rows">
            {log.map((entry, i) => (
              <div key={i} className="event-log__row">
                <span className="event-log__title">{entry.title}</span>
                <span className="event-log__year">Yr {entry.year}</span>
                {entry.concept && <span className="concept-badge">{entry.concept}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
