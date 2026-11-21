/// <reference types="vite/client" />
interface ImportMetaEnv {
  /** P17 global endless board (Cloudflare Worker URL). Empty or missing keeps the board in local mode. */
  readonly VITE_LEADERBOARD_API_URL?: string;
}
