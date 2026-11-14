import { describe, expect, it } from 'vitest';
import { StickerRenderer } from '../src/render/StickerRenderer';

// These coordinates are independently hand-checked from the public stage layout.
// Boundary coverage catches invisible gaps or neighbouring cells stealing drops.
describe('renderer drop targets', () => {
  const hit = (x: number, y: number) => StickerRenderer.prototype.hitTest.call({} as StickerRenderer, x, y);

  it('maps board corners to the correct grid cell and excludes the outer edge', () => {
    expect(hit(32, 240)).toEqual({ kind: 'cell', col: 0, row: 0 });
    expect(hit(607.99, 959.99)).toEqual({ kind: 'cell', col: 7, row: 9 });
    expect(hit(104, 312)).toEqual({ kind: 'cell', col: 1, row: 1 });
    expect(hit(608, 500)).toBeNull();
    expect(hit(300, 960)).toBeNull();
  });

  it('keeps the five nests separate, including the gap between them', () => {
    expect(hit(114, 1162)).toEqual({ kind: 'bench', slot: 0 });
    expect(hit(514, 1162)).toEqual({ kind: 'bench', slot: 4 });
    expect(hit(163, 1162)).toBeNull();
    expect(hit(556, 1162)).toBeNull();
    expect(hit(114, 1204)).toBeNull();
  });

  it('uses a circular shovel target and safely rejects non-finite coordinates', () => {
    expect(hit(550, 1035)).toEqual({ kind: 'shovel' });
    expect(hit(550, 1074)).toEqual({ kind: 'shovel' });
    expect(hit(589, 1074)).toBeNull();
    expect(hit(Number.NaN, 250)).toBeNull();
    expect(hit(100, Number.POSITIVE_INFINITY)).toBeNull();
  });
});
