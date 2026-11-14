export const UNIT_ICONS: Record<string, string> = {
  hamster: '🐹', squirrel: '🐿️', hedgehog: '🦔', corgi: '🐶', bee: '🐝', panda: '🐼', cat: '🐱', shiba: '🐕',
  hat_bamboo: '🎋', hat_shades: '🕶️', hat_wizard: '🧙', goose: '🦢', cleaver: '🔪', rooster: '🐔',
  basketball: '🏀', raccoon: '🦝', trash_lid: '🗑️', frog: '🐸', crown: '👑',
  kungfu_po: '🐼🎋', bamboo_mafia: '🐼🕶️', zen_master: '🐼☯', puss_in_hat: '🐱🎋', meowfia: '🐱🕶️',
  purrcerer: '🐱🧙', samurai_doge: '🐕🎋', doge_wick: '🐕🕶️', ronin_goose: '🦢🔪', ballin_rooster: '🐔🏀',
  rocket_coon: '🦝🗑️', pepe_king: '🐸👑',
};

export const capyLogo = `<svg viewBox="0 0 72 72" aria-hidden="true"><path d="M12 37Q8 13 25 19Q35 12 52 22Q68 18 63 42L60 60Q40 69 17 59Z" fill="#c99365" stroke="#493d35" stroke-width="4"/><path d="M19 19l7 7m28-4-5 7M22 42h7m17 0h7" fill="none" stroke="#493d35" stroke-width="4" stroke-linecap="round"/><path d="M33 49q5 5 10 0" fill="none" stroke="#493d35" stroke-width="3" stroke-linecap="round"/><circle cx="36" cy="13" r="10" fill="#f8a34f" stroke="#493d35" stroke-width="3"/><path d="M36 4q3-7 10-2-3 6-10 2" fill="#87aa74" stroke="#493d35" stroke-width="2"/></svg>`;

export const capyIllustration = `<svg class="capy-illustration" viewBox="0 0 400 300" aria-hidden="true">
  <g fill="none" stroke="#ead8b9" stroke-width="3" stroke-linecap="round"><path d="M73 103q-13-16 1-30t0-24"/><path d="M314 106q-14-17 1-32t0-23"/><path d="M96 68q-9-12 1-23"/></g>
  <ellipse cx="203" cy="266" rx="150" ry="15" fill="#e7dbbd"/>
  <g stroke="#493d35" stroke-width="5" stroke-linejoin="round">
    <path d="M74 191l18 67q104 28 218-1l17-65" fill="#bf855b"/><path d="M107 203l8 59m36-52 3 56m46-52v57m47-58-4 54m49-61-8 55" stroke-width="3" fill="none"/>
    <path d="M85 238q117 25 232-1" stroke="#785537" fill="none" stroke-width="8"/>
    <ellipse cx="201" cy="191" rx="132" ry="41" fill="#eec99b"/><ellipse cx="201" cy="190" rx="116" ry="29" fill="#97c6b3"/>
    <path d="M125 184q-13-70 13-87l-3-12q1-24 24-15l12 8q32-14 68 0l13-8q23-7 26 15l-3 16q19 22 13 84-82 29-163-1Z" fill="#c99469"/>
    <path d="M147 86l11 7m101-8-10 9" fill="none" stroke-width="4" stroke-linecap="round"/>
    <path d="M152 132q10 8 20 0m61 0q10 8 20 0" fill="none" stroke-linecap="round"/>
    <path d="M185 157q17 16 32 0" fill="#e2b180"/>
    <path d="M196 151h10" fill="none" stroke-width="4" stroke-linecap="round"/>
    <path d="M139 183q9-13 19 0m82 0q10-13 20 0" fill="#d8ab80"/>
    <g fill="#f4a04c"><circle cx="204" cy="66" r="22"/><circle cx="204" cy="33" r="17"/><circle cx="205" cy="8" r="12"/></g>
    <path d="M205 0q12-13 20-2-12 10-20 2" fill="#8da76b" stroke-width="3"/>
  </g>
  <g fill="none" stroke="#d8eee0" stroke-width="4" stroke-linecap="round"><path d="M91 194q17 11 33 0m150 7q20 8 38-4m-149 5q35 9 68 0"/></g>
  <g fill="#e18f7f" opacity=".5"><ellipse cx="149" cy="151" rx="11" ry="6"/><ellipse cx="256" cy="151" rx="11" ry="6"/></g>
  <g stroke="#493d35" stroke-width="3" transform="translate(325 134) rotate(-14)"><ellipse cx="0" cy="0" rx="11" ry="17" fill="#fff9df"/><ellipse cx="16" cy="0" rx="11" ry="17" fill="#fff9df"/><ellipse cx="9" cy="11" rx="22" ry="15" fill="#f5cc62"/><path d="M2-1v24m12-23v25"/><circle cx="23" cy="7" r="2" fill="#493d35"/></g>
  <g fill="#fff5d8" stroke="#493d35" stroke-width="3"><path d="M51 145l5-12 4 12 11 4-11 4-4 12-5-12-11-4Z"/><path d="M335 225l4-9 3 9 9 3-9 4-3 9-4-9-9-4Z"/></g>
</svg>`;

export function escapeHtml(value: string | number): string {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
}
