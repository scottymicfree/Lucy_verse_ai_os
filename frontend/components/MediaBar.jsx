import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2 } from 'lucide-react';
import { playSound } from '../utils/soundPlayer';

export default function MediaBar() {
  const [radioPlaying, setRadioPlaying] = useState(false);
  const [spotifyPlaying, setSpotifyPlaying] = useState(false);
  const [volume, setVolume] = useState(0.3);
  const [trackInfo, setTrackInfo] = useState({ title: 'Not Playing', artist: '' });

  useEffect(() => {
    // Initial volume setting
    if (window.electronAPI && window.electronAPI.radioSetVolume) {
      window.electronAPI.radioSetVolume(volume);
    }
  }, []);

  const toggleRadio = async () => {
    if (!window.electronAPI) return;
    try {
      if (radioPlaying) {
        await window.electronAPI.radioStop();
        setRadioPlaying(false);
      } else {
        await window.electronAPI.radioPlay();
        setRadioPlaying(true);
      }
      playSound('drag-success'); // reusing a click sound for feedback
    } catch (e) {
      playSound('error');
    }
  };

  const handleVolume = (e) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (window.electronAPI && window.electronAPI.radioSetVolume) {
      window.electronAPI.radioSetVolume(vol);
    }
  };

  const handleSpotifyAction = async (action) => {
    if (!window.electronAPI) return;
    try {
      switch (action) {
        case 'play':
          await window.electronAPI.spotifyPlay();
          setSpotifyPlaying(true);
          break;
        case 'pause':
          await window.electronAPI.spotifyPause();
          setSpotifyPlaying(false);
          break;
        case 'next':
          await window.electronAPI.spotifyNext();
          break;
        case 'prev':
          await window.electronAPI.spotifyPrev();
          break;
      }
      playSound('drag-success');
    } catch (e) {
      playSound('error');
    }
  };

  const handleSpotifyAuth = async () => {
    if (window.electronAPI && window.electronAPI.spotifyAuth) {
      playSound('consent-open');
      await window.electronAPI.spotifyAuth();
    }
  };

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 text-white shadow-xl ml-4">
      {/* Lucy Radio Controls */}
      <div className="flex items-center gap-3 pr-4 border-r border-white/10">
        <div className="text-xs font-bold text-emerald-400 uppercase tracking-widest mr-2">Lucy Radio</div>
        <button onClick={toggleRadio} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          {radioPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <div className="flex items-center gap-2">
          <Volume2 size={14} className="text-slate-400" />
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.01" 
            value={volume} 
            onChange={handleVolume}
            className="w-20 accent-emerald-400"
          />
        </div>
      </div>

      {/* Spotify Controls */}
      <div className="flex items-center gap-3">
        <button onClick={handleSpotifyAuth} className="text-[10px] uppercase font-bold text-slate-400 hover:text-white transition-colors mr-2">
          Connect Spotify
        </button>
        <button onClick={() => handleSpotifyAction('prev')} className="p-1 hover:bg-white/10 rounded-full transition-colors">
          <SkipBack size={16} />
        </button>
        <button onClick={() => handleSpotifyAction(spotifyPlaying ? 'pause' : 'play')} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          {spotifyPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button onClick={() => handleSpotifyAction('next')} className="p-1 hover:bg-white/10 rounded-full transition-colors">
          <SkipForward size={16} />
        </button>
        <div className="flex flex-col ml-2">
          <span className="text-xs font-semibold">{trackInfo.title}</span>
          <span className="text-[10px] text-slate-400">{trackInfo.artist || 'Spotify Player'}</span>
        </div>
      </div>
    </div>
  );
}
