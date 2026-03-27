/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Set on Vercel builds from VERCEL_GIT_COMMIT_SHA */
  readonly VITE_GIT_SHA: string
  /** Set on Vercel builds from VERCEL_ENV (production | preview | development) */
  readonly VITE_VERCEL_ENV: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
