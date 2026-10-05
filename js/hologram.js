/**
 * JARVIS 3D — Shared holographic shader library + material factories.
 * All shaders written for JARVIS 3D. Original.
 */
import * as THREE from 'three';

/* ---------------- GLSL chunks ---------------- */

export const SIMPLEX = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(
      i.z+vec4(0.0,i1.z,i2.z,1.0))
    + i.y+vec4(0.0,i1.y,i2.y,1.0))
    + i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){
  float v=0.0;
  float a=0.5;
  for(int i=0;i<4;i++){
    v+=a*snoise(p);
    p*=2.02;
    a*=0.5;
  }
  return v;
}
`;

export const FRESNEL = /* glsl */`
float fresnel(vec3 n, vec3 v, float power){
  return pow(1.0 - clamp(dot(normalize(n), normalize(v)), 0.0, 1.0), power);
}
`;

/* ---------------- Palettes ---------------- */

export const PALETTE = {
  home:  { a: new THREE.Color('#6fe3f5'), b: new THREE.Color('#9db8ff'), c: new THREE.Color('#e8fbff') },
  space: { a: new THREE.Color('#7fb2ff'), b: new THREE.Color('#c39bff'), c: new THREE.Color('#ffffff') },
  car:   { a: new THREE.Color('#ffb26b'), b: new THREE.Color('#ff7a59'), c: new THREE.Color('#fff3e0') }
};

export const STATE_TINT = {
  IDLE:      new THREE.Color('#6fe3f5'),
  LISTENING: new THREE.Color('#9db8ff'),
  THINKING:  new THREE.Color('#ffd08a'),
  ANALYZING: new THREE.Color('#ffd08a'),
  RESPONDING:new THREE.Color('#7ef0a8'),
  SPEAKING:  new THREE.Color('#7ef0a8'),
  EXECUTING: new THREE.Color('#ffffff'),
  ERROR:     new THREE.Color('#ff6f6f'),
  CURIOUS:   new THREE.Color('#c39bff'),
  READY:     new THREE.Color('#6fe3f5')
};

/* ---------------- Material factories ---------------- */

/**
 * Core energy sphere.
 * Vertices displaced by fbm noise. Additive. Fresnel edge glow.
 */
export function createCoreMaterial(){
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime:      { value: 0 },
      uAmp:       { value: 0.14 },
      uPulse:     { value: 0.0 },
      uColorA:    { value: new THREE.Color('#6fe3f5') },
      uColorB:    { value: new THREE.Color('#e8fbff') },
      uOpacity:   { value: 1.0 }
    },
    vertexShader: /* glsl */`
      uniform float uTime;
      uniform float uAmp;
      uniform float uPulse;
      varying vec3 vNormal;
      varying vec3 vViewPos;
      varying float vNoise;
      ${SIMPLEX}
      void main(){
        vNormal = normalize(normalMatrix * normal);
        vec3 p = position;
        float n = fbm(position * 2.1 + vec3(0.0, uTime * 0.35, uTime * 0.18));
        vNoise = n;
        p += normal * n * (uAmp + uPulse * 0.22);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vViewPos = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform float uPulse;
      uniform vec3  uColorA;
      uniform vec3  uColorB;
      uniform float uOpacity;
      varying vec3 vNormal;
      varying vec3 vViewPos;
      varying float vNoise;
      ${FRESNEL}
      void main(){
        float f = fresnel(vNormal, vViewPos, 2.2);
        vec3 col = mix(uColorA, uColorB, clamp(vNoise * 0.6 + 0.5, 0.0, 1.0));
        col += uColorB * f * 1.4;
        col += uColorB * uPulse * 0.6;
        float a = (0.42 + f * 0.75 + uPulse * 0.35) * uOpacity;
        gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });
}

/**
 * Outer holographic shell with horizontal scanlines + grid latitude lines.
 */
