// Nusa Wings — game bootstrap and main loop: renderer, cameras, state
// machine (title / playing / paused / crashed / complete), the chase
// and cockpit cameras, and the per-frame wiring between input, flight
// model, missions, world, HUD and sound.

import * as THREE from 'three';
import { World, terrainHeight } from './world.js';
import { Aircraft } from './aircraft.js';
import { FlightModel, FlightEvent } from './flight.js';
import { MissionManager } from './missions.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { SoundEngine } from './audio.js';
import { readShotParams, applyShotPreset } from './shots.js';
import { FLIGHT, MISSIONS } from './config.js';
import { clamp, lerp } from './rng.js';

const BEST_KEY = 'nusa-wings-best';

class Game {
  constructor() {
    this.state = 'title'; // title | playing | paused | crashed | complete
    this.view = 'chase'; // chase | cockpit
    this.now = 0;
    this.best = Number(localStorage.getItem(BEST_KEY) ?? 0) || 0;
    this.crashReason = '';
    this.shot = readShotParams();
    this.input = new Input();
    this.sound = new SoundEngine();
    this.setupRenderer();
    this.world = new World(this.scene, this.shot ? this.shot.seed : 20261126);
    this.aircraft = new Aircraft(this.scene);
    this.flight = new FlightModel();
    this.missions = new MissionManager(this.world);
    this.hud = new Hud();
    this.cameraChasePos = new THREE.Vector3();
    this.cameraCockpitPos = new THREE.Vector3();
    this.bindUi();
  }

  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.getElementById('app').appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 9000);
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  bindUi() {
    this.input.attach();
    window.addEventListener('keydown', (e) => {
      this.sound.ensure();
      if (e.code === 'KeyM') this.sound.setMuted(!this.sound.muted);
    });
    window.addEventListener('pointerdown', () => this.sound.ensure());
    // Click anywhere to start: the title screen overlay sits above the
    // canvas, so the listener must live on the window, not on #app.
    window.addEventListener('click', () => {
      if (this.state === 'title') this.startGame();
    });
  }

  startGame() {
    this.flight = new FlightModel();
    this.missions = new MissionManager(this.world);
    this.missions.score = 0;
    this.state = 'playing';
    this.hud.hideScreen();
    this.sound.ensure();
  }

  restartFromCrash() {
    this.flight.resetToRunway(-160, 0, 90);
    this.flight.fuel = 100;
    this.flight.damage = 0;
    this.missions.resetToStart();
    this.state = 'playing';
    this.hud.hideScreen();
  }

  showTitle() {
    this.state = 'title';
    const bestLine = this.best > 0 ? `Best score: ${this.best} pts` : 'Your first flight over the Nusa islands.';
    this.hud.showScreen(
      'NUSA WINGS',
      `Island Hopper — bush pilot of the Nusa archipelago. ${bestLine}`,
      'W/S throttle · Arrows pitch & roll · A/D rudder · F flaps · G gear · C cockpit · Click or press Enter to fly',
    );
  }

  showCrash(reason) {
    this.state = 'crashed';
    this.crashReason = reason;
    this.sound.crashBuzz();
    this.hud.showScreen(
      'CRASHED',
      `${reason}. Score ${this.missions.score} — best ${this.best}.`,
      'Press R to climb back into the cockpit and try the sortie again',
    );
  }

  showComplete() {
    this.state = 'complete';
    this.saveBest();
    this.hud.showScreen(
      'ALL MISSIONS COMPLETE!',
      `You flew every sortie in ${this.hud.fmtTime(this.missions.totalTime)} — final score ${this.missions.score}. Best: ${this.best}.`,
      'Press R to fly the archipelago again',
    );
  }

  saveBest() {
    if (this.missions.score > this.best) {
      this.best = this.missions.score;
      try {
        localStorage.setItem(BEST_KEY, String(this.best));
      } catch (e) {
        // Private mode: best score simply does not persist.
      }
    }
  }

  updateCamera(dt) {
    const f = this.flight;
    const forward = new THREE.Vector3(Math.sin(f.heading), 0, -Math.cos(f.heading));
    if (this.view === 'cockpit') {
      // Pilot seat: ahead of the canopy and above the fuselage, looking
      // over the nose and propeller — never inside the canopy mesh.
      const seat = f.pos.clone().addScaledVector(forward, 1.2);
      seat.y += 1.15;
      this.camera.position.lerp(seat, 1 - Math.pow(0.0001, dt));
      const look = f.pos.clone().addScaledVector(forward, 60);
      look.y += Math.sin(f.pitch) * 40 + this.input.lookY * 12;
      look.x += Math.cos(f.heading) * this.input.lookX * 14;
      look.z += -Math.sin(f.heading) * this.input.lookX * 14;
      this.camera.lookAt(look);
      // Roll the camera with the aircraft — rotateZ multiplies the
      // lookAt quaternion; assigning rotation.z after lookAt would
      // rebuild the orientation from Euler angles and flip the horizon.
      this.camera.rotateZ(f.roll * 0.35);
    } else {
      // Chase: behind and above, eased so it never fights the pilot.
      const back = 15 + f.speed * 0.06;
      const up = 4.5 + f.speed * 0.02;
      const target = f.pos.clone().addScaledVector(forward, -back);
      target.y += up;
      target.x += Math.cos(f.heading) * this.input.lookX * 6;
      target.z += -Math.sin(f.heading) * this.input.lookX * 6;
      this.camera.position.lerp(target, 1 - Math.pow(0.001, dt));
      const look = f.pos.clone().addScaledVector(forward, 18);
      look.y += 1;
      this.camera.lookAt(look);
      this.camera.rotateZ(f.roll * 0.12);
    }
    this.camera.fov = 62 + clamp((f.speed - 50) / 60, 0, 1) * 8;
    this.camera.updateProjectionMatrix();
  }

  syncAircraft(dt) {
    const f = this.flight;
    this.aircraft.group.position.copy(f.pos);
    this.aircraft.group.rotation.order = 'YXZ';
    // The model's nose points along local -Z; rotation.y = -heading maps
    // that onto the flight model's forward (sin h, -cos h).
    this.aircraft.group.rotation.y = -f.heading;
    this.aircraft.group.rotation.x = f.pitch;
    this.aircraft.group.rotation.z = -f.roll;
    this.aircraft.update(dt, f.throttle, this.now);
  }

  frame(dt) {
    this.now += dt;
    const input = this.input;
    input.consumeLook();

    // Global keys.
    if (input.wasPressed('KeyP', 'Escape')) {
      if (this.state === 'playing') {
        this.state = 'paused';
        this.hud.showScreen('PAUSED', 'The archipelago waits for you.', 'P to resume · R to restart the sortie');
      } else if (this.state === 'paused') {
        this.state = 'playing';
        this.hud.hideScreen();
      }
    }
    if (input.wasPressed('KeyR') && (this.state === 'crashed' || this.state === 'complete' || this.state === 'paused')) {
      this.restartFromCrash();
    }
    if (input.wasPressed('Enter') && this.state === 'title') this.startGame();
    if (input.wasPressed('KeyC', 'KeyV') && this.state === 'playing') {
      this.view = this.view === 'chase' ? 'cockpit' : 'chase';
    }

    if (this.state === 'playing') {
      // Screenshot mode freezes the flight model so the pinned scene is
      // exactly what the camera captures; the world still animates.
      if (!this.shot) {
        const event = this.flight.update(dt, input);
        if (event === FlightEvent.CRASH_TERRAIN || event === FlightEvent.CRASH_WATER) {
          this.saveBest();
          this.showCrash(this.flight.eventDetail);
        } else if (event === FlightEvent.LANDED || event === FlightEvent.HARD_LANDING) {
          this.sound.thud(event === FlightEvent.HARD_LANDING);
          this.missions.setMessage(this.flight.eventDetail, this.now, 2.5);
        }
        const result = this.missions.update(dt, this.flight, this.now);
        if (result === 'stage') this.sound.chime(false);
        if (result === 'mission') this.sound.chime(true);
        if (result === 'done') {
          this.sound.chime(true);
          this.showComplete();
        }
        this.sound.update(this.flight.throttle, this.flight.speed / FLIGHT.maxSpeed, this.flight.airborne);
      }
    } else if (this.state === 'title') {
      // Idle orbit on the title screen: the plane sits on the strip while
      // the camera slowly circles it, so the title already shows the game.
      const t = this.now * 0.12;
      this.camera.position.set(
        this.flight.pos.x + Math.sin(t) * 16,
        this.flight.pos.y + 5 + Math.sin(t * 0.6) * 1.5,
        this.flight.pos.z + Math.cos(t) * 16,
      );
      this.camera.lookAt(this.flight.pos.x, this.flight.pos.y + 1, this.flight.pos.z);
    }

    // The world always animates (sea, smoke, boats, clouds).
    this.world.update(dt);
    this.syncAircraft(dt);
    if (this.state !== 'title') this.updateCamera(dt);
    this.hud.update(this, dt);
    this.renderer.render(this.scene, this.camera);
    input.endFrame();
  }

  run() {
    if (this.shot) {
      // Screenshot mode: jump straight into the pinned scene.
      applyShotPreset(this, this.shot);
      document.getElementById('hud').classList.remove('hidden');
    } else {
      this.showTitle();
    }
    let last = performance.now();
    const loop = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      this.frame(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

const game = new Game();
// Exposed for debugging and automated play-testing only.
window.__nusaWings = game;
game.run();
