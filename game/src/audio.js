// Every sound is synthesised live with oscillators and filtered noise; no audio files are shipped.
export function createAudio() {
  let ctx = null;
  function ensure() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; } }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, dur, type, gain, slide) {
    const c = ensure(); if (!c) return;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), c.currentTime + dur);
    g.gain.setValueAtTime(gain || 0.08, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + dur);
  }
  function noise(dur, gain, freq) {
    const c = ensure(); if (!c) return;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 1800;
    const g = c.createGain(); g.gain.value = gain || 0.15;
    src.connect(f); f.connect(g); g.connect(c.destination); src.start();
  }
  return {
    unlock() { ensure(); },
    shot(kind) { if (kind === 'rail') { tone(140, 0.18, 'sawtooth', 0.12, -90); noise(0.1, 0.1, 3000); } else if (kind === 'pump') { noise(0.22, 0.25, 900); } else { noise(0.09, 0.16, 2200); tone(220, 0.05, 'square', 0.05, -120); } },
    dry() { tone(1200, 0.04, 'square', 0.05); },
    reload() { tone(500, 0.06, 'square', 0.06); setTimeout(() => tone(750, 0.06, 'square', 0.06), 160); },
    hit() { tone(900, 0.05, 'square', 0.06); },
    headshot() { tone(1560, 0.07, 'square', 0.09); setTimeout(() => tone(2090, 0.06, 'square', 0.07), 40); noise(0.05, 0.06, 4000); },
    hurt() { tone(110, 0.15, 'sawtooth', 0.1, -40); },
    plant() { tone(660, 0.09, 'sine', 0.09); },
    beep(fast) { tone(fast ? 1320 : 880, 0.07, 'sine', 0.08); },
    boom() { noise(0.9, 0.4, 300); tone(55, 0.8, 'sine', 0.3, -20); },
    flash() { tone(2400, 0.25, 'sine', 0.1, -1600); noise(0.15, 0.08, 5000); },
    toss() { noise(0.12, 0.07, 1200); tone(320, 0.1, 'sine', 0.05, 180); },
    buy() { tone(1040, 0.07, 'sine', 0.07); setTimeout(() => tone(1560, 0.09, 'sine', 0.07), 80); },
    round(win) { tone(win ? 523 : 262, 0.16, 'triangle', 0.1); setTimeout(() => tone(win ? 784 : 196, 0.24, 'triangle', 0.1), 150); },
  };
}
