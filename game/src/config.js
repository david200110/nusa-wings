// Nusa Wings — game configuration: the archipelago, its runways and the
// six chained courier missions. All numbers are in metres / seconds;
// the HUD converts to feet and knots for display.

export const GAME_NAME = 'Nusa Wings';
export const GAME_TAGLINE = 'Island Hopper';

// World extents (metres). The sea is a square this wide; islands sit inside it.
export const WORLD_SIZE = 5200;
export const SEA_LEVEL = 0;

// Flight envelope.
export const FLIGHT = {
  maxThrottle: 1,
  maxSpeed: 92, // m/s, about 179 kt — overspeed above this
  cruiseSpeed: 55,
  stallSpeed: 24, // m/s — below this, airborne, the wing quits
  takeoffSpeed: 30,
  climbRate: 9,
  turnRate: 0.9, // rad/s at full roll
  pitchRate: 0.55,
  yawRate: 0.35,
  accel: 14, // m/s^2 at full throttle on the ground roll
  drag: 0.055,
  fuelBurn: 0.55, // % per second at full throttle
  fuelBurnIdle: 0.06,
  gearHeight: 2.2, // metres from origin to wheels
};

// The five islands of the Nusa archipelago.
export const ISLANDS = [
  { id: 'pasir', name: 'Pulau Pasir', x: 0, z: 0, r: 430, peak: 55, hill: 2.0, town: false, volcano: false },
  { id: 'karang', name: 'Kota Karang', x: 1500, z: -950, r: 400, peak: 70, hill: 2.0, town: true, volcano: false },
  { id: 'api', name: 'Pulau Api', x: -1350, z: -1150, r: 470, peak: 285, hill: 1.25, town: false, volcano: true },
  { id: 'hijau', name: 'Pulau Hijau', x: -950, z: 1250, r: 360, peak: 115, hill: 1.8, town: false, volcano: false },
  { id: 'terumbu', name: 'Pulau Terumbu', x: 1150, z: 1150, r: 230, peak: 26, hill: 2.2, town: false, volcano: false },
];

// Runways. `along` is 'x' (east-west) or 'z' (north-south); `elev` is the
// flattened ground height the strip sits at.
export const RUNWAYS = [
  { id: 'pasir', name: 'Pasir Strip', island: 'pasir', x: 0, z: 0, along: 'x', length: 400, width: 26, elev: 4, heading: 90 },
  { id: 'karang', name: 'Karang Field', island: 'karang', x: 1500, z: -950, along: 'z', length: 360, width: 26, elev: 4, heading: 0 },
];

// Six chained missions. A mission is a list of stages; a stage is either
// fly-through a ring, or land on a runway. Rewards are in points.
export const MISSIONS = [
  {
    id: 'cargo', name: 'Mission 1 — Cargo Run', brief: 'Fly the cargo to Kota Karang: thread the ring over the harbour, then land on Karang Field.',
    reward: 500, parSeconds: 150,
    stages: [
      { kind: 'ring', x: 1500, y: 110, z: -700, r: 26, text: 'Thread the ring over Kota Karang' },
      { kind: 'land', runway: 'karang', text: 'Land on Karang Field (gear down, gentle!)' },
    ],
  },
  {
    id: 'passengers', name: 'Mission 2 — Island Hop', brief: 'Passengers are waiting at Karang. Fly them home and land on Pasir Strip.',
    reward: 600, parSeconds: 150,
    stages: [
      { kind: 'ring', x: 700, y: 130, z: -450, r: 26, text: 'Climb out over the strait' },
      { kind: 'land', runway: 'pasir', text: 'Land on Pasir Strip' },
    ],
  },
  {
    id: 'medicine', name: 'Mission 3 — Medicine Drop', brief: 'Pulau Api needs medicine. Drop low over the black-sand beach — under 400 ft through the ring.',
    reward: 700, parSeconds: 170,
    stages: [
      { kind: 'ring', x: -1150, y: 70, z: -950, r: 24, text: 'Low pass through the ring over Api beach (stay under 400 ft)' },
      { kind: 'ring', x: -600, y: 150, z: -500, r: 26, text: 'Climb away over the strait' },
    ],
  },
  {
    id: 'mail', name: 'Mission 4 — Mail Run', brief: 'Mail for Pulau Hijau. Thread the ring above the green hills, then land back on Pasir Strip.',
    reward: 650, parSeconds: 170,
    stages: [
      { kind: 'ring', x: -950, y: 160, z: 1250, r: 26, text: 'Thread the ring over Pulau Hijau' },
      { kind: 'land', runway: 'pasir', text: 'Land on Pasir Strip' },
    ],
  },
  {
    id: 'photo', name: 'Mission 5 — Photo Run', brief: 'The reef at Pulau Terumbu from the air. Fly all three rings in order, low and steady.',
    reward: 900, parSeconds: 180,
    stages: [
      { kind: 'ring', x: 1000, y: 80, z: 1000, r: 22, text: 'Ring 1 of 3 — over the reef' },
      { kind: 'ring', x: 1150, y: 90, z: 1250, r: 22, text: 'Ring 2 of 3 — over the lagoon' },
      { kind: 'ring', x: 1320, y: 80, z: 1080, r: 22, text: 'Ring 3 of 3 — over the sandbar' },
    ],
  },
  {
    id: 'rescue', name: 'Mission 6 — Rescue', brief: 'A hiker is stranded on Pulau Api. Reach the beacon ring, then bring the rescue home to Pasir Strip.',
    reward: 1200, parSeconds: 200,
    stages: [
      { kind: 'ring', x: -1350, y: 200, z: -1150, r: 28, text: 'Reach the beacon ring over the volcano' },
      { kind: 'land', runway: 'pasir', text: 'Land on Pasir Strip — bring them home' },
    ],
  },
];

// Golden evening light: the whole game is lit like late afternoon.
export const LIGHTING = {
  sunColor: 0xffd9a0,
  sunIntensity: 2.6,
  sunPosition: [-1800, 900, -1400],
  hemiSky: 0x9fc8e8,
  hemiGround: 0x3d6b4f,
  hemiIntensity: 1.15,
  skyColor: 0x87bfe8,
  fogColor: 0xa8c8e0,
  fogNear: 900,
  fogFar: 4200,
};
