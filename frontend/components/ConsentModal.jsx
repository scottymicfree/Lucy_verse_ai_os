import React, { useState, useEffect } from 'react'
import { playSound } from '../utils/soundPlayer'

export default function ConsentModal({ onClose }) {
  const [visible, setVisible] = useState(true)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
	playSound('consent-open');
	// read existing consent from electron store when available
	if (window.electron && window.electron.consent) {
	  setEnabled(!!window.electron.consent.os_integration)
	}
  }, [])

  const save = async () => {
	if (window.electron && window.electron.toolbeltCall) {
	  // ask main process to persist consent via a toolbelt ipc (reusing endpoint pattern)
	  await window.electron.toolbeltCall('/_consent/save', { os_integration: enabled })
	}
	setVisible(false)
	if (onClose) onClose(enabled)
  }

  if (!visible) return null

  return (
	<div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
	  <div style={{ background: '#fff', color: '#000', padding: 20, width: 480, borderRadius: 8 }}>
		<h3>Enable OS Integrations</h3>
		<p>Allow Lucy to perform native actions on your machine (cursor, keyboard, media controls). Enable only if you trust this environment.</p>
		<label><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} /> Enable OS integrations</label>
		<div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
		  <button onClick={() => { setVisible(false); if (onClose) onClose(false) }}>Close</button>
		  <button onClick={save}>Save</button>
		</div>
	  </div>
	</div>
  )
}
