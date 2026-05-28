import React, { useState, useEffect, useCallback } from 'react'

const PAD = 14

export default function SpotlightOverlay({ selector, zIndex = 150 }) {
  const [rect, setRect] = useState(null)

  const measure = useCallback(() => {
    if (!selector) { setRect(null); return }
    const el = document.querySelector(selector)
    if (el) setRect(el.getBoundingClientRect())
    else setRect(null)
  }, [selector])

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)

    let obs
    if (selector) {
      const el = document.querySelector(selector)
      if (el) {
        obs = new ResizeObserver(measure)
        obs.observe(el)
      }
    }
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
      obs?.disconnect()
    }
  }, [measure, selector])

  const base = {
    position: 'fixed', inset: 0, zIndex,
    pointerEvents: 'none',
    transition: 'opacity 0.3s',
  }

  // No selector: full dark overlay
  if (!selector || !rect) {
    return <div style={{ ...base, background: 'rgba(0,0,0,0.72)' }} />
  }

  const { x, y, width, height } = rect
  const W = window.innerWidth
  const H = window.innerHeight

  return (
    <svg
      style={{ ...base, width: '100%', height: '100%', display: 'block' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <mask id="spot-mask">
          <rect width={W} height={H} fill="white" />
          <rect
            x={x - PAD} y={y - PAD}
            width={width + PAD * 2} height={height + PAD * 2}
            fill="black" rx="4"
          />
        </mask>
      </defs>

      {/* Dark surround */}
      <rect width={W} height={H} fill="rgba(0,0,0,0.72)" mask="url(#spot-mask)" />

      {/* Accent border around spotlight */}
      <rect
        x={x - PAD} y={y - PAD}
        width={width + PAD * 2} height={height + PAD * 2}
        fill="none"
        stroke="rgba(184,112,64,0.85)"
        strokeWidth="2"
        rx="4"
      />
    </svg>
  )
}
