/**
 * JARVIS 3D — Particle systems.
 * Uses THREE.Points with custom shaders for soft additive dots.
 */
import * as THREE from 'three';
import { rand } from './utils.js';

export function createPointMaterial({ color = '#6fe3f5', size = 2.4, opacity = 0.8 } = {}){
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime:    { value: 0 },
      uColor:   { value: new THREE.Color(color) },
      uSize:    { value: size },
      uOpacity: { value: opacity },
      uPixel:   { value: Math.min(window.devicePixelRatio || 1, 2) }
    },
    vertexShader: /* glsl */`
      uniform float uTime;
      uniform float uSize;
      uniform float uPixel;
      attribute float aScale;
      attribute float aPhase;
      varying float vAlpha;
      void main(){
        vec3 p = position;
        p.y += sin(uTime * 0.6 + aPhase) * 0.04;
        p.x += cos(uTime * 0.5 + aPhase * 1.3) * 0.04;

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * aScale * uPixel * (1.0 / max(0.1, -mv.z)) * 30.0;
        vAlpha = clamp(0.3 + 0.7 * aScale, 0.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3  uColor;
      uniform float uOpacity;
      varying float vAlpha;
      void main(){
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        float a = pow(clamp(1.0 - d * 2.0, 0.0, 1.0), 2.0);
        gl_FragColor = vec4(uColor, a * uOpacity * vAlpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
}

/** Spherical halo of particles around the core */
export class CoreParticles {
  constructor(count = 2600){
    this.count = count;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const scale = new Float32Array(count);
    const phase = new Float32Array(count);

    for (let i = 0; i < count; i++){
      const r = 1.4 + Math.pow(Math.random(), 0.6) * 3.6;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
      pos[i*3+1] = r * Math.cos(phi) * 0.7;
      pos[i*3+2] = r * Math.sin(phi) * Math.sin(theta);
      scale[i] = 0.25 + Math.random() * 0.9;
      phase[i] = Math.random() * Math.PI * 2;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));

    this.material = createPointMaterial({ color: '#8fe9ff', size: 2.6, opacity: 0.75 });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
  }

  update(t, state){
    this.material.uniforms.uTime.value = t;
    const target = state === 'THINKING' || state === 'ANALYZING' ? 1.25 : 1.0;
    this.points.rotation.y = t * 0.03;
    this.points.scale.setScalar(1 + Math.sin(t * 0.4) * 0.012);
  }

  setTint(color){
    this.material.uniforms.uColor.value.copy(color);
  }
}

/** Instanced floating data fragments orbiting the core */
export class DataFragments {
  constructor(count = 60){
    this.count = count;
    const geo = new THREE.BoxGeometry(0.045, 0.045, 0.045);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x9fe8ff,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.frustumCulled = false;

    this.data = [];
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++){
      const d = {
        r: 1.9 + Math.random() * 3.4,
        theta: Math.random() * Math.PI * 2,
        phi: Math.acos(2 * Math.random() - 1),
        speed: (Math.random() * 0.5 + 0.2) * (Math.random() < 0.5 ? -1 : 1),
        wobble: Math.random() * Math.PI * 2,
        scale: 0.5 + Math.random() * 1.4,
        yScale: 0.4 + Math.random() * 1.2
      };
      this.data.push(d);
      dummy.scale.setScalar(d.scale);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }
    this.dummy = dummy;
    this._c = new THREE.Color();
  }

  update(t, state){
    const speedMult = state === 'THINKING' || state === 'ANALYZING' ? 2.4
                    : state === 'EXECUTING' ? 3.2
                    : state === 'ERROR' ? 0.25 : 1.0;

    for (let i = 0; i < this.count; i++){
      const d = this.data[i];
      d.theta += d.speed * 0.0035 * speedMult;
      const r = d.r + Math.sin(t * 0.5 + d.wobble) * 0.08;
      const x = r * Math.sin(d.phi) * Math.cos(d.theta);
      const y = r * Math.cos(d.phi) * d.yScale;
      const z = r * Math.sin(d.phi) * Math.sin(d.theta);

      this.dummy.position.set(x, y, z);
      this.dummy.rotation.set(t * 0.6 * d.speed, t * 0.8, 0);
      const s = d.scale * (state === 'EXECUTING' ? 1.3 : 1.0);
      this.dummy.scale.setScalar(s);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  setTint(color){
    this.mesh.material.color.copy(color);
  }
}

/** Starfield for space mode */
export class Starfield {
  constructor(count = 6000, radius = 220){
    this.count = count;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const scale = new Float32Array(count);
    const phase = new Float32Array(count);
    const colorArr = new Float32Array(count * 3);

    const c = new THREE.Color();
    for (let i = 0; i < count; i++){
      const r = radius * (0.35 + Math.pow(Math.random(), 0.5) * 0.65);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
      pos[i*3+1] = r * Math.cos(phi);
      pos[i*3+2] = r * Math.sin(phi) * Math.sin(theta);

      scale[i] = 0.2 + Math.pow(Math.random(), 3) * 2.2;
      phase[i] = Math.random() * Math.PI * 2;

      const tint = rand(0, 1);
      if (tint < 0.7) c.setRGB(1, 1, 1);
      else if (tint < 0.85) c.setRGB(0.75, 0.85, 1);
      else c.setRGB(1, 0.88, 0.75);

      colorArr[i*3] = c.r; colorArr[i*3+1] = c.g; colorArr[i*3+2] = c.b;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    geo.setAttribute('color', new THREE.BufferAttribute(colorArr, 3));

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime:  { value: 0 },
        uSize:  { value: 2.2 },
        uPixel: { value: Math.min(window.devicePixelRatio || 1, 2) },
        uOpacity: { value: 1.0 }
      },
      vertexShader: /* glsl */`
        uniform float uTime;
        uniform float uSize;
        uniform float uPixel;
        attribute float aScale;
        attribute float aPhase;
        varying vec3 vColor;
        varying float vAlpha;
        void main(){
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          float tw = 0.7 + 0.3 * sin(uTime * 2.0 + aPhase);
          gl_PointSize = uSize * aScale * uPixel * tw * (1.0 / max(0.1, -mv.z)) * 40.0;
          vAlpha = tw;
        }
      `,
      fragmentShader: /* glsl */`
        uniform float uOpacity;
        varying vec3 vColor;
        varying float vAlpha;
        void main(){
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          float a = pow(clamp(1.0 - d * 2.0, 0.0, 1.0), 2.2);
          gl_FragColor = vec4(vColor, a * uOpacity * vAlpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true
    });

    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.visible = false;
  }

  update(t){
    this.material.uniforms.uTime.value = t;
    this.points.rotation.y = t * 0.006;
    this.points.rotation.x = Math.sin(t * 0.02) * 0.04;
  }

  setVisible(v){ this.points.visible = v; }
}
