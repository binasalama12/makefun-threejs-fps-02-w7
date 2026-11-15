// Subway Interchange layout: ticket hall up south, long platform in the middle, sunken tracks
// and a stopped train up north. Warning yellow, concrete grey and green platform tile set the look.
import * as THREE from 'three';

export const PALETTE = { warn: 0xf5c518, concrete: 0x3a3e44, dark: 0x1c1e22, tile: 0x2e7d6b, rust: 0xc65a3a, cream: 0xd8d2c0, rail: 0x777d84 };

function box(list, shoot, scene, w, h, d, x, y, z, color, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.05, ...(opts || {}) }));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; scene.add(m); shoot.push(m);
  if (h > 0.6) list.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  return m;
}

export function createWorld(scene) {
  const colliders = []; const shootables = []; const flicker = [];
  const B = (w, h, d, x, y, z, c, o) => box(colliders, shootables, scene, w, h, d, x, y, z, c, o);
  scene.fog = new THREE.Fog(0x0c0e10, 32, 95);
  scene.add(new THREE.AmbientLight(0x99a894, 1.05));
  scene.add(new THREE.HemisphereLight(0xcfe4d4, 0x14161a, 0.55));
  // Floors: platform slab, track pit, ticket hall.
  const floorMat = new THREE.MeshStandardMaterial({ color: PALETTE.concrete, roughness: 1 });
  const plat = new THREE.Mesh(new THREE.BoxGeometry(48, 0.4, 18), floorMat); plat.position.set(0, -0.2, 3); plat.receiveShadow = true; scene.add(plat); shootables.push(plat);
  const pit = new THREE.Mesh(new THREE.BoxGeometry(48, 0.4, 9), new THREE.MeshStandardMaterial({ color: 0x17181a, roughness: 1 })); pit.position.set(0, -1.5, -10.5); pit.receiveShadow = true; scene.add(pit); shootables.push(pit);
  const hall = new THREE.Mesh(new THREE.BoxGeometry(30, 0.4, 10), new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 1 })); hall.position.set(0, -0.2, 17); hall.receiveShadow = true; scene.add(hall); shootables.push(hall);
  // Yellow safety stripe along the platform edge plus green tile band on the back wall.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(48, 0.05, 0.8), new THREE.MeshStandardMaterial({ color: PALETTE.warn, roughness: 0.7 })); stripe.position.set(0, 0.03, -5.4); scene.add(stripe);
  const band = new THREE.Mesh(new THREE.BoxGeometry(48, 1.6, 0.2), new THREE.MeshStandardMaterial({ color: PALETTE.tile, roughness: 0.5 })); band.position.set(0, 1.6, 12.1); scene.add(band);
  // Outer walls and ceiling beams.
  B(21, 6, 0.6, -13.5, 3, 12.4, PALETTE.dark); B(21, 6, 0.6, 13.5, 3, 12.4, PALETTE.dark); B(48, 6, 0.6, 0, 3, -15.4, PALETTE.dark);
  B(0.6, 6, 31, -24, 3, -1.5, PALETTE.dark); B(0.6, 6, 31, 24, 3, -1.5, PALETTE.dark);
  B(30, 6, 0.6, 0, 3, 22.4, PALETTE.dark); B(0.6, 6, 10, -15, 3, 17, PALETTE.dark); B(0.6, 6, 10, 15, 3, 17, PALETTE.dark);
  for (let x = -20; x <= 20; x += 8) B(48 / 24, 0.5, 30, x, 5.6, -1, 0x24262a);
  // Platform pillars, benches, kiosks, ticket gates: the cover game.
  for (const x of [-18, -9, 9, 18]) { B(1.2, 5.4, 1.2, x, 2.7, 6, PALETTE.concrete); B(1.3, 0.3, 1.3, x, 0.4, 6, PALETTE.warn); }
  for (const x of [-14, -4, 5, 14]) B(3.4, 0.5, 0.9, x, 0.45, 1.5, 0x5a4632);
  B(4, 2.6, 2.2, -12, 1.3, 9.5, PALETTE.tile); B(4, 2.6, 2.2, 12, 1.3, 9.5, 0x4a4e54);
  for (const x of [-6, -2, 2, 6]) B(1.6, 1.1, 0.7, x, 0.55, 12.6, PALETTE.rail, { metalness: 0.6, roughness: 0.4 });
  B(6, 2.4, 1.6, 0, 1.2, 18.5, 0x303338); // ticket desk
  B(3, 2.2, 3, -19, 1.1, -2, 0x33363c); B(3, 2.2, 3, 20, 1.1, -2, 0x33363c); // tunnel mouths blocks
  // Stopped train on the tracks: the plant target. Cream body, rust stripe, dark windows.
  const train = B(22, 3.2, 3.4, 0, 0.9, -10.5, PALETTE.cream); train.material.roughness = 0.45;
  B(22, 0.7, 3.5, 0, 0.1, -10.5, PALETTE.rust); colliders.pop();
  const winMat = new THREE.MeshStandardMaterial({ color: 0x10151c, roughness: 0.2, metalness: 0.4, emissive: 0x223344, emissiveIntensity: 0.6 });
  for (let x = -9; x <= 9; x += 3) { const w = new THREE.Mesh(new THREE.BoxGeometry(2, 0.9, 0.1), winMat); w.position.set(x, 1.7, -8.75); scene.add(w); }
  // Rails in the pit.
  for (const z of [-11.6, -9.4]) { const r = new THREE.Mesh(new THREE.BoxGeometry(48, 0.08, 0.18), new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.8, roughness: 0.3 })); r.position.set(0, -1.25, z); scene.add(r); }
  // Hanging signs.
  const s1 = new THREE.Mesh(new THREE.BoxGeometry(5, 0.9, 0.15), new THREE.MeshStandardMaterial({ color: 0x15161a, emissive: PALETTE.warn, emissiveIntensity: 0.25 })); s1.position.set(0, 4.2, 3); scene.add(s1);
  const s2 = s1.clone(); s2.position.set(-14, 4.2, 10); scene.add(s2);
  const s3 = s1.clone(); s3.position.set(14, 4.2, -3); scene.add(s3);
  // Platform lamps: a row of point lights, two of them flicker gently.
  for (let i = 0, x = -20; x <= 20; x += 8, i++) {
    const p = new THREE.PointLight(0xffe9b0, 75, 27, 1.7); p.position.set(x, 4.9, 2); scene.add(p);
    const shade = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.5), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffe9b0, emissiveIntensity: 2.2 })); shade.position.set(x, 5.05, 2); scene.add(shade);
    if (i === 1 || i === 4) flicker.push({ light: p, shade, phase: i * 1.7 });
  }
  const hallLight = new THREE.PointLight(0xbfe8d8, 55, 22, 1.7); hallLight.position.set(0, 4.6, 17); scene.add(hallLight);
  // Plant zone marker beside the train doors.
  const zone = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.06, 2.4), new THREE.MeshBasicMaterial({ color: PALETTE.warn, transparent: true, opacity: 0.35 })); zone.position.set(2, 0.05, -6.8); scene.add(zone);
  const waypoints = [
    new THREE.Vector3(-20, 0, 9), new THREE.Vector3(-12, 0, 2), new THREE.Vector3(-6, 0, -3.5),
    new THREE.Vector3(2, 0, -5.5), new THREE.Vector3(10, 0, -3), new THREE.Vector3(18, 0, 2),
    new THREE.Vector3(14, 0, 9), new THREE.Vector3(5, 0, 10), new THREE.Vector3(-4, 0, 10),
    new THREE.Vector3(0, 0, 17), new THREE.Vector3(-10, 0, 17), new THREE.Vector3(10, 0, 17),
  ];
  return {
    colliders, shootables, flicker, waypoints, zone,
    plantZone: { minX: -0.2, maxX: 4.2, minZ: -8, maxZ: -5.6 },
    playerSpawn: new THREE.Vector3(-20, 0, 16),
    mateSpawns: [new THREE.Vector3(-21, 0, 14), new THREE.Vector3(-18, 0, 18)],
    botSpawns: [new THREE.Vector3(20, 0, -3), new THREE.Vector3(17, 0, 5), new THREE.Vector3(21, 0, 10), new THREE.Vector3(12, 0, -4.5)],
    update(t) { for (const f of flicker) { const v = 0.82 + 0.18 * Math.sin(t * 9 + f.phase) * Math.sin(t * 2.3 + f.phase * 2); f.light.intensity = 75 * v; f.shade.material.emissiveIntensity = 2.2 * v; } },
  };
}
export function collide(pos, radius, colliders) {
  pos.x = Math.max(-23.2, Math.min(23.2, pos.x)); pos.z = Math.max(-14.6, Math.min(21.6, pos.z));
  // Ticket hall is only reachable through the middle gap in the platform back wall line z=12.
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(c.maxX, pos.x)); const nz = Math.max(c.minZ, Math.min(c.maxZ, pos.z));
    const dx = pos.x - nx; const dz = pos.z - nz; const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 1e-8) { const d = Math.sqrt(d2); pos.x = nx + (dx / d) * radius; pos.z = nz + (dz / d) * radius; }
      else { pos.x = c.maxX + radius; }
    }
  }
}
export function losBlocked(a, b, colliders) {
  // 2D segment versus collider rectangles, sampled coarsely: cheap and good enough for bot sight.
  for (let t = 0.08; t < 0.95; t += 0.06) {
    const x = a.x + (b.x - a.x) * t; const z = a.z + (b.z - a.z) * t;
    for (const c of colliders) if (x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ) return true;
  }
  return false;
}
