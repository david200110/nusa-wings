// Nusa Wings — the flight model: throttle, pitch, roll and rudder into
// speed and attitude, with stall, overspeed, wind gusts, ground roll,
// landing judgement and crash detection. Arcade at heart, but throttle
// and turn discipline decide whether a sortie works.

import * as THREE from 'three';
import { FLIGHT } from './config.js';
import { terrainHeight, onRunway, anyRunwayAt } from './world.js';
import { clamp, angleDelta } from './rng.js';

export const FlightEvent = {
  NONE: 'none',
  TOUCHDOWN: 'touchdown',
  HARD_LANDING: 'hard',
  CRASH_TERRAIN: 'crash-terrain',
  CRASH_WATER: 'crash-water',
  CRASH_STALL: 'crash-stall',
  LANDED: 'landed',
};

export class FlightModel {
  constructor() {
    this.pos = new THREE.Vector3(-160, 4, 0); // on Pasir Strip, facing east
    this.heading = Math.PI / 2; // radians; 0 = north (-Z), PI/2 = east (+X)
    this.pitch = 0;
    this.roll = 0;
    this.speed = 0;
    this.throttle = 0;
    this.flaps = false;
    this.gearDown = true;
    this.brakes = false;
    this.airborne = false;
    this.fuel = 100;
    this.damage = 0;
    this.verticalSpeed = 0;
    this.gustPhase = 0;
    this.stalled = false;
    this.overspeed = false;
    this.event = FlightEvent.NONE;
    this.eventDetail = '';
    this.time = 0;
    this.windBase = 3; // m/s steady sea breeze from the west
  }

  resetToRunway(x, z, headingDeg) {
    const ground = terrainHeight(x, z);
    this.pos.set(x, ground + FLIGHT.gearHeight, z);
    this.heading = (headingDeg * Math.PI) / 180;
    this.pitch = 0;
    this.roll = 0;
    this.speed = 0;
    this.throttle = 0;
    this.airborne = false;
    this.verticalSpeed = 0;
    this.event = FlightEvent.NONE;
  }

  // Gusting wind, metres per second, as a sideways push on the aircraft.
  windAt(t) {
    const gust = Math.sin(t * 0.31) * 2.2 + Math.sin(t * 0.83 + 1.3) * 1.4;
    return { x: -(this.windBase + gust) * 0.4, z: gust * 0.8 };
  }

