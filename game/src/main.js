// LAST TRAIN: Subway Interchange — round-based tactical FPS in a metro station.
// Signal Crew (you + two mates) plant a charge on the stopped train; Rustline bots defend
// and defuse. Fixed-step simulation, rendering on rAF, everything offline.
import * as THREE from 'three';
import { mulberry32 } from './rng.js';
import { createAudio } from './audio.js';
import { createWorld } from './world.js';
import { createPlayer } from './player.js';
import { createInput } from './input.js';
import { createArsenal, WEAPONS, NADE, FRAG } from './weapons.js';
import { createBot, stepBot } from './bots.js';
import { createHud } from './hud.js';
import { createGrenades, GRENADE_TYPES } from './grenades.js';
import { losBlocked } from './world.js';

const STEP = 1 / 60;
const params = new URLSearchParams(location.search);
const shot = params.get('shot');
const rng = mulberry32(Number.parseInt(params.get('seed') ?? '7', 10) || 7);
const audio = createAudio();
const hud = createHud();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.getElementById('game').appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0c0e10);
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 160); scene.add(camera);

const world = createWorld(scene);
const player = createPlayer(world.colliders, world.playerSpawn);
const arsenal = createArsenal(camera);
const grenades = createGrenades(scene);
const enemies = world.botSpawns.map((s, i) => createBot(scene, s, 'E', i, rng, world.waypoints));
const mates = world.mateSpawns.map((s, i) => createBot(scene, s, 'F', i, rng, world.waypoints));
const allHit = []; for (const b of [...enemies, ...mates]) allHit.push(...b.hitMeshes);
const ray = new THREE.Raycaster(); ray.far = 130;
const tmpV = new THREE.Vector3();

const G = { phase: 'menu', round: 1, us: 0, them: 0, money: 800, timer: 90, plantT: 0, fuse: 0, defuse: 0, overT: 0, started: false, kills: 0, playerBlind: 0 };
const playerEnt = { isPlayer: true, get alive() { return player.state.hp > 0; }, get pos() { return player.state.pos; } };

function shopHtml() {
  return '<div class="shop">' + WEAPONS.map((w, i) => '<div><span>' + (i + 1) + ' · ' + w.name + ' — dmg ' + w.dmg + ', mag ' + w.mag + '</span><b>$' + w.price + (arsenal.owned[i] ? ' OWNED' : '') + '</b></div>').join('') +
    '<div><span>5 · ' + NADE.name + ' (throw with G)</span><b>$' + NADE.price + '</b></div>' +
    '<div><span>6 · ' + FRAG.name + ' (throw with Q)</span><b>$' + FRAG.price + '</b></div></div>';
}
function scoreHtml() {
  return '<table><tr><th>Crew</th><th>Rounds</th></tr><tr><td>Signal Crew (you, Alto, Bex)</td><td>' + G.us + '</td></tr><tr><td>Rustline (Vex, Moss, Juno, Pike)</td><td>' + G.them + '</td></tr></table><p>Your eliminations: ' + G.kills + ' · Cash: $' + G.money + '</p>';
}

