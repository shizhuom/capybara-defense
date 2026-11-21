/**
 * Compact big numbers for damage pop-ups, boss bars, live cards and reports:
 * `<10,000` stays exact (`9,876`), then `12.5K`, `3.42M`, `1.85B`.
 */
export function formatCompactNumber(value:number):string {
  if(!Number.isFinite(value))return '0';
  const abs=Math.abs(value),sign=value<0?'-':'';
  if(abs<10_000)return `${sign}${Math.round(abs).toLocaleString('en-US')}`;
  // Rounding 999,950 up must read 1M, not "1000K" (same for millions → billions).
  if(abs<999_500)return `${sign}${(abs/1_000).toFixed(abs>=100_000?0:1).replace(/\.0$/,'')}K`;
  if(abs<999_950_000)return `${sign}${(abs/1_000_000).toFixed(abs>=100_000_000?1:2).replace(/\.?0+$/,'')}M`;
  return `${sign}${(abs/1_000_000_000).toFixed(2).replace(/\.?0+$/,'')}B`;
}
