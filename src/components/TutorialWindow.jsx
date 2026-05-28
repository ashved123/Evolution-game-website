import React, { useState, useEffect, useRef } from 'react'
import FloatingWindow from './FloatingWindow.jsx'
import { TUTORIAL_STEPS } from '../data/tutorialSteps.js'
import narratorFriendly from '../assets/sprites/narrator/pose_friendly.png'
import narratorNeutral  from '../assets/sprites/narrator/pose_neutral.png'
import narratorThreat   from '../assets/sprites/narrator/pose_threat.png'
import './TutorialWindow.css'

const NARRATOR_IMGS = {
  friendly: narratorFriendly,
  neutral:  narratorNeutral,
  threat:   narratorThreat,
}

const CHAR_DELAY  = 28
const MOUTH_DELAY = 160

// Parse [[spriteName]] markers out of body text.
// Returns { clean: string, changes: [{ atChar, sprite }] }
function parseBody(body) {
  const changes = []
  let clean = ''
  let i = 0
  while (i < body.length) {
    if (body[i] === '[' && body[i + 1] === '[') {
      const end = body.indexOf(']]', i)
      if (end !== -1) {
        changes.push({ atChar: clean.length, sprite: body.slice(i + 2, end) })
        i = end + 2
        continue
      }
    }
    clean += body[i]
    i++
  }
  return { clean, changes }
}