function resetRound() {
  player.state.pos.copy(world.playerSpawn); player.state.vel.set(0, 0, 0); player.state.hp = 100; player.state.yaw = 0; player.state.pitch = 0;
  enemies.forEach((b, i) => b.reset(world.botSpawns[i]));
  mates.forEach((b, i) => b.reset(world.mateSpawns[i]));
  arsenal.refillAll(); grenades.clear();
  // Per-round grenade grant: every crew member starts a round holding at least one of each.
  if (arsenal.state.nades < 1) arsenal.state.nades = 1;
  if (arsenal.state.frags < 1) arsenal.state.frags = 1;
  G.plantT = 0; G.fuse = 0; G.defuse = 0;
  G.phase = 'buy'; G.timer = 10;
  hud.msg('BUY PHASE — keys 1-5 spend cash, round ' + G.round, 2600);
}
function endRound(win, why) {
  if (G.phase === 'over' || G.phase === 'matchover') return;
  if (win) { G.us++; G.money += 2900; } else { G.them++; G.money += 1400; }
  G.money += G.kills * 0; audio.round(win);
  hud.msg((win ? 'SIGNAL TAKES THE ROUND — ' : 'RUSTLINE TAKES THE ROUND — ') + why, 3200);
  G.phase = 'over'; G.overT = 3.6;
  if (G.us >= 6 || G.them >= 6 || G.round >= 9) { G.phase = 'matchover'; setTimeout(() => { if (!shot) { hud.show(G.us > G.them ? 'SIGNAL WINS THE STATION' : 'RUSTLINE HOLDS THE STATION', 'Final score from Subway Interchange.', scoreHtml(), 'Play again'); document.exitPointerLock?.(); } }, 900); }
}
function startMatch() { G.us = 0; G.them = 0; G.round = 1; G.money = 800; G.kills = 0; G.started = true; resetRound(); }

const input = createInput(renderer.domElement, (locked) => {
  if (shot) return;
  if (locked) { hud.hide(); audio.unlock(); if (!G.started) startMatch(); }
  else if (G.started && G.phase !== 'matchover') hud.show('PAUSED', 'The interchange waits for no one.', shopHtml(), 'Resume');
});
hud.onPlay(() => { if (shot) return; if (G.phase === 'matchover' || !G.started) { G.started = false; startMatch(); } input.lock(); });
hud.show('LAST TRAIN — SUBWAY INTERCHANGE', 'Signal Crew must plant a charge on the stopped train at the platform, or clear Rustline out. First to 6 rounds.', shopHtml(), 'Enter the station');

function inPlantZone() { const p = player.state.pos; const z = world.plantZone; return p.x > z.minX && p.x < z.maxX && p.z > z.minZ && p.z < z.maxZ; }

