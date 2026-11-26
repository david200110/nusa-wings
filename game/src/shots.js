// Nusa Wings — deterministic screenshot scenes. ?shot=<name>&seed=<n>
// pins the plane, camera, mission and light to a fixed, flattering
// moment so each screenshot is a real render of the game's own code.
// The four shots are listed in shots.json at the repository root.

export const SHOT_PRESETS = {
  cover: {
    view: 'chase',
    mission: 1, stage: 1,
    pos: [-620, 95, 30], headingDeg: 88, speed: 50, throttle: 0.7,
    pitch: 0.04, roll: -0.05, gearDown: true, flaps: false, fuel: 82,
  },
  cockpit: {
    view: 'cockpit',
    mission: 1, stage: 1,
    pos: [-480, 55, 0], headingDeg: 90, speed: 38, throttle: 0.55,
    pitch: 0.02, roll: 0, gearDown: true, flaps: true, fuel: 64,
  },
  approach: {
    view: 'chase',
    mission: 1, stage: 1,
    pos: [-400, 32, 6], headingDeg: 90, speed: 33, throttle: 0.5,
    pitch: 0.02, roll: 0.02, gearDown: true, flaps: true, fuel: 58,
  },
  mission: {
    view: 'chase',
    mission: 0, stage: 0,
    pos: [1330, 112, -680], headingDeg: 83, speed: 52, throttle: 0.78,
    pitch: 0.03, roll: -0.1, gearDown: false, flaps: false, fuel: 71,
  },
};

export function readShotParams() {
  const q = new URLSearchParams(window.location.search);
  const name = q.get('shot');
  if (!name || !SHOT_PRESETS[name]) return null;
  const seed = Number(q.get('seed') ?? 13) || 13;
  return { name, seed, preset: SHOT_PRESETS[name] };
}

// Apply a preset to a live game: plane state, mission, camera view,
// and the world clock pinned so the sea and smoke sit the same way.
export function applyShotPreset(game, { preset, seed }) {
  const f = game.flight;
  f.pos.set(preset.pos[0], preset.pos[1], preset.pos[2]);
  f.heading = (preset.headingDeg * Math.PI) / 180;
  f.pitch = preset.pitch;
  f.roll = preset.roll;
  f.speed = preset.speed;
  f.throttle = preset.throttle;
  f.gearDown = preset.gearDown;
  f.flaps = preset.flaps;
  f.fuel = preset.fuel;
  f.damage = 0;
  f.airborne = true;
  f.verticalSpeed = 0;
  game.view = preset.view;
  game.aircraft.setGearDown(preset.gearDown);
  game.missions.index = preset.mission;
  game.missions.stageIndex = preset.stage;
  game.missions.missionTime = 47;
  game.missions.showStage();
  game.world.time = seed % 7;
  game.state = 'playing';
  game.hud.hideScreen();
}
