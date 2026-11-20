import * as T from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

export type Spill = { x: number; z: number; length: number; width: number; angle: number; seed: number };

function outlineAt(angle: number, seed: number) {
  return (
    0.91 +
    0.13 * Math.sin(3 * angle + seed) +
    0.095 * Math.sin(5 * angle - seed) +
    0.046 * Math.cos(9 * angle + seed)
  );
}
export function inSpill(spill: Spill, x: number, z: number) {
  const dx = x - spill.x,
    dz = spill.z - z;
  const c = Math.cos(spill.angle),
    s = Math.sin(spill.angle);
  const u = (dx * c + dz * s) / spill.length,
    v = (dz * c - dx * s) / spill.width;
  return u * u + v * v < outlineAt(Math.atan2(v, u), spill.seed) ** 2;
}

// All spills lie on the same floor plane, so they can share a single mirrored view.
export function corridorPuddles(spills: Spill[]) {
  const points: number[] = [],
    edges: number[] = [],
    indices: number[] = [];
  const bounds: T.Sphere[] = [];
  for (const { x, z, length, width, angle, seed } of spills) {
    const base = points.length / 3;
    points.push(x, -z, 0);
    edges.push(1);
    bounds.push(new T.Sphere(new T.Vector3(x, 0.014, z), length + width));
    const segments = 56;
    for (const scale of [0.86, 1]) {
      for (let i = 0; i < segments; i++) {
        const a = (2 * Math.PI * i) / segments;
        const outline = outlineAt(a, seed);
        const u = length * Math.cos(a) * scale * outline,
          v = width * Math.sin(a) * scale * outline;
        points.push(
          x + u * Math.cos(angle) - v * Math.sin(angle),
          -z + u * Math.sin(angle) + v * Math.cos(angle),
          0,
        );
        edges.push(scale === 1 ? 0 : 1);
      }
    }
    for (let i = 0; i < segments; i++) {
      const a = base + 1 + i,
        b = base + 1 + ((i + 1) % segments);
      indices.push(base, a, b, a, a + segments, b + segments, a, b + segments, b);
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(points, 3));
  geometry.setAttribute('wetness', new T.Float32BufferAttribute(edges, 1));
  geometry.setIndex(indices);
  const water = new Reflector(geometry, {
    textureWidth: 512,
    textureHeight: 320,
    multisample: 0,
    clipBias: 0.001,
    shader: {
      name: 'Shallow water',
      uniforms: {
        tDiffuse: { value: null },
        color: { value: new T.Color() },
        textureMatrix: { value: new T.Matrix4() },
      },
      vertexShader: `
        attribute float wetness;
        uniform mat4 textureMatrix;
        varying float edge;
        varying vec4 projected;
        varying vec3 surface;
        void main() {
          edge=wetness;
          projected=textureMatrix*vec4(position,1.);
          surface=(modelMatrix*vec4(position,1.)).xyz;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
        }`,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        varying float edge;
        varying vec4 projected;
        varying vec3 surface;
        void main() {
          vec3 eye=cameraPosition-surface;
          float fade=1.-smoothstep(22.,34.,length(eye));
          if(fade*edge<.002) discard;
          vec2 uv=projected.xy/projected.w;
          vec2 ripple=vec2(sin(surface.z*17.+surface.x*4.),cos(surface.x*12.-surface.z*6.))*.0009;
          vec3 room=texture2D(tDiffuse,clamp(uv+ripple,.001,.999)).rgb;
          float fresnel=pow(1.-abs(normalize(eye).y),3.);
          gl_FragColor=vec4(mix(vec3(.026,.03,.019),room,.43+.53*fresnel),fade*smoothstep(0.,.8,edge)*(.46+.46*fresnel));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    },
  });
  const material = water.material as T.ShaderMaterial;
  material.transparent = true;
  material.depthWrite = false;
  // Preserve the planar reflection as an off-screen fallback. The alpha channel
  // of the scene target records the feathered footprint for the depth-ray pass.
  material.blending = T.CustomBlending;
  material.blendSrc = T.SrcAlphaFactor;
  material.blendDst = T.OneMinusSrcAlphaFactor;
  material.blendSrcAlpha = T.ZeroFactor;
  material.blendDstAlpha = T.OneMinusSrcAlphaFactor;
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.014;
  water.name = 'Corridor puddles';
  water.renderOrder = 1;
  const draw = water.onBeforeRender.bind(water);
  const frustum = new T.Frustum(),
    clip = new T.Matrix4(),
    eye = new T.Vector3();
  let last = -Infinity;
  water.onBeforeRender = (renderer, scene, camera, geometry, material, group) => {
    const now = performance.now();
    if (now - last < (renderer.shadowMap.enabled ? 66 : 120)) return;
    eye.setFromMatrixPosition(camera.matrixWorld);
    frustum.setFromProjectionMatrix(
      clip.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
    );
    if (
      !bounds.some(
        (b) => eye.distanceToSquared(b.center) < (34 + b.radius) ** 2 && frustum.intersectsSphere(b),
      )
    )
      return;
    draw(renderer, scene, camera, geometry, material, group);
    last = now;
  };
  return water;
}
