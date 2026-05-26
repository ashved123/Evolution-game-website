import { Router } from 'express'
import bcrypt from 'bcryptjs'
import db from '../db.js'

const router = Router()

router.post('/register', async (req, res) => {
  const { username, password } = req.body ?? {}
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password required' })
  if (username.trim().length < 3)
    return res.status(400).json({ error: 'Username must be at least 3 characters' })
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' })

  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim())
  if (exists) return res.status(409).json({ error: 'Username already taken' })

  const hash   = await bcrypt.hash(password, 10)
  const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username.trim(), hash)

  req.session.userId = result.lastInsertRowid
  res.status(201).json({ id: result.lastInsertRowid, username: username.trim() })
})

router.post('/login', async (req, res) => {
  const { username, password } = req.body ?? {}
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password required' })

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim())
  if (!user) return res.status(401).json({ error: 'Invalid username or password' })

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) return res.status(401).json({ error: 'Invalid username or password' })

  req.session.userId = user.id
  res.json({ id: user.id, username: user.username })
})

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }))
})

router.get('/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' })
  const user = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?').get(req.session.userId)
  if (!user) return res.status(401).json({ error: 'Not authenticated' })
  res.json(user)
})

export default router
