const finite = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));

export function getRotatedFootprint(item) {
  const width = Math.max(finite(item?.width), 0);
  const depth = Math.max(finite(item?.depth), 0);
  const radians = (finite(item?.rotationY) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const clean = (value) => Math.round(value * 1_000_000) / 1_000_000;
  return {
    width: clean(width * cos + depth * sin),
    depth: clean(width * sin + depth * cos),
  };
}

export function clampPlacementToRoom(item, room) {
  const next = { ...item };
  const footprint = getRotatedFootprint(next);
  const roomWidth = Math.max(finite(room?.width), 0);
  const roomLength = Math.max(finite(room?.length), 0);
  const roomHeight = Math.max(finite(room?.height), 0);
  const objectHeight = Math.max(finite(next.height), 0);
  const fallbackX = footprint.width / 2;
  const fallbackZ = footprint.depth / 2;

  next.x = clamp(finite(next.x, fallbackX), footprint.width / 2, roomWidth - footprint.width / 2);
  next.y = clamp(finite(next.y), 0, roomHeight - objectHeight);
  next.z = clamp(finite(next.z, fallbackZ), footprint.depth / 2, roomLength - footprint.depth / 2);
  return next;
}

export function applyTranslationDelta(item, delta, room) {
  return clampPlacementToRoom(
    {
      ...item,
      x: finite(item?.x) + finite(delta?.x),
      y: finite(item?.y) + finite(delta?.y),
      z: finite(item?.z) + finite(delta?.z),
    },
    room
  );
}

export function coordinateDeltaForPlane(plane, worldDelta) {
  const x = finite(worldDelta?.x);
  const y = finite(worldDelta?.y);
  const z = finite(worldDelta?.z);
  if (plane === "xy") return { x, y, z: 0 };
  if (plane === "yz") return { x: 0, y, z };
  return { x, y: 0, z };
}

export function coordinateDeltaForAxis(axis, worldDelta) {
  const value = finite(worldDelta?.[axis]);
  if (axis === "x") return { x: value, y: 0, z: 0 };
  if (axis === "y") return { x: 0, y: value, z: 0 };
  return { x: 0, y: 0, z: value };
}
