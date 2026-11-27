/// <reference types="vite/client" />
/** Compile-time flag: true in local dev/tests, false in production dist-wx/dist-bl bundles so DevToolsModal tree-shakes out. */
declare const __ENABLE_DEV_TOOLS__: boolean;
/** Compile-time flag: false in WeChat Mini Game (`dist-wx`) to ship Chinese-only UI and strip English dictionaries/sprites. */
declare const __ENABLE_ENGLISH__: boolean;
interface ImportMetaEnv {
  /** P17 global endless board (Cloudflare Worker URL). Empty or missing keeps the board in local mode. */
  readonly VITE_LEADERBOARD_API_URL?: string;
}
