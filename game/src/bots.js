// Rustline bots and two Signal Crew mates share one brain with a tactical loop:
// patrol a named waypoint route through the interchange, hold the final point covering a
// platform lane, engage on sight, and push to the last seen position when contact breaks.
// Blinded bots halt and hold fire entirely. Heads are a separate hitbox (see damage model
// in weapons.js). Scratch vectors are module-level so the per-step loop allocates nothing.
import * as THREE from 'three';
import { collide, losBlocked } from './world.js';

const NAMES_E = ['Vex', 'Moss', 'Juno', 'Pike'];
const NAMES_F = ['Alto', 'Bex'];

// Named routes over the world waypoint graph (indices into world.waypoints).
// pts are walked in order; at the last point the bot holds for `hold` seconds, facing
// `face` down the lane it covers, scanning slowly, before looping the route again.
export const ROUTES = [
  { name: 'East Platform Lane', pts: [11, 7, 6, 5, 4], hold: 6, face: [-1, 0.2] },
  { name: 'Train Door Guard', pts: [5, 4, 3], hold: 7, face: [0, 1] },
  { name: 'West Platform Lane', pts: [10, 8, 0, 1, 2], hold: 6, face: [1, -0.2] },
  { name: 'Hall Sweep', pts: [9, 8, 7, 6], hold: 5, face: [-1, 0.3] },
];

const _tp = new THREE.Vector3();
const _tgt = new THREE.Vector3();
const _strafe = new THREE.Vector3();
const _chase = new THREE.Vector3();

function makeFigure(scene, color, name) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x22242a, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.34), mat); body.position.y = 1.05; body.castShadow = true; g.add(body);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.3), dark); legs.position.y = 0.31; g.add(legs);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), new THREE.MeshStandardMaterial({ color: 0xd9b48f, roughness: 0.7 })); head.position.y = 1.68; head.castShadow = true; g.add(head);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.6), dark); gun.position.set(0.2, 1.25, -0.3); g.add(gun);
  body.userData.part = 'body'; head.userData.part = 'head'; legs.userData.part = 'body';
  scene.add(g);
  return { group: g, hitMeshes: [body, head, legs], name };
}

export function createBot(scene, spawn, team, idx, rng, waypoints) {
  const fig = makeFigure(scene, team === 'E' ? 0xc65a3a : 0x2e7d6b, team === 'E' ? NAMES_E[idx] : NAMES_F[idx]);
  const route = ROUTES[(idx + (team === 'F' ? 2 : 0)) % ROUTES.length];
  const bot = {
    team, name: fig.name, pos: spawn.clone(), hp: 100, alive: true, group: fig.group, hitMeshes: fig.hitMeshes,
    wp: Math.floor(rng() * waypoints.length), cool: 1 + rng() * 1.5, burst: 0, blind: 0, speed: 2.6 + rng() * 0.7, strafe: rng() > 0.5 ? 1 : -1, strafeT: 0,
    route, routeName: route.name, rpos: 0, holding: false, holdT: 0, scan: rng() * 6.28,
    lastSeen: new THREE.Vector3(), lastSeenAge: 99,
    reset(sp) {
      this.pos.copy(sp); this.hp = 100; this.alive = true; this.group.visible = true;
      this.cool = 1 + rng() * 1.2; this.blind = 0; this.rpos = 0; this.holding = false; this.holdT = 0; this.lastSeenAge = 99;
      this.sync();
    },
    sync() { this.group.position.copy(this.pos); },
    aimPoint(out) { const v = out || new THREE.Vector3(); return v.set(this.pos.x, 1.45, this.pos.z); },
    headPoint(out) { const v = out || new THREE.Vector3(); return v.set(this.pos.x, 1.68, this.pos.z); },
    damage(amount, part) {
      if (!this.alive) return false;
      this.hp -= amount;
      if (this.hp <= 0) { this.alive = false; this.group.visible = false; return true; }
      return false;
    },
  };
  for (const m of fig.hitMeshes) m.userData.bot = bot;
  bot.sync();
  return bot;
}

