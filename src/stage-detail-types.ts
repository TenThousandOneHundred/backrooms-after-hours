export type Wear = 'mineral' | 'damp' | 'rust' | 'dust' | 'soot' | 'scuff';
export type Point = [number, number, number];

// Coordinates in metres. The wall is at z=0; positive z faces the player.
export interface DetailDrawing {
  box(color: string, x: number, y: number, z: number, w: number, h: number, depth: number, tilt?: number): void;
  rod(color: string, from: Point, to: Point, radius: number): void;
  disc(color: string, x: number, y: number, z: number, diameter: number, depth: number): void;
  stain(kind: Wear, x: number, y: number, w: number, h: number): void;
}

export interface DetailSpec {
  name: string;
  build(d: DetailDrawing): void;
}
