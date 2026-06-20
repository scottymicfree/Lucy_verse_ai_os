// src/frontend/utils/soundPlayer.js

/**
 * Play a sound asset using design‑token based volume.
 * @param {string} src - Path to the sound file (imported or URL).
 * @param {string} volumeToken - CSS variable name for volume (e.g., '--sound-volume-default').
 */
export function playSound(src, volumeToken = '--sound-volume-default') {
  const audio = new Audio(src)
  try {
    const rootStyles = getComputedStyle(document.documentElement)
    const vol = parseFloat(rootStyles.getPropertyValue(volumeToken)) || 0.3
    audio.volume = Math.max(0, Math.min(1, vol))
  } catch (e) {
    // fallback volume
    audio.volume = 0.3
  }
  // optional fade‑in for smoother UX
  audio.play().catch(() => {
    // ignore play errors (e.g., autoplay restrictions)
  })
}
