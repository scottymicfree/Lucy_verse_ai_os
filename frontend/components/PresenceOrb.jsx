import React, { useEffect, useState } from 'react';
import { playSound } from '../../utils/soundPlayer';
import placeholderNotification from '../../../public/assets/sounds/placeholder_notification.wav?url';

export default function PresenceOrb() {
  const [state, setState] = useState('idle') // idle|thinking|acting|speaking

  useEffect(() => {
	function onStart(e) { setState('acting') }
	function onThinking(e) { setState('thinking') }
	function onSpeak(e) { setState('speaking') }
	function onEnd(e) { setState('idle') }
	window.addEventListener('lucy:actionStart', onStart)
	window.addEventListener('lucy:thinking', onThinking)
	window.addEventListener('lucy:speaking', onSpeak)
	window.addEventListener('lucy:actionEnd', onEnd)
	return () => {
	  window.removeEventListener('lucy:actionStart', onStart)
	  window.removeEventListener('lucy:thinking', onThinking)
	  window.removeEventListener('lucy:speaking', onSpeak)
	  window.removeEventListener('lucy:actionEnd', onEnd)
	}
  }, []);

  // Play sound on state change
  useEffect(() => {
    if (state !== 'idle') {
      playSound(placeholderNotification);
    }
  }, [state]);

  return (
	<div style={{ position: 'fixed', left: 16, bottom: 16, zIndex: 9999 }}>
	  <div className={`lucy-orb ${state}`} title={`Lucy: ${state}`} />
	</div>
  )
}
