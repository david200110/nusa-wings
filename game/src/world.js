// Nusa Wings — the archipelago itself: terrain height shared by the
// mesh and the flight model, the animated sea, the volcano with its
// smoke, the harbour town of Kota Karang with its boats, the two
// runways, the mission rings, clouds and golden evening light.

import * as THREE from 'three';
import { ISLANDS, RUNWAYS, WORLD_SIZE, LIGHTING } from './config.js';
import { noise2, clamp, mulberry32 } from './rng.js';

// Height of the ground (or sea floor, clamped at 0) at a point, in metres.
// The flight model and the terrain mesh both call this, so what you see
// is exactly what you can hit.
export function terrainHeight(x, z) {
  let h = 0;
  for (const isl of ISLANDS) {
    const dx = x - isl.x;
    const dz = z - isl.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d >= isl.r) continue;
    const t = 1 - d / isl.r;
    h += isl.peak * Math.pow(t, isl.hill);
  }
  // Gentle rolling bumps so the green islands are not perfect cones.
  h += noise2(x, z) * 6 * Math.min(1, h / 20);
  h = Math.max(0, h);
  // Flatten the ground under each runway to its strip elevation.
  for (const rw of RUNWAYS) {
    const along = rw.along === 'x' ? Math.abs(x - rw.x) : Math.abs(z - rw.z);
    const across = rw.along === 'x' ? Math.abs(z - rw.z) : Math.abs(x - rw.x);
    if (along < rw.length / 2 + 60 && across < rw.width / 2 + 60) {
      const edge = Math.max(
        (along - rw.length / 2) / 60,
        (across - rw.width / 2) / 60,
      );
      const f = clamp(edge, 0, 1);
      h = h * f + rw.elev * (1 - f);
    }
  }
  return h;
}

// True when (x, z) is on the named runway's paved strip.
export function onRunway(x, z, runwayId) {
  const rw = RUNWAYS.find((r) => r.id === runwayId);
  if (!rw) return false;
  const along = rw.along === 'x' ? Math.abs(x - rw.x) : Math.abs(z - rw.z);
  const across = rw.along === 'x' ? Math.abs(z - rw.z) : Math.abs(x - rw.x);
  return along <= rw.length / 2 && across <= rw.width / 2;
}

// True when (x, z) is over any runway strip.
export function anyRunwayAt(x, z) {
  return RUNWAYS.find((rw) => onRunway(x, z, rw.id)) ?? null;
}

function islandColor(x, z, h) {
  // Sand at the shore, grass on the slopes, rock high up, dark basalt
  // and a warm crater rim on the volcano.
  const api = ISLANDS[2];
  const dApi = Math.hypot(x - api.x, z - api.z);
  if (h < 2.5) return new THREE.Color(0xe8d29a);
  if (dApi < 170 && h > 150) return new THREE.Color(0x4a4038);
  if (dApi < 120) return new THREE.Color(0x8a5a3a);
  if (h > 120) return new THREE.Color(0x6b7a5e);
  if (h > 45) return new THREE.Color(0x4f8a4a);
  return new THREE.Color(0x5da24f);
}

export class World {
  constructor(scene, seed) {
    this.scene = scene;
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.time = 0;
    this.smokePuffs = [];
    this.boats = [];
    this.clouds = [];
    this.ringMeshes = new Map();
    this.buildLights();
    this.buildSea();
    this.buildTerrain();
    this.buildVolcanoSmoke();
    this.buildRunways();
    this.buildApproachGates();
    this.buildTown();
    this.buildClouds();
    this.buildSunDisc();
  }

  buildLights() {
    const sun = new THREE.DirectionalLight(LIGHTING.sunColor, LIGHTING.sunIntensity);
    sun.position.set(...LIGHTING.sunPosition);
    this.scene.add(sun);
    const hemi = new THREE.HemisphereLight(LIGHTING.hemiSky, LIGHTING.hemiGround, LIGHTING.hemiIntensity);
    this.scene.add(hemi);
    this.scene.background = new THREE.Color(LIGHTING.skyColor);
    this.scene.fog = new THREE.Fog(LIGHTING.fogColor, LIGHTING.fogNear, LIGHTING.fogFar);
  }

  buildSea() {
    const geo = new THREE.PlaneGeometry(WORLD_SIZE * 2, WORLD_SIZE * 2, 72, 72);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshPhongMaterial({ color: 0x1e7a9e, shininess: 90, specular: 0x99ccdd, flatShading: true });
    this.sea = new THREE.Mesh(geo, mat);
    this.sea.position.y = 0;
    this.seaBase = geo.attributes.position.array.slice();
    this.scene.add(this.sea);
  }

