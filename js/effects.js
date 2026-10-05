/**
 * JARVIS 3D — Post-processing chain (bloom + output).
 * Falls back to direct rendering if the composer fails.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export class Effects {
  constructor(renderer, scene, camera, { bloom = true, bloomStrength = 0.75 } = {}){
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.enabled = false;
    this.composer = null;

    try {
      this.composer = new EffectComposer(renderer);
      this.composer.addPass(new RenderPass(scene, camera));

      if (bloom){
        const size = new THREE.Vector2(window.innerWidth, window.innerHeight);
        this.bloomPass = new UnrealBloomPass(size, bloomStrength, 0.55, 0.18);
        this.composer.addPass(this.bloomPass);
        this.enabled = true;
      }

      this.composer.addPass(new OutputPass());
      this.composer.setSize(window.innerWidth, window.innerHeight);
    } catch (e){
      console.warn('Post-processing unavailable, falling back.', e);
      this.composer = null;
      this.enabled = false;
    }
  }

  setSize(w, h){
    if (this.composer) this.composer.setSize(w, h);
    if (this.bloomPass) this.bloomPass.resolution.set(w, h);
  }

  setStrength(v){
    if (this.bloomPass) this.bloomPass.strength = v;
  }

  render(){
    if (this.composer && this.enabled){
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  dispose(){
    if (this.composer){
      this.composer.passes.forEach(p => p.dispose && p.dispose());
    }
  }
}
