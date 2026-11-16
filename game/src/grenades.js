// Grenade system: one job — projectile physics for throwable ordnance.
// Two types share the same arc/bounce simulation and differ only in fuse and payload,
// which the owner (main.js) resolves through the onDetonate callback:
//   frag  — 1.9 s fuse, radial damage with linear falloff (damage model lives in main).
//   flash — 1.15 s fuse, blinds anything looking at the pop with a clear line of sight.
// Meshes, geometry and materials are created once and shared; per-step work reuses
// module-level scratch vectors so the hot loop allocates nothing.
import * as THREE from 'three';
import { collide } from './world.js';

export const GRENADE_TYPES = {
  frag: { fuse: 1.9, power: 17, radius: 6.5 },
  flash: { fuse: 1.15, power: 19, radius: 15 },
};

const GRAVITY = 19;
const FLOOR_Y = 0.16;
const _prev = new THREE.Vector3();

export function createGrenades(scene) {
  const fragGeo = new THREE.SphereGeometry(0.13, 10, 8);
  const flashGeo = new THREE.SphereGeometry(0.11, 10, 8);
  const fragMat = new THREE.MeshStandardMaterial({ color: 0x3a4038, roughness: 0.55, metalness: 0.35 });
  const fragBand = new THREE.MeshStandardMaterial({ color: 0xc65a3a, roughness: 0.6 });
  const flashMat = new THREE.MeshStandardMaterial({ color: 0xf5c518, roughness: 0.35, emissive: 0xf5c518, emissiveIntensity: 0.7 });
  const active = [];

  function spawn(type, origin, dir, power) {
    const def = GRENADE_TYPES[type];
    if (!def) return;
    const mesh = new THREE.Mesh(type === 'frag' ? fragGeo : flashGeo, type === 'frag' ? fragMat : flashMat);
    if (type === 'frag') {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.028, 6, 14), fragBand);
      band.rotation.x = Math.PI / 2; mesh.add(band);
    }
    mesh.position.copy(origin);
    mesh.castShadow = true;
    scene.add(mesh);
    active.push({
      type, mesh, fuse: def.fuse,
      pos: origin.clone(),
      vel: new THREE.Vector3(dir.x * (power || def.power), dir.y * (power || def.power) + 4.2, dir.z * (power || def.power)),
      spin: 5 + Math.random() * 5,
    });
  }

  // Advance every live grenade. ctx: { colliders, onDetonate(type, pos) }.
  function step(dt, ctx) {
    for (let i = active.length - 1; i >= 0; i--) {
      const g = active[i];
      g.fuse -= dt;
      _prev.copy(g.pos);
      g.vel.y -= GRAVITY * dt;
      g.pos.addScaledVector(g.vel, dt);
      // Floor bounce: restitution plus friction so the grenade settles and rolls.
      if (g.pos.y < FLOOR_Y) {
        g.pos.y = FLOOR_Y;
        if (g.vel.y < 0) { g.vel.y = -g.vel.y * 0.42; g.vel.x *= 0.7; g.vel.z *= 0.7; }
        if (Math.abs(g.vel.y) < 0.6) g.vel.y = 0;
      }
      // Wall collision via the world AABB solver; a pushed axis means a bounce off that wall.
      collide(g.pos, 0.18, ctx.colliders);
      if (g.pos.x !== _prev.x + g.vel.x * dt && Math.abs(g.vel.x) > 0.1) g.vel.x *= -0.35;
      if (g.pos.z !== _prev.z + g.vel.z * dt && Math.abs(g.vel.z) > 0.1) g.vel.z *= -0.35;
      g.mesh.position.copy(g.pos);
      g.mesh.rotation.x += g.spin * dt; g.mesh.rotation.z += g.spin * 0.6 * dt;
      if (g.fuse <= 0) {
        scene.remove(g.mesh);
        active.splice(i, 1);
        ctx.onDetonate(g.type, g.pos);
      }
    }
  }

  function clear() {
    for (const g of active) scene.remove(g.mesh);
    active.length = 0;
  }

  return { spawn, step, clear, get count() { return active.length; } };
}
