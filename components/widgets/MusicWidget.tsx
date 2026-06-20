import React, { useState, useEffect } from 'react';
import { Play, Music, LogIn } from 'lucide-react';

export function MusicWidget() {
  const [playing, setPlaying] = useState(false);
  const [track, setTrack] = useState<any>(null);
  const [topTracks, setTopTracks] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSpotify = async () => {
      try {
        const nowPlayingRes = await fetch('/api/spotify/now-playing');
        const nowPlaying = await nowPlayingRes.json();
        if (nowPlaying.error) {
          setError(nowPlaying.error);
        } else {
          setPlaying(nowPlaying.playing);
          if (nowPlaying.item) setTrack(nowPlaying.item);
          setError(null);
        }

        const topTracksRes = await fetch('/api/spotify/top-tracks');
        const topTracksData = await topTracksRes.json();
        if (Array.isArray(topTracksData)) {
          setTopTracks(topTracksData);
        }
      } catch (err: any) {
        console.error("Spotify fetch error:", err);
      }
    };

    fetchSpotify();
    const interval = setInterval(fetchSpotify, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  const handleLogin = () => {
    window.open('/api/spotify/login', 'Spotify Login', 'width=500,height=600');
  };

  return (
    <div className="flex flex-col h-full mt-2 p-4">
        {error === "Not logged in" ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 opacity-80">
            <Music size={32} className="text-lucy-primary mb-2" />
            <button onClick={handleLogin} className="px-4 py-2 bg-lucy-primary rounded-xl text-xs font-semibold text-white flex items-center gap-2 hover:bg-lucy-primary/80 transition-colors shadow-[0_0_15px_rgba(14,165,233,0.4)]">
              <LogIn size={14} /> Connect Spotify
            </button>
          </div>
        ) : (
          <>
            {/* Active Track */}
            <div className="flex gap-4 items-center mb-4 bg-white/5 p-2 rounded-xl border border-white/10">
              {track?.album?.images?.[0] ? (
                <img src={track.album.images[0].url} alt="Album Art" className="w-12 h-12 rounded-lg shadow-lg" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg flex-shrink-0" />
              )}
              
              <div className="flex-1 overflow-hidden">
                <div className="text-sm font-bold truncate">{track ? track.name : 'Not Playing'}</div>
                <div className="text-[10px] text-lucy-muted truncate">
                  {track ? track.artists.map((a:any) => a.name).join(', ') : 'Spotify'}
                </div>
              </div>
              <button className={`w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0 hover:scale-105 transition-all shadow-lg ${playing ? 'bg-emerald-500 shadow-emerald-500/40 animate-pulse' : 'bg-lucy-primary shadow-lucy-primary/40'}`}>
                <Play size={14} className="ml-0.5" />
              </button>
            </div>

            {/* Top Tracks List */}
            <div className="text-[10px] font-semibold text-lucy-primary mb-2 uppercase tracking-wider">Top Tracks</div>
            <div className="space-y-2 mt-auto overflow-y-auto no-scrollbar pb-2">
              {topTracks.length === 0 && <div className="text-xs text-lucy-muted text-center py-4">No top tracks found</div>}
              {topTracks.map((t, i) => (
                <div key={i} className="flex gap-3 items-center group cursor-pointer hover:bg-white/5 p-1 rounded-lg -mx-1 transition-colors">
                  {t.album?.images?.[2] ? (
                    <img src={t.album.images[2].url} className="w-8 h-8 rounded-md flex-shrink-0 border border-white/10" alt="art" />
                  ) : (
                    <div className="w-8 h-8 rounded-md bg-slate-800 flex-shrink-0 border border-white/10" />
                  )}
                  <div className="overflow-hidden">
                    <div className="text-xs font-semibold truncate group-hover:text-white text-lucy-muted transition-colors">{t.name}</div>
                    <div className="text-[10px] text-lucy-muted/70 truncate">{t.artists.map((a:any) => a.name).join(', ')}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      
    </div>
  );
}