export default function TutorialWindow({
  step, stepComplete, animated,
  pos, size, zIndex,
  onNext, onBack, onSkip, onClose, onFocus, onMove, onResize,
}) {
  const current = TUTORIAL_STEPS[step]
  const total   = TUTORIAL_STEPS.length
  const isFirst = step === 0
  const isLast  = step === total - 1

  const { clean: fullText, changes: spriteChanges } = parseBody(current?.body ?? '')

  const [charCount,     setCharCount]     = useState(0)
  const [isTyping,      setIsTyping]      = useState(true)
  const [mouthOpen,     setMouthOpen]     = useState(false)
  const [reacted,       setReacted]       = useState(false)
  const [spriteOverride, setSpriteOverride] = useState(null)

  const typingRef = useRef(null)
  const mouthRef  = useRef(null)

  const isDone = charCount >= fullText.length

  // Reset everything on step change
  useEffect(() => {
    clearInterval(typingRef.current)
    clearInterval(mouthRef.current)
    setCharCount(0)
    setIsTyping(true)
    setMouthOpen(false)
    setReacted(false)
    setSpriteOverride(null)
  }, [step])

  useEffect(() => {
    if (!isTyping) return
    typingRef.current = setInterval(() => {
      setCharCount(prev => {
        const next = prev + 1
        // Check for sprite marker triggers
        for (const ch of spriteChanges) {
          if (prev < ch.atChar && next >= ch.atChar) {
            setSpriteOverride(ch.sprite)
          }
        }
        if (next >= fullText.length) {
          setIsTyping(false)
          clearInterval(typingRef.current)
        }
        return next
      })
    }, CHAR_DELAY)
    return () => clearInterval(typingRef.current)
  }, [isTyping, fullText, spriteChanges])

  useEffect(() => {
    if (!isTyping) { setMouthOpen(false); return }
    mouthRef.current = setInterval(() => setMouthOpen(o => !o), MOUTH_DELAY)
    return () => clearInterval(mouthRef.current)
  }, [isTyping])

  // When player completes an interactive step: show reaction then auto-advance
  useEffect(() => {
    if (!stepComplete || !isDone || !current?.completeWhen) return
    setReacted(true)
    const t = setTimeout(onNext, 1100)
    return () => clearTimeout(t)
  }, [stepComplete, isDone, current?.completeWhen, onNext])

  function skipTyping() {
    clearInterval(typingRef.current)
    clearInterval(mouthRef.current)
    setCharCount(fullText.length)
    setIsTyping(false)
    setMouthOpen(false)
    // Apply any sprite markers that would have triggered during skipped text
    if (spriteChanges.length > 0) {
      const last = spriteChanges[spriteChanges.length - 1]
      setSpriteOverride(last.sprite)
    }
  }

  function handleNext() {
    if (!isDone) { skipTyping(); return }
    onNext()
  }

  if (!current) return null

  const stepSprite     = spriteOverride ?? current.sprite ?? 'neutral'
  const reactionSprite = current.reactionSprite ?? 'friendly'
  const talkingSprite  = mouthOpen ? 'neutral' : 'friendly'

  let narratorKey
  if (reacted)                                     narratorKey = reactionSprite
  else if (isTyping && stepSprite !== 'threat')    narratorKey = talkingSprite
  else                                             narratorKey = stepSprite
  const narratorSrc = NARRATOR_IMGS[narratorKey]

  const displayed = reacted
    ? (current.reactionText ?? '')
    : fullText.slice(0, charCount)
  const lines = displayed.split('\n')

  const isInteractive = !!current.completeWhen
  const waiting       = isInteractive && isDone && !stepComplete && !reacted

  return (
    <FloatingWindow
      title="📖 Tutorial"
      pos={pos} size={size} zIndex={zIndex}
      onClose={onClose} onFocus={onFocus}
      onMove={onMove} onResize={onResize}
      minW={460} minH={320}
      animated={animated}
    >
      <div className="tut-win">

        {/* Progress pips */}
        <div className="tut-win__meta">
          <span className="tut-win__counter">Step {step + 1} / {total}</span>
          <div className="tut-win__bar">
            {TUTORIAL_STEPS.map((_, i) => (
              <div key={i} className={`tut-win__pip ${i <= step ? 'tut-win__pip--done' : ''}`} />
            ))}
          </div>
        </div>

        <div className="tut-win__divider" />

        {/* Narrator + flowing text */}
        <div className="tut-win__content-row">

          <div className={`tut-win__stage tut-win__stage--${reacted ? reactionSprite : (spriteOverride ?? current.sprite ?? 'neutral')}`}>
            {Object.entries(NARRATOR_IMGS).map(([key, src]) => (
              <img
                key={key}
                className="tut-win__narrator"
                src={src}
                alt="narrator"
                style={{ opacity: narratorSrc === src ? 1 : 0 }}
              />
            ))}
          </div>

          <div
            className="tut-win__dialogue"
            onClick={!isDone && !reacted ? skipTyping : undefined}
            style={{ cursor: !isDone && !reacted ? 'pointer' : 'default' }}
          >
            <div className="tut-win__step-title">
              {reacted ? (reactionSprite === 'friendly' ? '✓' : '!') + ' ' + current.title : current.title}
            </div>
            <div className="tut-win__text">
              {lines.map((line, i) =>
                line === ''
                  ? <br key={i} />
                  : <span key={i}>
                      {line}
                      {i === lines.length - 1 && !isDone && !reacted
                        ? <span className="tut-cursor">▮</span>
                        : <br />}
                    </span>
              )}
            </div>
          </div>

        </div>

        {/* Navigation */}
        <div className="tut-win__nav">
          <div className="tut-win__nav-left">
            {!isFirst && !reacted && (
              <button className="pixel-btn tut-btn" onClick={onBack}>← Back</button>
            )}
          </div>
          <div className="tut-win__nav-right">
            {waiting && (
              <span className="tut-hint">↑ {current.hint}</span>
            )}
            {!reacted && (
              !isDone
                ? <button className="pixel-btn tut-btn" onClick={skipTyping}>Skip ▶▶</button>
                : waiting
                  ? null
                  : isLast
                    ? <button className="pixel-btn tut-btn tut-btn--done" onClick={onSkip}>Done ✓</button>
                    : <button className="pixel-btn tut-btn" onClick={handleNext}>Next →</button>
            )}
            {isDone && !reacted && <button className="tut-skip" onClick={onSkip}>Skip tutorial</button>}
          </div>
        </div>

      </div>
    </FloatingWindow>
  )
}
