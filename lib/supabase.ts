import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const PLACEHOLDER_VALUES = new Set([
  "",
  "your_supabase_project_url",
  "your_supabase_publishable_key",
  "your_supabase_secret_key",
  "your_supabase_anon_key",
  "your_supabase_service_role_key",
]);

function isConfigured(value: string | undefined): value is string {
  return Boolean(value && !PLACEHOLDER_VALUES.has(value));
}

export function isSupabaseConfigured(): boolean {
  return (
    isConfigured(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    isConfigured(
      process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  );
}

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!isConfigured(url) || !isConfigured(secretKey)) {
    throw new Error("Supabase is not configured");
  }

  adminClient ??= createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}
