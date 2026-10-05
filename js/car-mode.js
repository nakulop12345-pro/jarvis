/**
 * JARVIS 3D — Automotive laboratory environment.
 * Original procedural concept hypercar with holographic body,
 * wireframe aero lines, rotating wheels, suspension visualization,
 * and a ground grid.
 */
import * as THREE from 'three';
import { createRingMaterial, createGlowMaterial } from './hologram.js';
import { rand } from './utils.js';

function buildBodyShape(){
  const s = new THREE.Shape();
  // Side silhouette of a low, aerodynamic concept car
  // Origin at ground level, length along X, height along Y
  s.moveTo(-2.60, 0.30);
  s.lineTo(-2.55, 0.62);
  s.quadraticCurveTo(-2.35, 0.86, -1.85, 0.92);   // rear haunch
  s.quadraticCurveTo(-1.10, 1.00, -0.60, 1.06);   // cockpit rise
  s.quadraticCurveTo( 0.10, 1.12,  0.55, 1.00);   // roof
  s.quadraticCurveTo( 1.30, 0.82,  1.85, 0.66);   // windshield slope
  s.quadraticCurveTo( 2.30, 0.54,  2.60, 0.42);   // nose
  s.lineTo( 2.62, 0.24);
  s.quadraticCurveTo( 2.20, 0.16,  1.70, 0.14);   // front splitter
  s.lineTo( 1.10, 0.14);
  s.quadraticCurveTo( 0.80, 0.42,  0.30, 0.46);   // wheel arch front top
  s.lineTo(-0.30, 0.46);
  s.quadraticCurveTo(-0.80, 0.42, -1.10, 0.14);   // wheel arch rear top
  s.lineTo(-1.70, 0.14);
  s.quadraticCurveTo(-2.20, 0.16, -2.60, 0.30);
  return s;
}

