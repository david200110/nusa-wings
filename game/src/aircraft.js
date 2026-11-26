// Nusa Wings — the aircraft: a little orange-and-white bush plane built
// from primitives (fuselage, wings, tail, spinning propeller, landing
// gear, navigation lights). No model files, no copied art — every part
// is a box, cylinder or cone placed by hand.

import * as THREE from 'three';

export class Aircraft {
  constructor(scene) {
    this.group = new THREE.Group();
    this.propeller = null;
    this.gearGroup = null;
    this.navLights = [];
    this.buildFuselage();
    this.buildWings();
    this.buildTail();
    this.buildPropeller();
    this.buildGear();
    this.buildLights();
    scene.add(this.group);
  }

  buildFuselage() {
    const orange = new THREE.MeshLambertMaterial({ color: 0xe8622c });
    const white = new THREE.MeshLambertMaterial({ color: 0xf5f2ea });
    const dark = new THREE.MeshLambertMaterial({ color: 0x22282e });
    // Main body: a tapered cylinder along the Z axis, nose forward (-Z).
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.55, 5.6, 12), orange);
    body.rotation.x = Math.PI / 2;
    body.position.z = 0.2;
    this.group.add(body);
    // Nose cone.
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.4, 12), white);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = -3.4;
    this.group.add(nose);
    // Cockpit windows: a dark canopy hump.
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.72, 12, 8), dark);
    canopy.scale.set(0.9, 0.62, 1.7);
    canopy.position.set(0, 0.62, -0.9);
    this.group.add(canopy);
    // Belly stripe.
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 5.2), white);
    stripe.position.set(0, -0.72, 0.2);
    this.group.add(stripe);
  }

  buildWings() {
    const white = new THREE.MeshLambertMaterial({ color: 0xf5f2ea });
    const orange = new THREE.MeshLambertMaterial({ color: 0xe8622c });
    // High wing across the top of the fuselage, slightly swept.
    const wing = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.22, 1.9), white);
    wing.position.set(0, 0.75, -0.2);
    this.group.add(wing);
    // Orange wingtips.
    for (const s of [-1, 1]) {
      const tip = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.26, 1.9), orange);
      tip.position.set(s * 5.2, 0.75, -0.2);
      this.group.add(tip);
    }
    // Wing struts down to the fuselage.
    for (const s of [-1, 1]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 6), white);
      strut.position.set(s * 1.9, 0.1, -0.2);
      strut.rotation.z = s * 0.5;
      this.group.add(strut);
    }
  }

  buildTail() {
    const orange = new THREE.MeshLambertMaterial({ color: 0xe8622c });
    const white = new THREE.MeshLambertMaterial({ color: 0xf5f2ea });
    // Vertical fin.
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.7, 1.5), orange);
    fin.position.set(0, 0.9, 2.9);
    fin.rotation.x = -0.25;
    this.group.add(fin);
    // Horizontal stabiliser.
    const stab = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.16, 1.1), white);
    stab.position.set(0, 0.25, 2.9);
    this.group.add(stab);
  }

  buildPropeller() {
    this.propeller = new THREE.Group();
    // The blades are translucent so the spinning propeller reads as a
    // blur from the cockpit instead of a solid black slab.
    const bladeMat = new THREE.MeshLambertMaterial({ color: 0x2a2e33, transparent: true, opacity: 0.22 });
    const dark = bladeMat;
    const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.7, 10), new THREE.MeshLambertMaterial({ color: 0xe8622c }));
    spinner.rotation.x = -Math.PI / 2;
    spinner.position.z = -4.2;
    this.propeller.add(spinner);
    for (const a of [0, Math.PI]) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.6, 0.1), dark);
      blade.position.z = -4.15;
      blade.rotation.z = a;
      this.propeller.add(blade);
    }
    this.propeller.position.z = 0;
    this.group.add(this.propeller);
  }

  buildGear() {
    this.gearGroup = new THREE.Group();
    const dark = new THREE.MeshLambertMaterial({ color: 0x22282e });
    const strutMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
    // Two main wheels + a tail wheel.
    for (const s of [-1, 1]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6), strutMat);
      strut.position.set(s * 0.85, -1.15, -0.4);
      this.gearGroup.add(strut);
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12), dark);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(s * 0.85, -1.7, -0.4);
      this.gearGroup.add(wheel);
    }
    const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.18, 10), dark);
    tailWheel.rotation.z = Math.PI / 2;
    tailWheel.position.set(0, -1.35, 2.7);
    this.gearGroup.add(tailWheel);
    this.group.add(this.gearGroup);
  }

  buildLights() {
    // Wingtip nav lights: red left, green right, white tail.
    const defs = [
      { color: 0xff2222, x: -5.75, y: 0.75, z: -0.2 },
      { color: 0x22ff66, x: 5.75, y: 0.75, z: -0.2 },
      { color: 0xffffff, x: 0, y: 0.3, z: 3.6 },
    ];
    for (const d of defs) {
      const light = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 8, 6),
        new THREE.MeshBasicMaterial({ color: d.color }),
      );
      light.position.set(d.x, d.y, d.z);
      this.navLights.push(light);
      this.group.add(light);
    }
  }

  // Called every frame: spin the prop with throttle, blink the nav lights.
  update(dt, throttle, time) {
    if (this.propeller) this.propeller.rotation.z += dt * (4 + throttle * 55);
    const blink = Math.sin(time * 4) > 0;
    this.navLights[0].visible = blink;
    this.navLights[1].visible = blink;
  }

  setGearDown(down) {
    this.gearGroup.visible = down;
  }
}