export function createShellMaterial(){
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime:    { value: 0 },
      uColor:   { value: new THREE.Color('#6fe3f5') },
      uOpacity: { value: 0.32 },
      uScan:    { value: 1.0 },
      uPulse:   { value: 0.0 }
    },
    vertexShader: /* glsl */`
      varying vec3 vNormal;
      varying vec3 vViewPos;
      varying vec3 vLocal;
      void main(){
        vNormal = normalize(normalMatrix * normal);
        vLocal = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewPos = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform vec3  uColor;
      uniform float uOpacity;
      uniform float uScan;
      uniform float uPulse;
      varying vec3 vNormal;
      varying vec3 vViewPos;
      varying vec3 vLocal;
      ${FRESNEL}
      void main(){
        float f = fresnel(vNormal, vViewPos, 2.6);

        // horizontal scanlines
        float scan = sin((vLocal.y * 60.0) - uTime * 3.4);
        scan = smoothstep(0.86, 1.0, scan) * uScan;

        // latitude/longitude grid
        float lat = abs(fract(vLocal.y * 2.6) - 0.5);
        float grid = smoothstep(0.47, 0.5, lat);

        float a = f * 0.55 + scan * 0.35 + grid * 0.22;
        a += uPulse * 0.3;
        a *= uOpacity;

        vec3 col = uColor + vec3(scan * 0.5) + vec3(uPulse * 0.4);
        gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });
}

/**
 * Ring material — travelling energy highlight around the torus.
 */
export function createRingMaterial(){
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime:    { value: 0 },
      uColor:   { value: new THREE.Color('#6fe3f5') },
      uColor2:  { value: new THREE.Color('#9db8ff') },
      uOpacity: { value: 0.75 },
      uSpeed:   { value: 1.0 },
      uPulse:   { value: 0.0 }
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPos;
      void main(){
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewPos = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform vec3  uColor;
      uniform vec3  uColor2;
      uniform float uOpacity;
      uniform float uSpeed;
      uniform float uPulse;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPos;
      ${FRESNEL}
      void main(){
        float f = fresnel(vNormal, vViewPos, 1.5);
        float t = fract(vUv.x - uTime * 0.12 * uSpeed);
        float energy = smoothstep(0.0, 0.06, t) * smoothstep(0.28, 0.06, t);
        energy += smoothstep(0.5, 0.58, t) * smoothstep(0.78, 0.58, t) * 0.6;

        vec3 col = mix(uColor, uColor2, energy);
        float a = (0.18 + energy * 0.9 + f * 0.5 + uPulse * 0.4) * uOpacity;
        gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });
}

/**
 * Volumetric-looking glow billboard.
 */
export function createGlowMaterial(color = '#6fe3f5'){
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor:   { value: new THREE.Color(color) },
      uOpacity: { value: 0.5 },
      uTime:    { value: 0 }
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uTime;
      varying vec2 vUv;
      void main(){
        vec2 c = vUv - 0.5;
        float d = length(c) * 2.0;
        float a = pow(clamp(1.0 - d, 0.0, 1.0), 2.6);
        a += pow(clamp(1.0 - d, 0.0, 1.0), 8.0) * 0.6;
        gl_FragColor = vec4(uColor, a * uOpacity);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });
}

/**
 * Abstract eye element — soft horizontal lens shape with iris glow.
 */
export function createEyeMaterial(){
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime:    { value: 0 },
      uOpen:    { value: 1.0 },
      uBlink:   { value: 1.0 },
      uColor:   { value: new THREE.Color('#eafcff') },
      uGlow:    { value: new THREE.Color('#6fe3f5') },
      uMood:    { value: 0.5 },
      uLook:    { value: new THREE.Vector2(0, 0) },
      uOpacity: { value: 1.0 }
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform float uOpen;
      uniform float uBlink;
      uniform float uMood;
      uniform vec2  uLook;
      uniform vec3  uColor;
      uniform vec3  uGlow;
      uniform float uOpacity;
      varying vec2 vUv;

      void main(){
        vec2 uv = vUv - 0.5;
        uv.y /= max(0.06, uOpen * uBlink);
        uv -= uLook * 0.08;

        float d = length(uv * vec2(1.0, 1.35));
        float lens = 1.0 - smoothstep(0.34, 0.5, d);

        // iris
        float iris = 1.0 - smoothstep(0.16, 0.30, d);
        float ring = smoothstep(0.20, 0.24, d) * (1.0 - smoothstep(0.26, 0.30, d));

        float shimmer = 0.85 + 0.15 * sin(uTime * 2.4 + vUv.x * 12.0);

        vec3 col = uGlow * lens * 0.9;
        col += uColor * iris * 1.4 * shimmer;
        col += uColor * ring * (1.2 + uMood * 0.8);

        float a = (lens * 0.5 + iris * 0.95 + ring * 0.8) * uOpacity;
        gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });
}

/**
 * Radial waveform ring (audio reactive).
 */
export function createWaveformMaterial(){
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime:    { value: 0 },
      uAmp:     { value: 0.0 },
      uColor:   { value: new THREE.Color('#6fe3f5') },
      uOpacity: { value: 0.9 }
    },
    vertexShader: /* glsl */`
      uniform float uTime;
      uniform float uAmp;
      varying vec2 vUv;
      varying float vR;
      void main(){
        vUv = uv;
        float r = 1.0 + uAmp * (
          0.35 * sin(uv.x * 90.0 + uTime * 6.0) +
          0.25 * sin(uv.x * 143.0 - uTime * 4.2) +
          0.20 * sin(uv.x * 37.0 + uTime * 2.1)
        );
        vR = r;
        vec3 p = position * r;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uAmp;
      varying vec2 vUv;
      void main(){
        float a = (0.25 + uAmp * 0.85) * uOpacity;
        gl_FragColor = vec4(uColor, clamp(a, 0.0, 1.0));
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });
}

/**
 * Nebula / volumetric cloud plane material (space mode).
 */
export function createNebulaMaterial(seed = 0){
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime:    { value: 0 },
      uSeed:    { value: seed },
      uColorA:  { value: new THREE.Color('#3a5aa8') },
      uColorB:  { value: new THREE.Color('#8a5ad0') },
      uOpacity: { value: 0.35 }
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform float uSeed;
      uniform vec3  uColorA;
      uniform vec3  uColorB;
      uniform float uOpacity;
      varying vec2 vUv;
      ${SIMPLEX}
      void main(){
        vec2 uv = vUv * 2.0;
        float n = 0.0;
        n += fbm(vec3(uv * 1.4, uTime * 0.03 + uSeed)) * 0.5;
        n += fbm(vec3(uv * 3.1, uTime * 0.05 + uSeed * 2.0)) * 0.3;

        float d = length(vUv - 0.5) * 2.0;
        float mask = pow(clamp(1.0 - d, 0.0, 1.0), 2.0);

        float a = smoothstep(0.1, 0.65, n + 0.35) * mask * uOpacity;
        vec3 col = mix(uColorA, uColorB, clamp(n * 1.5 + 0.4, 0.0, 1.0));

        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });
}
