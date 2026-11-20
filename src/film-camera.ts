import * as T from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const vertexShader = 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
const pass = (fragmentShader: string, uniforms: Record<string, T.IUniform>) =>
  new T.ShaderMaterial({
    vertexShader,
    fragmentShader: 'varying vec2 vUv;\n' + fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });

// Meter into a pair of 1-pixel textures. Exposure history never reads back to the CPU.
export class FilmCamera {
  private target: T.WebGLRenderTarget;
  private meters = [
    new T.WebGLRenderTarget(1, 1, { depthBuffer: false }),
    new T.WebGLRenderTarget(1, 1, { depthBuffer: false }),
  ];
  private index = 0;
  private initialized = false;
  private size = new T.Vector2();
  private frame = 0;
  private meter = pass(
    `
    uniform sampler2D frame, previous;
    uniform float elapsed;
    uniform bool initial;
    void main() {
      float sum=0.;
      for(int y=0;y<3;y++) for(int x=0;x<5;x++){
        vec2 p=vec2(.14+float(x)*.18,.2+float(y)*.3);
        sum+=log(max(.006,dot(texture2D(frame,p).rgb,vec3(.2126,.7152,.0722))));
      }
      float target=clamp(.19/pow(exp(sum/15.),.72),.73,1.55);
      float last=dot(texture2D(previous,vec2(.5)).rg,vec2(2.,2./255.));
      float next=initial ? target : mix(last,target,1.-exp(-elapsed*(target>last ? .63 : 3.4)));
      float packedValue=next*.5*255.;
      gl_FragColor=vec4(floor(packedValue)/255.,fract(packedValue),0.,1.);
    }`,
    { frame: { value: null }, previous: { value: null }, elapsed: { value: 0 }, initial: { value: true } },
  );
  private display = pass(
    `
    uniform sampler2D frame, depthMap, meter;
    uniform mat4 projection, inverseProjection;
    uniform vec2 pixel;
    uniform float seed;
    uniform bool reflections;
    vec3 positionAt(vec2 uv){
      vec4 p=inverseProjection*vec4(uv*2.-1.,texture2D(depthMap,uv).r*2.-1.,1.);
      return p.xyz/p.w;
    }
    vec2 screenPoint(vec3 p){
      vec4 clip=projection*vec4(p,1.);
      return clip.xy/clip.w*.5+.5;
    }
    void main(){
      vec4 base=texture2D(frame,vUv);
      vec3 p=positionAt(vUv), normal=normalize(cross(dFdx(p),dFdy(p)));
      float wet=1.-base.a;
      vec3 light=base.rgb;
      if(reflections && wet>.025 && -p.z<45.){
        if(dot(normal,-p)<0.) normal=-normal;
        vec3 view=normalize(p), ray=reflect(view,normal);
        float prev=.085, travel=.12;
        for(int j=0;j<35;j++){
          vec3 probe=p+normal*.045+ray*travel;
          vec2 uv=screenPoint(probe);
          if(probe.z>-.07 || any(lessThan(uv,pixel)) || any(greaterThan(uv,1.-pixel))) break;
          float gap=positionAt(uv).z-probe.z;
          if(gap>=0. && gap<.16+.085*travel){
            float lo=prev,hi=travel;
            for(int k=0;k<4;k++){
              float mid=(lo+hi)*.5;vec3 q=p+normal*.045+ray*mid;
              if(positionAt(screenPoint(q)).z>=q.z)hi=mid;else lo=mid;
            }
            uv=screenPoint(p+normal*.045+ray*hi);
            vec2 edge=min(uv,1.-uv);
            float weight=smoothstep(0.,.085,min(edge.x,edge.y))*(1.-smoothstep(16.,32.,travel));
            float fresnel=.085+.74*pow(1.-clamp(dot(normal,-view),0.,1.),3.);
            light=mix(light,texture2D(frame,uv).rgb,wet*weight*fresnel);
            break;
          }
          prev=travel; travel+=.12+travel*.105;
        }
      }
      light*=dot(texture2D(meter,vec2(.5)).rg,vec2(2.,2./255.));
      // A soft shoulder keeps bright fluorescent fixtures from clipping to a flat white.
      light=light/(1.+.25*light);
      gl_FragColor=vec4(light,1.);
      #include <colorspace_fragment>
      float grain=fract(52.9829189*fract(dot(gl_FragCoord.xy+vec2(seed,seed*.73),vec2(.06711056,.00583715))))-.5;
      gl_FragColor.rgb+=grain*(.009+.006*(1.-clamp(light.g,0.,1.)));
    }`,
    {
      frame: { value: null },
      depthMap: { value: null },
      meter: { value: null },
      projection: { value: null },
      inverseProjection: { value: null },
      pixel: { value: new T.Vector2() },
      seed: { value: 0 },
      reflections: { value: true },
    },
  );
  private quad = new FullScreenQuad(this.display);
  constructor(renderer: T.WebGLRenderer) {
    this.target = new T.WebGLRenderTarget(1, 1, {
      type: renderer.extensions.has('EXT_color_buffer_float') ? T.HalfFloatType : T.UnsignedByteType,
      depthTexture: new T.DepthTexture(1, 1, T.UnsignedIntType),
    });
  }
  render(renderer: T.WebGLRenderer, scene: T.Scene, camera: T.PerspectiveCamera, dt: number, high: boolean) {
    renderer.getDrawingBufferSize(this.size);
    this.target.setSize(this.size.x, this.size.y);
    const previous = renderer.getRenderTarget();
    renderer.setRenderTarget(this.target);
    renderer.render(scene, camera);
    const u = this.meter.uniforms;
    u.frame.value = this.target.texture;
    u.previous.value = this.meters[this.index].texture;
    u.elapsed.value = dt;
    u.initial.value = !this.initialized;
    this.initialized = true;
    this.index = 1 - this.index;
    renderer.setRenderTarget(this.meters[this.index]);
    this.quad.material = this.meter;
    this.quad.render(renderer);
    const d = this.display.uniforms;
    d.frame.value = this.target.texture;
    d.depthMap.value = this.target.depthTexture;
    d.projection.value = camera.projectionMatrix;
    d.inverseProjection.value = camera.projectionMatrixInverse;
    d.pixel.value.set(1 / this.size.x, 1 / this.size.y);
    d.meter.value = this.meters[this.index].texture;
    d.seed.value = this.frame = (this.frame + 1) % 251;
    d.reflections.value = high;
    renderer.setRenderTarget(previous);
    this.quad.material = this.display;
    this.quad.render(renderer);
  }
  dispose() {
    this.target.dispose();
    this.meters.forEach((target) => target.dispose());
    this.meter.dispose();
    this.display.dispose();
    this.quad.dispose();
  }
}
