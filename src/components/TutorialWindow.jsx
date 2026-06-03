import React, { useState, useEffect, useRef, useMemo } from 'react'
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

const CHARS_PER_SEC = 500
const MOUTH_DELAY   = 160

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

  const { clean: fullText, changes: spriteChanges } = useMemo(
    () => parseBody(current?.body ?? ''),
    [step] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const [charCount,      setCharCount]      = useState(0)
  const [isTyping,       setIsTyping]       = useState(true)
  const [mouthOpen,      setMouthOpen]      = useState(false)
  const [reacted,        setReacted]        = useState(false)
  const [spriteOverride, setSpriteOverride] = useState(null)

  const typingRef      = useRef(null)
  const mouthRef       = useRef(null)
  const fullTextRef    = useRef(fullText)
  const spriteChgRef   = useRef(spriteChanges)
  fullTextRef.current  = fullText
  spriteChgRef.current = spriteChanges

  const isDone = charCount >= fullText.length

  useEffect(() => {
    cancelAnimationFrame(typingRef.current)
    clearInterval(mouthRef.current)
    setCharCount(0)
    setIsTyping(true)
    setMouthOpen(false)
    setReacted(false)
    setSpriteOverride(null)

    let startTime = null
    let lastChar  = 0

    function frame(now) {
      if (startTime === null) startTime = now
      const target = Math.min(
        Math.floor((now - startTime) * CHARS_PER_SEC / 1000),
        fullTextRef.current.length
      )
      if (target > lastChar) {
        for (const ch of spriteChgRef.current) {
          if (ch.atChar > lastChar && ch.atChar <= target) setSpriteOverride(ch.sprite)
        }
        lastChar = target
        setCharCount(target)
        if (target >= fullTextRef.current.length) {
          setIsTyping(false)
          return
        }
      }
      typingRef.current = requestAnimationFrame(frame)
    }

    typingRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(typingRef.current)
  }, [step])

  useEffect(() => {
    if (!isTyping) { setMouthOpen(false); return }
    mouthRef.current = setInterval(() => setMouthOpen(o => !o), MOUTH_DELAY)
    return () => clearInterval(mouthRef.current)
  }, [isTyping])

  useEffect(() => {
    if (!stepComplete || !isDone || !current?.completeWhen) return
    setReacted(true)
    const t = setTimeout(onNext, 1100)
    return () => clearTimeout(t)
  }, [stepComplete, isDone, current?.completeWhen, onNext])

  function skipTyping() {
    cancelAnimationFrame(typingRef.current)
    clearInterval(mouthRef.current)
    setCharCount(fullText.length)
    setIsTyping(false)
    setMouthOpen(false)
    if (spriteChanges.length > 0) {
      setSpriteOverride(spriteChanges[spriteChanges.length - 1].sprite)
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
  if (reacted)                                  narratorKey = reactionSprite
  else if (isTyping && stepSprite !== 'threat') narratorKey = talkingSprite
  else                                          narratorKey = stepSprite
  const narratorSrc = NARRATOR_IMGS[narratorKey]

  const displayed = reacted
    ? (current.reactionText ?? '')
    : fullText.slice(0, charCount)
  const lines = displayed.split('\n')

  const isInteractive = !!current.completeWhen
  const waiting       = isInteractive && isDone && !stepComplete && !reacted

  const stageSprite = reacted ? reactionSprite : (spriteOverride ?? current.sprite ?? 'neutral')

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

        <div className="tut-win__meta">
          <span className="tut-win__counter">Step {step + 1} / {total}</span>
          <div className="tut-win__bar">
            {TUTORIAL_STEPS.map((_, i) => (
              <div key={i} className={`tut-win__pip ${i <= step ? 'tut-win__pip--done' : ''}`} />
            ))}
          </div>
        </div>

        <div className="tut-win__divider" />

        <div className="tut-win__content-row">

          <div className={`tut-win__stage tut-win__stage--${stageSprite}${isTyping && !reacted ? ' tut-win__stage--talking' : ''}`}>
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
