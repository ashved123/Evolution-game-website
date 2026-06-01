import React, { useState, useEffect, useRef } from 'react'
import narratorFriendly from '../assets/sprites/narrator/pose_friendly.png'
import narratorNeutral  from '../assets/sprites/narrator/pose_neutral.png'
import narratorThreat   from '../assets/sprites/narrator/pose_threat.png'
import './OverseerPopup.css'

const NARRATOR_IMGS = { friendly: narratorFriendly, neutral: narratorNeutral, threat: narratorThreat }
const CHAR_DELAY  = 24
const MOUTH_DELAY = 160

export default function OverseerPopup({ message, onDismiss }) {
  const text   = message?.overseerText  ?? ''
  const sprite = message?.overseerSprite ?? 'neutral'
  const concept = message?.concept ?? null
  const emoji   = message?.emoji ?? null
  const title   = message?.label ? `${message.label} has arrived` : (message?.title ?? null)

  const [charCount, setCharCount] = useState(0)
  const [isTyping,  setIsTyping]  = useState(true)
  const [mouthOpen, setMouthOpen] = useState(false)

  const typingRef = useRef(null)
  const mouthRef  = useRef(null)

  const isDone = charCount >= text.length

  useEffect(() => {
    setCharCount(0)
    setIsTyping(true)
    setMouthOpen(false)
  }, [message])

  useEffect(() => {
    if (!isTyping) return
    typingRef.current = setInterval(() => {
      setCharCount(prev => {
        const next = prev + 1
        if (next >= text.length) { setIsTyping(false); clearInterval(typingRef.current) }
        return next
      })
    }, CHAR_DELAY)
    return () => clearInterval(typingRef.current)
  }, [isTyping, text])

  useEffect(() => {
    if (!isTyping) { setMouthOpen(false); return }
    mouthRef.current = setInterval(() => setMouthOpen(o => !o), MOUTH_DELAY)
    return () => clearInterval(mouthRef.current)
  }, [isTyping])

  function skip() {
    clearInterval(typingRef.current)
    clearInterval(mouthRef.current)
    setCharCount(text.length)
    setIsTyping(false)
    setMouthOpen(false)
  }

  const narratorKey = isTyping ? (mouthOpen ? 'neutral' : 'friendly') : sprite
  const displayed   = text.slice(0, charCount)
  const lines       = displayed.split('\n')

  if (!message) return null

  return (
    <div className="overseer-popup">
      <div className={`overseer-popup__stage overseer-popup__stage--${sprite}`}>
        {Object.entries(NARRATOR_IMGS).map(([key, src]) => (
          <img key={key} className="overseer-popup__narrator" src={src} alt=""
            style={{ opacity: narratorKey === key ? 1 : 0 }} />
        ))}
      </div>

      <div className="overseer-popup__body" onClick={!isDone ? skip : undefined}
        style={{ cursor: !isDone ? 'pointer' : 'default' }}>
        {concept && (
          <div className="overseer-popup__meta">
            <span className="concept-badge">{concept}</span>
          </div>
        )}
        {title && <div className="overseer-popup__title">{title}</div>}
        <div className="overseer-popup__text">
          {lines.map((line, i) =>
            line === ''
              ? <br key={i} />
              : <span key={i}>{line}{i === lines.length - 1 && !isDone ? <span className="tut-cursor">▮</span> : <br />}</span>
          )}
        </div>
      </div>

      <button className="overseer-popup__dismiss pixel-btn" onClick={onDismiss}>Dismiss</button>
    </div>
  )
}
