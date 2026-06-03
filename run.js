#!/usr/bin/env node
/**
 * Island of Life — single-file launcher
 * Run with:  node run.js
 * Requires:  Node.js 14+  (no npm install needed)
 */
import http from 'http'
import fs   from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(__dirname, 'dist')
const PORT = 3000

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.json': 'application/json',
}

// Sanity check — make sure the dist folder exists
if (!fs.existsSync(DIST)) {
  console.error('ERROR: "dist" folder not found next to run.js.')
  console.error('Make sure you have the full project folder, not just this file.')
  process.exit(1)
}

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0].replace(/^\//, '') || 'index.html'
  let filePath  = path.join(DIST, urlPath)

  // SPA fallback: any path that isn't a real file → serve index.html
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST, 'index.html')
  }

  const ext         = path.extname(filePath).toLowerCase()
  const contentType = MIME[ext] ?? 'application/octet-stream'

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Not found')
      return
    }
    res.writeHead(200, { 'Content-Type': contentType })
    res.end(data)
  })
})

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}`

  console.log()
  console.log('  ╔══════════════════════════════════════╗')
  console.log('  ║       Island of Life  🌿             ║')
  console.log(`  ║   Running at ${url}   ║`)
  console.log('  ╠══════════════════════════════════════╣')
  console.log('  ║  Opening your browser now…           ║')
  console.log('  ║  Press  Ctrl + C  to stop.           ║')
  console.log('  ╚══════════════════════════════════════╝')
  console.log()

  // Auto-open browser (works on Windows, macOS, and Linux)
  const platform = process.platform
  const cmd = platform === 'win32' ? `start "" "${url}"` :
              platform === 'darwin' ? `open "${url}"` :
              `xdg-open "${url}"`

  exec(cmd, err => {
    if (err) console.log(`  → Could not open browser automatically. Please visit: ${url}`)
  })
})

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nPort ${PORT} is already in use.`)
    console.error(`Try closing other programs, or visit http://localhost:${PORT} in your browser.\n`)
  } else {
    console.error('Server error:', err.message)
  }
  process.exit(1)
})
