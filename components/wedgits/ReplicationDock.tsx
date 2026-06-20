import React from 'react';
import notificationSound from '../../../public/assets/sounds/placeholder_notification.wav?url';

type Props = {
  onDropAgent?: (agentId: string) => void
}

export default function ReplicationDock({onDropAgent}: Props){
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault() }
  const handleDrop = (e: React.DragEvent) => {
	e.preventDefault()
	const raw = e.dataTransfer.getData('text/plain')
	try{
	  const payload = JSON.parse(raw)
	  if(payload.type === 'agent' && onDropAgent) {
        onDropAgent(payload.id);
        const audio = new Audio(notificationSound);
        audio.volume = 0.3;
        audio.play();
      }
	}catch(err){}
  }

	return (
	<div className="replication-dock" onDragOver={handleDragOver} onDrop={handleDrop} style={{padding:12, border:'2px dashed #888', minWidth:160, minHeight:80}}>
	  <div className="dock-label">Replication Dock</div>
	</div>
  )
}