  buildTerrain() {
    const size = WORLD_SIZE * 1.15;
    const seg = 150;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = terrainHeight(x, z);
      // Where there is no island the terrain is the sea floor, well below
      // the waves: otherwise the sand-coloured mesh z-fights the sea.
      pos.setY(i, h < 0.5 ? -6 : h);
      const c = islandColor(x, z, h);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const mesh = new THREE.Mesh(geo, mat);
    this.scene.add(mesh);
  }

  buildVolcanoSmoke() {
    const api = ISLANDS[2];
    const top = terrainHeight(api.x, api.z);
    const geo = new THREE.SphereGeometry(9, 8, 6);
    const mat = new THREE.MeshLambertMaterial({ color: 0xcfc8bd, transparent: true, opacity: 0.75 });
    for (let i = 0; i < 10; i++) {
      const puff = new THREE.Mesh(geo, mat.clone());
      puff.position.set(api.x, top + 10 + i * 14, api.z);
      puff.scale.setScalar(0.6 + this.rng() * 0.9);
      puff.userData.phase = this.rng() * Math.PI * 2;
      this.smokePuffs.push(puff);
      this.scene.add(puff);
    }
    // Warm glow in the crater.
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(16, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xff5a1e }),
    );
    glow.position.set(api.x, top - 2, api.z);
    glow.scale.y = 0.4;
    this.scene.add(glow);
  }

  buildRunways() {
    for (const rw of RUNWAYS) {
      const group = new THREE.Group();
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(rw.along === 'x' ? rw.length : rw.width, 1.2, rw.along === 'x' ? rw.width : rw.length),
        new THREE.MeshLambertMaterial({ color: 0x3a3f45 }),
      );
      slab.position.set(rw.x, rw.elev + 0.2, rw.z);
      group.add(slab);
      // Centre dashes.
      const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5f5e8 });
      const n = Math.floor(rw.length / 28);
      for (let i = 0; i < n; i++) {
        const t = -rw.length / 2 + 18 + i * 28;
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(12, 2), dashMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(rw.along === 'x' ? rw.x + t : rw.x, rw.elev + 0.9, rw.along === 'x' ? rw.z : rw.z + t);
        group.add(dash);
      }
      // Edge beacons: warm lights so the strip reads from the air.
      const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffc860 });
      for (let s = -1; s <= 1; s += 2) {
        for (let i = 0; i <= 6; i++) {
          const t = -rw.length / 2 + (i / 6) * rw.length;
          const b = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 6), beaconMat);
          b.position.set(
            rw.along === 'x' ? rw.x + t : rw.x + s * (rw.width / 2 + 2),
            rw.elev + 1.6,
            rw.along === 'x' ? rw.z + s * (rw.width / 2 + 2) : rw.z + t,
          );
          group.add(b);
        }
      }
      this.scene.add(group);
    }
  }

  // Amber approach gates floating over each runway threshold: a landing
  // aid in play, and a target ring ahead in the screenshots.
  buildApproachGates() {
    this.gates = [];
    const defs = [
      { x: -260, y: 40, z: 0, faceX: true }, // Pasir: approached along X
      { x: 1500, y: 40, z: -1210, faceX: false }, // Karang: approached along Z
    ];
    for (const d of defs) {
      const gate = new THREE.Mesh(
        new THREE.TorusGeometry(22, 2, 10, 40),
        new THREE.MeshBasicMaterial({ color: 0xffa726 }),
      );
      gate.position.set(d.x, d.y, d.z);
      if (d.faceX) gate.rotation.y = Math.PI / 2;
      gate.userData.phase = d.x;
      this.gates.push(gate);
      this.scene.add(gate);
    }
  }

  buildTown() {
    const karang = ISLANDS[1];
    const rng = mulberry32(this.seed + 77);
    // Harbour town: two dozen little houses with coloured roofs.
    for (let i = 0; i < 26; i++) {
      const a = rng() * Math.PI * 2;
      const d = 90 + rng() * 200;
      const x = karang.x + Math.cos(a) * d;
      const z = karang.z + Math.sin(a) * d * 0.8;
      const h = terrainHeight(x, z);
      if (h < 3 || h > 60) continue;
      const w = 10 + rng() * 12;
      const tall = 7 + rng() * 14;
      const house = new THREE.Group();
      const walls = new THREE.Mesh(
        new THREE.BoxGeometry(w, tall, w),
        new THREE.MeshLambertMaterial({ color: [0xf2e8d5, 0xe8c9a0, 0xdfe8f2, 0xf2d5d5][i % 4] }),
      );
      walls.position.y = tall / 2;
      house.add(walls);
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(w * 0.78, 5 + rng() * 3, 4),
        new THREE.MeshLambertMaterial({ color: [0xc0392b, 0xe67e22, 0x7d4a2d, 0x2e6b8a][i % 4] }),
      );
      roof.position.y = tall + 2.5;
      roof.rotation.y = Math.PI / 4;
      house.add(roof);
      house.position.set(x, h, z);
      house.rotation.y = rng() * Math.PI;
      this.scene.add(house);
    }
    // Boats bobbing in the harbour: hull, cabin and a mast.
    const boatColors = [0xffffff, 0xffd166, 0x4ecdc4, 0xef476f, 0x118ab2];
    for (let i = 0; i < 8; i++) {
      const boat = new THREE.Group();
      const hull = new THREE.Mesh(
        new THREE.BoxGeometry(16, 3, 6),
        new THREE.MeshLambertMaterial({ color: boatColors[i % boatColors.length] }),
      );
      hull.position.y = 1;
      boat.add(hull);
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(6, 3, 4),
        new THREE.MeshLambertMaterial({ color: 0xffffff }),
      );
      cabin.position.set(-2, 4, 0);
      boat.add(cabin);
      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.3, 10, 6),
        new THREE.MeshLambertMaterial({ color: 0x6b4a2f }),
      );
      mast.position.set(2, 7, 0);
      boat.add(mast);
      const a = (i / 8) * Math.PI * 2;
      boat.position.set(karang.x + Math.cos(a) * 300, 0.5, karang.z + Math.sin(a) * 300 + 120);
      boat.rotation.y = a;
      boat.userData.phase = i * 0.8;
      this.boats.push(boat);
      this.scene.add(boat);
    }
  }

  buildClouds() {
    const rng = mulberry32(this.seed + 31);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
    for (let i = 0; i < 22; i++) {
      const cloud = new THREE.Group();
      const puffs = 3 + Math.floor(rng() * 3);
      for (let j = 0; j < puffs; j++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(18 + rng() * 22, 8, 6), mat);
        s.position.set(j * 22 - puffs * 10 + rng() * 8, rng() * 6, rng() * 14 - 7);
        s.scale.y = 0.45;
        cloud.add(s);
      }
      cloud.position.set((rng() - 0.5) * 4200, 260 + rng() * 160, (rng() - 0.5) * 4200);
      cloud.userData.speed = 2 + rng() * 3;
      this.clouds.push(cloud);
      this.scene.add(cloud);
    }
  }

  buildSunDisc() {
    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(90, 24),
      new THREE.MeshBasicMaterial({ color: 0xffe9b0, fog: false }),
    );
    sun.position.set(-2600, 620, -2200);
    sun.lookAt(0, 100, 0);
    this.scene.add(sun);
  }

  // A glowing torus the pilot flies through. `key` identifies the stage.
  addRing(key, x, y, z, r) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r, 2.2, 10, 40),
      new THREE.MeshBasicMaterial({ color: 0xffa726 }),
    );
    ring.position.set(x, y, z);
    this.scene.add(ring);
    this.ringMeshes.set(key, ring);
    return ring;
  }

  removeRing(key) {
    const ring = this.ringMeshes.get(key);
    if (ring) {
      this.scene.remove(ring);
      this.ringMeshes.delete(key);
    }
  }

  setRingActive(key, active) {
    const ring = this.ringMeshes.get(key);
    if (ring) ring.material.color.set(active ? 0xffb020 : 0x7a8899);
  }

  update(dt) {
    this.time += dt;
    // Animated sea: gentle swell on the stored base positions.
    const pos = this.sea.geometry.attributes.position;
    const base = this.seaBase;
    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3];
      const bz = base[i * 3 + 2];
      pos.array[i * 3 + 1] =
        Math.sin(bx * 0.012 + this.time * 0.7) * 0.9 +
        Math.cos(bz * 0.015 + this.time * 0.5) * 0.9;
    }
    pos.needsUpdate = true;
    this.sea.geometry.computeVertexNormals();
    // Volcano smoke rises and drifts.
    for (const puff of this.smokePuffs) {
      puff.position.y += dt * 6;
      puff.position.x += dt * 3;
      if (puff.position.y > 420) puff.position.y = 300;
      const s = 0.6 + 0.5 * Math.sin(this.time * 0.8 + puff.userData.phase);
      puff.scale.setScalar(Math.max(0.4, s));
    }
    // Boats bob; clouds drift; approach gates pulse gently.
    for (const gate of this.gates ?? []) {
      const s = 1 + Math.sin(this.time * 1.4 + gate.userData.phase) * 0.05;
      gate.scale.setScalar(s);
    }
    for (const boat of this.boats) {
      boat.position.y = 0.5 + Math.sin(this.time * 0.9 + boat.userData.phase) * 0.5;
      boat.rotation.z = Math.sin(this.time * 0.7 + boat.userData.phase) * 0.03;
    }
    for (const cloud of this.clouds) {
      cloud.position.x += cloud.userData.speed * dt;
      if (cloud.position.x > 2400) cloud.position.x = -2400;
    }
  }
}
