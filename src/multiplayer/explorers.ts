import { AnimationMixer, Color, Group, MathUtils, Mesh, MeshStandardMaterial, type Scene } from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import type { Explorer } from './expedition';

let asset: GLTF;
export async function loadExplorer() {
  asset ??= await new GLTFLoader().loadAsync(import.meta.env.BASE_URL+'models/explorer.glb');
}
const colors=[0xdcb14d,0xc8885f,0x6bafab,0xa49cc4,0x94ac79,0xd18086,0x829fc2,0xc3b495];
function explorer(slot:number){
  const mesh=clone(asset.scene);
  const trim=new MeshStandardMaterial({color:new Color(colors[slot-1]),roughness:.66});
  mesh.traverse(o=>{if(o instanceof Mesh) {
    const tint=(m:MeshStandardMaterial)=>m.name==='Unit stripe'?trim:m;
    o.material=Array.isArray(o.material)?o.material.map(tint):tint(o.material);
  }});
  const mixer=new AnimationMixer(mesh);
  const actions=asset.animations.map(clip=>mixer.clipAction(clip).play().setEffectiveWeight(0));
  return { mesh, mixer, actions, trim, initialized:false };
}
export class Explorers {
  root=new Group();
  private models=new Map<number,ReturnType<typeof explorer>>();
  attach(scene:Scene) {
    scene.add(this.root);
    for(const m of this.models.values())m.initialized=false;
  }
  update(players:Explorer[], self:number, ignore:number, dt:number, floor:(x:number,z:number)=>number) {
    for(const [id,m] of this.models)if(!players.some(p=>p.slot===id)){
      this.release(m);this.models.delete(id);
    }
    for(const p of players){
      if(p.slot===self)continue;
      let m=this.models.get(p.slot);
      if(!m){m=explorer(p.slot);this.models.set(p.slot,m);this.root.add(m.mesh);}
      m.mesh.visible=p.alive && !p.hidden && p.slot!==ignore;
      if(!m.mesh.visible){m.initialized=false;continue;}
      const blend=m.initialized?1-Math.exp(-dt*18):1;
      m.mesh.position.x+=(p.x-m.mesh.position.x)*blend;
      m.mesh.position.z+=(p.z-m.mesh.position.z)*blend;
      m.mesh.position.y+=((floor(p.x,p.z)+p.y)-m.mesh.position.y)*blend;
      const target=Math.PI-p.yaw;
      m.mesh.rotation.y+=Math.atan2(Math.sin(target-m.mesh.rotation.y),Math.cos(target-m.mesh.rotation.y))*blend;
      const name=p.crouch?'Crouch':p.moving?(p.sprint?'Run':'Walk'):'Idle';
      for(const action of m.actions)action.setEffectiveWeight(MathUtils.damp(action.getEffectiveWeight(),action.getClip().name===name?1:0,16,dt));
      m.mixer.update(dt);m.initialized=true;
    }
  }
  private release(m:ReturnType<typeof explorer>){m.mesh.removeFromParent();m.mixer.stopAllAction();m.mixer.uncacheRoot(m.mesh);m.trim.dispose();}
  dispose(){for(const m of this.models.values())this.release(m);this.models.clear();this.root.removeFromParent();}
}