export class CarMode {
  constructor({ quality = 'HIGH' } = {}){
    this.group = new THREE.Group();
    this.group.name = 'CarMode';
    this.group.visible = false;
    this.opacity = 0;
    this.targetOpacity = 0;
    this.t = 0;
    this.speed = 0;

    /* ---------------- Vehicle ---------------- */
    this.vehicle = new THREE.Group();
    this.vehicle.position.y = 0.32;
    this.group.add(this.vehicle);

    const segs = quality === 'LOW' ? 6 : quality === 'ULTRA' ? 20 : 12;

    // Body — extruded silhouette
    const shape = buildBodyShape();
    const extrudeSettings = {
      depth: 1.9,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 2,
      curveSegments: segs
    };
    const bodyGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    bodyGeo.center();
    bodyGeo.rotateY(Math.PI / 2);
    bodyGeo.translate(0, 0.14, 0);

    this.bodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x0b1a2a,
      metalness: 0.85,
      roughness: 0.18,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      transparent: true,
      opacity: 0.65,
      emissive: new THREE.Color('#1d4a63'),
      emissiveIntensity: 0.35,
      side: THREE.DoubleSide
    });

    this.body = new THREE.Mesh(bodyGeo, this.bodyMat);
    this.vehicle.add(this.body);

    // Wireframe overlay for holographic feel
    this.wireMat = new THREE.MeshBasicMaterial({
      color: 0x6fe3f5,
      wireframe: true,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.wire = new THREE.Mesh(bodyGeo, this.wireMat);
    this.wire.scale.setScalar(1.004);
    this.vehicle.add(this.wire);

    /* ---------------- Wheels ---------------- */
    this.wheels = [];
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.28, 28, 1, false);
    wheelGeo.rotateZ(Math.PI / 2);

    const rimGeo = new THREE.TorusGeometry(0.30, 0.022, 6, 40);
    rimGeo.rotateY(Math.PI / 2);

    const spokeGeo = new THREE.BoxGeometry(0.02, 0.56, 0.03);

    const wheelPositions = [
      [ 1.72, 0.10,  0.98],
      [ 1.72, 0.10, -0.98],
      [-1.62, 0.10,  1.02],
      [-1.62, 0.10, -1.02]
    ];

    for (const p of wheelPositions){
      const w = new THREE.Group();

      const tire = new THREE.Mesh(wheelGeo, new THREE.MeshStandardMaterial({
        color: 0x05090e,
        metalness: 0.1,
        roughness: 0.9,
        transparent: true,
        opacity: 0.85
      }));
      w.add(tire);

      const rim = new THREE.Mesh(rimGeo, new THREE.MeshBasicMaterial({
        color: 0x9fe8ff,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending
      }));
      rim.rotation.y = Math.PI / 2;
      w.add(rim);

      // spokes
      for (let i = 0; i < 6; i++){
        const sp = new THREE.Mesh(spokeGeo, new THREE.MeshBasicMaterial({
          color: 0x6fe3f5,
          transparent: true,
          opacity: 0.35,
          blending: THREE.AdditiveBlending
        }));
        sp.rotation.x = (i / 6) * Math.PI;
        w.add(sp);
      }

      // suspension line from wheel to body
      const susMat = new THREE.LineBasicMaterial({
        color: 0xffb26b,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending
      });
      const susGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0.5, p[2] > 0 ? -0.2 : 0.2)
      ]);
      const sus = new THREE.Line(susGeo, susMat);
      w.add(sus);

      w.position.set(p[0], p[1], p[2]);
      w.userData = { sus, rim, baseY: p[1] };
      this.wheels.push(w);
      this.vehicle.add(w);
    }

    /* ---------------- Aerodynamic flow lines ---------------- */
    this.aeroLines = [];
    for (let i = 0; i < 14; i++){
      const z = -1.0 + (i / 13) * 2.0;
      const pts = [];
      for (let a = 0; a <= 24; a++){
        const x = -2.9 + (a / 24) * 6.2;
        const y = 0.55 + Math.sin(a * 0.5 + i) * 0.06 + Math.abs(z) * 0.02;
        pts.push(new THREE.Vector3(x, y, z));
      }
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      const m = new THREE.LineBasicMaterial({
        color: 0x6fe3f5,
        transparent: true,
        opacity: 0.14,
        blending: THREE.AdditiveBlending
      });
      const line = new THREE.Line(g, m);
      line.userData = { offset: Math.random() * Math.PI * 2 };
      this.aeroLines.push(line);
      this.vehicle.add(line);
    }

    /* ---------------- Downforce / drag visualizer ---------------- */
    this.forceGroup = new THREE.Group();
    this.forceGroup.position.set(2.2, 1.2, 0);
    this.vehicle.add(this.forceGroup);

    const forceMat = createRingMaterial();
    forceMat.uniforms.uColor.value.set('#ffb26b');
    forceMat.uniforms.uOpacity.value = 0.6;
    this.forceRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.008, 4, 60),
      forceMat
    );
    this.forceGroup.add(this.forceRing);

    this.forceRing2 = new THREE.Mesh(
      new THREE.TorusGeometry(0.46, 0.005, 4, 60),
      forceMat.clone()
    );
    this.forceRing2.material.uniforms.uColor.value.set('#ff7a59');
    this.forceGroup.add(this.forceRing2);

    /* ---------------- Ground grid ---------------- */
    this.ground = new THREE.Group();
    const gm = new THREE.LineBasicMaterial({
      color: 0x6fe3f5,
      transparent: true,
      opacity: 0.13,
      blending: THREE.AdditiveBlending
    });
    const half = 14;
    const step = 1;
    for (let i = -half; i <= half; i += step){
      const gx = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(i, 0, -half),
        new THREE.Vector3(i, 0,  half)
      ]);
      const gz = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-half, 0, i),
        new THREE.Vector3( half, 0, i)
      ]);
      this.ground.add(new THREE.Line(gx, gm));
      this.ground.add(new THREE.Line(gz, gm));
    }
    this.ground.position.y = -0.06;
    this.group.add(this.ground);

    /* ---------------- Platform halo ---------------- */
    const haloMat = createGlowMaterial('#6fe3f5');
    haloMat.uniforms.uOpacity.value = 0.32;
    this.platformHalo = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), haloMat);
    this.platformHalo.rotation.x = -Math.PI / 2;
    this.platformHalo.position.y = -0.05;
    this.group.add(this.platformHalo);

    /* ---------------- Scan pillars ---------------- */
    this.pillars = [];
    for (let i = 0; i < 4; i++){
      const a = (i / 4) * Math.PI * 2;
      const r = 4.6;
      const mat = createRingMaterial();
      mat.uniforms.uColor.value.set('#9fd0ff');
      mat.uniforms.uOpacity.value = 0.4;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.36, 0.006, 4, 50),
        mat
      );
      ring.position.set(Math.cos(a) * r, 1.1, Math.sin(a) * r);
      ring.rotation.x = Math.PI / 2;
      ring.userData = { mat, phase: Math.random() * Math.PI * 2 };
      this.pillars.push(ring);
      this.group.add(ring);
    }

    /* ---------------- Telemetry nodes ---------------- */
    this.telemetry = [];
    for (let i = 0; i < 6; i++){
      const mat = createRingMaterial();
      mat.uniforms.uColor.value.set('#ffb26b');
      mat.uniforms.uOpacity.value = 0.5;
      const node = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.09, 0),
        mat
      );
      const a = Math.random() * Math.PI * 2;
      const r = 3.2 + Math.random() * 2.2;
      node.position.set(Math.cos(a) * r, 0.6 + Math.random() * 2.0, Math.sin(a) * r);
      node.userData = { mat, phase: Math.random() * Math.PI * 2, baseY: node.position.y };
      this.telemetry.push(node);
      this.group.add(node);
    }
  }

  setActive(active){
    this.targetOpacity = active ? 1 : 0;
    if (active) this.group.visible = true;
  }

  update(dt, t, camera){
    this.t = t;

    this.opacity += (this.targetOpacity - this.opacity) * Math.min(1, dt * 1.6);
    if (this.opacity < 0.002 && this.targetOpacity === 0){
      this.group.visible = false;
      return;
    }
    if (this.targetOpacity > 0) this.group.visible = true;

    const o = this.opacity;

    /* Vehicle idle rotation */
    this.vehicle.rotation.y += dt * 0.12;
    this.vehicle.position.y = 0.32 + Math.sin(t * 0.9) * 0.02;

    /* Materials opacity follow */
    this.bodyMat.opacity = 0.62 * o;
    this.wireMat.opacity = 0.16 * o;

    /* Wheels */
    this.speed += (1 - this.speed) * dt * 0.5; // settle at 1
    this.wheels.forEach((w, i) => {
      w.rotation.x += dt * (1.4 + i * 0.05);
      w.position.y = w.userData.baseY + Math.sin(t * 1.6 + i) * 0.012;
      w.userData.sus.material.opacity = (0.3 + Math.sin(t * 2.2 + i) * 0.2) * o;
    });

    /* Aero lines shimmer */
    this.aeroLines.forEach((l, i) => {
      l.material.opacity = (0.08 + Math.abs(Math.sin(t * 1.2 + l.userData.offset)) * 0.14) * o;
    });

    /* Force rings */
    this.forceRing.material.uniforms.uTime.value = t;
    this.forceRing2.material.uniforms.uTime.value = t;
    this.forceRing.material.uniforms.uOpacity.value = 0.55 * o;
    this.forceRing2.material.uniforms.uOpacity.value = 0.4 * o;
    this.forceRing.rotation.z += dt * 1.2;
    this.forceRing2.rotation.z -= dt * 0.8;
    this.forceRing.rotation.x = Math.PI / 2;
    this.forceRing2.rotation.x = Math.PI / 2;
    this.forceGroup.position.y = 1.2 + Math.sin(t * 1.1) * 0.05;

    /* Ground */
    this.ground.rotation.y = t * 0.02;

    /* Platform halo */
    this.platformHalo.material.uniforms.uTime.value = t;
    this.platformHalo.material.uniforms.uOpacity.value = (0.22 + Math.sin(t * 0.8) * 0.06) * o;

    /* Pillars */
    this.pillars.forEach((p, i) => {
      p.userData.mat.uniforms.uTime.value = t;
      p.userData.mat.uniforms.uOpacity.value = (0.3 + Math.sin(t * 1.5 + p.userData.phase) * 0.2) * o;
      p.rotation.z += dt * 0.5;
    });

    /* Telemetry nodes */
    this.telemetry.forEach((n, i) => {
      n.userData.mat.uniforms.uTime.value = t;
      n.userData.mat.uniforms.uOpacity.value = (0.35 + Math.sin(t * 1.8 + n.userData.phase) * 0.25) * o;
      n.position.y = n.userData.baseY + Math.sin(t * 1.2 + n.userData.phase) * 0.18;
      n.rotation.x += dt * 0.9;
      n.rotation.y += dt * 1.2;
    });

    /* Group-level visibility of everything */
    this.group.traverse(c => {
      if (c.material && c.material.opacity !== undefined && c !== this.body &&
          c !== this.wire && c !== this.platformHalo){
        // leave per-object opacities as computed above
      }
    });
  }

  /** Is the vehicle roughly facing the camera? Used for cinematic framing */
  dispose(){
    this.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material){
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
        else o.material.dispose();
      }
    });
  }
}
