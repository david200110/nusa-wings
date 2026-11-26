// Nusa Wings — the mission chain: six sorties with different goals,
// each a list of stages (fly through a ring, or land on a runway).
// Tracks progress, the mission timer, rewards and the running score.

import { MISSIONS, RUNWAYS } from './config.js';

export class MissionManager {
  constructor(world) {
    this.world = world;
    this.index = 0; // which mission is active
    this.stageIndex = 0;
    this.score = 0;
    this.missionTime = 0;
    this.totalTime = 0;
    this.completed = 0;
    this.allDone = false;
    this.message = '';
    this.messageUntil = 0;
    this.activeRingKey = null;
    this.showStage();
  }

  get mission() {
    return MISSIONS[this.index];
  }

  get stage() {
    return this.mission ? this.mission.stages[this.stageIndex] : null;
  }

  get stageText() {
    return this.stage ? this.stage.text : 'All missions complete!';
  }

  // Target point for the HUD arrow and minimap.
  get target() {
    const s = this.stage;
    if (!s) return null;
    if (s.kind === 'ring') return { x: s.x, y: s.y, z: s.z, r: s.r };
    const rw = RUNWAYS.find((r) => r.id === s.runway);
    return { x: rw.x, y: rw.elev + 5, z: rw.z, r: 40 };
  }

  showStage() {
    // Clear old rings, draw the new stage's ring (if any).
    if (this.activeRingKey) {
      this.world.removeRing(this.activeRingKey);
      this.activeRingKey = null;
    }
    const s = this.stage;
    if (!s) return;
    if (s.kind === 'ring') {
      const key = `m${this.index}s${this.stageIndex}`;
      this.world.addRing(key, s.x, s.y, s.z, s.r);
      this.activeRingKey = key;
    }
  }

  // Called every frame while flying. Returns 'stage', 'mission', 'done' or null.
  update(dt, flight, now) {
    if (this.allDone) return null;
    this.missionTime += dt;
    this.totalTime += dt;
    const s = this.stage;
    if (!s) return null;
    if (s.kind === 'ring') {
      const dx = flight.pos.x - s.x;
      const dy = flight.pos.y - s.y;
      const dz = flight.pos.z - s.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < s.r) {
        return this.completeStage(now, 'Ring threaded!');
      }
      // Medicine drop must stay low.
      if (this.mission.id === 'medicine' && this.stageIndex === 0 && flight.altitudeFt > 400 && dist < 220) {
        this.setMessage('Too high for the drop — stay under 400 ft!', now, 2.5);
      }
      return null;
    }
    if (s.kind === 'land') {
      if (flight.event === 'landed' || flight.event === 'hard') {
        const rw = RUNWAYS.find((r) => r.id === s.runway);
        const dx = flight.pos.x - rw.x;
        const dz = flight.pos.z - rw.z;
        const along = rw.along === 'x' ? Math.abs(dx) : Math.abs(dz);
        const across = rw.along === 'x' ? Math.abs(dz) : Math.abs(dx);
        if (along <= rw.length / 2 && across <= rw.width / 2) {
          return this.completeStage(now, 'Down safe on the strip!');
        }
      }
      return null;
    }
    return null;
  }

  completeStage(now, text) {
    this.setMessage(text, now, 2.5);
    this.score += 100;
    this.stageIndex++;
    if (this.stageIndex >= this.mission.stages.length) {
      return this.completeMission(now);
    }
    this.showStage();
    return 'stage';
  }

  completeMission(now) {
    const m = this.mission;
    const timeBonus = Math.max(0, Math.round((m.parSeconds - this.missionTime) * 4));
    const gained = m.reward + timeBonus;
    this.score += gained;
    this.completed++;
    this.setMessage(`${m.name} complete! +${gained} pts`, now, 4);
    this.index++;
    this.stageIndex = 0;
    this.missionTime = 0;
    if (this.index >= MISSIONS.length) {
      this.allDone = true;
      this.showStage();
      return 'done';
    }
    this.showStage();
    return 'mission';
  }

  setMessage(text, now, seconds) {
    this.message = text;
    this.messageUntil = now + seconds;
  }

  // Crash: the current mission's timer keeps running, score stays.
  resetToStart() {
    this.index = 0;
    this.stageIndex = 0;
    this.missionTime = 0;
    this.showStage();
  }
}
