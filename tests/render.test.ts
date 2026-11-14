import { describe, expect, it } from 'vitest';
import { StickerRenderer } from '../src/render/StickerRenderer';

// These coordinates are independently hand-checked from the public stage layout.
// Boundary coverage catches invisible gaps or neighbouring cells stealing drops.
describe('renderer drop targets', () => {
  const hit = (x: number, y: number) => StickerRenderer.prototype.hitTest.call({} as StickerRenderer, x, y);

  it('maps board corners to the correct grid cell and excludes the outer edge', () => {
    expect(hit(172, 72)).toEqual({ kind: 'cell', col: 0, row: 0 });
    expect(hit(1107.99, 591.99)).toEqual({ kind: 'cell', col: 8, row: 4 });
    expect(hit(276, 176)).toEqual({ kind: 'cell', col: 1, row: 1 });
    expect(hit(1108, 500)).toBeNull();
    expect(hit(300, 592)).toBeNull();
  });

  it('keeps the five nests separate, including the gap between them', () => {
    expect(hit(298, 656)).toEqual({ kind: 'bench', slot: 0 });
    expect(hit(714, 656)).toEqual({ kind: 'bench', slot: 4 });
    expect(hit(350, 656)).toBeNull();
    expect(hit(760, 656)).toBeNull();
    expect(hit(298, 702)).toBeNull();
  });

  it('uses a circular shovel target and safely rejects non-finite coordinates', () => {
    expect(hit(86, 162)).toEqual({ kind: 'shovel' });
    expect(hit(86, 202)).toEqual({ kind: 'shovel' });
    expect(hit(126, 202)).toBeNull();
    expect(hit(Number.NaN, 250)).toBeNull();
    expect(hit(100, Number.POSITIVE_INFINITY)).toBeNull();
  });
});
