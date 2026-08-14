function axes(rect) {
  const angle = (Number(rect.rotationY) || 0) * Math.PI / 180;
  return [{ x: Math.cos(angle), z: Math.sin(angle) }, { x: -Math.sin(angle), z: Math.cos(angle) }];
}

function corners(rect, clearance = 0) {
  const [u, v] = axes(rect); const hw = Number(rect.width) / 2 + clearance; const hd = Number(rect.depth) / 2 + clearance;
  return [[-1,-1],[-1,1],[1,-1],[1,1]].map(([a,b]) => ({ x: Number(rect.x) + u.x*hw*a + v.x*hd*b, z: Number(rect.z) + u.z*hw*a + v.z*hd*b }));
}

const projection = (points, axis) => points.reduce((range, p) => ({ min: Math.min(range.min, p.x*axis.x+p.z*axis.z), max: Math.max(range.max, p.x*axis.x+p.z*axis.z) }), { min: Infinity, max: -Infinity });

export function intersectsOriented(a, b, clearance = 0) {
  const ac = corners(a, clearance / 2); const bc = corners(b, clearance / 2);
  return [...axes(a), ...axes(b)].every((axis) => { const pa=projection(ac,axis); const pb=projection(bc,axis); return pa.max > pb.min && pb.max > pa.min; });
}

export function findCollisions(subject, placements, clearance = 0) {
  return placements.filter((other) => other.id !== subject.id && intersectsOriented(subject, other, clearance));
}
