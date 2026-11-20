import * as T from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const vertexShader = `
varying vec2 point;
void main() {
  point = uv;
  gl_Position = vec4(position.xy, 0., 1.);
}`;
const depthFunctions = `
uniform sampler2D roomDepth;
uniform vec2 clipRange;
float distanceAt(vec2 uv) {
  float d = texture2D(roomDepth, uv).r;
  return clipRange.x * clipRange.y / (clipRange.y - d * (clipRange.y - clipRange.x));
}`;

// Estimate contact shading from actual room depth and scatter bright fixture light
// at half resolution. The final pass preserves the original geometry and HUD edges.
class RoomCamera {
  private size = new T.Vector2();
  private sceneColor = new T.WebGLRenderTarget(1, 1);
  private lighting = new T.WebGLRenderTarget(1, 1, { depthBuffer: false });
  private uniforms = {
    roomDepth: { value: new T.DepthTexture(1, 1, T.UnsignedIntType) },
    frame: { value: this.sceneColor.texture },
    lighting: { value: this.lighting.texture },
    clipRange: { value: new T.Vector2() },
    lens: { value: new T.Vector2() },
    texel: { value: new T.Vector2() },
  };
  private gather = new T.ShaderMaterial({
    uniforms: this.uniforms, depthTest: false, depthWrite: false, vertexShader,
    fragmentShader: `
    varying vec2 point;
    uniform vec2 lens, texel;
    uniform sampler2D frame;
    ${depthFunctions}
    vec3 viewPosition(vec2 sampleUV) {
      // Depth uses nearest filtering. Reconstruct from the same pixel center
      // that supplied its depth, including when reading at half resolution.
      vec2 uv = (floor(clamp(sampleUV, vec2(0.), 1. - texel) / texel) + .5) * texel;
      float z = distanceAt(uv);
      return vec3((2. * uv - 1.) * lens, -1.) * z;
    }
    void main() {
      vec2 center = (floor(point / texel) + .5) * texel;
      vec3 p = viewPosition(center);
      // Use the shallower derivative on silhouettes to avoid crossing onto another object.
      vec3 l = p - viewPosition(center - vec2(texel.x, 0.));
      vec3 r = viewPosition(center + vec2(texel.x, 0.)) - p;
      vec3 b = p - viewPosition(center - vec2(0., texel.y));
      vec3 t = viewPosition(center + vec2(0., texel.y)) - p;
      vec3 normal = cross(abs(l.z) < abs(r.z) ? l : r, abs(b.z) < abs(t.z) ? b : t);
      normal /= max(length(normal), .000001);
      vec2 radius = min(vec2(.095), .46 / (max(.15, -p.z) * 2. * lens));
      vec3 glow = vec3(0.);
      float contact = 0.;
      for (int i = 0; i < 12; i++) {
        float angle = float(i) * 2.399963;
        vec2 ray = vec2(cos(angle), sin(angle));
        float reach = sqrt((float(i) + .5) / 12.);
        vec3 delta = viewPosition(clamp(center + ray * radius * reach, 0., 1.)) - p;
        float dist = max(.001, length(delta));
        contact += max(0., dot(normal, delta) / dist - .075) * (1. - smoothstep(.1, .68, dist));
        vec3 light = texture2D(frame, point + ray * texel * (2. + 16. * reach)).rgb;
        float peak = max(light.r, max(light.g, light.b));
        glow += light * smoothstep(.29, .83, peak) * (1.5 - reach);
      }
      gl_FragColor = vec4(glow / 12., clamp(1. - contact * .235, .48, 1.));
    }`,
  });
  private combine = new T.ShaderMaterial({
    uniforms: this.uniforms, depthTest: false, depthWrite: false, vertexShader,
    fragmentShader: `
    varying vec2 point;
    uniform vec2 texel;
    uniform sampler2D frame, lighting;
    ${depthFunctions}
    void main() {
      float z = distanceAt(point);
      float shade = 0., weights = 0.;
      vec3 glow = vec3(0.);
      for (int i = 0; i < 4; i++) {
        vec2 offset = vec2(float(i - (i/2)*2), float(i/2)) * 2. - 1.;
        vec2 uv = point + offset * texel;
        vec4 effect = texture2D(lighting, uv);
        float w = 1. / (1. + abs(z - distanceAt(uv)) * 48.);
        shade += effect.a * w;
        weights += w;
        glow += texture2D(lighting, point + offset * texel * 3.).rgb;
      }
      vec3 color = texture2D(frame, point).rgb * (shade / max(.0001, weights));
      color += glow * .11;
      gl_FragColor = vec4(color, 1.);
      #include <colorspace_fragment>
    }`,
  });
  // Other scene effects can supply a full-resolution depth target. Composite over
  // that target in place, retaining its depth and alpha for the downstream camera.
  private overlay = new T.ShaderMaterial({
    uniforms: this.uniforms, depthTest: false, depthWrite: false, vertexShader,
    transparent: true, blending: T.CustomBlending,
    blendSrc: T.OneFactor, blendDst: T.SrcAlphaFactor,
    blendSrcAlpha: T.ZeroFactor, blendDstAlpha: T.OneFactor,
    fragmentShader: `
      varying vec2 point;
      uniform sampler2D lighting;
      uniform vec2 texel;
      void main() {
        vec4 effect = texture2D(lighting, point);
        vec3 glow = vec3(0.);
        for (int i = 0; i < 4; i++) {
          vec2 off = vec2(float(i - (i/2)*2), float(i/2)) * 2. - 1.;
          glow += texture2D(lighting, point + off * texel * 3.).rgb;
        }
        gl_FragColor = vec4(glow * .11, effect.a);
      }`,
  });
  private quad = new FullScreenQuad(this.gather);

