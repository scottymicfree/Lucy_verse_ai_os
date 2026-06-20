# Log to stdout
set("log.stdout", true)
set("server.telnet", true)
set("server.telnet.port", 1234)
set("server.telnet.password", "lucy")

# Music source: all files in /music
music = playlist("/music")

# Simple crossfade
radio = crossfade(music)

# Output to Icecast (MP3)
output.icecast(
  %mp3(bitrate=128, samplerate=44100, stereo=true),
  host = "icecast",
  port = 8000,
  password = "hackme",
  mount = "live",
  name = "Lucy Radio",
  description = "Lucy OS Live Stream",
  genre = "AI DJ"
  ,
  radio
)
