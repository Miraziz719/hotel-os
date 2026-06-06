// Short two-tone "ding" played on important guest notifications.
// WebSocket connection itself now lives in WSContext (single shared socket).
export function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    function tone(freq, start, dur) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, start)
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.35, start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur)
      osc.start(start)
      osc.stop(start + dur)
    }
    tone(880, ctx.currentTime, 0.35)
    tone(1100, ctx.currentTime + 0.18, 0.45)
    setTimeout(() => ctx.close(), 1200)
  } catch {}
}
