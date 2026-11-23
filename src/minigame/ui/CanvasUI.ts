import { assets } from '../../render/AssetRegistry';
import { INK, round } from '../../render/StickerArt';

export const UI_FONT = '"Trebuchet MS", "PingFang SC", "Microsoft YaHei", sans-serif';

export const PALETTE = {
  woodDark: '#5b3c22',
  woodMid: '#7a5230',
  woodLight: '#a67647',
  cream: '#fbf1dc',
  creamSoft: '#fff7e6',
  parchment: '#f4e3be',
  gold: '#f4c855',
  goldDark: '#b97e1c',
  teal: '#4e9b86',
  tealDark: '#2f6a5a',
  green: '#72b859',
  greenDark: '#3f732c',
  coral: '#d6604d',
  coralDark: '#8f3426',
  ink: '#462c16',
  inkSoft: '#6d4c2f',
  muted: '#8c7258',
} as const;

export interface UiHitBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  data?: unknown;
  disabled?: boolean;
}

export class UiHitManager {
  private boxes: UiHitBox[] = [];
  activeId: string | null = null;

  clear(): void {
    this.boxes = [];
  }

  add(box: UiHitBox): void {
    this.boxes.push(box);
  }

  hit(x: number, y: number): UiHitBox | undefined {
    for (let i = this.boxes.length - 1; i >= 0; i--) {
      const b = this.boxes[i];
      if (!b.disabled && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
    return undefined;
  }

  isPressed(id: string): boolean {
    return this.activeId === id;
  }
}

export interface ToastMessage {
  text: string;
  tone: 'info' | 'good' | 'warn';
  remaining: number;
  duration: number;
}

export class ScrollRegion {
  offset = 0;
  maxOffset = 0;
  velocity = 0;
  dragging = false;
  lastY = 0;
  movedDistance = 0;

  reset(): void {
    this.offset = 0;
    this.velocity = 0;
    this.dragging = false;
    this.movedDistance = 0;
  }

  setContentBounds(contentHeight: number, viewportHeight: number): void {
    this.maxOffset = Math.max(0, contentHeight - viewportHeight);
    if (this.offset > this.maxOffset) this.offset = this.maxOffset;
    if (this.offset < 0) this.offset = 0;
  }

  onStart(y: number): void {
    this.dragging = true;
    this.lastY = y;
    this.velocity = 0;
    this.movedDistance = 0;
  }

  onMove(y: number): void {
    if (!this.dragging) return;
    const dy = this.lastY - y;
    this.lastY = y;
    this.movedDistance += Math.abs(dy);
    this.offset = Math.max(0, Math.min(this.maxOffset, this.offset + dy));
    this.velocity = dy * 40;
  }

  onEnd(): boolean {
    const wasScroll = this.movedDistance > 10;
    this.dragging = false;
    return wasScroll;
  }

  tick(dt: number): void {
    if (this.dragging || Math.abs(this.velocity) < 2) return;
    this.offset = Math.max(0, Math.min(this.maxOffset, this.offset + this.velocity * dt));
    this.velocity *= Math.pow(0.06, dt);
    if (this.offset <= 0 || this.offset >= this.maxOffset) this.velocity = 0;
  }
}

export function drawText(
  c: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string = PALETTE.ink,
  align: CanvasTextAlign = 'center',
  weight: number | string = 700,
  stroke?: string,
  strokeWidth = 3,
): void {
  c.font = `${weight} ${size}px ${UI_FONT}`;
  c.textAlign = align;
  c.textBaseline = 'middle';
  if (stroke) {
    c.lineJoin = 'round';
    c.lineWidth = strokeWidth;
    c.strokeStyle = stroke;
    c.strokeText(text, x, y);
  }
  c.fillStyle = color;
  c.fillText(text, x, y);
}

/** CJK + Latin hybrid line wrapper that breaks cleanly on spaces and ideographs. */
export function wrapText(c: CanvasRenderingContext2D, text: string, maxWidth: number, size: number, weight: number | string = 600): string[] {
  if (!text) return [];
  c.font = `${weight} ${size}px ${UI_FONT}`;
  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const para of paragraphs) {
    if (!para.trim()) { lines.push(''); continue; }
    // Tokenize into words (Latin/digits) and individual CJK/punctuation characters
    const tokens = para.match(/[A-Za-z0-9_+.,:;/%×·'-]+\s*|\s+|./gu) ?? [para];
    let current = '';
    for (const token of tokens) {
      const candidate = current + token;
      if (current && c.measureText(candidate.trimEnd()).width > maxWidth) {
        lines.push(current.trimEnd());
        current = token.trimStart();
      } else {
        current = candidate;
      }
    }
    if (current.trimEnd()) lines.push(current.trimEnd());
  }
  return lines;
}

export function drawWrappedText(
  c: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  lineHeight: number,
  color: string = PALETTE.ink,
  align: CanvasTextAlign = 'left',
  weight: number | string = 600,
  maxLines?: number,
): number {
  const lines = wrapText(c, text, maxWidth, size, weight);
  const clipped = maxLines && lines.length > maxLines ? lines.slice(0, maxLines) : lines;
  if (maxLines && lines.length > maxLines && clipped.length > 0) {
    const last = clipped[clipped.length - 1];
    clipped[clipped.length - 1] = `${last.slice(0, Math.max(1, last.length - 1))}…`;
  }
  c.font = `${weight} ${size}px ${UI_FONT}`;
  c.textAlign = align;
  c.textBaseline = 'top';
  c.fillStyle = color;
  for (let i = 0; i < clipped.length; i++) {
    c.fillText(clipped[i], x, y + i * lineHeight);
  }
  return clipped.length * lineHeight;
}

/** Draws a sprite scaled to fit cleanly inside a box while preserving aspect ratio. */
export function drawSpriteContain(
  c: CanvasRenderingContext2D,
  spriteId: string,
  x: number,
  y: number,
  w: number,
  h: number,
  alpha = 1,
): boolean {
  const img = assets.get(spriteId);
  if (!img) return false;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return false;
  const scale = Math.min(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  if (alpha < 1) {
    c.save();
    c.globalAlpha *= alpha;
    c.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    c.restore();
  } else {
    c.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }
  return true;
}

/** Warm wooden-framed storybook modal or card panel. */
export function drawWoodPanel(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius = 22,
  bg: string = PALETTE.cream,
  border: string = PALETTE.woodDark,
): void {
  // Soft drop shadow
  round(c, x, y + 6, w, h, radius, 'rgba(34,20,8,0.26)', 'transparent', 0);
  // Outer wooden border + warm cream body
  round(c, x, y, w, h, radius, bg, border, 4);
  // Subtle inner cream highlight ring
  if (w > 24 && h > 24) {
    round(c, x + 5, y + 5, w - 10, h - 10, Math.max(8, radius - 5), 'transparent', 'rgba(255,250,235,0.75)', 1.5);
  }
}

export interface ButtonStyle {
  fill: string;
  bottom: string;
  stroke: string;
  text: string;
  radius?: number;
  fontSize?: number;
  icon?: string;
  disabled?: boolean;
  pressed?: boolean;
}

export const BTN_STYLES = {
  gold: { fill: '#f6d269', bottom: '#b57b24', stroke: '#62421e', text: '#4a2b10' },
  teal: { fill: '#5fb098', bottom: '#326c5c', stroke: '#275347', text: '#fffdf6' },
  green: { fill: '#86c665', bottom: '#477a31', stroke: '#355c24', text: '#fffdf6' },
  coral: { fill: '#df6c58', bottom: '#96392a', stroke: '#69251b', text: '#fffdf6' },
  cream: { fill: '#fff4da', bottom: '#bfa177', stroke: '#6b4d2e', text: '#4a2e16' },
  muted: { fill: '#dfd3be', bottom: '#a4947a', stroke: '#7b6b53', text: '#7d6b56' },
} as const;

export function drawButton(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  style: ButtonStyle,
  data?: unknown,
): void {
  const radius = style.radius ?? Math.min(16, h / 2);
  const pressed = !style.disabled && (style.pressed ?? hits.isPressed(id));
  const dy = pressed ? 3 : 0;
  const s = style.disabled ? BTN_STYLES.muted : style;

  hits.add({ id, x, y, w, h, data, disabled: style.disabled });
  if (!pressed) {
    round(c, x, y + 4, w, h, radius, s.bottom, s.stroke, 2);
  }
  round(c, x, y + dy, w, h, radius, s.fill, s.stroke, 2.5);

  const fontSize = style.fontSize ?? Math.min(20, Math.round(h * 0.42));
  if (style.icon) {
    const iconSize = Math.min(h - 14, 30);
    const hasImg = drawSpriteContain(c, style.icon, x + 12, y + dy + (h - iconSize) / 2, iconSize, iconSize);
    if (hasImg) {
      drawText(c, label, x + 12 + iconSize + (w - 18 - iconSize) / 2, y + dy + h / 2 + 1, fontSize, s.text, 'center', 800);
      return;
    }
  }
  const lines = label.split('\n');
  if (lines.length > 1) {
    const lineGap = Math.round(fontSize * 1.32);
    const topY = y + dy + h / 2 - ((lines.length - 1) * lineGap) / 2;
    lines.forEach((line, idx) => {
      drawText(c, line, x + w / 2, topY + idx * lineGap, idx === 0 ? fontSize : Math.max(12, fontSize - 2), s.text, 'center', idx === 0 ? 900 : 800);
    });
    return;
  }
  drawText(c, label, x + w / 2, y + dy + h / 2 + 1, fontSize, s.text, 'center', 800);
}

export function drawProgressBar(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fraction: number,
  fill: string,
  track = 'rgba(72,46,24,0.22)',
  border: string = PALETTE.woodDark,
): void {
  const clamped = Math.max(0, Math.min(1, fraction));
  const r = h / 2;
  round(c, x, y, w, h, r, track, border, 1.5);
  if (clamped > 0.01) {
    const fw = Math.max(h, w * clamped);
    round(c, x + 1, y + 1, Math.min(w - 2, fw - 2), h - 2, Math.max(2, r - 1), fill, 'transparent', 0);
  }
}

export function drawToast(c: CanvasRenderingContext2D, toast: ToastMessage | null, stageWidth: number, y = 74): void {
  if (!toast || toast.remaining <= 0) return;
  const fade = Math.min(1, toast.remaining / 0.35, (toast.duration - toast.remaining) / 0.14 + 0.2);
  c.save();
  c.globalAlpha = Math.max(0, Math.min(1, fade));
  c.font = `800 17px ${UI_FONT}`;
  const tw = Math.min(stageWidth - 80, Math.max(200, c.measureText(toast.text).width + 44));
  const th = 40;
  const x = (stageWidth - tw) / 2;
  const fill = toast.tone === 'good' ? '#3a7a4f' : toast.tone === 'warn' ? '#a63e30' : '#4a311c';
  const stroke = toast.tone === 'good' ? '#b8f0c8' : toast.tone === 'warn' ? '#ffd0c4' : '#f2cf84';
  round(c, x, y, tw, th, 20, fill, stroke, 2);
  drawText(c, toast.text, stageWidth / 2, y + th / 2 + 1, 16, '#fffaf0', 'center', 800, INK, 0);
  c.restore();
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}
