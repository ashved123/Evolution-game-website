import express from 'express'
import session from 'express-session'
import authRouter    from './routes/auth.js'
import islandsRouter from './routes/islands.js'

const app  = express()
const PORT = 3001

app.use(express.json())

app.use(session({
  secret: 'island-of-life-dev-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}))

app.use('/api/auth',    authRouter)
app.use('/api/islands', islandsRouter)

app.listen(PORT, () => {
  console.log(`API server → http://localhost:${PORT}`)
})
