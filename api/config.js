// Donne à la page l'adresse de ton projet Supabase et sa clé publique, pour la connexion par e-mail et mot de passe.
// Ces deux valeurs sont faites pour être visibles dans le navigateur : la sécurité vient des règles de la table (supabase.sql).
// Variables d'environnement : SUPABASE_URL (https://xxxx.supabase.co) et SUPABASE_PUBLISHABLE_KEY (sb_publishable_…, ou l'ancienne clé « anon »).
export default {
  fetch() {
    const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
    const key = (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
    const ok = /^https:\/\/[^\s]+$/.test(url) && key && !/^sb_secret_/.test(key);
    return new Response(JSON.stringify(ok ? { supabase: { url, key } } : {}), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  } };
