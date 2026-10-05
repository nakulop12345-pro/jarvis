/**
 * JARVIS 3D — Space environment.
 * Starfield, procedural nebulae, orbital bodies, holographic
 * astronomical grid, and coordinate markers.
 */
import * as THREE from 'three';
import { createNebulaMaterial, createRingMaterial } from './hologram.js';
import { Starfield } from './particles.js';
import { rand } from './utils.js';

export class SpaceMode {
  constructor({ particleCount = 3200, quality = 'HIGH' } = {}){
    this.group = new THREE.Group();
    this.group.name = 'SpaceMode';
    this.group.visible = false;
    this.opacity = 0;
    this.targetOpacity = 0;
    this.t = 0;

    /* -------- Starfield -------- */
    this.stars = new Starfield(
      Math.max(1200, Math.min(9000, Math.floor(particleCount * 2.2))),
      260
    );
    this.group.add(this.stars.points);

    /* -------- Nebula clouds -------- */
    this.nebulae = [];
    const nebulaCount = quality === 'LOW' ? 3 : quality === 'MEDIUM' ? 5 : 7;
    for (let i = 0; i < nebulaCount; i++){
      const mat = createNebulaMaterial(i * 7.13);
      const size = rand(90, 190);
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
      const a = rand(0, Math.PI * 2);
      const r = rand(70, 150);
      plane.position.set(
        Math.cos(a) * r,
        rand(-45, 45),
        Math.sin(a) * r - 60
      );
      plane.lookAt(0, 0, 0);
      mat.uniforms.uOpacity.value = rand(0.18, 0.4);
      plane.userData = { mat, rotSpeed: rand(-0.006, 0.006) };
      this.nebulae.push(plane);
      this.group.add(plane);
    }

    /* -------- Holographic astronomical grid -------- */
    this.grid = new THREE.Group();

    const gridMat = new THREE.LineBasicMaterial({
      color: 0x6fe3f5,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    // Latitude circles
    for (let i = 1; i <= 5; i++){
      const r = 12 * Math.sin((i / 6) * Math.PI);
      const y = 12 * Math.cos((i / 6) * Math.PI);
      const pts = [];
      for (let a = 0; a <= 128; a++){
        const th = (a / 128) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r));
      }
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      this.grid.add(new THREE.Line(g, gridMat));
    }

    // Longitude arcs
    for (let i = 0; i < 8; i++){
      const phi = (i / 8) * Math.PI;
      const pts = [];
      for (let a = 0; a <= 96; a++){
        const th = (a / 96) * Math.PI * 2;
        pts.push(new THREE.Vector3(
          Math.sin(th) * Math.cos(phi) * 12,
          Math.cos(th) * 12,
          Math.sin(th) * Math.sin(phi) * 12
        ));
      }
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      this.grid.add(new THREE.Line(g, gridMat));
    }

    this.group.add(this.grid);

    /* -------- Orbital bodies -------- */
    this.bodies = [];
    const bodyDefs = [
      { r: 22, size: 0.9,  speed: 0.09,  color: '#7fb2ff', tilt: 0.2 },
      { r: 30, size: 1.6,  speed: -0.06, color: '#c39bff', tilt: 0.5 },
      { r: 40, size: 2.4,  speed: 0.045, color: '#9fd0ff', tilt: -0.3 },
      { r: 54, size: 3.4,  speed: -0.03, color: '#ffd7b0', tilt: 0.15 }
    ];

    for (const def of bodyDefs){
      const body = new THREE.Group();

      const sphere = new THREE.Mesh(
        new THREE.IcosahedronGeometry(def.size, 2),
        new THREE.MeshBasicMaterial({
          color: def.color,
          transparent: true,
          opacity: 0.55,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          wireframe: true
        })
      );
      body.add(sphere);

      const haloMat = createRingMaterial();
      haloMat.uniforms.uColor.value.set(def.color);
      haloMat.uniforms.uOpacity.value = 0.35;
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(def.size * 1.6, 0.02, 4, 90),
        haloMat
      );
      halo.rotation.x = Math.PI / 2;
      body.add(halo);

      body.userData = def;
      body.userData.angle = Math.random() * Math.PI * 2;
      body.userData.haloMat = haloMat;

      this.bodies.push(body);
      this.group.add(body);
    }

