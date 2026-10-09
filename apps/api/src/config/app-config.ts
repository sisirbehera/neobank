export interface AuthConfig {
  accessTokenSecret: string;
  accessTokenTtlMinutes: number;
  refreshTokenTtlDays: number;
  /** Send the refresh cookie over HTTPS only (true in production). */
  secureCookies: boolean;
  /** Max auth requests per IP per 15 minutes. */
  rateLimit: number;
}

/** Everything createApp() needs; built from env vars in main.ts and by hand in tests. */
export interface AppConfig {
  version: string;
  /** Folder with the built Angular app; skipped if it doesn't exist. */
  staticDir?: string;
  auth: AuthConfig;
}
