// Thin DOM layer: every readout the player needs, plus the start, buy and scoreboard panels.
export function createHud() {
  const el = (id) => document.getElementById(id);
  const ov = el('overlay');
  let hitTimer = null;
  return {
    set(hp, money, mag, res, wname, nades, round, tsec, us, them, obj) {
      el('hpv').textContent = Math.max(0, Math.ceil(hp));
      el('money').textContent = '$' + money;
      el('mag').textContent = mag; el('res').textContent = res;
      el('wname').textContent = wname; el('nade').textContent = nades;
      el('round').textContent = round;
      el('timer').textContent = Math.floor(tsec / 60) + ':' + String(Math.floor(tsec % 60)).padStart(2, '0');
      el('teamscore').textContent = 'SIGNAL ' + us + ' — ' + them + ' RUSTLINE';
      if (obj) el('obj').textContent = obj;
    },
    msg(text, ms) { const m = el('msg'); m.textContent = text; if (ms) setTimeout(() => { if (m.textContent === text) m.textContent = ''; }, ms); },
    hitmark() { const h = el('hit'); h.style.opacity = 1; clearTimeout(hitTimer); hitTimer = setTimeout(() => { h.style.opacity = 0; }, 110); },
    show(title, copy, extra, btn) { el('ov-title').textContent = title; el('ov-copy').textContent = copy; el('ov-extra').innerHTML = extra || ''; el('play').textContent = btn || 'Play'; ov.hidden = false; },
    hide() { ov.hidden = true; },
    get visible() { return !ov.hidden; },
    onPlay(fn) { el('play').addEventListener('click', fn); },
  };
}
