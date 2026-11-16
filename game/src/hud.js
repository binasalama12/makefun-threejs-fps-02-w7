// DOM layer for the whole HUD: health / money / ammo / timer / team score readouts, the
// transient centre message, hitmarkers (red for body, gold and larger for headshots), a
// five-line kill feed, a round-result banner, the white-out overlay when the player is
// flashed, plus the start, buy and scoreboard panels.
export function createHud() {
  const el = (id) => document.getElementById(id);
  const ov = el('overlay');
  const feedBox = el('feed');
  const bannerBox = el('banner');
  let hitTimer = null;
  let bannerTimer = null;
  return {
    set(hp, money, mag, res, wname, nades, round, tsec, us, them, obj, frags) {
      const hpEl = el('hpv');
      hpEl.textContent = Math.max(0, Math.ceil(hp));
      hpEl.style.color = hp <= 30 ? '#ff5a3c' : '';
      el('money').textContent = '$' + money;
      el('mag').textContent = mag; el('res').textContent = res;
      el('wname').textContent = wname; el('nade').textContent = nades;
      const fr = el('frag'); if (fr) fr.textContent = frags || 0;
      el('round').textContent = round;
      const timerEl = el('timer');
      timerEl.textContent = Math.floor(tsec / 60) + ':' + String(Math.floor(tsec % 60)).padStart(2, '0');
      timerEl.style.color = tsec <= 10 ? '#ff5a3c' : '';
      el('teamscore').textContent = 'SIGNAL ' + us + ' — ' + them + ' RUSTLINE';
      if (obj) el('obj').textContent = obj;
    },
    msg(text, ms) { const m = el('msg'); m.textContent = text; if (ms) setTimeout(() => { if (m.textContent === text) m.textContent = ''; }, ms); },
    hitmark(head) {
      const h = el('hit');
      h.style.color = head ? '#ffd23c' : '#ff5a3c';
      h.style.fontSize = head ? '32px' : '22px';
      h.style.opacity = 1;
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => { h.style.opacity = 0; }, head ? 170 : 110);
    },
    // Kill feed: newest event on top, capped at five lines, each fading after ~5 s.
    feed(text, cls) {
      if (!feedBox) return;
      const row = document.createElement('div');
      if (cls) row.className = cls;
      row.textContent = text;
      feedBox.prepend(row);
      while (feedBox.children.length > 5) feedBox.lastChild.remove();
      setTimeout(() => { row.style.opacity = '0'; setTimeout(() => row.remove(), 350); }, 5000);
    },
    clearFeed() { if (feedBox) feedBox.innerHTML = ''; },
    // Round banner: big centred ROUND WON / ROUND LOST with the reason underneath.
    banner(title, sub, cls) {
      if (!bannerBox) return;
      el('banner-title').textContent = title;
      el('banner-sub').textContent = sub || '';
      bannerBox.className = cls || '';
      bannerBox.hidden = false;
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => { bannerBox.hidden = true; }, 3400);
    },
    // Player flash white-out: opacity follows the remaining blind time.
    blindFx(seconds) {
      const b = el('blind'); if (!b) return;
      b.style.opacity = seconds > 0 ? Math.min(0.95, seconds / 1.4) : 0;
    },
    show(title, copy, extra, btn) { el('ov-title').textContent = title; el('ov-copy').textContent = copy; el('ov-extra').innerHTML = extra || ''; el('play').textContent = btn || 'Play'; ov.hidden = false; },
    hide() { ov.hidden = true; },
    get visible() { return !ov.hidden; },
    onPlay(fn) { el('play').addEventListener('click', fn); },
  };
}
