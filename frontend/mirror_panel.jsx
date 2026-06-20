import React, { useEffect, useRef } from 'react'

export default function MirrorPanel() {
  const videoRef = useRef(null)

  useEffect(() => {
	// In production, set up WebRTC PeerConnection and attach remote stream to videoRef.current
	// For now, this is a placeholder showing where the mirrored stream will appear.

	const el = videoRef.current
	if (!el) return

	function onDragOver(e) {
	  e.preventDefault()
	  e.dataTransfer.dropEffect = 'copy'
	}

	async function onDrop(e) {
	  e.preventDefault()
	  const file = e.dataTransfer.files && e.dataTransfer.files[0]
	  if (!file) return

      let isDir = false;
      if (window.os && window.os.listDir) {
        try {
          // If listDir succeeds without throwing, it's a directory
          const files = await window.os.listDir(file.path);
          if (Array.isArray(files)) isDir = true;
        } catch (err) {}
      }

      if (isDir) {
        window.dispatchEvent(new CustomEvent('lucy:fileDropped', { detail: { path: file.path, name: file.name, type: 'directory' } }));
        if (window.lucyAddToast) window.lucyAddToast('Directory dropped: ' + file.name);
        return;
      }

	  const reader = new FileReader()
	  reader.onload = async () => {
		const b64 = reader.result.split(',')[1]
		if (window.electronDrop && window.electronDrop.handleDroppedFile) {
		  const res = await window.electronDrop.handleDroppedFile(file.name, b64)
		  // notify parent via DOM event
		  window.dispatchEvent(new CustomEvent('lucy:fileDropped', { detail: { path: res.path, name: file.name, type: file.type } }))
		  if (window.lucyAddToast) window.lucyAddToast('File dropped: ' + file.name)
		}
	  }
	  reader.readAsDataURL(file)
	}

	el.addEventListener('dragover', onDragOver)
	el.addEventListener('drop', onDrop)
	return () => {
	  el.removeEventListener('dragover', onDragOver)
	  el.removeEventListener('drop', onDrop)
	}
  }, [])

  const testClick = async () => {
	if (window.electron) {
	  // Check consent
	  const consent = window.electron.consent || { os_integration: false }
	  if (!consent.os_integration) {
		alert('OS integrations are disabled. Open Settings to enable.');
		return
	  }
	  const res = await window.electron.toolbeltCall('/cursor/click', { x: null, y: null, button: 'left' })
	  console.log('toolbelt response', res)
	  // show toast
	  const el = document.createElement('div')
	  el.className = 'toast'
	  el.textContent = 'Cursor click sent'
	  document.body.appendChild(el)
	  setTimeout(() => el.remove(), 4000)
	} else {
	  console.log('electron IPC not available in this environment')
	}
  }

  return (
	<div style={{display:'flex', flexDirection:'column', height: '100%'}}>
	  <div style={{flex: 1, backgroundColor: '#111'}}>
		<video ref={videoRef} style={{width: '100%', height: '100%'}} autoPlay muted playsInline />
	  </div>
	  <div style={{padding: 12, display: 'flex', gap: 8}}>
		<button onClick={testClick}>Test Click via Toolbelt</button>
		<button onClick={() => alert('Mirror controls placeholder')}>Mirror Controls</button>
	  </div>
	</div>
  )
}