    /* -------- Coordinate markers -------- */
    this.markers = [];
    for (let i = 0; i < 8; i++){
      const mat = createRingMaterial();
      mat.uniforms.uColor.value.set('#9fd0ff');
      mat.uniforms.uOpacity.value = 0.5;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.5, 0.008, 4, 60),
        mat
      );
      const a = Math.random() * Math.PI * 2;
      const r = 20 + Math.random() * 40;
      ring.position.set(Math.cos(a) * r, rand(-25, 25), Math.sin(a) * r);
      ring.lookAt(0, 0, 0);
      ring.userData = { mat, base: ring.position.clone(), phase: Math.random() * Math.PI * 2 };
      this.markers.push(ring);
      this.group.add(ring);
    }

    /* -------- Distant galaxy sprites -------- */
    this.galaxies = [];
    for (let i = 0; i < 3; i++){
      const mat = createNebulaMaterial(100 + i * 13);
      mat.uniforms.uColorA.value.set('#7f5ad0');
      mat.uniforms.uColorB.value.set('#4fb6ff');
      mat.uniforms.uOpacity.value = 0.5;
      const g = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), mat);
      const a = rand(0, Math.PI * 2);
      g.position.set(Math.cos(a) * 140, rand(-40, 40), Math.sin(a) * 140);
      g.lookAt(0, 0, 0);
      g.userData = { mat, spin: rand(-0.02, 0.02) };
      this.galaxies.push(g);
      this.group.add(g);
    }
  }

  setActive(active){
    this.targetOpacity = active ? 1 : 0;
    if (active) this.group.visible = true;
  }

  update(dt, t, camera){
    this.t = t;

    /* Visibility fade */
    this.opacity += (this.targetOpacity - this.opacity) * Math.min(1, dt * 1.6);
    if (this.opacity < 0.002 && this.targetOpacity === 0){
      this.group.visible = false;
      return;
    }
    if (this.targetOpacity > 0) this.group.visible = true;

    const o = this.opacity;

    /* Stars */
    this.stars.material.uniforms.uOpacity.value = o;
    this.stars.update(t);

    /* Nebulae */
    this.nebulae.forEach((n, i) => {
      n.userData.mat.uniforms.uTime.value = t;
      n.userData.mat.uniforms.uOpacity.value = (0.16 + Math.sin(t * 0.12 + i) * 0.06) * o;
      n.rotation.z += n.userData.rotSpeed * dt;
    });

    /* Grid */
    this.grid.rotation.y = t * 0.01;
    this.grid.rotation.x = Math.sin(t * 0.02) * 0.05;
    this.grid.traverse(c => {
      if (c.material && c.material.opacity !== undefined && c.material.color){
        c.material.opacity = 0.1 * o;
      }
    });
    this.grid.scale.setScalar(1 + Math.sin(t * 0.15) * 0.01);

    /* Bodies */
    this.bodies.forEach((b, i) => {
      const d = b.userData;
      d.angle += d.speed * dt;
      const x = Math.cos(d.angle) * d.r;
      const z = Math.sin(d.angle) * d.r;
      const y = Math.sin(d.angle * 0.7 + i) * 3 * Math.sin(d.tilt + 1);
      b.position.set(x, y, z);
      b.rotation.y += dt * 0.25;
      b.rotation.x += dt * 0.1;
      d.haloMat.uniforms.uTime.value = t;
      d.haloMat.uniforms.uOpacity.value = 0.28 * o;
      b.children[1].rotation.z += dt * 0.4 * (i % 2 === 0 ? 1 : -1);
    });

    /* Markers */
    this.markers.forEach((m, i) => {
      m.userData.mat.uniforms.uTime.value = t;
      m.userData.mat.uniforms.uOpacity.value = (0.35 + Math.sin(t * 0.9 + m.userData.phase) * 0.2) * o;
      m.position.y = m.userData.base.y + Math.sin(t * 0.4 + m.userData.phase) * 1.2;
      m.rotation.z += dt * 0.3;
    });

    /* Galaxies */
    this.galaxies.forEach((g, i) => {
      g.userData.mat.uniforms.uTime.value = t;
      g.userData.mat.uniforms.uOpacity.value = 0.4 * o;
      g.rotation.z += g.userData.spin * dt;
    });
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