function playerShoot() {
  const w = arsenal.def();
  if (!arsenal.ready()) return;
  if (arsenal.state.mag <= 0) { audio.dry(); arsenal.state.cooldown = 0.3; return; }
  audio.shot(w.id); arsenal.takeRound();
  camera.getWorldDirection(tmpV);
  for (let p = 0; p < w.pellets; p++) {
    const s = arsenal.spread(player.speed(), player.state.crouch, false);
    const dir = tmpV.clone(); dir.x += (rng() * 2 - 1) * s; dir.y += (rng() * 2 - 1) * s; dir.z += (rng() * 2 - 1) * s; dir.normalize();
    ray.set(camera.position, dir); ray.far = w.range;
    const hits = ray.intersectObjects([...world.shootables, ...enemies.filter((b) => b.alive).flatMap((b) => b.hitMeshes)], false);
    if (hits.length) {
      const bot = hits[0].object.userData.bot; const part = hits[0].object.userData.part;
      if (bot && bot.team === 'E') {
        const killed = bot.damage(part === 'head' ? w.dmg * w.headMult : w.dmg, part); audio.hit(); hud.hitmark();
        if (killed) { G.kills++; G.money += 300; hud.msg(bot.name + ' down +$300', 1200); }
      }
    }
  }
  arsenal.fired();
  player.state.pitch += w.kick * (0.7 + rng() * 0.6); player.state.yaw += (rng() * 2 - 1) * w.kick * 0.35;
}
function throwNade() {
  if (arsenal.state.nades <= 0 || G.phase === 'buy' || G.phase === 'over') return;
  arsenal.state.nades--; audio.toss();
  camera.getWorldDirection(tmpV);
  const origin = camera.position.clone(); origin.addScaledVector(tmpV, 0.6);
  grenades.spawn('flash', origin, tmpV);
  hud.msg('Flash out!', 700);
}
function throwFrag() {
  if (arsenal.state.frags <= 0 || G.phase === 'buy' || G.phase === 'over') return;
  arsenal.state.frags--; audio.toss();
  camera.getWorldDirection(tmpV);
  const origin = camera.position.clone(); origin.addScaledVector(tmpV, 0.6);
  grenades.spawn('frag', origin, tmpV);
  hud.msg('Frag out!', 700);
}
// Payload resolution for grenades.js: frag = radial damage with linear falloff (walls
// absorb most of the blast); flash = line-of-sight plus facing check, bots and player alike.
const _exp = new THREE.Vector3();
function onDetonate(type, pos) {
  if (type === 'frag') {
    audio.boom();
    const R = GRENADE_TYPES.frag.radius;
    for (const b of [...enemies, ...mates]) {
      if (!b.alive) continue;
      _exp.set(b.pos.x, 0.9, b.pos.z);
      const d = _exp.distanceTo(pos);
      if (d >= R) continue;
      let dmg = 115 * (1 - d / R) + 8;
      if (losBlocked(pos, _exp, world.colliders)) dmg *= 0.3;
      const killed = b.damage(dmg, 'body');
      if (killed && b.team === 'E') { G.kills++; G.money += 300; hud.msg('Frag takes ' + b.name + ' +$300', 1500); }
      else if (killed) hud.msg('Friendly fire — frag got ' + b.name + '!', 1500);
    }
    const pd = Math.hypot(player.state.pos.x - pos.x, player.state.pos.z - pos.z);
    if (pd < R && player.state.hp > 0) player.state.hp -= Math.max(4, 60 * (1 - pd / R));
    hud.msg('Frag detonates!', 900);
  } else {
    audio.flash();
    let blinded = 0;
    for (const b of [...enemies, ...mates]) {
      if (!b.alive) continue;
      _exp.set(b.pos.x, 1.4, b.pos.z);
      const d = _exp.distanceTo(pos);
      if (d >= GRENADE_TYPES.flash.radius) continue;
      if (d > 2.5 && losBlocked(pos, _exp, world.colliders)) continue;
      // Bot forward is -Z of its group rotation (gun side); point-blank pops blind regardless.
      const fx = -Math.sin(b.group.rotation.y); const fz = -Math.cos(b.group.rotation.y);
      const tx = pos.x - b.pos.x; const tz = pos.z - b.pos.z; const tl = Math.hypot(tx, tz) || 1;
      if (d <= 2.5 || (tx / tl) * fx + (tz / tl) * fz > 0.05) { b.blind = Math.max(b.blind, b.team === 'E' ? 3.4 : 2.2); if (b.team === 'E') blinded++; }
    }
    camera.getWorldDirection(tmpV);
    _exp.copy(pos).sub(camera.position);
    const pd = _exp.length();
    if (pd < GRENADE_TYPES.flash.radius && _exp.normalize().dot(tmpV) > 0.05 && !losBlocked(camera.position, pos, world.colliders)) {
      G.playerBlind = 1.8; hud.msg('You looked at the flash!', 1200);
    }
    hud.msg(blinded ? 'Flash blinds ' + blinded + ' Rustline!' : 'Flash pops — nobody looking', 1500);
  }
}
function buyKey(code) {
  const map = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 };
  if (code in map) {
    const i = map[code];
    if (arsenal.owned[i]) arsenal.equip(i);
    else if (G.phase === 'buy') { const left = arsenal.buy(i, G.money); if (left >= 0) { G.money = left; arsenal.equip(i); audio.buy(); } else hud.msg('Not enough cash for ' + WEAPONS[i].name, 1400); }
    else hud.msg('Buy window closed — weapons switch only if owned', 1400);
  }
  if (code === 'Digit5' && G.phase === 'buy' && G.money >= NADE.price) { G.money -= NADE.price; arsenal.state.nades++; audio.buy(); }
  if (code === 'Digit6' && G.phase === 'buy') { if (G.money >= FRAG.price) { G.money -= FRAG.price; arsenal.state.frags++; audio.buy(); } else hud.msg('Not enough cash for ' + FRAG.name, 1400); }
}

