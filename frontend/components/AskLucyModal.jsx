import React, { useState } from 'react'

export default function AskLucyModal({ filePath, onClose }) {
  const [action, setAction] = useState('analyze')
  const [freeText, setFreeText] = useState('')

  const submit = async () => {
	// send request to toolbelt
	if (window.electron && window.electron.toolbeltCall) {
	  await window.electron.toolbeltCall('/file/dropped', { path: filePath, action, prompt: freeText })
	}
	onClose()
  }

  return (
	<div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
	  <div style={{ background: '#fff', padding: 16, width: 520, borderRadius: 8 }}>
		<h3>What would you like Lucy to do with this file?</h3>
		<div>
		  <select value={action} onChange={e => setAction(e.target.value)}>
			<option value="set_wallpaper">Set as wallpaper</option>
			<option value="analyze">Analyze image</option>
			<option value="transcribe">Transcribe audio</option>
			<option value="summarize">Summarize text</option>
			<option value="open">Open with toolbelt</option>
		  </select>
		</div>
		<div style={{ marginTop: 8 }}>
		  <input placeholder="Ask Lucy..." value={freeText} onChange={e => setFreeText(e.target.value)} style={{ width: '100%', padding: 8 }} />
		</div>
		<div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
		  <button onClick={onClose}>Cancel</button>
		  <button onClick={submit}>Send</button>
		</div>
	  </div>
	</div>
  )
}