  update(dt, input) {
    this.time += dt;
    this.event = FlightEvent.NONE;
    const wasAirborne = this.airborne;

    // --- Throttle -------------------------------------------------------
    if (input.throttleUp) this.throttle = clamp(this.throttle + dt * 0.7, 0, 1);
    if (input.throttleDown) this.throttle = clamp(this.throttle - dt * 0.9, 0, 1);
    if (input.wasPressed('KeyF')) this.flaps = !this.flaps;
    if (input.wasPressed('KeyG')) this.gearDown = !this.gearDown;
    this.brakes = input.down('KeyB');

    // --- Attitude --------------------------------------------------------
    const pitchIn = input.pitchAxis; // +1 = pull up (ArrowDown)
    const rollIn = input.rollAxis;
    const yawIn = input.yawAxis;
    const authority = this.airborne ? 1 : 0.6;
    this.pitch = clamp(this.pitch + pitchIn * FLIGHT.pitchRate * authority * dt * (this.speed > 8 ? 1 : 0.4), -0.5, 0.6);
    this.roll = clamp(this.roll + rollIn * 1.6 * authority * dt, -1.1, 1.1);
    // Roll banks the turn; rudder yaws directly.
    this.heading += (-this.roll * FLIGHT.turnRate * (this.airborne ? 1 : 0.4) + yawIn * FLIGHT.yawRate * 0.5) * dt;
    // Ease the wings level when no roll input.
    if (rollIn === 0) this.roll *= Math.max(0, 1 - dt * 1.4);
    if (pitchIn === 0 && this.airborne) this.pitch *= Math.max(0, 1 - dt * 0.5);

    // --- Speed ------------------------------------------------------------
    const flapDrag = this.flaps ? 0.03 : 0;
    const gearDrag = this.gearDown ? 0.012 : 0;
    const drag = FLIGHT.drag + flapDrag + gearDrag;
    if (!this.airborne) {
      this.speed += (this.throttle * FLIGHT.accel - drag * this.speed * 2 - (this.brakes ? 14 : 0)) * dt;
      this.speed = clamp(this.speed, 0, FLIGHT.maxSpeed);
      // Liftoff: enough speed and a pull on the stick (or flaps helping).
      const liftSpeed = this.flaps ? FLIGHT.takeoffSpeed - 4 : FLIGHT.takeoffSpeed;
      if (this.speed > liftSpeed && this.pitch > 0.06) {
        this.airborne = true;
        this.verticalSpeed = 2;
      }
    } else {
      // Airborne: thrust fights drag; climbing (positive pitch) costs speed.
      const thrust = this.throttle * 26;
      this.speed += (thrust - drag * this.speed - Math.sin(this.pitch) * 14) * dt * 0.55;
      this.speed = clamp(this.speed, 0, FLIGHT.maxSpeed + 12);
    }

    // --- Stall / overspeed -------------------------------------------------
    this.stalled = this.airborne && this.speed < FLIGHT.stallSpeed;
    this.overspeed = this.speed > FLIGHT.maxSpeed;
    if (this.stalled) {
      // The nose drops and the wing stops answering.
      this.pitch = clamp(this.pitch - dt * 0.7, -0.5, 0.6);
      this.verticalSpeed -= 14 * dt;
    }
    if (this.overspeed) this.damage = Math.min(100, this.damage + dt * 1.5);

    // --- Position -----------------------------------------------------------
    const wind = this.windAt(this.time);
    const fwdX = Math.sin(this.heading);
    const fwdZ = -Math.cos(this.heading);
    if (this.airborne) {
      this.verticalSpeed = this.speed * Math.sin(this.pitch) + (this.stalled ? this.verticalSpeed * 0.4 : 0);
      this.verticalSpeed = clamp(this.verticalSpeed, -22, FLIGHT.climbRate + this.throttle * 4);
      this.pos.x += (fwdX * this.speed * Math.cos(this.pitch) + wind.x) * dt;
      this.pos.z += (fwdZ * this.speed * Math.cos(this.pitch) + wind.z) * dt;
      this.pos.y += this.verticalSpeed * dt;
    } else {
      this.pos.x += (fwdX * this.speed + wind.x * 0.2) * dt;
      this.pos.z += (fwdZ * this.speed + wind.z * 0.2) * dt;
      const groundY = terrainHeight(this.pos.x, this.pos.z);
      // Rolling off the strip into the sea is a ditching, not a taxiway.
      if (groundY <= 0.5 && this.speed > 2) {
        this.event = FlightEvent.CRASH_WATER;
        this.eventDetail = 'Taxied into the sea';
        this.damage = 100;
        return this.event;
      }
      this.pos.y = groundY + FLIGHT.gearHeight;
      this.verticalSpeed = 0;
      // On the ground the nose stays put unless the pilot is pulling —
      // damping here used to cancel the rotation itself, so the plane
      // could never lift off.
      if (input.pitchAxis === 0) this.pitch *= Math.max(0, 1 - dt * 4);
    }

    // Keep the plane inside the charted sea.
    const bound = 2500;
    this.pos.x = clamp(this.pos.x, -bound, bound);
    this.pos.z = clamp(this.pos.z, -bound, bound);

    // --- Fuel ---------------------------------------------------------------
    const burn = (FLIGHT.fuelBurnIdle + (FLIGHT.fuelBurn - FLIGHT.fuelBurnIdle) * this.throttle) * dt;
    this.fuel = Math.max(0, this.fuel - burn);
    if (this.fuel <= 0 && this.throttle > 0) this.throttle = Math.max(0, this.throttle - dt * 0.5);

    // --- Ground / water contact ----------------------------------------------
    const ground = terrainHeight(this.pos.x, this.pos.z);
    if (this.airborne && this.pos.y <= ground + FLIGHT.gearHeight) {
      const runway = anyRunwayAt(this.pos.x, this.pos.z);
      const descent = -this.verticalSpeed;
      const gentle = descent < 3.5 && Math.abs(this.roll) < 0.25 && this.speed < 55;
      if (ground <= 0.5) {
        this.event = FlightEvent.CRASH_WATER;
        this.eventDetail = 'Ditched in the sea';
      } else if (runway && gentle && this.gearDown) {
        this.airborne = false;
        this.pos.y = ground + FLIGHT.gearHeight;
        this.event = this.speed > 42 ? FlightEvent.HARD_LANDING : FlightEvent.LANDED;
        this.eventDetail = descent < 1.5 ? 'Butter-smooth landing' : descent < 3 ? 'Firm but fine' : 'A bit of a thump';
        if (this.event === FlightEvent.HARD_LANDING) {
          this.damage = Math.min(100, this.damage + 18);
          this.speed *= 0.7;
        }
        this.fuel = 100; // refuel on the strip
        this.damage = Math.max(0, this.damage - 10); // ground crew patches you up
      } else if (runway && !this.gearDown) {
        this.event = FlightEvent.CRASH_TERRAIN;
        this.eventDetail = 'Belly landing — gear was up';
      } else if (descent > 7 || this.speed > 60) {
        this.event = FlightEvent.CRASH_TERRAIN;
        this.eventDetail = this.stalled ? 'Stalled into the ground' : 'Flew into the terrain';
      } else {
        // Rough landing: survivable, but it hurts.
        this.airborne = false;
        this.pos.y = ground + FLIGHT.gearHeight;
        this.event = FlightEvent.HARD_LANDING;
        this.eventDetail = runway ? 'Hard landing on the strip' : 'Rough landing off the strip';
        this.damage = Math.min(100, this.damage + (runway ? 18 : 25));
        this.speed *= 0.5;
      }
      if (this.event === FlightEvent.CRASH_TERRAIN || this.event === FlightEvent.CRASH_WATER) {
        this.damage = 100;
      }
    }
    if (!wasAirborne && this.airborne) {
      this.event = FlightEvent.TOUCHDOWN; // liftoff — reused as "airborne now"
      this.eventDetail = 'Airborne';
    }
    return this.event;
  }

  // Heading in degrees, 0 = north, clockwise.
  get headingDeg() {
    return ((deg(this.heading) % 360) + 360) % 360;
  }

  get altitudeFt() {
    return Math.max(0, this.pos.y * 3.28084);
  }

  get speedKt() {
    return this.speed * 1.94384;
  }

  // Distance and bearing to a target point, for the HUD arrow.
  bearingTo(x, z) {
    const dx = x - this.pos.x;
    const dz = z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    // Bearing: 0 = north (-Z), clockwise.
    const bearing = (Math.atan2(dx, -dz) * 180) / Math.PI;
    const rel = angleDelta((this.headingDeg * Math.PI) / 180, (bearing * Math.PI) / 180);
    return { dist, bearing: ((bearing % 360) + 360) % 360, relative: rel };
  }
}

function deg(rad) {
  return (rad * 180) / Math.PI;
}
