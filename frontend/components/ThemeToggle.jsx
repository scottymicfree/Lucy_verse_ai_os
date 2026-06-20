import React, { useEffect, useState } from 'react'

export default function ThemeToggle() {
  const [theme, setTheme] = useState('system')
  useEffect(() => {
	const t = localStorage.getItem('lucy_theme') || 'system'
	setTheme(t)
	apply(t)
  }, [])
  const apply = (t) => {
	document.documentElement.classList.toggle('light', t === 'light')
	localStorage.setItem('lucy_theme', t)
	setTheme(t)
  }
  return (
	<select value={theme} onChange={e => apply(e.target.value)} style={{ padding: 6 }}>
	  <option value="system">System</option>
	  <option value="dark">Dark</option>
	  <option value="light">Light</option>
	</select>
  )
}
