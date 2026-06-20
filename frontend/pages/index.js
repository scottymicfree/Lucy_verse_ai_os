import dynamic from 'next/dynamic'
import React, { useState, useEffect } from 'react'
import ConsentModal from '../components/ConsentModal'
import SystemStatus from '../components/SystemStatus'
import ThemeToggle from '../components/ThemeToggle'
import ToastManager from '../components/ToastManager'
import AskLucyModal from '../components/AskLucyModal'
import PresenceOrb from '../components/PresenceOrb'
import ActingOverlay from '../components/ActingOverlay'
import { playSound } from '../utils/soundPlayer'
import { detectProjectType } from '../utils/projectDetector'
import '../styles/theme.css'

// MirrorPanel uses browser APIs and must not be server-side rendered
const MirrorPanel = dynamic(() => import('../mirror_panel'), { ssr: false })

export default function Home() {
	const [consentSaved, setConsentSaved] = useState(false)
  const [askFile, setAskFile] = useState(null)

  useEffect(() => {
	function onDropped(e) {
	  const d = e.detail
      if (d.type === 'directory') {
        handleAppDrop(d);
        return;
      }
      if (d.type && d.type.startsWith('audio/')) {
        handleSongDrop(d);
        return;
      }
	  setAskFile(d.path)
	}

    const handleAppDrop = async (file) => {
      const type = await detectProjectType(file.path);
      if (type === "node" || type === "python") {
        if (window.confirm(`Install ${type} app in ${file.name}?`)) {
          if (window.lucyAddToast) window.lucyAddToast("Installing app...");
          
          const cmdOpts = type === "node" 
             ? { cwd: file.path, cmd: "npm", args: ["install"] }
             : { cwd: file.path, cmd: "pip", args: ["install", "-r", "requirements.txt"] };
             
          const res = await window.os.runCommand(cmdOpts);
          
          if (res.code === 0) {
            playSound("drag-success");
            if (window.lucyAddToast) window.lucyAddToast("Install complete");
          } else {
            playSound("error");
            if (window.lucyAddToast) window.lucyAddToast("Install failed");
            console.error("Install failed:", res.stderr);
          }
        }
      } else {
        // Just a regular directory, pass to normal ask loop or ignore
        setAskFile(file.path);
      }
    };

    const handleSongDrop = async (file) => {
      if (window.lucyLibrary) {
        const result = await window.lucyLibrary.addSong(file.path);
        if (result.success) {
          playSound("drag-success");
          if (window.lucyAddToast) window.lucyAddToast("Song added to Lucy's library");
          window.lucyLibrary.queueSong(result.path).catch(console.error);
        } else {
          playSound("error");
          if (window.lucyAddToast) window.lucyAddToast("Failed to add song");
        }
      }
    };
	window.addEventListener('lucy:fileDropped', onDropped)
	return () => window.removeEventListener('lucy:fileDropped', onDropped)
  }, [])
	return (
	<ToastManager>
	<div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
	  <div style={{ display: 'flex', flex: 1 }}>
		<div style={{ flex: 3 }}><MirrorPanel /></div>
		<div style={{ width: 360 }}><SystemStatus /></div>
	  </div>
		<PresenceOrb />
	  <ActingOverlay />
	  {!consentSaved && <ConsentModal onClose={(val) => setConsentSaved(true)} />}
	  {askFile && <AskLucyModal filePath={askFile} onClose={() => setAskFile(null)} />}
	</div>
	</ToastManager>
  )
}
