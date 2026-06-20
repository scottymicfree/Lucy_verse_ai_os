import React, { useState, useEffect, createContext } from 'react'

export const ToastContext = createContext(null)

export default function ToastManager({ children }) {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
	window.lucyAddToast = (msg) => {
	  const id = Date.now()
	  setToasts(t => [...t, { id, msg }])
	  setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 5000)
	}
  }, [])

  return (
	<ToastContext.Provider value={{ add: (m) => window.lucyAddToast(m) }}>
	  {children}
	  <div style={{ position: 'fixed', right: 20, bottom: 20 }}>
		{toasts.map(t => <div key={t.id} style={{ background: '#111', color:'#fff', padding: 8, borderRadius: 8, marginTop: 8 }}>{t.msg}</div>)}
	  </div>
	</ToastContext.Provider>
  )
}
