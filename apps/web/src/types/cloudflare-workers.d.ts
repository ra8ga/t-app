declare module "cloudflare:workers" {
  export interface Env {
    BETTER_AUTH_SECRET: string
    BETTER_AUTH_URL: string
    CORS_ORIGIN: string
    CLOUDFLARE_ACCOUNT_ID?: string
    CLOUDFLARE_DATABASE_ID?: string
    CLOUDFLARE_D1_TOKEN?: string
    DB?: unknown
  }
  export const env: Env
}