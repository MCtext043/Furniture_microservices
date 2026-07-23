export type RoomWall = 'back' | 'front' | 'left' | 'right';

export function wallBoxSize(
  wall: RoomWall,
  width: number,
  length: number,
  height: number,
  thickness = 0.05,
): [number, number, number] {
  return wall === 'back' || wall === 'front'
    ? [width, height, thickness]
    : [thickness, height, length];
}
