import * as T from 'three';
import type { Finish } from './world-materials';

export function surfaceMaterial(finish: Finish, options: T.MeshStandardMaterialParameters) {
  const roughness =
    finish === 'water'
      ? 0.1
      : finish === 'metal'
        ? 0.43
        : finish === 'tile' || finish === 'hospital'
          ? 0.36
          : finish === 'wood'
            ? 0.59
            : 0.88;
  return new T.MeshStandardMaterial({ roughness, metalness: finish === 'metal' ? 0.64 : 0, ...options });
}

// Keep the sound boundary and visible waterline on exactly the same contour.
export function poolLevel(x: number, z: number) {
  return (
    Math.sin(0.43 * x + 0.67 * Math.sin(0.92 * z)) +
    0.8 * Math.cos(0.59 * z - 0.22 * x) +
    0.29 * Math.sin(1.57 * x + 0.96 * z)
  );
}
export function markWet(mat: T.Material, pooled: boolean) {
  const compile = mat.onBeforeCompile.bind(mat);
  const key = mat.customProgramCacheKey();
  mat.customProgramCacheKey = () => key + (pooled ? '/pools' : '/water');
  mat.onBeforeCompile = (shader, renderer) => {
    compile(shader, renderer);
    shader.vertexShader =
      'varying vec3 vWetPoint;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvWetPoint = (modelMatrix * vec4(position,1.)).xyz;',
      );
    shader.fragmentShader =
      'varying vec3 vWetPoint;\n' +
      shader.fragmentShader
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
      float x=vWetPoint.x, z=vWetPoint.z;
      float contour=sin(.43*x+.67*sin(.92*z))+.8*cos(.59*z-.22*x)+.29*sin(1.57*x+.96*z);
      float wetness=${pooled ? 'smoothstep(1.12,1.56,contour) * smoothstep(.65,.95,abs(normalize(cross(dFdx(vWetPoint),dFdy(vWetPoint))).y))' : '1.'};
      diffuseColor.rgb *= mix(1.,.64,wetness);`,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          '#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.09,wetness);',
        );
    // Opaque floor alpha stores the wet mask in the camera target. Translucent
    // water uses separate alpha blending to preserve its visible transmission.
    if (!mat.transparent)
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        '#include <dithering_fragment>\ngl_FragColor.a = 1. - wetness;',
      );
  };
  if (mat.transparent) {
    mat.blending = T.CustomBlending;
    mat.blendSrc = T.SrcAlphaFactor;
    mat.blendDst = T.OneMinusSrcAlphaFactor;
    mat.blendSrcAlpha = mat.blendDstAlpha = T.ZeroFactor;
    mat.depthWrite = true;
  }
}
