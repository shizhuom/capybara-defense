import { describe, expect, it } from 'vitest';
import { StickerRenderer } from '../src/render/StickerRenderer';

// These coordinates are independently hand-checked from the public stage layout.
// Boundary coverage catches invisible gaps or neighbouring cells stealing drops.
describe('renderer drop targets', () => {
  const hit = (x: number, y: number) => StickerRenderer.prototype.hitTest.call({} as StickerRenderer, x, y);

  it('maps board corners to the correct grid cell and excludes the outer edge', () => {
    expect(hit(32, 188)).toEqual({ kind: 'cell', col: 0, row: 0 });
    expect(hit(607.99, 859.99)).toEqual({ kind: 'cell', col: 5, row: 6 });
    expect(hit(128, 284)).toEqual({ kind: 'cell', col: 1, row: 1 });
    expect(hit(608, 500)).toBeNull();
    expect(hit(300, 860)).toBeNull();
  });

  it('keeps the five nests separate, including the gap between them', () => {
    expect(hit(96, 992)).toEqual({ kind: 'bench', slot: 0 });
    expect(hit(544, 992)).toEqual({ kind: 'bench', slot: 4 });
    expect(hit(150, 992)).toBeNull();
    expect(hit(592, 992)).toBeNull();
    expect(hit(96, 1040)).toBeNull();
  });

  it('uses a circular shovel target and safely rejects non-finite coordinates', () => {
    expect(hit(556, 898)).toEqual({ kind: 'shovel' });
    expect(hit(556, 937)).toEqual({ kind: 'shovel' });
    expect(hit(595, 937)).toBeNull();
    expect(hit(Number.NaN, 250)).toBeNull();
    expect(hit(100, Number.POSITIVE_INFINITY)).toBeNull();
  });
});