// One simulation step. Returns a shot request {bot, target, hit, head, dist} when the bot fires.
export function stepBot(bot, dt, ctx) {
  if (!bot.alive) return null;
  bot.blind = Math.max(0, bot.blind - dt); bot.cool -= dt; bot.strafeT -= dt;
  bot.lastSeenAge += dt; bot.scan += dt;
  // Blinded bots stop dead: no target acquisition, no fire, no movement until it clears.
  if (bot.blind > 0) { bot.sync(); return null; }
  // Pick the nearest visible opponent (player or opposing bot).
  let target = null; let best = 1e9;
  for (const o of ctx.opponents) {
    if (!o.alive) continue;
    if (o.isPlayer) _tp.set(o.pos.x, 1.4, o.pos.z); else o.aimPoint(_tp);
    const d = bot.pos.distanceTo(_tp);
    if (d < best && d < 34 && !losBlocked(bot.pos, _tp, ctx.colliders)) { best = d; target = o; _tgt.copy(_tp); }
  }
  let moveTarget = null;
  if (target) {
    // Contact: remember exactly where the opponent was for the pursuit below.
    bot.lastSeen.set(_tgt.x, 0, _tgt.z); bot.lastSeenAge = 0; bot.holding = false;
    bot.group.rotation.y = Math.atan2(_tgt.x - bot.pos.x, _tgt.z - bot.pos.z) + Math.PI;
    if (bot.strafeT <= 0) { bot.strafe = -bot.strafe; bot.strafeT = 0.9 + ctx.rng() * 1.1; }
    if (best > 9) moveTarget = _tgt; else {
      // Strafe sideways while fighting up close.
      const dx = _tgt.x - bot.pos.x; const dz = _tgt.z - bot.pos.z; const l = Math.hypot(dx, dz) || 1;
      _strafe.set(bot.pos.x + (-dz / l) * bot.strafe * 2, 0, bot.pos.z + (dx / l) * bot.strafe * 2);
      moveTarget = _strafe;
    }
    if (bot.cool <= 0) {
      // Longer pauses between bursts and a steeper range falloff, so closing distance
      // (or forcing bots to reposition) matters more than standing in the open.
      bot.burst += 1; bot.cool = bot.burst >= 3 ? 1.05 + ctx.rng() * 0.55 : 0.17; if (bot.burst >= 3) bot.burst = 0;
      const hitChance = Math.max(0.1, 0.5 - best * 0.014 - (target.isPlayer ? ctx.playerSpeed * 0.035 : 0));
      return { bot, target, hit: ctx.rng() < hitChance, head: ctx.rng() < 0.18, dist: best };
    }
  } else if (bot.lastSeenAge < 4) {
    // Contact lost recently: advance on the last seen position and clear it on arrival.
    _chase.copy(bot.lastSeen);
    if (Math.hypot(_chase.x - bot.pos.x, _chase.z - bot.pos.z) < 1.2) bot.lastSeenAge = 99;
    else moveTarget = _chase;
  } else if (ctx.objective) {
    moveTarget = ctx.objective;
    if (bot.pos.distanceTo(ctx.objective) < 1.2 && ctx.onArrive) ctx.onArrive(bot);
  } else if (bot.holding) {
    // Hold the end of the route: stand the lane, face its cover direction, scan slowly.
    bot.holdT -= dt;
    bot.group.rotation.y = Math.atan2(bot.route.face[0], bot.route.face[1]) + Math.PI + Math.sin(bot.scan * 0.6) * 0.4;
    if (bot.holdT <= 0) { bot.holding = false; bot.rpos = 0; }
  } else {
    // Patrol the named route waypoint by waypoint; reaching the last one starts the hold.
    const wp = ctx.waypoints[bot.route.pts[bot.rpos]];
    if (bot.pos.distanceTo(wp) < 1.4) {
      if (bot.rpos >= bot.route.pts.length - 1) { bot.holding = true; bot.holdT = bot.route.hold + ctx.rng() * 2.5; }
      else bot.rpos++;
    }
    moveTarget = wp;
  }
  if (moveTarget) {
    const dx = moveTarget.x - bot.pos.x; const dz = moveTarget.z - bot.pos.z; const l = Math.hypot(dx, dz);
    if (l > 0.25) {
      bot.pos.x += (dx / l) * bot.speed * dt; bot.pos.z += (dz / l) * bot.speed * dt;
      if (!target) bot.group.rotation.y = Math.atan2(dx, dz) + Math.PI;
    }
  }
  collide(bot.pos, 0.42, ctx.colliders);
  bot.sync();
  return null;
}
