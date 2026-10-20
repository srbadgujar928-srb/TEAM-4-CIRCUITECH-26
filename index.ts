import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Replace * with your exact GitHub Pages origin for production.
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

const CLIENT_ENV: Record<string, { channel: string; key: string }> = {
  client1: { channel: "THINGSPEAK_CLIENT1_CHANNEL_ID", key: "THINGSPEAK_CLIENT1_READ_KEY" },
  client2: { channel: "THINGSPEAK_CLIENT2_CHANNEL_ID", key: "THINGSPEAK_CLIENT2_READ_KEY" },
  client3: { channel: "THINGSPEAK_CLIENT3_CHANNEL_ID", key: "THINGSPEAK_CLIENT3_READ_KEY" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  let body: { client?: string };
  try { body = await req.json(); } catch { return reply({ error: "Invalid JSON" }, 400); }
  const clientId = body.client || "";
  if (!CLIENT_ENV[clientId]) return reply({ error: "Unknown client" }, 400);

  const env = CLIENT_ENV[clientId];
  const channelId = Deno.env.get(env.channel);
  const readKey = Deno.env.get(env.key);
  if (!channelId) return reply({ error: "ThingSpeak channel is not configured for this client" }, 503);

  const upstream = new URL(`https://api.thingspeak.com/channels/${encodeURIComponent(channelId)}/feeds.json`);
  upstream.searchParams.set("results", "20");
  if (readKey) upstream.searchParams.set("api_key", readKey);

  try {
    const response = await fetch(upstream.toString(), { headers: { "Accept": "application/json" } });
    if (!response.ok) return reply({ error: "ThingSpeak returned an error" }, 502);
    const data = await response.json();
    // Only send field readings/timestamps; never return channel keys or config secrets.
    const feeds = Array.isArray(data.feeds) ? data.feeds.map((f: Record<string, unknown>) => {
      const row: Record<string, unknown> = { created_at: f.created_at };
      for (let i = 1; i <= 8; i++) row[`field${i}`] = f[`field${i}`] ?? null;
      return row;
    }) : [];
    return reply({ channel: clientId, feeds });
  } catch {
    return reply({ error: "Could not reach ThingSpeak" }, 502);
  }
});