let beepT = 0;
function sim(dt) {
  world.update(performance.now() / 1000);
  if (!G.started || G.phase === 'menu' || G.phase === 'matchover') return;
  const look = input.takeLook(); player.step(dt, input.keys, G.phase === 'over' ? { x: 0, y: 0 } : look);
  arsenal.step(dt);
  if (G.phase === 'over') { G.overT -= dt; if (G.overT <= 0 && G.us < 6 && G.them < 6) { G.round++; resetRound(); } return; }
  G.timer -= dt;
  if (input.takeClick() || (arsenal.def().auto && input.firing)) playerShoot();
  else input.takeClick();
  if (input.keys.has('KeyR') && arsenal.reload()) audio.reload();
  if (input.keys.has('KeyG')) { input.keys.delete('KeyG'); throwNade(); }
  if (input.keys.has('KeyQ')) { input.keys.delete('KeyQ'); throwFrag(); }
  grenades.step(dt, { colliders: world.colliders, onDetonate });
  G.playerBlind = Math.max(0, G.playerBlind - dt);
  for (const c of ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6']) if (input.keys.has(c)) { input.keys.delete(c); buyKey(c); }
  if (input.keys.has('KeyB')) { input.keys.delete('KeyB'); hud.msg(WEAPONS.map((w, i) => (i + 1) + ':' + w.name + ' $' + w.price).join(' · ') + ' · 5:Flash $' + NADE.price + ' · 6:Frag $' + FRAG.price, 3500); }
  // Planting and defusing.
  if (G.phase === 'live' && input.keys.has('KeyF') && inPlantZone() && player.state.hp > 0) {
    G.plantT += dt; if (G.plantT > 0.4 && G.plantT < 0.5) audio.plant();
    hud.msg('Planting charge… ' + Math.floor(G.plantT / 3 * 100) + '%', 200);
    if (G.plantT >= 3) { G.phase = 'planted'; G.fuse = 14; hud.msg('CHARGE PLANTED — defend it!', 2400); }
  } else if (G.phase === 'live') G.plantT = Math.max(0, G.plantT - dt * 2);
  if (G.phase === 'planted') {
    G.fuse -= dt; beepT -= dt; if (beepT <= 0) { audio.beep(G.fuse < 5); beepT = G.fuse < 5 ? 0.3 : 0.8; }
    if (G.defuse >= 4) { endRound(false, 'charge defused at the train'); return; }
    if (G.fuse <= 0) { audio.boom(); endRound(true, 'charge detonated on the train'); return; }
  }
  // Bots: enemies hunt the player crew (or rush the charge once planted); mates guard and push.
  const pSpeed = player.speed();
  const eCtx = { opponents: [playerEnt, ...mates], colliders: world.colliders, waypoints: world.waypoints, rng, playerSpeed: pSpeed, objective: G.phase === 'planted' ? new THREE.Vector3(2, 0, -6.8) : null, onArrive: () => { if (G.phase === 'planted') G.defuse += dt; } };
  for (const b of enemies) { const s = stepBot(b, dt, eCtx); if (s) resolveBotShot(s); }
  const mCtx = { opponents: enemies, colliders: world.colliders, waypoints: world.waypoints, rng, playerSpeed: 0, objective: G.phase === 'planted' ? new THREE.Vector3(-1, 0, -4) : null, onArrive: null };
  for (const b of mates) { const s = stepBot(b, dt, mCtx); if (s) resolveBotShot(s); }
  // Round endings by elimination or clock.
  if (enemies.every((b) => !b.alive)) { endRound(true, 'Rustline eliminated'); return; }
  if (player.state.hp <= 0 && mates.every((b) => !b.alive)) { endRound(false, 'Signal Crew eliminated'); return; }
  if (G.phase === 'live' && G.timer <= 0) { endRound(false, 'time expired, no plant'); return; }
  if (G.phase === 'buy' && G.timer <= 0) { G.phase = 'live'; G.timer = 90; hud.msg('ROUND ' + G.round + ' — plant at the train or clear Rustline', 2200); }
}
function resolveBotShot(s) {
  audio.shot('carbine');
  if (!s.hit) return;
  const dmg = s.head ? 46 : 19;
  if (s.target.isPlayer) { player.state.hp -= dmg; audio.hurt(); hud.msg('Hit by ' + s.bot.name + '!', 700); }
  else s.target.damage(dmg, s.head ? 'head' : 'body');
}
function syncHud() {
  const t = G.phase === 'planted' ? G.fuse : G.timer;
  hud.set(player.state.hp, G.money, arsenal.state.mag, arsenal.state.reserve, arsenal.def().name, arsenal.state.nades, G.round, Math.max(0, t), G.us, G.them,
    G.phase === 'planted' ? 'DEFEND THE CHARGE — ' + G.fuse.toFixed(0) + 's' : G.phase === 'buy' ? 'Buy phase: keys 1-6' : 'Plant the charge at the train (hold F)', arsenal.state.frags);
}
function syncCam() { camera.position.set(player.state.pos.x, player.state.pos.y + player.state.eye, player.state.pos.z); camera.rotation.set(player.state.pitch, player.state.yaw, 0, 'YXZ'); }

// --- Deterministic screenshot scenes -------------------------------------------------
function runShot(mode) {
  G.started = true; G.money = 2650; G.round = 3; G.us = 2; G.them = 1; G.kills = 2;
  arsenal.buy(2, 99999); arsenal.equip(2); arsenal.state.nades = 1;
  if (mode === 'start') {
    player.state.pos.set(-6, 0, 18); player.state.yaw = 0.25; player.state.pitch = -0.02;
    mates.forEach((b, i) => { b.pos.set(-11 + i * 5, 0, 13.5); b.sync(); });
    enemies.forEach((b, i) => { b.pos.set(14 - i * 7, 0, 4 - (i % 2) * 5); b.sync(); });
    G.phase = 'buy'; G.timer = 8; syncCam(); syncHud();
    hud.show('LAST TRAIN — BUY PHASE', 'Round 3 loadout at the ticket hall. Signal Crew cash: $2,650.', shopHtml(), 'Enter the station');
  } else if (mode === 'play') {
    player.state.pos.set(-4, 0, 6); player.state.yaw = -0.55; player.state.pitch = 0.02;
    enemies.forEach((b, i) => { b.pos.set(2 + i * 2.8, 0, -3 - (i % 2) * 2.4); b.sync(); b.group.rotation.y = Math.PI * 0.8; });
    mates.forEach((b, i) => { b.pos.set(-9 + i * 2.5, 0, 9.5); b.sync(); });
    arsenal.state.mag = 24; player.state.hp = 76; G.phase = 'live'; G.timer = 57;
    hud.hide(); syncCam(); syncHud(); hud.hitmark();
  } else {
    player.state.pos.set(0, 0, 8); player.state.yaw = 0.1; player.state.pitch = -0.03;
    enemies.forEach((b, i) => { b.pos.set(8 - i * 5, 0, 0); b.sync(); });
    mates.forEach((b, i) => { b.pos.set(-6 + i * 4, 0, 5); b.sync(); });
    G.us = 6; G.them = 3; G.phase = 'matchover'; syncCam(); syncHud();
    hud.show('SIGNAL WINS THE STATION 6 — 3', 'Final scoreboard from Subway Interchange.', scoreHtml(), 'Play again');
  }
  let painted = 0;
  (function paint() { requestAnimationFrame(paint); world.update(1200); syncCam(); renderer.render(scene, camera); if (++painted === 3) window.__shotReady = true; })();
}

let acc = 0; let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.1); last = now;
  acc += dt; let n = 0;
  while (acc >= STEP && n < 5) { sim(STEP); acc -= STEP; n++; }
  if (acc > STEP * 5) acc = 0;
  syncCam(); if (!shot) syncHud();
  renderer.render(scene, camera);
}
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
if (shot) runShot(shot); else { syncCam(); requestAnimationFrame(frame); }
