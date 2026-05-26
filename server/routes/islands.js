import { Router } from 'express'
import db from '../db.js'

const router = Router()

const VALID_PRESETS = ['standard', 'volcanic', 'tropical', 'highland']

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' })
  next()
}

// GET /api/islands — list all islands for the logged-in user
router.get('/', requireAuth, (req, res) => {
  const islands = db
    .prepare('SELECT * FROM islands WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.session.userId)
  res.json(islands)
})

// POST /api/islands — create a new island
router.post('/', requireAuth, (req, res) => {
  const { name, preset = 'standard' } = req.body ?? {}
  if (!name || name.trim().length === 0)
    return res.status(400).json({ error: 'Island name required' })
  if (name.trim().length > 40)
    return res.status(400).json({ error: 'Island name too long (max 40 chars)' })
  if (!VALID_PRESETS.includes(preset))
    return res.status(400).json({ error: 'Invalid preset' })

  const result = db
    .prepare('INSERT INTO islands (user_id, name, preset) VALUES (?, ?, ?)')
    .run(req.session.userId, name.trim(), preset)
  const island = db.prepare('SELECT * FROM islands WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json(island)
})

// GET /api/islands/:id — get one island (must belong to user)
router.get('/:id', requireAuth, (req, res) => {
  const island = db
    .prepare('SELECT * FROM islands WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.session.userId)
  if (!island) return res.status(404).json({ error: 'Island not found' })
  res.json(island)
})

// DELETE /api/islands/:id
router.delete('/:id', requireAuth, (req, res) => {
  const result = db
    .prepare('DELETE FROM islands WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.session.userId)
  if (result.changes === 0) return res.status(404).json({ error: 'Island not found' })
  res.json({ ok: true })
})

export default router
