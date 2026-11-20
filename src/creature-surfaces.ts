import {
  Mesh,
  MeshStandardMaterial,
  RepeatWrapping,
  TextureLoader,
  type Object3D,
  type Texture,
} from 'three';

// Project onto rest-space geometry so painted details follow every bone and joint.
// R stores relief, G pigmentation, and B the local roughness of the surface.
const textures = new Map<string, Texture>();
function detail(name: string) {
  if (!textures.has(name)) {
    const map = new TextureLoader().load(import.meta.env.BASE_URL + 'models/surfaces/' + name + '.png');
    map.wrapS = map.wrapT = RepeatWrapping;
    textures.set(name, map);
  }
  return textures.get(name)!;
}
const treated = new WeakSet<MeshStandardMaterial>();
export function detailCreature(root: Object3D) {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!(material instanceof MeshStandardMaterial) || treated.has(material)) continue;
      treated.add(material);
      const name = material.name.toLowerCase();
      if (
        /glint|lamp|glow|lure|iris|milk glass|void|warning|visor|polycarbonate|reflective|nickel/.test(name)
      )
        continue;
      const family = /cloth|wool|silk|wing|mane|straw|shroud|denim|velvet|paper|ochre shell|webbing/.test(
        name,
      )
        ? 'weave'
        : /sinew|raw|gum|blood|throat|tendon|cartilage|filament|sea|belly/.test(name)
          ? 'sinew'
          : /bone|enamel|ivory|iron|brass|porcelain|shell|bronze|keratin|marble|dentine|horn|wax/.test(name)
            ? 'shell'
            : 'dermis';
      const scale = family === 'weave' ? 2.5 : family === 'sinew' ? 1.35 : 1.85;
      const map = detail(family);
      material.customProgramCacheKey = () => 'field-material-v1';
      material.onBeforeCompile = (shader) => {
        shader.uniforms.detailPlate = { value: map };
        shader.uniforms.detailScale = { value: scale };
        shader.vertexShader = 'varying vec3 vFieldPoint, vFieldAxes;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvFieldPoint=position; vFieldAxes=normal;',
        );
        shader.fragmentShader =
          'varying vec3 vFieldPoint,vFieldAxes; uniform sampler2D detailPlate; uniform float detailScale;\n' +
          shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <color_fragment>',
            `
          #include <color_fragment>
          vec3 coord=vFieldPoint*detailScale;
          vec3 weights=pow(abs(vFieldAxes),vec3(4.0));
          weights/=max(.0001,dot(weights,vec3(1.0)));
          vec3 plate=texture2D(detailPlate,coord.yz).rgb*weights.x+
            texture2D(detailPlate,coord.xz).rgb*weights.y+texture2D(detailPlate,coord.xy).rgb*weights.z;
          diffuseColor.rgb *= .60+.82*plate.g;
        `,
          )
          .replace(
            '#include <roughnessmap_fragment>',
            '#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+(plate.b-.50)*.62,.13,1.0);',
          )
          .replace(
            '#include <normal_fragment_maps>',
            `
          #include <normal_fragment_maps>
          vec3 sx=dFdx(-vViewPosition), sy=dFdy(-vViewPosition);
          vec3 tx=cross(sy,normal), ty=cross(normal,sx);
          float det=dot(sx,tx);
          vec3 relief=sign(det)*(dFdx(plate.r)*tx+dFdy(plate.r)*ty);
          normal=normalize(max(abs(det),.00000001)*normal-.0018*relief);
        `,
          );
      };
    }
  });
}
