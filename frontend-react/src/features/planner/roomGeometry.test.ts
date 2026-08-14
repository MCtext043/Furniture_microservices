import { describe, expect, it } from 'vitest';
import { wallBoxSize } from './roomGeometry';

describe('wallBoxSize', () => {
  const dimensions = { width: 6, length: 5, height: 2.8, thickness: 0.05 };

  it.each([
    ['back', [6, 2.8, 0.05]],
    ['front', [6, 2.8, 0.05]],
    ['left', [0.05, 2.8, 5]],
    ['right', [0.05, 2.8, 5]],
  ] as const)('keeps the %s wall vertical', (wall, expected) => {
    expect(wallBoxSize(wall, dimensions.width, dimensions.length, dimensions.height, dimensions.thickness)).toEqual(expected);
  });
});
