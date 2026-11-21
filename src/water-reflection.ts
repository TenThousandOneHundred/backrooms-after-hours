import * as T from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

// All floor chunks share one capture of the stage and one ripple projection.
export function waterReflection(floors: T.Mesh[]) {
  const mirror = new Reflector(new T.BufferGeometry(), { clipBias: .001, multisample: 0 });
  mirror.rotation.x = -Math.PI / 2;
  mirror.updateMatrixWorld(true);
  const target = mirror.getRenderTarget();
  target.texture.type = T.UnsignedByteType;
  target.texture.colorSpace = T.SRGBColorSpace;
  const projection = (mirror.material as T.ShaderMaterial).uniforms.textureMatrix;
  const active = { value: 0 };
  const size = new T.Vector2();
  const hidden: T.Mesh[] = [];
  let capturing = false;
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
          if (uWaterLive > 0.5) {
            vec2 mirrorUV = vWaterMirror.xy / max(.001, vWaterMirror.w);
            vec2 flow = wave * .0037 + vec2(sin(w.y*11.+tm*1.7),cos(w.x*9.-tm*1.2))*.0009;
            vec3 reflection = texture2D(uWaterMirror, clamp(mirrorUV + flow, .001, .999)).rgb;
            outgoingLight = mix(outgoingLight, reflection * vec3(.82,.95,1.), .16 + .68 * fresnel);
          }
          #include <opaque_fragment>`);
    },
    capture(renderer: T.WebGLRenderer, scene: T.Scene, camera: T.Camera, group: T.Group) {
      active.value = 0;
      if (capturing || !renderer.shadowMap.enabled || camera.layers.mask !== 1 || camera.matrixWorld.elements[13] <= .025) return;
      renderer.getDrawingBufferSize(size);
      const width = Math.min(640, Math.max(1, Math.ceil(size.x / 2)));
      const height = Math.max(1, Math.round(width * size.y / Math.max(1, size.x)));
      const now = performance.now();
      if (camera !== lastCamera || target.width !== width || target.height !== height || now - previous > 50) {
        target.setSize(width, height);
        capturing = true;
        for (const floor of floors) {
          if (floor.visible) {
            floor.visible = false;
            hidden.push(floor);
          }
        }
        try {
          mirror.onBeforeRender(renderer, scene, camera, mirror.geometry, mirror.material as T.Material, group);
        } finally {
          for (const floor of hidden) floor.visible = true;
          hidden.length = 0;
          capturing = false;
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
