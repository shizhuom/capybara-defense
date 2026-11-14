export type AttackStyle='spin360'|'cleave180'|'cross_slash'|'thrust'|'ranged_recoil'|'magic_cast';
export const COMBAT_STYLES:Record<string,AttackStyle>={
 hamster:'cleave180',squirrel:'ranged_recoil',hedgehog:'thrust',corgi:'spin360',
 kungfu_po:'spin360',ronin_goose:'spin360',samurai_doge:'cleave180',puss_in_hat:'cross_slash',
 bamboo_mafia:'ranged_recoil',meowfia:'ranged_recoil',doge_wick:'ranged_recoil',rocket_coon:'ranged_recoil',
 zen_master:'magic_cast',purrcerer:'magic_cast',ballin_rooster:'magic_cast',pepe_king:'magic_cast',
};
export const DEFAULT_HELD_WEAPONS:Record<string,string>={
 hamster:'weapon_basic_club',squirrel:'weapon_basic_slingshot',hedgehog:'weapon_basic_spear',corgi:'weapon_basic_hammer',
 kungfu_po:'weapon_m10_bamboo_staff',ronin_goose:'cleaver',samurai_doge:'weapon_m11_salted_fish',puss_in_hat:'weapon_m09_cat_blade',
 bamboo_mafia:'weapon_r09_bamboo_bazooka',meowfia:'weapon_r10_acorn_minigun',doge_wick:'weapon_r11_sniper_laser',rocket_coon:'weapon_r12_junk_mortar',
 zen_master:'weapon_w09_yin_yang_burner',purrcerer:'weapon_w01_teaser',ballin_rooster:'basketball',pepe_king:'weapon_w12_rain_crown_scepter',
};
export const WEAPON_RARITY_SCALES=[1.05,1.15,1.26,1.38,1.52];
