// Simple JSON-based consent store for Electron renderer
const fs = require('fs')
const path = require('path')
const os = require('os')
const homedir = os.homedir()
const storePath = process.env.LUCY_CONSENT_PATH || path.join(homedir, '.lucy_consent.json')

function read() {
  try {
	if (!fs.existsSync(storePath)) return { os_integration: false }
	const data = fs.readFileSync(storePath, 'utf8')
	return JSON.parse(data)
  } catch (e) {
	return { os_integration: false }
  }
}

function write(obj) {
  try {
	fs.writeFileSync(storePath, JSON.stringify(obj, null, 2), { mode: 0o600 })
	return true
  } catch (e) {
	return false
  }
}

module.exports = { read, write, storePath }
