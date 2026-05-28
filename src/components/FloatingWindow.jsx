import React, { useRef } from 'react'
import './FloatingWindow.css'

export default function FloatingWindow({
  title, children, pos, size, zIndex,
  onClose, onFocus, onMove, onResize,
  minW = 240, minH = 140, bodyStyle, animated = false,
}) {
  const winRef = useRef(null)

  const handleBarDown = (e) => {
    if (e.button !== 0) return
    onFocus?.()
    if (winRef.current) winRef.current.style.transition = 'none'
    const ox = e.clientX - pos.x
    const oy = e.clientY - pos.y
    const move = (ev) => onMove({ x: Math.max(0, ev.clientX - ox), y: Math.max(48, ev.clientY - oy) })
    const up = () => {
      if (winRef.current) winRef.current.style.transition = ''
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const handleResizeDown = (e) => {
    if (e.button !== 0) return
    e.stopPropagation()
    onFocus?.()
    if (winRef.current) winRef.current.style.transition = 'none'
    const sx = e.clientX, sy = e.clientY, sw = size.w, sh = size.h
    const move = (ev) => onResize({
      w: Math.max(minW, sw + ev.clientX - sx),
      h: Math.max(minH, sh + ev.clientY - sy),
    })
    const up = () => {
      if (winRef.current) winRef.current.style.transition = ''
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const transition = animated
    ? 'left 0.55s cubic-bezier(0.22,1,0.36,1), top 0.55s cubic-bezier(0.22,1,0.36,1), width 0.4s ease, height 0.4s ease'
    : undefined

  return (
    <div
      ref={winRef}
      className="fwin"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h, zIndex, transition }}
      onMouseDown={onFocus}
    >
      <div className="fwin__bar" onMouseDown={handleBarDown}>
        <span className="fwin__title">{title}</span>
        <button className="fwin__close" onMouseDown={e => e.stopPropagation()} onClick={onClose}>✕</button>
      </div>
      <div className="fwin__body" style={bodyStyle}>
        {children}
      </div>
      <div className="fwin__resize" onMouseDown={handleResizeDown} />
    </div>
  )
}
