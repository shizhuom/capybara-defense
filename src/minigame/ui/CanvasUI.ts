import { assets } from '../../render/AssetRegistry';
import { INK, round } from '../../render/StickerArt';
import type { ViewportMetrics } from '../../platform/types';
import { t } from '../../i18n/i18n';
import type { DialogGuideStep } from '../../ui/OnboardingGuide';

export const UI_FONT = '"Trebuchet MS", "PingFang SC", "Microsoft YaHei", sans-serif';

export const PALETTE = {
  woodDark: '#4a2b16',
  woodMid: '#794e31',
  woodWarm: '#8a5a38',
  woodLight: '#b88552',
  cream: '#fbf1dc',
  creamSoft: '#fffdf7',
  parchment: '#f5e4c2',
  gold: '#f7c948',
  goldDark: '#b97816',
  matcha: '#395f3a',
  matchaBorder: '#96ce45',
  teal: '#4e9b86',
  tealDark: '#2c6555',
  green: '#79be43',
  greenDark: '#3f7322',
  coral: '#d9634e',
  coralDark: '#8f3426',
  ink: '#3f2412',
  inkSoft: '#634125',
  muted: '#876d55',
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

  clear(): void { this.boxes = []; }
  add(box: UiHitBox): void { this.boxes.push(box); }
  findById(id: string): UiHitBox | undefined { return this.boxes.find(b => b.id === id); }

  hit(x: number, y: number): UiHitBox | undefined {
    for (let i = this.boxes.length - 1; i >= 0; i--) {
      const b = this.boxes[i];
      if (!b.disabled && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
    return undefined;
  }

  isPressed(id: string): boolean { return this.activeId === id; }
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
  weight: number | string = 800,
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
export function wrapText(c: CanvasRenderingContext2D, text: string, maxWidth: number, size: number, weight: number | string = 700): string[] {
  if (!text) return [];
  c.font = `${weight} ${size}px ${UI_FONT}`;
  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const para of paragraphs) {
    if (!para.trim()) { lines.push(''); continue; }
    const tokens = para.match(/(?:[A-Za-z0-9_+.,:;/%×·'-]+\s*|\s+|[^\s])[。，、；：！？）》】」]*/gu) ?? [para];
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
  weight: number | string = 700,
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
  const drawX = align === 'center' ? x + maxWidth / 2 : align === 'right' ? x + maxWidth : x;
  for (let i = 0; i < clipped.length; i++) {
    c.fillText(clipped[i], drawX, y + i * lineHeight);
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

/** Draws a hand-inked yuzu-leaf & sakura bud corner sprig (exact P18 Web SVG geometry in Canvas). */
function drawCornerSprig(c: CanvasRenderingContext2D, x: number, y: number, flipX: boolean): void {
  c.save();
  c.translate(x, y);
  if (flipX) c.scale(-1, 1);

  // Main yuzu leaf
  c.fillStyle = '#8cc53e';
  c.strokeStyle = '#3b5918';
  c.lineWidth = 2.4;
  c.beginPath();
  c.moveTo(0, 0);
  c.bezierCurveTo(-12, -16, -26, -18, -36, -10);
  c.bezierCurveTo(-30, 3, -15, 10, 0, 0);
  c.closePath();
  c.fill();
  c.stroke();

  // Secondary lighter sprout leaf
  c.fillStyle = '#a8dc54';
  c.beginPath();
  c.moveTo(6, 2);
  c.bezierCurveTo(6, -12, -4, -22, -14, -20);
  c.bezierCurveTo(-14, -8, -4, 1, 6, 2);
  c.closePath();
  c.fill();
  c.stroke();

  // Small sakura blossom bud
  c.fillStyle = '#fbc8d4';
  c.strokeStyle = '#8c3d52';
  c.lineWidth = 1.7;
  c.beginPath();
  c.arc(-8, 6, 5.5, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.fillStyle = '#ffe47a';
  c.beginPath();
  c.arc(-8, 6, 2, 0, Math.PI * 2);
  c.fill();

  c.restore();
}

/**
 * 1:1 P18 Carved Hinoki-Wood Bulletin Board (`p18-garden-wood.css`).
 * Renders horizontal wood planks, organic woodgrain, golden inner rim, dark espresso border,
 * and hand-inked yuzu-leaf corner vines!
 */
export function drawHinokiBoard(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius = 24,
): void {
  // Deep shadow beneath board
  round(c, x, y + 8, w, h, radius, 'rgba(20,10,4,0.44)', 'transparent', 0);

  // Outer carved wood body clipped for horizontal plank seams & woodgrain
  c.save();
  c.beginPath();
  c.roundRect(x, y, w, h, radius);
  c.clip();

  const plankH = 74;
  for (let py = y, idx = 0; py < y + h; py += plankH, idx++) {
    c.fillStyle = idx % 2 === 0 ? '#875a3a' : '#7b5032';
    c.fillRect(x, py, w, plankH + 1);
    // Horizontal plank joint shadow + warm highlight
    c.strokeStyle = 'rgba(72,40,20,0.46)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x, py + plankH);
    c.lineTo(x + w, py + plankH);
    c.stroke();
    c.strokeStyle = 'rgba(227,184,123,0.16)';
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(x, py + 2);
    c.lineTo(x + w, py + 2);
    c.stroke();
    // Subtle wavy woodgrain line
    c.strokeStyle = 'rgba(74,43,22,0.2)';
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(x, py + 26);
    c.quadraticCurveTo(x + w * 0.35, py + (idx % 2 ? 18 : 34), x + w * 0.7, py + 24);
    c.quadraticCurveTo(x + w * 0.88, py + 19, x + w, py + 28);
    c.stroke();
  }
  c.restore();

  // Crisp golden inner rim + thick espresso outer border
  round(c, x + 5, y + 5, w - 10, h - 10, Math.max(10, radius - 5), 'transparent', 'rgba(244,210,152,0.58)', 2.4);
  round(c, x, y, w, h, radius, 'transparent', '#4a2b16', 4.5);

  // Hand-inked yuzu-leaf & sakura corner sprigs at bottom-left & bottom-right
  drawCornerSprig(c, x + 30, y + h - 10, false);
  drawCornerSprig(c, x + w - 30, y + h - 10, true);
}

/**
 * 1:1 P18 Matcha-Bamboo Signboard Header straddling the top of every modal (`p18-garden-wood.css`).
 */
export function drawMatchaSignboard(
  c: CanvasRenderingContext2D,
  cx: number,
  topY: number,
  title: string,
  subtitle?: string,
  minWidth = 340,
): void {
  c.font = `900 36px ${UI_FONT}`;
  const tw = Math.max(minWidth, Math.ceil(c.measureText(title).width) + 92);
  const th = 66;
  const sx = cx - tw / 2;
  const sy = topY;

  // Drop shadow & dark outer outline
  round(c, sx, sy + 6, tw, th, 24, '#314714', '#314714', 2);
  round(c, sx - 2, sy - 2, tw + 4, th + 4, 26, '#3e5a1a', 'transparent', 0);

  // Matcha gradient body + bright bamboo border
  const grad = c.createLinearGradient(sx, sy, sx, sy + th);
  grad.addColorStop(0, '#3f6940');
  grad.addColorStop(0.6, '#2f5231');
  grad.addColorStop(1, '#244026');
  c.save();
  c.beginPath();
  c.roundRect(sx, sy, tw, th, 23);
  c.fillStyle = grad;
  c.fill();
  c.lineWidth = 4.5;
  c.strokeStyle = '#96ce45';
  c.stroke();
  c.restore();

  // Inner top bamboo specular highlight
  round(c, sx + 8, sy + 6, tw - 16, 11, 5, 'rgba(208,243,132,0.22)', 'transparent', 0);

  // Corner yuzu leaf & sakura sprigs flanking the signboard
  drawCornerSprig(c, sx + 14, sy + th - 6, false);
  drawCornerSprig(c, sx + tw - 14, sy + th - 6, true);

  // Bold white title with deep green drop shadow
  drawText(c, title, cx, sy + th / 2 + 3, 35, '#182c19', 'center', 900);
  drawText(c, title, cx, sy + th / 2, 35, '#fffdf5', 'center', 900);

  // Optional cream pill subtitle nestled right underneath the signboard
  if (subtitle) {
    c.font = `800 20px ${UI_FONT}`;
    const sw = Math.min(820, Math.max(220, Math.ceil(c.measureText(subtitle).width) + 40));
    const py = sy + th + 6;
    round(c, cx - sw / 2, py + 2, sw, 36, 18, 'rgba(56,30,12,0.38)', 'transparent', 0);
    round(c, cx - sw / 2, py, sw, 36, 18, '#fff9eb', '#8a5b32', 2.4);
    drawText(c, subtitle, cx, py + 19, 19.5, '#4a2a14', 'center', 900);
  }
}

/**
 * 1:1 P18 Plump Yuzu-Gold circular Close Medallion (`×`).
 */
export function drawYuzuCloseButton(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  id: string,
  cx: number,
  cy: number,
  r = 25,
): void {
  const pressed = hits.isPressed(id);
  const dy = pressed ? 3 : 0;
  hits.add({ id, x: cx - r - 4, y: cy - r - 4, w: (r + 4) * 2, h: (r + 4) * 2 });

  if (!pressed) {
    c.fillStyle = '#4b260a';
    c.beginPath();
    c.arc(cx, cy + 4, r, 0, Math.PI * 2);
    c.fill();
  }
  const grad = c.createRadialGradient(cx - r * 0.3, cy + dy - r * 0.35, 3, cx, cy + dy, r);
  grad.addColorStop(0, '#fff7be');
  grad.addColorStop(0.45, '#ffd44f');
  grad.addColorStop(0.85, '#f29f1c');
  grad.addColorStop(1, '#d87b0f');

  c.beginPath();
  c.arc(cx, cy + dy, r, 0, Math.PI * 2);
  c.fillStyle = grad;
  c.fill();
  c.lineWidth = 3.2;
  c.strokeStyle = '#5b310f';
  c.stroke();

  drawText(c, '×', cx, cy + dy + 1, Math.round(r * 1.24), '#5e2a0b', 'center', 900);
}

/**
 * 1:1 P18 Carved Honey-Oak Bookmark Tab perched along the top of the hinoki board.
 */
export function drawHoneyOakTab(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  active: boolean,
): void {
  hits.add({ id, x, y, w, h });
  const dy = active ? 0 : 4;
  const r = 14;

  c.save();
  c.beginPath();
  c.roundRect(x, y + dy, w, h - dy + 6, [r, r, 0, 0]);
  const grad = c.createLinearGradient(x, y + dy, x, y + h);
  if (active) {
    grad.addColorStop(0, '#fffdf7');
    grad.addColorStop(0.7, '#f8e9c8');
    grad.addColorStop(1, '#ecd29e');
  } else {
    grad.addColorStop(0, '#c8965d');
    grad.addColorStop(0.6, '#a67340');
    grad.addColorStop(1, '#8c5c2f');
  }
  c.fillStyle = grad;
  c.fill();
  c.lineWidth = 2.6;
  c.strokeStyle = '#4a2b16';
  c.stroke();
  c.restore();

  // Active matcha indicator dot at top-right (signature P18 touch!)
  if (active) {
    c.beginPath();
    c.arc(x + w - 14, y + 12, 5, 0, Math.PI * 2);
    c.fillStyle = '#8cc53e';
    c.fill();
    c.lineWidth = 1.6;
    c.strokeStyle = '#3b5918';
    c.stroke();
  }

  drawText(
    c,
    label,
    x + w / 2,
    y + dy + (h - dy) / 2 + 1,
    active ? 23 : 21.5,
    active ? '#462610' : '#fff8e8',
    'center',
    900,
    active ? undefined : 'rgba(62,33,14,0.65)',
    2.5,
  );
}

/**
 * 1:1 P18 Sculpted Ivory Row Slab used inside every wooden modal (`p18-garden-wood.css`).
 */
export function drawIvorySlab(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius = 16,
  fillTop = '#fffdf7',
  fillBot = '#f6e7c7',
  border = '#7c5330',
  borderWidth = 2.2,
): void {
  round(c, x, y + 3, w, h, radius, 'rgba(42,22,8,0.24)', 'transparent', 0);
  const grad = c.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, fillTop);
  grad.addColorStop(1, fillBot);
  c.save();
  c.beginPath();
  c.roundRect(x, y, w, h, radius);
  c.fillStyle = grad;
  c.fill();
  c.lineWidth = borderWidth;
  c.strokeStyle = border;
  c.stroke();
  c.restore();
}

/** Cozy striped red-and-cream market stall awning for Raccoon Market. */
export function drawShopAwning(c: CanvasRenderingContext2D, x: number, y: number, w: number, h = 22): void {
  const stripes = 14;
  const sw = w / stripes;
  c.save();
  for (let i = 0; i < stripes; i++) {
    const sx = x + i * sw;
    c.fillStyle = i % 2 === 0 ? '#cf5242' : '#fff6e0';
    c.beginPath();
    c.roundRect(sx, y, sw + 0.5, h, [0, 0, sw / 2, sw / 2]);
    c.fill();
    c.lineWidth = 1.6;
    c.strokeStyle = '#5c2c1b';
    c.stroke();
  }
  c.restore();
}

/** Radial sunburst glow behind Victory / Unlock emblems. */
export function drawSunburst(c: CanvasRenderingContext2D, cx: number, cy: number, radius: number, elapsed: number, color = 'rgba(255,222,110,0.26)'): void {
  c.save();
  c.translate(cx, cy);
  c.rotate(elapsed * 0.25);
  c.fillStyle = color;
  const rays = 12;
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2;
    c.beginPath();
    c.moveTo(0, 0);
    c.arc(0, 0, radius, a, a + Math.PI / rays * 0.65);
    c.closePath();
    c.fill();
  }
  c.restore();
}

/** Classic warm parchment panel (kept for compact overlays, tutorials & tooltips). */
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
  round(c, x, y + 6, w, h, radius, 'rgba(34,20,8,0.28)', 'transparent', 0);
  round(c, x, y, w, h, radius, bg, border, 4);
  if (w > 24 && h > 24) {
    round(c, x + 5, y + 5, w - 10, h - 10, Math.max(8, radius - 5), 'transparent', 'rgba(255,250,235,0.78)', 1.6);
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
  gold: { fill: '#f8d05a', bottom: '#b87616', stroke: '#5c3612', text: '#46250b' },
  teal: { fill: '#57ad94', bottom: '#2b6756', stroke: '#224f42', text: '#fffdf7' },
  green: { fill: '#86c84d', bottom: '#437920', stroke: '#2f5716', text: '#fffdf7' },
  coral: { fill: '#e06753', bottom: '#963425', stroke: '#662015', text: '#fffdf7' },
  cream: { fill: '#fff8e8', bottom: '#b89464', stroke: '#603f21', text: '#452812' },
  muted: { fill: '#dcd1be', bottom: '#9e8e75', stroke: '#73634d', text: '#6e5c48' },
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
  const radius = style.radius ?? Math.min(18, h / 2);
  const pressed = !style.disabled && (style.pressed ?? hits.isPressed(id));
  const dy = pressed ? 3 : 0;
  const s = style.disabled ? BTN_STYLES.muted : style;

  hits.add({ id, x, y, w, h, data, disabled: style.disabled });
  if (!pressed) {
    round(c, x, y + 4, w, h, radius, s.bottom, s.stroke, 2.2);
  }
  round(c, x, y + dy, w, h, radius, s.fill, s.stroke, 2.6);
  // Subtle glossy top rim (juicy P18 tactile button feel!)
  if (!style.disabled && w > 28 && h > 22) {
    round(c, x + 5, y + dy + 3, w - 10, Math.min(10, h * 0.28), Math.max(4, radius - 4), 'rgba(255,255,255,0.28)', 'transparent', 0);
  }

  const fontSize = style.fontSize ?? Math.min(22, Math.max(15, Math.round(h * 0.44)));
  if (style.icon) {
    const iconSize = Math.min(h - 10, 30);
    c.font = `900 ${fontSize}px ${UI_FONT}`;
    const textW = label ? Math.ceil(c.measureText(label).width) : 0;
    const gap = label ? 7 : 0;
    const totalW = iconSize + gap + textW;
    const startX = x + Math.max(10, Math.floor((w - totalW) / 2));
    const hasImg = drawSpriteContain(c, style.icon, startX, y + dy + (h - iconSize) / 2, iconSize, iconSize);
    if (hasImg) {
      if (label) {
        drawText(c, label, startX + iconSize + gap, y + dy + h / 2 + 1, fontSize, s.text, 'left', 900);
      }
      return;
    }
  }
  const lines = label.split('\n');
  if (lines.length > 1) {
    const lineGap = Math.round(fontSize * 1.32);
    const topY = y + dy + h / 2 - ((lines.length - 1) * lineGap) / 2;
    lines.forEach((line, idx) => {
      drawText(c, line, x + w / 2, topY + idx * lineGap, idx === 0 ? fontSize : Math.max(14, fontSize - 2), s.text, 'center', idx === 0 ? 900 : 800);
    });
    return;
  }
  drawText(c, label, x + w / 2, y + dy + h / 2 + 1, fontSize, s.text, 'center', 900);
}

/** Draws a hand-drawn sprite icon paired with crisp bold text (replaces system emojis cleanly). */
export function drawIconLabel(
  c: CanvasRenderingContext2D,
  spriteId: string,
  text: string,
  x: number,
  y: number,
  iconSize: number,
  fontSize: number,
  color: string = PALETTE.ink,
): number {
  const ok = drawSpriteContain(c, spriteId, x, y - iconSize / 2, iconSize, iconSize);
  const textX = ok ? x + iconSize + 5 : x;
  drawText(c, text, textX, y + 1, fontSize, color, 'left', 900);
  c.font = `900 ${fontSize}px ${UI_FONT}`;
  return (ok ? iconSize + 5 : 0) + c.measureText(text).width;
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
  round(c, x, y, w, h, r, track, border, 1.8);
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
  c.font = `900 19px ${UI_FONT}`;
  const tw = Math.min(stageWidth - 60, Math.max(240, c.measureText(toast.text).width + 54));
  const th = 46;
  const x = (stageWidth - tw) / 2;
  const fill = toast.tone === 'good' ? '#367448' : toast.tone === 'warn' ? '#a63b2d' : '#4a301b';
  const stroke = toast.tone === 'good' ? '#c8f5d4' : toast.tone === 'warn' ? '#ffd5c9' : '#f5d48e';
  round(c, x, y + 3, tw, th, 23, 'rgba(20,10,4,0.34)', 'transparent', 0);
  round(c, x, y, tw, th, 23, fill, stroke, 2.4);
  drawText(c, toast.text, stageWidth / 2, y + th / 2 + 1, 18.5, '#fffdf5', 'center', 900, INK, 0);
  c.restore();
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

/**
 * Eliminates all black letterbox/pillarbox bars across every phone & tablet aspect ratio
 * (19.5:9 iPhones, 20:9–22:9 Androids, 16:9 classics, 4:3 iPads, Foldables) by seamlessly
 * mirroring pure decorative outer edge strips of the active storybook panorama/map artwork
 * into the bleed regions outside 0..1280 × 0..720.
 */
export function drawFullBleedBackdrop(
  c: CanvasRenderingContext2D,
  spriteId: string,
  vp: ViewportMetrics,
  edgeStripX = 96,
  edgeStripY = 66,
  fallbackFill = '#c9d7a6',
  edgeStripRightX = edgeStripX,
): void {
  const { left, right, top, bottom, width, height } = vp.visible;
  c.fillStyle = fallbackFill;
  c.fillRect(left - 2, top - 2, width + 4, height + 4);

  const img = assets.get(spriteId);
  if (!img) return;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;

  // Seamless ultrawide panoramic artwork (e.g. 21:9 1680×720): draw the unified painting directly with ZERO mirroring!
  if (iw / ih > 1.85) {
    const panW = Math.round(720 * (iw / ih));
    const panLeft = (1280 - panW) / 2;
    const panRight = panLeft + panW;
    c.drawImage(img, panLeft, 0, panW, 720);

    const bleedTop = Math.max(0, -top);
    const bleedBottom = Math.max(0, bottom - 720);
    const trim = 2;
    if (bleedTop > 0.5) {
      const srcH = Math.max(16, Math.min(Math.floor(ih * 0.2), Math.round((edgeStripY / 720) * ih)));
      c.save();
      c.translate(0, 0);
      c.scale(1, -1);
      c.drawImage(img, 0, trim, iw, srcH, panLeft, -2, panW, bleedTop + 5);
      c.restore();
    }
    if (bleedBottom > 0.5) {
      const srcH = Math.max(16, Math.min(Math.floor(ih * 0.2), Math.round((edgeStripY / 720) * ih)));
      c.save();
      c.translate(0, 720);
      c.scale(1, -1);
      c.drawImage(img, 0, ih - srcH - trim, iw, srcH, panLeft, -(bleedBottom + 3), panW, bleedBottom + 5);
      c.restore();
    }
    // Extreme ultrawide fallback beyond 21:9 (>1680px wide)
    if (left < panLeft - 0.5) {
      c.drawImage(img, trim, 0, 24, ih, left - 2, 0, panLeft - left + 4, 720);
    }
    if (right > panRight + 0.5) {
      c.drawImage(img, iw - 24 - trim, 0, 24, ih, panRight - 2, 0, right - panRight + 4, 720);
    }
    return;
  }

  const bleedLeft = Math.max(0, -left);
  const bleedRight = Math.max(0, right - 1280);
  const bleedTop = Math.max(0, -top);
  const bleedBottom = Math.max(0, bottom - 720);

  const trim = 2;
  if (bleedLeft > 0.5) {
    const srcW = Math.max(16, Math.min(Math.floor(iw * 0.2), Math.round((edgeStripX / 1280) * iw)));
    c.save();
    c.translate(0, 0);
    c.scale(-1, 1);
    c.drawImage(img, trim, 0, srcW, ih, -2, 0, bleedLeft + 5, 720);
    c.restore();

    const g = c.createLinearGradient(left, 0, 0, 0);
    g.addColorStop(0, 'rgba(34,20,8,0.18)');
    g.addColorStop(1, 'rgba(34,20,8,0)');
    c.fillStyle = g;
    c.fillRect(left - 1, 0, bleedLeft + 2, 720);
  }

  if (bleedRight > 0.5) {
    const srcW = Math.max(16, Math.min(Math.floor(iw * 0.2), Math.round((edgeStripRightX / 1280) * iw)));
    const tileW = Math.max(edgeStripRightX * 1.4, Math.min(bleedRight + 5, Math.max(edgeStripRightX * 2.2, 48)));
    let drawn = 0;
    let flip = true;
    while (drawn < bleedRight + 4) {
      const segW = Math.min(tileW, bleedRight + 5 - drawn);
      const sx = iw - srcW - trim;
      c.save();
      if (flip) {
        c.translate(1280 + drawn + segW, 0);
        c.scale(-1, 1);
        c.drawImage(img, sx, 0, srcW, ih, 0, 0, segW + 1, 720);
      } else {
        c.drawImage(img, sx, 0, srcW, ih, 1280 + drawn - 1, 0, segW + 1, 720);
      }
      c.restore();
      drawn += segW;
      flip = !flip;
    }

    const g = c.createLinearGradient(1280, 0, right, 0);
    g.addColorStop(0, 'rgba(34,20,8,0)');
    g.addColorStop(1, 'rgba(34,20,8,0.18)');
    c.fillStyle = g;
    c.fillRect(1280, 0, bleedRight + 2, 720);
  }

  if (bleedTop > 0.5) {
    const srcH = Math.max(16, Math.min(Math.floor(ih * 0.2), Math.round((edgeStripY / 720) * ih)));
    c.save();
    c.translate(0, 0);
    c.scale(1, -1);
    c.drawImage(img, 0, trim, iw, srcH, 0, -2, 1280, bleedTop + 5);
    c.restore();

    const g = c.createLinearGradient(0, top, 0, 0);
    g.addColorStop(0, 'rgba(34,20,8,0.16)');
    g.addColorStop(1, 'rgba(34,20,8,0)');
    c.fillStyle = g;
    c.fillRect(0, top - 1, 1280, bleedTop + 2);
  }

  if (bleedBottom > 0.5) {
    const srcH = Math.max(16, Math.min(Math.floor(ih * 0.2), Math.round((edgeStripY / 720) * ih)));
    c.save();
    c.translate(0, 720);
    c.scale(1, -1);
    c.drawImage(img, 0, ih - srcH - trim, iw, srcH, 0, -(bleedBottom + 3), 1280, bleedBottom + 5);
    c.restore();

    const g = c.createLinearGradient(0, 720, 0, bottom);
    g.addColorStop(0, 'rgba(34,20,8,0)');
    g.addColorStop(1, 'rgba(34,20,8,0.2)');
    c.fillStyle = g;
    c.fillRect(0, 720, 1280, bleedBottom + 2);
  }
}

// ── 1:1 WEB P18 LEDGER SHELL & CONTROLS (`LedgerView.ts` + `p18_preview_*`) ──

/** Full-safe-width mobile storybook hinoki wood board (+48% wider than PC narrow sheet so 2-3 giant cards shine on phones!). */
export const LEDGER = {
  x: 24,
  y: 162,
  w: 1232,
  h: 500,
} as const;

export interface LedgerTabItem {
  id: string;
  label: string;
  active: boolean;
  pulse?: boolean;
}

export interface BadgeSegment {
  icon?: string;
  text: string;
}

export interface LedgerShellOptions {
  title: string;
  mascot: string;
  badgeSegments?: readonly BadgeSegment[];
  tabs?: readonly LedgerTabItem[];
  footer1?: string;
  footer2?: string;
  closeId?: string;
  /** Optional hit target on the Matcha Signboard title (used for hidden 5-tap Dev Mode in Settings). */
  titleHitId?: string;
  /** Optional in-battle switch link beside the header badge (`去黑市 ›` / `去神兵 ›`). */
  switchLink?: { id: string; label: string };
  /** Optional P19 in-dialog coaching strip rendered right inside the top of the wooden board. */
  guideStep?: DialogGuideStep | null;
  /** Optional elapsed seconds for gentle golden guide pulse. */
  elapsed?: number;
}

const GUIDE_MASCOT: Record<string, string> = {
  armory: 'ui_armory_peek_capy',
  market: 'ui_market_peek_raccoon',
  village: 'ui_village_peek_capy',
  kitchen: 'ui_kitchen_peek_capy',
  medallions: 'ui_medallion_peek_capy',
};

/**
 * Renders the EXACT Web P18 Carved Hinoki-Wood Ledger Window (`LedgerView.ts` + `p18_preview_*`):
 * Matcha-Bamboo Signboard -> Cream Badge Pill -> Yuzu Close Medallion -> Equal-Width Honey-Oak Tabs
 * -> Peeking Mascot -> Carved Hinoki Board -> Optional P19 Guide Strip -> 2-Line White Outlined Footer Tips!
 * Returns the inner content viewport rect `{ x, y, w, h }`.
 */
export function drawLedgerShell(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  opts: LedgerShellOptions,
): { x: number; y: number; w: number; h: number } {
  const { x: lx, y: ly, w: lw, h: lh } = LEDGER;

  // 1. Matcha-Bamboo Signboard straddling top center
  drawMatchaSignboard(c, 640, 8, opts.title, undefined, 340);
  if (opts.titleHitId) {
    hits.add({ id: opts.titleHitId, x: 640 - 190, y: 6, w: 380, h: 72 });
  }

  // 2. Plump Yuzu-Gold Close Button perched strictly LEFT of WeChat [🎮][···|◉] (x=1084 -> 100% clear on all iPhones!)
  drawYuzuCloseButton(c, hits, opts.closeId ?? 'modal:close', 1084, 44, 30);

  // 3. Enlarged Cream Pill Header Badge directly below signboard (crisp 23px bold for `已解锁 36/36`, `★ 180`, etc.!)
  if (opts.badgeSegments && opts.badgeSegments.length > 0) {
    c.font = `900 23px ${UI_FONT}`;
    let totalW = 38;
    const widths = opts.badgeSegments.map(seg => {
      const tw = Math.ceil(c.measureText(seg.text).width);
      const iw = seg.icon ? 30 : 0;
      const w = iw + tw;
      totalW += w + 16;
      return { tw, iw, w };
    });
    totalW = Math.min(820, Math.max(176, totalW - 16));
    const pillH = 42;
    const pillY = 76;
    const switchW = opts.switchLink ? 142 : 0;
    const groupW = totalW + (switchW ? switchW + 10 : 0);
    const pillX = 640 - groupW / 2;

    round(c, pillX, pillY + 2, totalW, pillH, 21, 'rgba(56,30,12,0.38)', 'transparent', 0);
    round(c, pillX, pillY, totalW, pillH, 21, '#fff9eb', '#8a5b32', 2.6);

    let cx = pillX + 18;
    opts.badgeSegments.forEach((seg, idx) => {
      const m = widths[idx];
      if (seg.icon) {
        drawSpriteContain(c, seg.icon, cx, pillY + 7, 28, 28);
        cx += 32;
      }
      drawText(c, seg.text, cx, pillY + 22, 23, '#4a2a14', 'left', 900);
      cx += m.tw + 16;
    });

    if (opts.switchLink) {
      drawPillButton(c, hits, opts.switchLink.id, pillX + totalW + 10, pillY + 1, switchW, 40, opts.switchLink.label, 'gold', { fontSize: 19 });
    }
  }

  // 4. Equal-Width Enlarged Honey-Oak Bookmark Tabs perched cleanly on top rim of hinoki board
  const hasTabs = Boolean(opts.tabs && opts.tabs.length > 0);
  const boardY = hasTabs ? ly : ly - 42;
  const boardH = hasTabs ? lh : lh + 42;

  if (opts.tabs && opts.tabs.length > 0) {
    const tabY = boardY - 52;
    const padX = 16;
    const gap = 10;
    const n = opts.tabs.length;
    const tabW = Math.floor((lw - padX * 2 - gap * (n - 1)) / n);
    opts.tabs.forEach((tb, i) => {
      const tx = lx + padX + i * (tabW + gap);
      drawHoneyOakTab(c, hits, tb.id, tx, tabY, tabW, 54, tb.label, tb.active);
      if (tb.pulse && !tb.active) {
        const glow = 0.55 + 0.45 * Math.sin((opts.elapsed ?? 0) * 6);
        round(c, tx - 2, tabY + 2, tabW + 4, 54, 15, 'transparent', `rgba(255,212,64,${glow.toFixed(2)})`, 3.5);
      }
    });
  }

  // 5. Carved Hinoki Wood Board
  drawHinokiBoard(c, lx, boardY, lw, boardH, 24);
  hits.add({ id: 'modal:card', x: lx, y: boardY, w: lw, h: boardH });

  // 6. Peeking Mascot layered ON TOP of Tab 1 shoulder
  drawSpriteContain(c, opts.mascot, lx + 8, hasTabs ? boardY - 132 : boardY - 88, 92, 92);

  // 7. Crisp Outlined Footer Tip right below the board
  if (opts.footer1) {
    drawText(c, opts.footer1, 640, boardY + boardH + 22, 19, '#fffdf5', 'center', 800, INK, 4.8);
  }
  if (opts.footer2) {
    drawText(c, opts.footer2, 640, boardY + boardH + 46, 17.5, '#fff4d6', 'center', 800, INK, 4.5);
  }

  // 8. Optional P19 In-Dialog Coaching Strip (enlarged 20px font!)
  let bodyY = boardY + 14;
  let bodyH = boardH - 28;
  if (opts.guideStep) {
    const gx = lx + 18, gw = lw - 36, gh = 78;
    const done = opts.guideStep.done;
    drawIvorySlab(
      c,
      gx,
      bodyY,
      gw,
      gh,
      18,
      done ? '#eafbe2' : '#fff8dc',
      done ? '#d4f2c4' : '#f8e6b4',
      done ? '#3d8633' : '#d6891e',
      3,
    );
    const gm = GUIDE_MASCOT[opts.guideStep.feature] ?? 'ui_tutorial_capy';
    drawSpriteContain(c, gm, gx + 14, bodyY + 11, 56, 56);
    const btnW = done ? 210 : 138;
    const guideText = t(opts.guideStep.textKey);
    const guideMaxW = gw - 102 - btnW;
    const lineCount = Math.min(2, Math.max(1, wrapText(c, guideText, guideMaxW, 20.5, 800).length));
    const textTopY = bodyY + Math.round((gh - lineCount * 26) / 2);
    drawWrappedText(c, guideText, gx + 82, textTopY, guideMaxW, 20.5, 26, PALETTE.ink, 'left', 800, 2);
    if (done) {
      drawPillButton(c, hits, `onboard:done:${opts.guideStep.feature}`, gx + gw - btnW - 14, bodyY + 14, btnW, 50, t('p19.guideGotIt'), 'green', { fontSize: 20 });
    } else {
      drawPillButton(c, hits, `onboard:skip:${opts.guideStep.feature}`, gx + gw - btnW - 14, bodyY + 14, btnW, 50, t('p19.guideSkip'), 'cream', { fontSize: 19 });
    }
    bodyY += gh + 10;
    bodyH -= gh + 10;
  }

  return { x: lx + 18, y: bodyY, w: lw - 36, h: bodyH };
}

/** Exact Web Detail Navigation Bar: `[← 返回列表]     [◀ 上一个  3 / 12  下一个 ▶]`. */
export function drawDetailNavBar(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  backId: string,
  prevId: string,
  nextId: string,
  indexText: string,
  x: number,
  y: number,
  w: number,
  backLabel: string = t('p7.back'),
): number {
  const h = 48;
  c.font = `900 20px ${UI_FONT}`;
  const backW = Math.min(280, Math.max(156, Math.ceil(c.measureText(backLabel).width) + 42));
  drawPillButton(c, hits, backId, x + 2, y, backW, h, backLabel, 'cream', { fontSize: 20 });
  drawPillButton(c, hits, prevId, x + w - 364, y, 128, h, `◀ ${t('p7.prev')}`, 'cream', { fontSize: 19 });
  drawText(c, indexText, x + w - 180, y + h / 2 + 1, 21, '#fffdf5', 'center', 900, INK, 4);
  drawPillButton(c, hits, nextId, x + w - 130, y, 128, h, `${t('p7.next')} ▶`, 'cream', { fontSize: 19 });
  return h;
}

/** Exact Web P18 rounded pill button (green, gold, cream, coral, muted). */
export function drawPillButton(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  variant: 'green' | 'gold' | 'cream' | 'coral' | 'muted' | 'teal',
  opts?: { fontSize?: number; icon?: string; disabled?: boolean; data?: unknown },
): void {
  const styleMap = {
    green: { fill: '#82c943', bottom: '#478020', stroke: '#2f5916', text: '#fffdf7' },
    gold: { fill: '#f8cd52', bottom: '#b57314', stroke: '#5c3612', text: '#46250b' },
    cream: { fill: '#fffaf0', bottom: '#bda074', stroke: '#6c4928', text: '#452812' },
    coral: { fill: '#e06753', bottom: '#963425', stroke: '#662015', text: '#fffdf7' },
    teal: { fill: '#57ad94', bottom: '#2b6756', stroke: '#224f42', text: '#fffdf7' },
    muted: { fill: '#e6dcc9', bottom: '#b5a68e', stroke: '#877862', text: '#756652' },
  } as const;
  drawButton(c, hits, id, x, y, w, h, label, {
    ...styleMap[variant],
    radius: Math.round(h / 2),
    fontSize: opts?.fontSize ?? Math.min(18, Math.max(14, Math.round(h * 0.43))),
    icon: opts?.icon,
    disabled: opts?.disabled,
  }, opts?.data);
}

/** Exact Web P18 Golden Wood-Track Volume Slider (`p18_preview_d17_settings.png`). */
export function drawGoldSlider(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  value: number,
): void {
  const v = Math.max(0, Math.min(1, value));
  const trackH = 12;
  const ty = y + (h - trackH) / 2;
  round(c, x, ty, w, trackH, 6, '#e9dac0', '#8c6239', 1.8);
  if (v > 0.01) {
    round(c, x + 1, ty + 1, Math.max(10, (w - 2) * v), trackH - 2, 5, '#efb93c', 'transparent', 0);
  }
  const kx = x + v * w;
  const ky = y + h / 2;
  const grad = c.createRadialGradient(kx - 4, ky - 4, 2, kx, ky, 14);
  grad.addColorStop(0, '#fff5b8');
  grad.addColorStop(0.55, '#f6c443');
  grad.addColorStop(1, '#d18414');
  c.beginPath();
  c.arc(kx, ky, 14, 0, Math.PI * 2);
  c.fillStyle = grad;
  c.fill();
  c.lineWidth = 2.4;
  c.strokeStyle = '#5c3612';
  c.stroke();
}

/** Exact Web P18 iOS-style Green Pill Toggle Switch (`p18_preview_d17_settings.png`). */
export function drawToggleSwitch(
  c: CanvasRenderingContext2D,
  hits: UiHitManager,
  id: string,
  x: number,
  y: number,
  checked: boolean,
): void {
  const w = 64, h = 34;
  hits.add({ id, x: x - 6, y: y - 6, w: w + 12, h: h + 12 });
  round(c, x, y, w, h, h / 2, checked ? '#82c943' : '#d6c6ac', checked ? '#3b6e1c' : '#856d50', 2.2);
  const kx = checked ? x + w - h / 2 : x + h / 2;
  const ky = y + h / 2;
  c.beginPath();
  c.arc(kx, ky, h / 2 - 4, 0, Math.PI * 2);
  c.fillStyle = '#fffdf8';
  c.fill();
  c.lineWidth = 1.6;
  c.strokeStyle = 'rgba(74,43,22,0.35)';
  c.stroke();
}

/** Crisp scroll indicator thumb drawn along the right edge of scrollable modal viewports. */
export function drawScrollbar(
  c: CanvasRenderingContext2D,
  vx: number,
  vy: number,
  vw: number,
  vh: number,
  contentH: number,
  scroll: ScrollRegion,
): void {
  if (contentH <= vh + 2) return;
  const trackH = vh - 16;
  const thumbH = Math.max(36, (vh / contentH) * trackH);
  const ratio = scroll.maxOffset > 0 ? scroll.offset / scroll.maxOffset : 0;
  const ty = vy + 8 + ratio * (trackH - thumbH);
  round(c, vx + vw - 9, ty, 6, thumbH, 3, 'rgba(255,244,218,0.72)', 'rgba(74,43,22,0.45)', 1);
}
