// Capsule-ish player: acceleration and friction, crouch that lowers the eye, simple AABB sliding.
import * as THREE from 'three';
import { collide } from './world.js';

export function createPlayer(colliders, spawn) {
  const state = { pos: spawn.clone(), vel: new THREE.Vector3(), yaw: 0, pitch: 0, hp: 100, crouch: false, eye: 1.62, dead: false };
  const SPEED = 5.4;
  function step(dt, keys, look) {
    state.yaw -= look.x * 0.0023; state.pitch = Math.max(-1.35, Math.min(1.35, state.pitch - look.y * 0.0023));
    state.crouch = keys.has('ControlLeft') || keys.has('KeyC');
    const targetEye = state.crouch ? 1.05 : 1.62; state.eye += (targetEye - state.eye) * Math.min(1, dt * 12);
    const walk = keys.has('ShiftLeft'); const max = state.crouch ? 2.1 : walk ? 2.8 : SPEED;
    const f = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
    const r = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    const sin = Math.sin(state.yaw); const cos = Math.cos(state.yaw);
    const wx = (-sin * f + cos * r); const wz = (-cos * f - sin * r);
    const len = Math.hypot(wx, wz) || 1;
    const accel = 42;
    state.vel.x += (wx / len) * accel * dt * (f || r ? 1 : 0);
    state.vel.z += (wz / len) * accel * dt * (f || r ? 1 : 0);
    const damp = Math.exp(-10 * dt); if (!f && !r) { state.vel.x *= damp; state.vel.z *= damp; }
    const sp = Math.hypot(state.vel.x, state.vel.z); if (sp > max) { state.vel.x *= max / sp; state.vel.z *= max / sp; }
    state.pos.x += state.vel.x * dt; state.pos.z += state.vel.z * dt;
    collide(state.pos, 0.45, colliders);
  }
  return { state, step, speed() { return Math.hypot(state.vel.x, state.vel.z); } };
}
