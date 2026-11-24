export type SpritePackage = 'main' | 'maps' | 'meta';

export interface SpritePackRule {
  pkg: SpritePackage;
  format: 'jpg' | 'webp';
  maxDim: number;
  quality: number;
  omit?: boolean;
}

const OPAQUE_MAIN_BGS = new Set(['start_splash_bg', 'map_sunny_backyard']);
const OPAQUE_MAP_BGS = new Set(['map_sakura_onsen', 'map_midnight_kitchen', 'map_cat_tower_maze', 'bg_onsen_village']);

const MAIN_CORE_IDS = new Set([
  // Basic pets & recipe components
  'panda', 'cat', 'shiba', 'goose', 'rooster', 'raccoon', 'frog',
  'hamster', 'squirrel', 'hedgehog', 'corgi', 'bee',
  'hat_bamboo', 'hat_shades', 'hat_wizard', 'cleaver', 'basketball', 'trash_lid', 'crown',
  // 12 base heroes
  'kungfu_po', 'bamboo_mafia', 'zen_master', 'puss_in_hat', 'meowfia', 'purrcerer',
  'samurai_doge', 'doge_wick', 'ronin_goose', 'ballin_rooster', 'rocket_coon', 'pepe_king',
  // Guardian, bath soak, tiles, tools
  'capybara', 'capybara_soak', 'capybara_soak_2', 'capybara_soak_3', 'capybara_soak_4',
  'capybara_soak_dizzy', 'capybara_soak_dizzy_2',
  'tub_rim_sunny_backyard', 'tile_open', 'tile_broken',
  'orange', 'shovel', 'sprinkler', 'glue_trap_placed',
  // Basic minions + Sunny Backyard bosses
  'rat', 'rat_walk2', 'roach', 'roach_walk2', 'crab', 'crab_walk2',
  'killer_bee', 'killer_bee_walk2', 'charmed_rat', 'charmed_rat_walk2',
  'husky_wrecker', 'husky_wrecker_walk2', 'diva_kitty', 'diva_kitty_walk2',
  'mega_roomba', 'mega_roomba_walk2', 'sad_rain_frog', 'sad_rain_frog_walk2',
  'king_skunk', 'king_skunk_walk2',
  // Splash + HUD + dock icons
  'logo_capy', 'avatar_capybara', 'title_logo_zh', 'title_logo_en', 'ui_btn_start_zh', 'ui_btn_start_en',
  'ui_bell_summon', 'ui_fish_food', 'ui_coin_gold', 'ui_star_rank', 'ui_compendium_book',
  'ui_shop_bag', 'ui_trophy_rank', 'ui_map_sign', 'ui_village_gate', 'ui_kitchen_pot',
  'ui_endless_crest', 'ui_lock_closed', 'ui_lock_open', 'ui_merge_sparkle', 'ui_wave_horn',
  'ui_tutorial_capy', 'ui_tutorial_pointer', 'ui_victory_shield_wings', 'ui_defeat_shield_wings',
  'ui_victory_star_lit', 'ui_victory_star_dim', 'ui_mvp_crown', 'ui_ticket_gacha',
  'ui_weapon_fragment', 'ui_clock_sand', 'ui_skull_threat', 'ui_btn_return_arrow',
  'ui_horn_continue', 'ui_crossed_blades', 'ui_storybook_check', 'ui_streak_flame',
  'ui_pause_peek_capy', 'ui_compendium_peek_capy', 'ui_armory_peek_capy', 'ui_alert_siren',
  'ui_battle_clash_crest', 'ui_harvest_basket', 'ui_rank_protect_shield', 'ui_endless_emblem',
  'ui_passive_aura_badge', 'ui_stat_damage_burst', 'ui_stat_ko_skull', 'weapon_m10_bamboo_staff',
  'ui_stats_scroll', 'ui_unlock_chest', 'ui_profile_peek_capy', 'ui_rank_peek_capy',
  'ui_market_peek_raccoon', 'ui_village_peek_capy', 'ui_kitchen_peek_capy', 'ui_medallion_peek_capy',
  'ui_gacha_machine', 'ui_pet_heart', 'ui_sleep_zzz',
]);

/** Single source of truth for mini-game sprite compression & WeChat/Bilibili subpackage assignment. */
export function classifySprite(id: string): SpritePackRule {
  if (id === 'menu_banner') {
    return { pkg: 'meta', format: 'jpg', maxDim: 640, quality: 0.78, omit: true };
  }
  if (OPAQUE_MAIN_BGS.has(id)) {
    return { pkg: 'main', format: 'jpg', maxDim: 1280, quality: 0.82 };
  }
  if (OPAQUE_MAP_BGS.has(id)) {
    return { pkg: 'maps', format: 'jpg', maxDim: 1280, quality: 0.82 };
  }
  if (id === 'title_logo_zh' || id === 'title_logo_en') {
    return { pkg: 'main', format: 'webp', maxDim: 720, quality: 0.85 };
  }
  if (id === 'ui_victory_shield_wings' || id === 'ui_defeat_shield_wings') {
    return { pkg: 'main', format: 'webp', maxDim: 512, quality: 0.85 };
  }
  if (id === 'ui_btn_start_zh' || id === 'ui_btn_start_en') {
    return { pkg: 'main', format: 'webp', maxDim: 440, quality: 0.85 };
  }
  if (id.startsWith('tub_rim_')) {
    return { pkg: id === 'tub_rim_sunny_backyard' ? 'main' : 'maps', format: 'webp', maxDim: 420, quality: 0.84 };
  }
  if (id.startsWith('fac_')) {
    return { pkg: 'maps', format: 'webp', maxDim: 280, quality: 0.84 };
  }
  if (id.startsWith('vfx_') || id.startsWith('weapon_basic_')) {
    return { pkg: 'main', format: 'webp', maxDim: 160, quality: 0.82 };
  }
  if (MAIN_CORE_IDS.has(id)) {
    const isIcon = id.startsWith('ui_') || id === 'orange' || id === 'logo_capy' || id === 'tile_open' || id === 'tile_broken';
    return { pkg: 'main', format: 'webp', maxDim: isIcon ? 160 : 224, quality: 0.82 };
  }
  const isLargeMeta = id.startsWith('dish_') || id.startsWith('npc_') || id.endsWith('_awakened') || id.endsWith('_walk2') || id.startsWith('box_kraken') || id.startsWith('dr_clippers') || id.startsWith('buff_roo') || id.startsWith('hornet_queen') || id.startsWith('screaming_marmot') || id.startsWith('trash_coon') || id.startsWith('dj_rat_king');
  return { pkg: 'meta', format: 'webp', maxDim: isLargeMeta ? 224 : 160, quality: 0.8 };
}

export function spriteRelativePath(id: string): string {
  const rule = classifySprite(id);
  const ext = rule.format;
  if (rule.pkg === 'main') return `assets/sprites/${id}.${ext}`;
  return `subpackages/${rule.pkg}/assets/${id}.${ext}`;
}
