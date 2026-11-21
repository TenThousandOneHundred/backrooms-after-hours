import { SkinnedMesh, type Object3D, type Skeleton } from 'three';

// SkeletonUtils clones one palette per glTF primitive. Meshes on the same
// instance can share bone updates while retaining their individual bind matrices.
export function shareActorPalettes(actor: Object3D): Skeleton[] {
  const palettes: Skeleton[] = [];
  actor.traverse(part => {
    if (!(part instanceof SkinnedMesh)) return;
    const rig = part.skeleton;
    const shared = palettes.find(other => other.boneInverses === rig.boneInverses &&
      other.bones.length === rig.bones.length && other.bones.every((bone, i) => bone === rig.bones[i]));
    if (shared) part.skeleton = shared;
    else palettes.push(rig);
  });
  return palettes;
}
