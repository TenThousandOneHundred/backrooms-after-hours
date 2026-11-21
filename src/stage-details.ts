import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ModelKit } from './world-models';
import type { Stage } from './campaign-format';
import { TILE } from './world-units';
import { stageDetailAnchors } from './stage-detail-anchors';
import { interiorDetails } from './stage-detail-interiors';
import { exteriorDetails } from './stage-detail-exteriors';
import type { Wear, DetailDrawing } from './stage-detail-types';

const wearTiles: Record<Wear, number> = {mineral:0, damp:1, rust:2, dust:3, soot:4, scuff:5};

export function addStageDetails(stage: Stage, kit: ModelKit, statics: THREE.Group, plane: THREE.PlaneGeometry) {
  const spec=interiorDetails[stage.id] ?? exteriorDetails[stage.id];
  if (!spec) return [];
  const anchors=stageDetailAnchors(stage);
  if (!anchors.length) return anchors;
  const parts=new THREE.Group(), wear=new THREE.Group();
  const wearPlanes = new Map<Wear, THREE.BufferGeometry>();
  let deposit: THREE.MeshLambertMaterial | undefined;
  const d: DetailDrawing = {
    box(c,x,y,z,w,h,depth,tilt=0) { kit.cube(parts,c,x,y,z,w,h,depth).rotation.z=tilt; },
    rod(c,a,b,r) { kit.rod(parts,c,a,b,r); },
    disc(c,x,y,z,diameter,depth) { kit.cylinder(parts,c,x,y,z,diameter,depth).rotation.x=Math.PI/2; },
    stain(kind,x,y,w,h) {
      if (!deposit) {
        const atlas=new THREE.TextureLoader().load(import.meta.env.BASE_URL+'surfaces/stage-deposits.webp');
        atlas.colorSpace=THREE.SRGBColorSpace;
        kit.textures.push(atlas);
        deposit=new THREE.MeshLambertMaterial({map:atlas,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
        kit.materials.set('stage-wall-deposits',deposit);
      }
      let cut=wearPlanes.get(kind);
      if (!cut) {
        const tile=wearTiles[kind];
        cut=plane.clone();
        const uv=cut.attributes.uv;
        for(let i=0;i<uv.count;i++) {
          uv.setXY(i,(tile%3+uv.getX(i))/3,(1-Math.floor(tile/3)+uv.getY(i))/2);
        }
        kit.geometries.push(cut);
        wearPlanes.set(kind,cut);
      }
      const patch=new THREE.Mesh(cut,deposit);
      patch.scale.set(w,h,1);
      patch.position.set(x,y,.026+wear.children.length*.00018);
      wear.add(patch);
    },
  };
  spec.build(d);
  // Bake every bolt and bar of the authored hardware into one mesh. Its three
  // world placements can share geometry, material, UVs and the underlying photograph.
  const pieces: THREE.BufferGeometry[]=[];
  for(const part of parts.children as THREE.Mesh<THREE.BufferGeometry,THREE.MeshLambertMaterial>[]) {
    part.updateMatrix();
    const geometry=part.geometry.clone().applyMatrix4(part.matrix);
    const {position,normal,uv}=geometry.attributes;
    const colors=new Float32Array(position.count*3);
    for(let i=0;i<position.count;i++) {
      part.material.color.toArray(colors,i*3);
      const nx=Math.abs(normal.getX(i)),ny=Math.abs(normal.getY(i)),nz=Math.abs(normal.getZ(i));
      const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
      uv.setXY(i,(nx>nz?z:x)*1.8,(ny>Math.max(nx,nz)?z:y)*1.8);
    }
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    pieces.push(geometry);
  }
  const combined=mergeGeometries(pieces)!;
  pieces.forEach(p=>p.dispose());
  kit.geometries.push(combined);
  const patina=new THREE.TextureLoader().load(import.meta.env.BASE_URL+'surfaces/hardware-patina.webp');
  patina.wrapS=patina.wrapT=THREE.RepeatWrapping;
  patina.colorSpace=THREE.SRGBColorSpace;
  kit.textures.push(patina);
  const paint=new THREE.MeshLambertMaterial({vertexColors:true,map:patina});
  paint.userData.stageDetailPaint=true;
  kit.materials.set('stage-hardware-paint',paint);
  for(const anchor of anchors) {
    const assembly=new THREE.Group();
    assembly.name=spec.name;
    const hardware=new THREE.Mesh(combined,paint), marks=wear.clone();
    if (spec.offset) {
      hardware.position.set(spec.offset[0],spec.offset[1],0);
      marks.position.copy(hardware.position);
    }
    assembly.add(hardware,marks);
    assembly.rotation.y=Math.atan2(-anchor.dx,-anchor.dz);
    assembly.position.set((anchor.x+anchor.dx*.498)*TILE,0,(anchor.z+anchor.dz*.498)*TILE);
    statics.add(assembly);
  }
  return anchors;
}
