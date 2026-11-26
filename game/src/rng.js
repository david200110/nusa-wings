// Nusa Wings — deterministic seeded random numbers (mulberry32) plus a
// small value-noise helper, so islands, towns and clouds are identical
// on every run for a given seed. Screenshot mode pins the seed.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth deterministic 2D noise from sines — no state, same value forever.
export function noise2(x, z) {
  return (
    Math.sin(x * 0.021 + z * 0.017) * 0.5 +
    Math.sin(x * 0.043 - z * 0.031 + 1.7) * 0.3 +
    Math.sin(x * 0.008 + z * 0.011 + 4.2) * 0.2
  );
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Shortest signed angle from a to b, in (-PI, PI].
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function deg(rad) {
  return (rad * 180) / Math.PI;
}
