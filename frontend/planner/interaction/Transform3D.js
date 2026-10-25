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

function placementBounds(item) {
  const footprint = getRotatedFootprint(item);
  const x = finite(item?.x);
  const y = finite(item?.y);
  const z = finite(item?.z);
  const height = Math.max(finite(item?.height), 0);
  return {
    x: { min: x - footprint.width / 2, max: x + footprint.width / 2 },
    y: { min: y, max: y + height },
    z: { min: z - footprint.depth / 2, max: z + footprint.depth / 2 },
  };
}

function projectionsOverlap(a, b, movingAxis) {
  return ["x", "y", "z"]
    .filter((axis) => axis !== movingAxis)
    .every((axis) => Math.min(a[axis].max, b[axis].max) - Math.max(a[axis].min, b[axis].min) > 1);
}

/**
 * Snaps two adjacent faces together on one world axis. Candidate furniture is
 * considered only when its projections overlap on both remaining axes, so a
 * distant cabinet cannot pull the selected item sideways through the room.
 */
export function snapPlacement3D(item, placements, room, options = {}) {
  const axis = ["x", "y", "z"].includes(options.axis) ? options.axis : "x";
  const threshold = Math.max(finite(options.threshold, 70), 0);
  const start = clampPlacementToRoom(item, room);
  const moving = placementBounds(start);
  const footprint = getRotatedFootprint(start);
  const roomSize = axis === "x" ? finite(room?.width) : axis === "y" ? finite(room?.height) : finite(room?.length);
  const size = axis === "x" ? footprint.width : axis === "y" ? Math.max(finite(start.height), 0) : footprint.depth;
  const candidates = [
    { shift: -moving[axis].min, target: "room-min", targetId: null },
    { shift: roomSize - moving[axis].max, target: "room-max", targetId: null },
  ];

  for (const other of placements || []) {
    if (!other || other.id === start.id) continue;
    const otherBounds = placementBounds(other);
    if (!projectionsOverlap(moving, otherBounds, axis)) continue;
    candidates.push(
      { shift: otherBounds[axis].max - moving[axis].min, target: "furniture-max", targetId: other.id },
      { shift: otherBounds[axis].min - moving[axis].max, target: "furniture-min", targetId: other.id },
    );
  }

  const best = candidates
    .filter((candidate) => Math.abs(candidate.shift) <= threshold)
    .sort((a, b) => Math.abs(a.shift) - Math.abs(b.shift))[0];
  if (!best) return { placement: start, snapped: false, axis, shift: 0, target: null, targetId: null };

  const snapped = { ...start, [axis]: finite(start[axis]) + best.shift };
  // Floating point noise from rotated footprints should not leak into saved scenes.
  snapped[axis] = Math.round(snapped[axis] * 1_000_000) / 1_000_000;
  return {
    placement: clampPlacementToRoom(snapped, room),
    snapped: true,
    axis,
    shift: best.shift,
    target: best.target,
    targetId: best.targetId,
    size,
  };
}
