export type Vec3 = { x: number; y: number; z: number };

const TAU = Math.PI * 2;
const SPIN_AXIS: Vec3 = { x: 0.48, y: 0.77, z: 0.42 };
const AXIS_LENGTH = Math.hypot(SPIN_AXIS.x, SPIN_AXIS.y, SPIN_AXIS.z);

// A single closed seam lives on the sphere. Its projected front half cannot
// cross itself; points on the back are hidden by the ball's surface.
export function seamPoint(longitude: number): Vec3 {
  const latitude = 0.58 * Math.sin(2 * longitude);
  const equatorRadius = Math.cos(latitude);
  return {
    x: equatorRadius * Math.cos(longitude),
    y: Math.sin(latitude),
    z: equatorRadius * Math.sin(longitude),
  };
}

export function rotatePoint(point: Vec3, angle: number): Vec3 {
  const axis = {
    x: SPIN_AXIS.x / AXIS_LENGTH,
    y: SPIN_AXIS.y / AXIS_LENGTH,
    z: SPIN_AXIS.z / AXIS_LENGTH,
  };
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const projection = axis.x * point.x + axis.y * point.y + axis.z * point.z;
  return {
    x: point.x * cosine + (axis.y * point.z - axis.z * point.y) * sine + axis.x * projection * (1 - cosine),
    y: point.y * cosine + (axis.z * point.x - axis.x * point.z) * sine + axis.y * projection * (1 - cosine),
    z: point.z * cosine + (axis.x * point.y - axis.y * point.x) * sine + axis.z * projection * (1 - cosine),
  };
}

function horizonPoint(front: Vec3, back: Vec3): Vec3 {
  const fraction = front.z / (front.z - back.z);
  return {
    x: front.x + (back.x - front.x) * fraction,
    y: front.y + (back.y - front.y) * fraction,
    z: 0,
  };
}

export function visibleSeam(angle: number, samples = 256): Vec3[][] {
  const segments: Vec3[][] = [];
  let segment: Vec3[] = [];
  let previous = rotatePoint(seamPoint(0), angle);
  if (previous.z >= 0) segment.push(previous);

  for (let index = 1; index <= samples; index += 1) {
    const current = rotatePoint(seamPoint((index / samples) * TAU), angle);
    if (current.z >= 0) {
      if (previous.z < 0) segment = [horizonPoint(current, previous)];
      segment.push(current);
    } else if (previous.z >= 0) {
      segment.push(horizonPoint(previous, current));
      if (segment.length > 1) segments.push(segment);
      segment = [];
    }
    previous = current;
  }

  if (segment.length > 1) segments.push(segment);
  return segments;
}
