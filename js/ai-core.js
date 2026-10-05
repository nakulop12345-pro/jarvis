/**
 * JARVIS 3D — The AI core entity.
 *
 * Composition:
 *   - inner energy sphere (noise-displaced, additive)
 *   - mid lattice shell (wireframe icosahedron)
 *   - outer holographic shell (scanlines + grid)
 *   - three concentric rings at different tilts
 *   - two orbital arcs
 *   - scanning sweep ring
 *   - abstract face (two eye planes + brow arc)
 *   - data fragments + particle halo
 *   - waveform ring (audio reactive)
 *   - volumetric glow billboards
 *
 * Every visual element reacts to the current state.
 */
import * as THREE from 'three';
import {
  createCoreMaterial, createShellMaterial, createRingMaterial,
  createGlowMaterial, createEyeMaterial, createWaveformMaterial,
  STATE_TINT, PALETTE
} from './hologram.js';
import { CoreParticles, DataFragments } from './particles.js';
import { damp, clamp } from './utils.js';

export class AICore {
  constructor({ quality = 'HIGH', particleCount = 3200 } = {}){
    this.group = new THREE.Group();
    this.group.name = 'AICore';

    this.state = 'IDLE';
    this.t = 0;
    this.pulse = 0;
    this.audioLevel = 0;
    this.tint = STATE_TINT.IDLE.clone();
    this.targetTint = STATE_TINT.IDLE.clone();
    this.quality = quality;

    /* ---------------- Inner core ---------------- */
    this.coreMat = createCoreMaterial();
    this.core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.42, quality === 'LOW' ? 3 : 4),
      this.coreMat
    );
    this.group.add(this.core);

    /* ---------------- Mid lattice ---------------- */
    this.latticeMat = new THREE.MeshBasicMaterial({
      color: 0x9fe8ff,
      wireframe: true,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.lattice = new THREE.Mesh(new THREE.IcosahedronGeometry(0.68, 1), this.latticeMat);
    this.group.add(this.lattice);

    /* ---------------- Outer shell ---------------- */
    this.shellMat = createShellMaterial();
    this.shell = new THREE.Mesh(
      new THREE.SphereGeometry(1.0, 64, 40),
      this.shellMat
    );
    this.group.add(this.shell);

    /* ---------------- Rings ---------------- */
    this.rings = [];
    const ringDefs = [
      { radius: 1.36, tube: 0.0055, tilt: [Math.PI / 2.4, 0, 0], speed: 0.35, color: '#6fe3f5' },
      { radius: 1.62, tube: 0.0042, tilt: [Math.PI / 1.7, Math.PI / 5, 0], speed: -0.24, color: '#9db8ff' },
      { radius: 1.95, tube: 0.0035, tilt: [Math.PI / 2.9, -Math.PI / 3, 0.4], speed: 0.16, color: '#cfeaff' },
      { radius: 2.32, tube: 0.0028, tilt: [Math.PI / 1.4, Math.PI / 8, -0.6], speed: -0.11, color: '#7fa9ff' }
    ];

    for (const def of ringDefs){
      const mat = createRingMaterial();
      mat.uniforms.uColor.value.set(def.color);
      const mesh = new THREE.Mesh(
        new THREE.TorusGeometry(def.radius, def.tube, 6, 220),
        mat
      );
      mesh.rotation.set(def.tilt[0], def.tilt[1], def.tilt[2]);
      mesh.userData = { speed: def.speed, base: def.tilt.slice(), mat };
      this.rings.push(mesh);
      this.group.add(mesh);
    }

    /* ---------------- Orbital arcs ---------------- */
    this.arcs = [];
    for (let i = 0; i < 2; i++){
      const mat = createRingMaterial();
      mat.uniforms.uColor.value.set(i === 0 ? '#6fe3f5' : '#9db8ff');
      mat.uniforms.uOpacity.value = 0.9;
      const geo = new THREE.TorusGeometry(2.6 + i * 0.5, 0.006, 6, 120, Math.PI * 1.25);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.set(Math.PI / 2 + i * 0.6, i * 1.2, i * 0.4);
      mesh.userData = { mat, speed: (i === 0 ? 1 : -1) * 0.2 };
      this.arcs.push(mesh);
      this.group.add(mesh);
    }

    /* ---------------- Scan sweep ring ---------------- */
    this.scanMat = createRingMaterial();
    this.scanMat.uniforms.uColor.value.set('#eafcff');
    this.scanMat.uniforms.uOpacity.value = 0.55;
    this.scanMat.uniforms.uSpeed.value = 3.0;
    this.scanRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.15, 0.0035, 4, 180),
      this.scanMat
    );
    this.scanRing.rotation.x = Math.PI / 2;
    this.group.add(this.scanRing);

    /* ---------------- Waveform ring ---------------- */
    this.waveMat = createWaveformMaterial();
    this.waveform = new THREE.Mesh(
      new THREE.RingGeometry(1.42, 1.46, 220, 1),
      this.waveMat
    );
    this.waveform.rotation.x = Math.PI / 2;
    this.waveform.visible = false;
    this.group.add(this.waveform);

    /* ---------------- Glow billboards ---------------- */
    this.glowOuterMat = createGlowMaterial('#6fe3f5');
    this.glowOuterMat.uniforms.uOpacity.value = 0.35;
    this.glowOuter = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), this.glowOuterMat);
    this.glowOuter.position.z = -1.2;
    this.group.add(this.glowOuter);

    this.glowInnerMat = createGlowMaterial('#eafcff');
    this.glowInnerMat.uniforms.uOpacity.value = 0.6;
    this.glowInner = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), this.glowInnerMat);
    this.glowInner.position.z = -0.4;
    this.group.add(this.glowInner);

    /* ---------------- Abstract face ---------------- */
    this.face = new THREE.Group();
    this.face.position.z = 0.86;

    this.eyeMatL = createEyeMaterial();
    this.eyeMatR = createEyeMaterial();

    const eyeGeo = new THREE.PlaneGeometry(0.42, 0.28);
    this.eyeL = new THREE.Mesh(eyeGeo, this.eyeMatL);
    this.eyeL.position.set(-0.24, 0.06, 0);
    this.eyeR = new THREE.Mesh(eyeGeo, this.eyeMatR);
    this.eyeR.position.set(0.24, 0.06, 0);

    this.face.add(this.eyeL, this.eyeR);

    // brow / energy bar between eyes
    this.browMat = createGlowMaterial('#9fe8ff');
    this.browMat.uniforms.uOpacity.value = 0.5;
    this.brow = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.02), this.browMat);
    this.brow.position.set(0, 0.32, 0);
    this.face.add(this.brow);

    this.group.add(this.face);

    /* ---------------- Particles + fragments ---------------- */
    this.particles = new CoreParticles(Math.max(600, Math.floor(particleCount * 0.8)));
    this.group.add(this.particles.points);

    this.fragments = new DataFragments(quality === 'LOW' ? 28 : quality === 'ULTRA' ? 90 : 56);
    this.group.add(this.fragments.mesh);

    /* ---------------- Internal animation state ---------------- */
    this.anim = {
      coreAmp: 0.14,
      shellOpacity: 0.32,
      eyeOpen: 1.0,
      blinkTimer: 2 + Math.random() * 4,
      blink: 1.0,
      eyeLook: new THREE.Vector2(0, 0),
      eyeLookTarget: new THREE.Vector2(0, 0),
      mood: 0.5,
      ringSpeeds: [0.35, -0.24, 0.16, -0.11],
      breath: 0
    };

    this.setTint(STATE_TINT.IDLE);
  }

  /* ============================================================
     STATE
  ============================================================ */
  setState(state){
    this.state = state;
    const tint = STATE_TINT[state] || STATE_TINT.IDLE;
    this.targetTint.copy(tint);

    // Face mood map
    const mood = {
      IDLE: 0.45, LISTENING: 0.7, THINKING: 0.6, ANALYZING: 0.62,
      RESPONDING: 0.8, SPEAKING: 0.85, EXECUTING: 0.9, ERROR: 0.15,
      CURIOUS: 0.75, READY: 0.6
    }[state] ?? 0.5;
    this.anim.mood = mood;

    // Look direction
    switch (state){
      case 'THINKING':
      case 'ANALYZING':
        this.anim.eyeLookTarget.set(-0.4, 0.25);
        break;
      case 'LISTENING':
        this.anim.eyeLookTarget.set(0, -0.1);
        break;
      case 'SPEAKING':
      case 'RESPONDING':
        this.anim.eyeLookTarget.set(0, 0.05);
        break;
      case 'ERROR':
        this.anim.eyeLookTarget.set(0, -0.3);
        break;
      case 'EXECUTING':
        this.anim.eyeLookTarget.set(0.3, 0.15);
        break;
      default:
        this.anim.eyeLookTarget.set(0, 0);
    }

    // Waveform visibility
    this.waveform.visible = state === 'LISTENING' || state === 'SPEAKING' || state === 'RESPONDING';

    // Scan ring behaviour
    this.scanRing.visible = state !== 'ERROR';
  }

  setTint(color){
    this.tint.copy(color);
    this.targetTint.copy(color);
    this._applyTint();
  }

  setModePalette(mode){
    const p = PALETTE[mode] || PALETTE.home;
    this.coreMat.uniforms.uColorA.value.copy(p.a);
    this.coreMat.uniforms.uColorB.value.copy(p.c);
    this.glowOuterMat.uniforms.uColor.value.copy(p.a);
    this.glowInnerMat.uniforms.uColor.value.copy(p.c);
    this.eyeMatL.uniforms.uGlow.value.copy(p.a);
    this.eyeMatR.uniforms.uGlow.value.copy(p.a);
  }

  _applyTint(){
    const c = this.tint;
    this.shellMat.uniforms.uColor.value.copy(c);
    this.eyeMatL.uniforms.uGlow.value.copy(c);
    this.eyeMatR.uniforms.uGlow.value.copy(c);
    this.scanMat.uniforms.uColor.value.copy(c).lerp(new THREE.Color(0xffffff), 0.4);
    this.waveMat.uniforms.uColor.value.copy(c);
    this.particles.setTint(c);
    this.fragments.setTint(c);
    this.glowOuterMat.uniforms.uColor.value.copy(c);

    // rings shift slightly
    this.rings.forEach((r, i) => {
      r.userData.mat.uniforms.uColor.value.copy(c).lerp(
        new THREE.Color(['#6fe3f5','#9db8ff','#cfeaff','#7fa9ff'][i] || '#6fe3f5'), 0.55
      );
    });
  }

  /** Audio reactivity input: 0..1 */
  setAudioLevel(level){
    this.audioLevel = clamp(level, 0, 1);
  }

  /* ============================================================
     UPDATE
  ============================================================ */
  update(dt, t, { camera } = {}){
    this.t = t;

    /* Tint easing */
    this.tint.lerp(this.targetTint, damp(0, 1, 3.0, dt));
    this._applyTint();

    /* Breathing / pulse */
    const state = this.state;
    const breathSpeed =
      state === 'EXECUTING' ? 4.4 :
      state === 'ERROR' ? 9.0 :
      state === 'THINKING' || state === 'ANALYZING' ? 2.6 :
      state === 'SPEAKING' || state === 'RESPONDING' ? 3.6 :
      state === 'LISTENING' ? 2.0 : 1.0;

    this.anim.breath = Math.sin(t * breathSpeed) * 0.5 + 0.5;

    /* Global pulse combines breath + audio */
    const audio = this.audioLevel;
    const targetPulse =
      state === 'EXECUTING' ? 0.55 + this.anim.breath * 0.35 :
      state === 'ERROR' ? 0.7 * Math.abs(Math.sin(t * 7)) :
      state === 'LISTENING' ? 0.25 + audio * 0.7 :
      state === 'SPEAKING' || state === 'RESPONDING' ? 0.15 + audio * 0.8 :
      state === 'THINKING' || state === 'ANALYZING' ? 0.2 + this.anim.breath * 0.25 :
      this.anim.breath * 0.22;

    this.pulse += (targetPulse - this.pulse) * clamp(dt * 6, 0, 1);

    /* Core */
    const coreAmpTarget =
      state === 'EXECUTING' ? 0.24 :
      state === 'ERROR' ? 0.18 :
      state === 'THINKING' || state === 'ANALYZING' ? 0.18 :
      state === 'LISTENING' ? 0.16 + audio * 0.1 :
      state === 'SPEAKING' || state === 'RESPONDING' ? 0.15 + audio * 0.12 :
      0.13;

    this.coreMat.uniforms.uTime.value = t;
    this.coreMat.uniforms.uAmp.value = damp(this.coreMat.uniforms.uAmp.value, coreAmpTarget, 3, dt);
    this.coreMat.uniforms.uPulse.value = this.pulse;
    this.core.scale.setScalar(1 + this.pulse * 0.06 + Math.sin(t * 1.2) * 0.008);

    /* Lattice */
    this.lattice.rotation.y = t * 0.15;
    this.lattice.rotation.x = t * 0.08;
    this.latticeMat.opacity = 0.16 + this.pulse * 0.22;
    this.lattice.scale.setScalar(1 + this.pulse * 0.05);

    /* Shell */
    this.shellMat.uniforms.uTime.value = t;
    this.shellMat.uniforms.uPulse.value = this.pulse;
    const shellOpacityTarget =
      state === 'IDLE' ? 0.28 :
      state === 'LISTENING' ? 0.4 :
      state === 'THINKING' || state === 'ANALYZING' ? 0.42 :
      state === 'EXECUTING' ? 0.5 :
      state === 'ERROR' ? 0.5 : 0.34;
    this.shellMat.uniforms.uOpacity.value = damp(
      this.shellMat.uniforms.uOpacity.value, shellOpacityTarget, 3, dt
    );
    this.shell.scale.setScalar(1 + this.pulse * 0.035);

    /* Rings */
    const speedMult =
      state === 'EXECUTING' ? 4.0 :
      state === 'ERROR' ? 0.15 :
      state === 'THINKING' || state === 'ANALYZING' ? 2.6 :
      state === 'SPEAKING' || state === 'RESPONDING' ? 1.4 :
      state === 'LISTENING' ? 1.3 : 1.0;

    this.rings.forEach((r, i) => {
      const base = r.userData.base;
      r.userData.mat.uniforms.uTime.value = t;
      r.userData.mat.uniforms.uPulse.value = this.pulse;
      r.userData.mat.uniforms.uSpeed.value = 1 + i * 0.4;

      r.rotation.z += r.userData.speed * dt * speedMult;
      r.rotation.x = base[0] + Math.sin(t * 0.3 + i) * 0.06 * speedMult * 0.4;
      r.rotation.y = base[1] + Math.cos(t * 0.24 + i * 1.7) * 0.05 * speedMult * 0.4;

      const expand = 1 + this.pulse * 0.045;
      r.scale.setScalar(expand);
    });

    /* Arcs */
    this.arcs.forEach((a, i) => {
      a.userData.mat.uniforms.uTime.value = t;
      a.userData.mat.uniforms.uPulse.value = this.pulse;
      a.rotation.z += a.userData.speed * dt * speedMult;
      a.rotation.y += a.userData.speed * 0.4 * dt * speedMult;
      a.scale.setScalar(1 + this.pulse * 0.06);
    });

    /* Scan ring */
    this.scanMat.uniforms.uTime.value = t;
    this.scanMat.uniforms.uPulse.value = this.pulse;
    if (this.scanRing.visible){
      const cycle = (t * 0.55) % 1;
      const y = Math.sin(cycle * Math.PI * 2) * 0.9;
      this.scanRing.position.y = y;
      const s = 0.6 + Math.sqrt(Math.max(0, 1 - (y / 0.95) ** 2)) * 0.55;
      this.scanRing.scale.set(s, s, 1);
      this.scanMat.uniforms.uOpacity.value = 0.22 + 0.45 * (1 - Math.abs(y) / 0.95);
    }

    /* Waveform */
    if (this.waveform.visible){
      this.waveMat.uniforms.uTime.value = t;
      const ampTarget = state === 'LISTENING' ? audio : (state === 'SPEAKING' ? audio : 0.15);
      this.waveMat.uniforms.uAmp.value = damp(this.waveMat.uniforms.uAmp.value, ampTarget, 8, dt);
      const ws = 1 + this.pulse * 0.05;
      this.waveform.scale.set(ws, ws, 1);
    }

    /* Glow */
    this.glowOuterMat.uniforms.uTime.value = t;
    this.glowInnerMat.uniforms.uTime.value = t;
    this.glowOuterMat.uniforms.uOpacity.value = 0.22 + this.pulse * 0.35;
    this.glowInnerMat.uniforms.uOpacity.value = 0.4 + this.pulse * 0.5;
    const gs = 1 + this.pulse * 0.12 + Math.sin(t * 0.6) * 0.02;
    this.glowOuter.scale.setScalar(gs);
    this.glowInner.scale.setScalar(gs);

    /* Billboard glow toward camera */
    if (camera){
      this.glowOuter.lookAt(camera.position);
      this.glowInner.lookAt(camera.position);
    }

    /* Face */
    this._updateFace(dt, t, camera);

    /* Particles + fragments */
    this.particles.update(t, state);
    this.fragments.update(t, state);

    /* Whole group subtle rotation */
    this.group.rotation.y += dt * 0.03;
  }

  _updateFace(dt, t, camera){
    /* Blink */
    this.anim.blinkTimer -= dt;
    if (this.anim.blinkTimer <= 0){
      this.anim.blinkTimer = 2.5 + Math.random() * 4.5;
    }
    // Blink envelope
    const blinkPhase = this.anim.blinkTimer;
    let blink = 1;
    if (blinkPhase < 0.14){
      blink = Math.abs(Math.sin((blinkPhase / 0.14) * Math.PI));
      blink = clamp(blink, 0.08, 1);
    }
    this.anim.blink += (blink - this.anim.blink) * clamp(dt * 22, 0, 1);

    /* Eye look */
    this.anim.eyeLook.x = damp(this.anim.eyeLook.x, this.anim.eyeLookTarget.x, 4, dt);
    this.anim.eyeLook.y = damp(this.anim.eyeLook.y, this.anim.eyeLookTarget.y, 4, dt);

    /* Eye open amount by state */
    const openTarget =
      this.state === 'ERROR' ? 0.35 :
      this.state === 'THINKING' ? 0.72 :
      this.state === 'LISTENING' ? 1.12 :
      this.state === 'SPEAKING' || this.state === 'RESPONDING' ? 1.05 :
      this.state === 'CURIOUS' ? 1.15 :
      1.0;
    this.anim.eyeOpen = damp(this.anim.eyeOpen, openTarget, 5, dt);

    const applyEye = (mat) => {
      mat.uniforms.uTime.value = t;
      mat.uniforms.uOpen.value = this.anim.eyeOpen;
      mat.uniforms.uBlink.value = this.anim.blink;
      mat.uniforms.uMood.value = this.anim.mood;
      mat.uniforms.uLook.value.set(this.anim.eyeLook.x, this.anim.eyeLook.y);
      mat.uniforms.uOpacity.value = 0.85 + this.pulse * 0.3;
    };
    applyEye(this.eyeMatL);
    applyEye(this.eyeMatR);

    /* Slight eye separation by state */
    const spread = this.state === 'ERROR' ? 0.29 : this.state === 'CURIOUS' ? 0.26 : 0.24;
    this.eyeL.position.x = -spread;
    this.eyeR.position.x =  spread;

    /* Brow */
    this.browMat.uniforms.uTime.value = t;
    this.browMat.uniforms.uOpacity.value = 0.3 + this.pulse * 0.35;
    this.brow.scale.x = 0.9 + this.anim.mood * 0.25;
    this.brow.position.y = 0.3 + (this.anim.mood - 0.5) * 0.06;

    /* Face follows camera gently */
    if (camera){
      const local = camera.position.clone();
      this.face.lookAt(local);
      this.face.position.z = 0.86;
      this.face.position.x *= 0.25;
      this.face.position.y *= 0.25;
    }
  }

  /* ============================================================
     POWER / STANDBY
  ============================================================ */
  setPower(p){ // 0..1
    this.power = p;
    const s = 0.15 + p * 0.85;
    this.group.scale.setScalar(s);
    this.coreMat.uniforms.uOpacity.value = p;
    this.shellMat.uniforms.uOpacity.value = 0.32 * p;
    this.latticeMat.opacity = 0.22 * p;
    this.glowOuterMat.uniforms.uOpacity.value = 0.35 * p;
    this.glowInnerMat.uniforms.uOpacity.value = 0.6 * p;
    this.eyeMatL.uniforms.uOpacity.value = p;
    this.eyeMatR.uniforms.uOpacity.value = p;
    this.browMat.uniforms.uOpacity.value = 0.5 * p;
    this.rings.forEach(r => {
      r.userData.mat.uniforms.uOpacity.value = 0.75 * p;
    });
    this.particles.material.uniforms.uOpacity.value = 0.75 * p;
    this.fragments.mesh.material.opacity = 0.7 * p;
  }

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
