// Serves the public Supabase connection settings to the browser.
// The anon key is designed to be public; data is protected by Row Level Security.
export default async () => {
  const url = Netlify.env.get("SUPABASE_URL") || null;
  const anonKey = Netlify.env.get("SUPABASE_ANON_KEY") || null;
  return Response.json({ url, anonKey }, { headers: { "cache-control": "public, max-age=300" } });
};

export const config = { path: "/api/config" };
