// Nusa Wings — the HUD: big legible altitude / speed / heading, a
// compass strip, throttle and fuel gauges, the mission objective with a
// waypoint arrow and distance, a minimap, warnings, and a canvas-drawn
// instrument cluster (attitude, airspeed, altimeter) that glows like
// flown instruments. Numbers are sized to read on a 768x480 contact sheet.

import { ISLANDS, RUNWAYS, MISSIONS } from './config.js';

const COMPASS_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export class Hud {
  constructor() {
    this.el = {};
    for (const id of [
      'alt', 'spd', 'hdg', 'throttleFill', 'throttleLabel', 'fuelFill', 'fuelLabel',
      'missionName', 'missionBrief', 'stageText', 'missionTimer', 'score', 'best',
      'waypointArrow', 'waypointDist', 'warning', 'message', 'damageFill', 'damageLabel',
      'flapsState', 'gearState', 'screenTitle', 'screenSub', 'screenHint',
      'screen', 'minimap', 'gauges', 'viewLabel', 'fuelWarn',
    ]) {
      this.el[id] = document.getElementById(id);
    }
    this.minimapCtx = this.el.minimap.getContext('2d');
    this.gaugeCtx = this.el.gauges.getContext('2d');
    this.lastWarning = '';
  }

  showScreen(title, sub, hint) {
    this.el.screen.classList.remove('hidden');
    this.el.screenTitle.textContent = title;
    this.el.screenSub.textContent = sub;
    this.el.screenHint.textContent = hint;
  }

  hideScreen() {
    this.el.screen.classList.add('hidden');
  }

  update(game, dt) {
    const f = game.flight;
    const m = game.missions;
    this.el.alt.textContent = Math.round(f.altitudeFt);
    this.el.spd.textContent = Math.round(f.speedKt);
    this.el.hdg.textContent = String(Math.round(f.headingDeg)).padStart(3, '0');
    this.el.throttleFill.style.width = `${Math.round(f.throttle * 100)}%`;
    this.el.throttleLabel.textContent = `THR ${Math.round(f.throttle * 100)}%`;
    this.el.fuelFill.style.width = `${Math.round(f.fuel)}%`;
    this.el.fuelLabel.textContent = `FUEL ${Math.round(f.fuel)}%`;
    this.el.fuelFill.classList.toggle('low', f.fuel < 25);
    this.el.fuelWarn.classList.toggle('hidden', f.fuel >= 25);
    this.el.damageFill.style.width = `${Math.round(f.damage)}%`;
    this.el.damageLabel.textContent = `DMG ${Math.round(f.damage)}%`;
    this.el.flapsState.textContent = f.flaps ? 'FLAPS' : 'flaps';
    this.el.flapsState.classList.toggle('on', f.flaps);
    this.el.gearState.textContent = f.gearDown ? 'GEAR' : 'GEAR UP';
    this.el.gearState.classList.toggle('on', f.gearDown);
    this.el.viewLabel.textContent = game.view === 'cockpit' ? 'COCKPIT' : 'CHASE';
    this.el.score.textContent = `SCORE ${m.score}`;
    this.el.best.textContent = `BEST ${game.best}`;
    const mission = m.mission;
    this.el.missionName.textContent = mission ? mission.name : 'All missions complete!';
    this.el.missionBrief.textContent = mission ? mission.brief : 'You flew every sortie. The archipelago is yours.';
    this.el.stageText.textContent = m.stageText;
    this.el.missionTimer.textContent = `⏱ ${this.fmtTime(m.missionTime)}  •  ${m.completed}/${MISSIONS.length} done`;

    // Waypoint arrow + distance.
    const target = m.target;
    if (target) {
      const b = f.bearingTo(target.x, target.z);
      this.el.waypointArrow.style.transform = `rotate(${b.relative}rad)`;
      const nm = b.dist / 1852;
      this.el.waypointDist.textContent = `${nm < 1 ? Math.round(b.dist) + ' m' : nm.toFixed(1) + ' nm'}`;
    } else {
      this.el.waypointDist.textContent = '—';
    }

    // Warnings, most urgent first.
    let warn = '';
    const nearRunway = RUNWAYS.some((rw) => Math.hypot(f.pos.x - rw.x, f.pos.z - rw.z) < 700);
    const onFinal = f.gearDown && nearRunway;
    if (f.damage >= 100) warn = 'CRASHED';
    else if (f.stalled) warn = '⚠ STALL — NOSE DOWN, FULL THROTTLE';
    else if (f.overspeed) warn = '⚠ OVERSPEED — THROTTLE BACK';
    else if (f.fuel < 15) warn = '⚠ LOW FUEL — LAND AND REFUEL';
    else if (f.airborne && f.altitudeFt < 300 && !f.gearDown) warn = '⚠ GEAR UP — LOW';
    else if (f.airborne && f.altitudeFt < 150 && !onFinal) warn = 'PULL UP — TERRAIN';
    this.el.warning.textContent = warn;
    this.el.warning.classList.toggle('hidden', warn === '');
    if (warn !== this.lastWarning) this.lastWarning = warn;

    // Transient centre message.
    if (game.now < m.messageUntil) {
      this.el.message.textContent = m.message;
      this.el.message.classList.remove('hidden');
    } else {
      this.el.message.classList.add('hidden');
    }

    this.drawMinimap(game);
    this.drawGauges(game);
  }

  fmtTime(t) {
    const s = Math.floor(t);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  drawMinimap(game) {
    const ctx = this.minimapCtx;
    const W = 190;
    const H = 190;
    const scale = W / 5200;
    const cx = W / 2;
    const cy = H / 2;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(10, 40, 70, 0.85)';
    ctx.fillRect(0, 0, W, H);
    // Sea grid.
    ctx.strokeStyle = 'rgba(120, 180, 220, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      ctx.beginPath(); ctx.moveTo((i * W) / 5, 0); ctx.lineTo((i * W) / 5, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, (i * H) / 5); ctx.lineTo(W, (i * H) / 5); ctx.stroke();
    }
    // Islands.
    for (const isl of ISLANDS) {
      ctx.beginPath();
      ctx.arc(cx + isl.x * scale, cy + isl.z * scale, Math.max(4, isl.r * scale), 0, Math.PI * 2);
      ctx.fillStyle = isl.volcano ? '#8a5a3a' : '#3f8a4a';
      ctx.fill();
      ctx.strokeStyle = '#e8d29a';
      ctx.stroke();
    }
    // Runways.
    for (const rw of RUNWAYS) {
      ctx.fillStyle = '#f5f5e8';
      const w = rw.along === 'x' ? rw.length * scale : 3;
      const h = rw.along === 'x' ? 3 : rw.length * scale;
      ctx.fillRect(cx + rw.x * scale - w / 2, cy + rw.z * scale - h / 2, w, h);
    }
    // Target.
    const target = game.missions.target;
    if (target) {
      const tx = cx + target.x * scale;
      const ty = cy + target.z * scale;
      ctx.strokeStyle = '#ffb020';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(tx, ty, 8, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(tx - 12, ty); ctx.lineTo(tx + 12, ty); ctx.moveTo(tx, ty - 12); ctx.lineTo(tx, ty + 12); ctx.stroke();
    }
    // The aircraft: a little triangle pointing along its heading.
    const f = game.flight;
    const px = cx + f.pos.x * scale;
    const py = cy + f.pos.z * scale;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(f.heading);
    ctx.fillStyle = '#ff6a1e';
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText('NUSA CHART', 8, 16);
  }

  drawGauges(game) {
    const ctx = this.gaugeCtx;
    const f = game.flight;
    const W = 460;
    const H = 110;
    ctx.clearRect(0, 0, W, H);
    const dial = (x, y, r, label, valueText) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(8, 18, 30, 0.92)';
      ctx.fill();
      ctx.strokeStyle = '#ffb020';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#7dffd4';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(valueText, x, y + 5);
      ctx.fillStyle = '#9fb8cc';
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillText(label, x, y + r + 13);
    };
    // Artificial horizon.
    const hx = 70;
    const hy = 55;
    const hr = 38;
    ctx.save();
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(hx, hy);
    ctx.rotate(-f.roll);
    ctx.translate(0, f.pitch * 90);
    ctx.fillStyle = '#2f7fc4';
    ctx.fillRect(-hr, -hr * 2, hr * 2, hr * 2);
    ctx.fillStyle = '#7a5a34';
    ctx.fillRect(-hr, 0, hr * 2, hr * 2);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-hr, 0); ctx.lineTo(hr, 0); ctx.stroke();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffb020';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffb020';
    ctx.beginPath();
    ctx.moveTo(hx - 14, hy); ctx.lineTo(hx + 14, hy); ctx.lineTo(hx, hy + 4); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#9fb8cc';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ATTITUDE', hx, hy + hr + 12);
    // Airspeed, altitude, heading dials.
    dial(170, 55, 38, 'AIRSPEED kt', String(Math.round(f.speedKt)));
    dial(260, 55, 38, 'ALTITUDE ft', String(Math.round(f.altitudeFt)));
    // Compass dial: cardinal letter by heading.
    const hdg = Math.round(f.headingDeg);
    const label = COMPASS_POINTS[Math.round(hdg / 45) % 8];
    dial(350, 55, 38, 'HEADING', `${label} ${String(hdg).padStart(3, '0')}`);
    // Vertical speed as a small bar.
    ctx.fillStyle = '#9fb8cc';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('VERT', 405, 30);
    const vs = Math.max(-1, Math.min(1, f.verticalSpeed / 12));
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(405, 38, 12, 44);
    ctx.fillStyle = vs >= 0 ? '#7dffd4' : '#ff7a5c';
    const bh = Math.abs(vs) * 22;
    ctx.fillRect(405, vs >= 0 ? 60 - bh : 60, 12, bh);
    ctx.fillStyle = '#7dffd4';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(`${f.verticalSpeed >= 0 ? '+' : ''}${f.verticalSpeed.toFixed(1)}`, 405, 96);
  }
}
