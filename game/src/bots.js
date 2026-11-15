// Rustline bots and two Signal Crew mates share one brain: walk the waypoint graph, keep a
// respectful distance, and only shoot with a clear line of sight. Heads take extra damage.
import * as THREE from 'three';
import { collide, losBlocked } from './world.js';

const NAMES_E = ['Vex', 'Moss', 'Juno', 'Pike'];
const NAMES_F = ['Alto', 'Bex'];

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
  const bot = {
    team, name: fig.name, pos: spawn.clone(), hp: 100, alive: true, group: fig.group, hitMeshes: fig.hitMeshes,
    wp: Math.floor(rng() * waypoints.length), cool: 1 + rng() * 1.5, burst: 0, blind: 0, speed: 2.6 + rng() * 0.7, strafe: rng() > 0.5 ? 1 : -1, strafeT: 0,
    reset(sp) { this.pos.copy(sp); this.hp = 100; this.alive = true; this.group.visible = true; this.cool = 1 + rng() * 1.2; this.sync(); },
    sync() { this.group.position.copy(this.pos); },
    aimPoint() { return new THREE.Vector3(this.pos.x, 1.45, this.pos.z); },
    headPoint() { return new THREE.Vector3(this.pos.x, 1.68, this.pos.z); },
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

// One simulation step. Returns a shot request {from, target, dmg} when the bot fires.
export function stepBot(bot, dt, ctx) {
  if (!bot.alive) return null;
  bot.blind = Math.max(0, bot.blind - dt); bot.cool -= dt; bot.strafeT -= dt;
  // Pick the nearest visible opponent (player or opposing bot).
  let target = null; let best = 1e9;
  for (const o of ctx.opponents) {
    if (!o.alive) continue;
    const tp = o.isPlayer ? new THREE.Vector3(o.pos.x, 1.4, o.pos.z) : o.aimPoint();
    const d = bot.pos.distanceTo(tp);
    if (d < best && d < 34 && bot.blind <= 0 && !losBlocked(bot.pos, tp, ctx.colliders)) { best = d; target = { ent: o, point: tp, dist: d }; }
  }
  let moveTarget = null;
  if (target) {
    bot.group.rotation.y = Math.atan2(target.point.x - bot.pos.x, target.point.z - bot.pos.z) + Math.PI;
    if (bot.strafeT <= 0) { bot.strafe = -bot.strafe; bot.strafeT = 0.9 + ctx.rng() * 1.1; }
    if (best > 9) moveTarget = target.point; else {
      // Strafe sideways while fighting up close.
      const dx = target.point.x - bot.pos.x; const dz = target.point.z - bot.pos.z; const l = Math.hypot(dx, dz) || 1;
      moveTarget = new THREE.Vector3(bot.pos.x + (-dz / l) * bot.strafe * 2, 0, bot.pos.z + (dx / l) * bot.strafe * 2);
    }
    if (bot.cool <= 0) {
      // Revision pass: longer pauses between bursts and a steeper range falloff, so closing
      // distance (or forcing bots to reposition) matters more than standing in the open.
      bot.burst += 1; bot.cool = bot.burst >= 3 ? 1.05 + ctx.rng() * 0.55 : 0.17; if (bot.burst >= 3) bot.burst = 0;
      const hitChance = Math.max(0.1, 0.5 - best * 0.014 - (target.ent.isPlayer ? ctx.playerSpeed * 0.035 : 0));
      return { bot, target: target.ent, hit: ctx.rng() < hitChance, head: ctx.rng() < 0.18, dist: best };
    }
  } else if (ctx.objective) {
    moveTarget = ctx.objective;
    if (bot.pos.distanceTo(ctx.objective) < 1.2 && ctx.onArrive) ctx.onArrive(bot);
  } else {
    const wp = ctx.waypoints[bot.wp];
    if (bot.pos.distanceTo(wp) < 1.4) bot.wp = (bot.wp + 1 + Math.floor(ctx.rng() * 3)) % ctx.waypoints.length;
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