  constructor(renderer: T.WebGLRenderer) {
    this.sceneColor.texture.colorSpace = T.SRGBColorSpace;
    this.sceneColor.samples = Math.min(4, renderer.capabilities.maxSamples);
    this.sceneColor.depthTexture = this.uniforms.roomDepth.value;
  }
  render(renderer: T.WebGLRenderer, scene: T.Scene, camera: T.PerspectiveCamera) {
    const destination = renderer.getRenderTarget();
    const source = destination ?? this.sceneColor;
    if (destination) this.size.set(destination.width, destination.height);
    else {
      renderer.getDrawingBufferSize(this.size);
      this.sceneColor.setSize(this.size.x, this.size.y);
    }
    this.uniforms.roomDepth.value = source.depthTexture!;
    this.uniforms.frame.value = source.texture;
    this.lighting.setSize(Math.max(1, Math.ceil(this.size.x / 2)), Math.max(1, Math.ceil(this.size.y / 2)));
    this.uniforms.texel.value.set(1 / this.size.x, 1 / this.size.y);
    this.uniforms.lens.value.set(1 / camera.projectionMatrix.elements[0], 1 / camera.projectionMatrix.elements[5]);
    this.uniforms.clipRange.value.set(camera.near, camera.far);
    const autoClear = renderer.autoClear;
    try {
      renderer.setRenderTarget(source);
      renderer.render(scene, camera);
      renderer.setRenderTarget(this.lighting);
      this.quad.material = this.gather;
      this.quad.render(renderer);
      renderer.setRenderTarget(destination);
      if (destination) renderer.autoClear = false;
      this.quad.material = destination ? this.overlay : this.combine;
      this.quad.render(renderer);
    } finally {
      renderer.autoClear = autoClear;
      renderer.setRenderTarget(destination);
    }
  }
  dispose() {
    this.sceneColor.dispose();
    this.lighting.dispose();
    this.gather.dispose();
    this.combine.dispose();
    this.overlay.dispose();
    this.quad.dispose();
  }
}

// High quality is the same renderer switch that enables the flashlight shadow map.
// Exclude reflection captures, menus and full-screen passes from scene processing.
export function createRoomRenderer(options: T.WebGLRendererParameters) {
  const renderer = new T.WebGLRenderer(options);
  const render = renderer.render.bind(renderer);
  const dispose = renderer.dispose.bind(renderer);
  let effects: RoomCamera | undefined;
  let drawingRoom = false;
  renderer.render = (scene, camera) => {
    if (!renderer.shadowMap.enabled && effects) {
      effects.dispose();
      effects = undefined;
    }
    const target = renderer.getRenderTarget();
    if (drawingRoom || !renderer.shadowMap.enabled || !scene.userData.isCampaignRoom ||
        !(scene instanceof T.Scene) || !(camera instanceof T.PerspectiveCamera) ||
        (target && !target.depthTexture)) {
      render(scene, camera);
      return;
    }
    effects ??= new RoomCamera(renderer);
    drawingRoom = true;
    try {
      effects.render(renderer, scene, camera);
    } finally {
      drawingRoom = false;
    }
  };
  renderer.dispose = () => {
    effects?.dispose();
    dispose();
  };
  return renderer;
}
