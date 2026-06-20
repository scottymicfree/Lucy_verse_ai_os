import React, { useEffect, useState } from 'react'

export default function ActingOverlay() {
  const [action, setAction] = useState(null)

  useEffect(() => {
	function onStart(e) { setAction(e.detail && e.detail.action ? e.detail.action : 'working') }
	function onEnd(e) { setAction(null) }
	window.addEventListener('lucy:actionStart', onStart)
	window.addEventListener('lucy:actionEnd', onEnd)
	return () => {
	  window.removeEventListener('lucy:actionStart', onStart)
	  window.removeEventListener('lucy:actionEnd', onEnd)
	}
  }, [])

  if (!action) return null

  return (
	<div className="acting-overlay">
	  <div className="acting-card">Lucy is performing: {action}…</div>
	</div>
  )
}
