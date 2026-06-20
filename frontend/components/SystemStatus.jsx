import React, { useEffect, useState } from 'react'

export default function SystemStatus() {
  const [status, setStatus] = useState({})

  async function refresh() {
	try {
	  const r = await fetch('/api/logs')
	  const j = await r.json()
	  const tail = j.content || ''
	  const lines = tail.split('\n').filter(Boolean).slice(-5)
	  const health = await fetch('http://localhost:8001/health').then(r => r.json()).catch(() => ({}))
	  const jwks = await fetch('http://localhost:8001/.well-known/jwks.json').then(r => r.json()).catch(() => ({}))
	  setStatus({ health, jwks, logs: lines })
	} catch (e) {
	  setStatus({ error: String(e) })
	}
  }

  useEffect(() => { refresh(); const t = setInterval(refresh, 5000); return () => clearInterval(t) }, [])

  return (
	<div style={{ padding: 12, background: '#0f1720', color: '#fff' }}>
	  <h4>System Status</h4>
	  <div>Toolbelt: {status.health ? status.health.status : 'unknown'}</div>
	  <div>JWKS keys: {status.jwks && status.jwks.keys ? status.jwks.keys.length : 0}</div>
	  <div>Consent: {window.electron && window.electron.consent ? (window.electron.consent.os_integration ? 'granted' : 'denied') : 'unknown'}</div>
		<div>FEATURE_OS_INTEGRATION: {window && window.electron && window.electron.config ? (window.electron.config().then ? 'unknown' : String(window.electron.config().feature_os_integration)) : 'unset'}</div>
	  <h5>Last logs</h5>
	  <pre style={{ maxHeight: 120, overflow: 'auto', background: '#05050a', padding: 8 }}>{(status.logs || []).join('\n')}</pre>
	</div>
  )
}
