const express = require('express')
const path = require('path')
const fs = require('fs')
const app = express()
const PORT = process.env.PORT || 3000

const staticDir = path.join(__dirname, 'static')
app.use(express.static(staticDir))

const LOG_FILE = path.join(__dirname, '..', 'logs', 'toolbelt_actions.log')

// safe read that returns empty string if file missing
function readLogTail(filePath, chars = 2000) {
  try {
	const data = fs.readFileSync(filePath, 'utf8')
	return data.slice(-chars)
  } catch (e) {
	return ''
  }
}

app.get('/api/logs', (req, res) => {
  fs.readFile(LOG_FILE, 'utf8', (err, data) => {
	// return last 2000 chars to keep payload small
	const tail = readLogTail(LOG_FILE, 2000)
	res.json({ ok: true, content: tail })
  })
})

app.get('/', (req, res) => {
  res.sendFile(path.join(staticDir, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Frontend static server listening on http://localhost:${PORT}`)
})