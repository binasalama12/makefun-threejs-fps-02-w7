// Keyboard set plus pointer-lock mouse deltas; in screenshot mode nothing ever locks.
export function createInput(el, onLock) {
  const keys = new Set(); let lx = 0; let ly = 0; let firing = false; let clicked = false;
  addEventListener('keydown', (e) => { keys.add(e.code); if (['Space', 'ControlLeft'].includes(e.code)) e.preventDefault(); });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('mousemove', (e) => { if (document.pointerLockElement === el) { lx += e.movementX; ly += e.movementY; } });
  addEventListener('mousedown', (e) => { if (e.button === 0) { firing = true; clicked = true; } });
  addEventListener('mouseup', (e) => { if (e.button === 0) firing = false; });
  document.addEventListener('pointerlockchange', () => onLock(document.pointerLockElement === el));
  return {
    keys,
    get firing() { return firing; },
    takeClick() { const c = clicked; clicked = false; return c; },
    takeLook() { const v = { x: lx, y: ly }; lx = 0; ly = 0; return v; },
    lock() { el.requestPointerLock(); },
  };
}
