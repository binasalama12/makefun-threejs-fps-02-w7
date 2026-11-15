// Four invented guns plus a flash pellet. Price, damage, cadence and handling all differ;
// standing still or crouching shrinks spread hard, sprinting and spraying blow it open.
import * as THREE from 'three';

export const WEAPONS = [
  { id: 'p9', name: 'P9 Sidearm', price: 300, dmg: 34, headMult: 3, mag: 12, reserve: 48, rpm: 320, auto: false, reload: 1.1, spread: 0.012, kick: 0.010, pellets: 1, range: 60 },
  { id: 'pump', name: 'Gatekeeper Pump', price: 900, dmg: 11, headMult: 2, mag: 6, reserve: 24, rpm: 75, auto: false, reload: 2.4, spread: 0.045, kick: 0.03, pellets: 8, range: 26 },
  { id: 'carbine', name: 'M7 Turnstile Carbine', price: 2400, dmg: 33, headMult: 3, mag: 30, reserve: 90, rpm: 640, auto: true, reload: 1.9, spread: 0.016, kick: 0.013, pellets: 1, range: 80 },
  { id: 'rail', name: 'Third-Rail Longshot', price: 4200, dmg: 96, headMult: 2, mag: 5, reserve: 20, rpm: 48, auto: false, reload: 2.6, spread: 0.003, kick: 0.045, pellets: 1, range: 120 },
];
export const NADE = { name: 'Flash Pellet', price: 200 };

export function createArsenal(camera) {
  const owned = [true, false, false, false];
  const state = { idx: 0, mag: WEAPONS[0].mag, reserve: WEAPONS[0].reserve, nades: 0, cooldown: 0, reloading: 0, bloom: 0 };
  const store = WEAPONS.map((w) => ({ mag: w.mag, reserve: w.reserve }));
  const group = new THREE.Group(); camera.add(group); group.position.set(0.28, -0.26, -0.55);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.4, metalness: 0.6 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0xf5c518, roughness: 0.5, metalness: 0.3 });
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.55), bodyMat); barrel.position.z = -0.2; group.add(barrel);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.1), bodyMat); grip.position.set(0, -0.12, 0.08); group.add(grip);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.03, 0.3), accentMat); stripe.position.set(0, 0.05, -0.15); group.add(stripe);
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffd76a })); flash.position.z = -0.52; flash.visible = false; group.add(flash);
  let flashT = 0;
  function def() { return WEAPONS[state.idx]; }
  function equip(i) {
    if (!owned[i]) return false;
    store[state.idx] = { mag: state.mag, reserve: state.reserve };
    state.idx = i; state.mag = store[i].mag; state.reserve = store[i].reserve; state.reloading = 0;
    barrel.scale.z = i === 3 ? 1.7 : i === 1 ? 0.8 : 1; return true;
  }
  function buy(i, money) {
    const w = WEAPONS[i]; if (owned[i] || money < w.price) return -1;
    owned[i] = true; store[i] = { mag: w.mag, reserve: w.reserve * 2 }; return money - w.price;
  }
  function refillAll() { WEAPONS.forEach((w, i) => { store[i] = { mag: w.mag, reserve: w.reserve }; }); state.mag = store[state.idx].mag; state.reserve = store[state.idx].reserve; state.reloading = 0; state.bloom = 0; }
  return {
    state, owned, def, equip, buy, refillAll, group,
    spread(speed, crouched, airborne) {
      const w = def(); let s = w.spread + state.bloom * 0.05 + speed * 0.006;
      if (crouched) s *= 0.55; if (airborne) s *= 2.1; return s;
    },
    ready() { return state.cooldown <= 0 && state.reloading <= 0; },
    takeRound() { if (state.mag <= 0) return false; state.mag -= 1; return true; },
    fired() { const w = def(); state.cooldown = 60 / w.rpm; state.bloom = Math.min(1, state.bloom + 0.22); flash.visible = true; flashT = 0.045; },
    reload() { const w = def(); if (state.reloading > 0 || state.mag >= w.mag || state.reserve <= 0) return false; state.reloading = w.reload; return true; },
    step(dt) {
      // Revision pass: bloom now settles faster (2.3/s), so disciplined tap-firing recovers
      // accuracy sooner while full-auto spray still opens the cone right up.
      state.cooldown = Math.max(0, state.cooldown - dt); state.bloom = Math.max(0, state.bloom - dt * 2.3);
      if (flashT > 0) { flashT -= dt; if (flashT <= 0) flash.visible = false; }
      if (state.reloading > 0) { state.reloading -= dt; if (state.reloading <= 0) { const w = def(); const need = w.mag - state.mag; const take = Math.min(need, state.reserve); state.mag += take; state.reserve -= take; } }
      group.position.y = -0.26 + Math.sin(performance.now() * 0.002) * 0.004;
    },
  };
}
