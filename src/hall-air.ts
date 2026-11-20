import * as T from 'three';
import { TILE } from './game-entity';
import { hash } from './world-materials';
import type { Stage } from './campaign';

type Shader = Parameters<T.Material['onBeforeCompile']>[0];

// The map records open hall interiors and their floor elevation, including ramps.
export function hallAir(root: T.Group, stage: Stage, open: (x: number,z: number)=>boolean,
  ground: (x: number,z: number)=>number, ceiling: number, tint: string) {
  const width = stage.map[0].length, depth = stage.map.length;
  const cells = new Uint8Array(width * depth * 4);
  const motes: number[] = [];
  let min = Infinity, max = -Infinity;
  for (let z=0; z<depth; z++) for (let x=0; x<width; x++) {
    const y = ground(x*TILE,z*TILE);
    min = Math.min(min,y); max = Math.max(max,y);
  }
  const range = Math.max(1, max-min);
  for (let z=0; z<depth; z++) for (let x=0; x<width; x++) {
    const offset = (z*width+x)*4, floor = ground(x*TILE,z*TILE);
    cells[offset+1] = Math.round(255*(floor-min)/range);
    if (!open(x,z)) continue;
    let area = 0;
    for (let v=-2; v<=2; v++) for (let u=-2; u<=2; u++) if (open(x+u,z+v)) area++;
    const density = T.MathUtils.clamp((area-15)/9,0,1);
    cells[offset] = Math.round(255*density);
    for (let i=0; i<Math.ceil(9*density); i++) {
      const px = (x+hash(x+i,z,87)-.5)*TILE, pz = (z+hash(x,z+i,151)-.5)*TILE;
      motes.push(px,ground(px,pz)+.16+hash(x+i,z-i,271)*(ceiling-.26),pz);
    }
  }
  const mask = new T.DataTexture(cells,width,depth);
  mask.minFilter = mask.magFilter = T.LinearFilter;
  mask.needsUpdate = true;
  const uniforms = {
    uHallMask:{value:mask}, uHallSize:{value:new T.Vector2(width,depth).multiplyScalar(TILE)},
    uHallBed:{value:new T.Vector2(min,range)}, uHallTime:{value:0},
    uHallTint:{value:new T.Color(tint).lerp(new T.Color('#acb4a9'),.65).multiplyScalar(.35)},
    uHallLamps:{value:[new T.Vector4(),new T.Vector4()]},
  };
  const lampGLSL = `
    uniform vec4 uHallLamps[2];
    float lampDust(vec3 p) {
      float sum=0.;
      for(int j=0;j<2;j++){
        vec3 d=uHallLamps[j].xyz-p;
        float radius=.6+max(0.,d.y)*.67;
        sum+=uHallLamps[j].w*step(-.05,d.y)*exp(-dot(d.xz,d.xz)/(radius*radius))/(1.+.045*d.y*d.y);
      }
      return min(sum,1.);
    }
  `;
  const geo = new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(motes,3));
  const mat = new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,
    vertexShader:lampGLSL+`
      uniform float uHallTime;
      varying float vPower;
      void main(){
        vec3 p=position;
        p.x+=.14*sin(p.z+uHallTime*.31); p.y+=.10*sin(p.x+uHallTime*.44);
        vec4 mv=viewMatrix*vec4(p,1.);
        vPower=lampDust(p)*(1.-smoothstep(5.,21.,-mv.z));
        gl_Position=projectionMatrix*mv;
        gl_PointSize=clamp(13./max(1.,-mv.z),1.,2.7);
      }`,
    fragmentShader:`uniform vec3 uHallTint; varying float vPower;
      void main(){float a=(1.-smoothstep(.1,.5,length(gl_PointCoord-.5)))*vPower;
        if(a<.012) discard; gl_FragColor=vec4(uHallTint*2.6,a*.72);
        #include <colorspace_fragment>
      }`});
  const particles = new T.Points(geo,mat);
  particles.name='Suspended hall dust';
  root.add(particles);
  return {
    apply(shader: Shader) {
      Object.assign(shader.uniforms,uniforms);
      shader.vertexShader='varying vec3 vHallPos;\n'+shader.vertexShader.replace('#include <project_vertex>',`
        #include <project_vertex>
        vec4 hp=vec4(transformed,1.);
        #ifdef USE_INSTANCING
          hp=instanceMatrix*hp;
        #endif
        vHallPos=(modelMatrix*hp).xyz;`);
      shader.fragmentShader=lampGLSL+`
        varying vec3 vHallPos; uniform sampler2D uHallMask; uniform vec2 uHallSize,uHallBed;
        uniform vec3 uHallTint; uniform float uHallTime;
      `+shader.fragmentShader.replace('#include <opaque_fragment>',`
        vec3 ray=vHallPos-cameraPosition;
        float span=min(length(ray),40.);
        vec3 stride=ray*(span/max(length(ray),.001))/6.;
        vec3 samplePos=cameraPosition+stride*.5;
        float transmittance=1.; vec3 scatter=vec3(0.);
        for(int k=0;k<6;k++) {
          vec2 air=texture2D(uHallMask,(samplePos.xz+vec2(${TILE*.5}))/uHallSize).rg;
          // Outside the hall mask this sample contributes exactly zero scattering.
          if(air.r==0.) { samplePos+=stride; continue; }
          float height=abs(samplePos.y-uHallBed.x-air.g*uHallBed.y);
          float drift=.82+.18*sin(samplePos.x*.69+sin(samplePos.z*.44+uHallTime*.13));
          float beam=lampDust(samplePos);
          float absorb=1.-exp(-span/6.*air.r*drift*(.115*exp(-height*1.95)+.031*beam));
          scatter+=transmittance*absorb*uHallTint*(.29+1.85*beam);
          transmittance*=1.-absorb;
          samplePos+=stride;
        }
        outgoingLight=outgoingLight*transmittance+scatter;
        #include <opaque_fragment>`);
    },
    update(time:number, spots: readonly T.SpotLight[]) {
      uniforms.uHallTime.value=time;
      spots.forEach((light,i)=>{
        const p=light.position;
        const height=p.y-light.target.position.y;
        uniforms.uHallLamps.value[i].set(p.x,p.y,p.z,light.intensity/Math.max(1,2.6*height*height));
      });
    },
    dispose(){mask.dispose();geo.dispose();mat.dispose();}
  };
}
