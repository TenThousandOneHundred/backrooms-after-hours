import * as T from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

// The campaign floor is one world-space mesh. Use one planar capture for all
// its visible water, with ripples applied when sampling the reflected image.
export function waterReflection(floor: T.Mesh) {
  const mirror = new Reflector(new T.BufferGeometry(), { clipBias: .001, multisample: 0 });
  mirror.rotation.x = -Math.PI / 2;
  mirror.updateMatrixWorld(true);
  const target = mirror.getRenderTarget();
  target.texture.type = T.UnsignedByteType;
  target.texture.colorSpace = T.SRGBColorSpace;
  const projection = (mirror.material as T.ShaderMaterial).uniforms.textureMatrix;
  const active = { value: 0 };
  const size = new T.Vector2();
  let previous = -Infinity, lastCamera: T.Camera | undefined;
  return {
    prepare(shader: Pick<typeof T.ShaderLib.lambert, 'uniforms' | 'vertexShader' | 'fragmentShader'>) {
      Object.assign(shader.uniforms, {
        uWaterMirror: { value: target.texture }, uWaterMatrix: projection, uWaterLive: active,
      });
      shader.vertexShader = 'uniform mat4 uWaterMatrix; varying vec4 vWaterMirror;\n' +
        shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          vWaterMirror = uWaterMatrix * vec4(position.x, -position.z, 0., 1.);`);
      shader.fragmentShader = 'uniform sampler2D uWaterMirror; uniform float uWaterLive; varying vec4 vWaterMirror;\n' +
        shader.fragmentShader.replace('#include <opaque_fragment>', `
          vec2 mirrorUV = vWaterMirror.xy / max(.001, vWaterMirror.w);
          vec2 flow = wave * .0037 + vec2(sin(w.y*11.+tm*1.7),cos(w.x*9.-tm*1.2))*.0009;
          vec3 reflection = texture2D(uWaterMirror, clamp(mirrorUV + flow, .001, .999)).rgb;
          outgoingLight = mix(outgoingLight, reflection * vec3(.82,.95,1.),
            uWaterLive * (.16 + .68 * fresnel));
          #include <opaque_fragment>`);
    },
    capture(renderer: T.WebGLRenderer, scene: T.Scene, camera: T.Camera, group: T.Group) {
      active.value = 0;
      if (!renderer.shadowMap.enabled || camera.layers.mask !== 1 || camera.matrixWorld.elements[13] <= .025) return;
      renderer.getDrawingBufferSize(size);
      const width = Math.min(640, Math.max(1, Math.ceil(size.x / 2)));
      const height = Math.max(1, Math.round(width * size.y / Math.max(1, size.x)));
      const now = performance.now();
      if (camera !== lastCamera || target.width !== width || target.height !== height || now - previous > 50) {
        target.setSize(width, height);
        floor.visible = false;
        try {
          mirror.onBeforeRender(renderer, scene, camera, floor.geometry, mirror.material as T.Material, group);
        } finally {
          floor.visible = true;
        }
        lastCamera = camera;
        previous = now;
      }
      active.value = 1;
    },
    dispose() {
      mirror.dispose();
      mirror.geometry.dispose();
    },
  };
}
