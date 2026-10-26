// Assistant « Pose ta question » de la formation Première vente : fonction serveur (Vercel, Node.js).
// La page envoie la question, les extraits trouvés dans la formation et le contexte ; cette fonction
// ajoute les règles de l'assistant, appelle l'IA avec la clé gardée sur le serveur et renvoie
// la réponse en texte, au fil de l'écriture. La clé n'est jamais envoyée au navigateur.
//
// Variables d'environnement (une des deux clés suffit ; si les deux sont là, Gemini est utilisé) :
//   GEMINI_API_KEY         clé gratuite créée dans Google AI Studio (offre gratuite de l'API Gemini)
//   ANTHROPIC_API_KEY      clé payante créée dans la Claude Console
//   ASSISTANT_ACCESS_CODE  conseillé : un code demandé une fois par la page ; sans lui, n'importe qui trouvant l'adresse peut utiliser ta clé.
//                          Une personne connectée à son compte du site (Supabase) n'a pas besoin de ce code.
//   ASSISTANT_MODEL        facultatif : modèle utilisé (par défaut gemini-3.8-flash avec Gemini, claude-haiku-5-5 avec Claude)
//   ASSISTANT_FALLBACK_MODEL facultatif : second modèle Gemini gratuit si le premier est surchargé ou à court de quota (par défaut gemini-3.5-flash-lite)
//   ALLOWED_ORIGIN         facultatif : l'adresse de ton site (https://…) pour refuser les appels venant d'ailleurs

const RULES = "Tu es l'assistant de « Première vente », une formation en français qui guide un débutant, en 14 étapes et 87 missions, pour lancer une boutique Shopify en dropshipping depuis la France et vendre avec Google Ads (Shopping et Search). Tu réponds aux questions de l'apprenant.\n\nTes règles :\n1. Réponds en français, en tutoyant, avec des mots simples et des exemples concrets. Va droit au but : la réponse directe d'abord, puis le détail utile. Quand il s'agit d'étapes à suivre, fais une courte liste numérotée.\n2. Appuie-toi d'abord sur les extraits de la formation donnés avec la question (numérotés [1], [2]…). Quand une information vient d'un extrait, mets son numéro entre crochets à la fin de la phrase, par exemple [2]. Quand c'est utile, dis quelle mission ouvrir (« mission 2.2 »).\n3. N'invente jamais un chiffre, un tarif, une date, un seuil, un taux, le nom d'un bouton ou d'un menu, une adresse web ou une règle. Si l'information n'est pas dans les extraits, dis-le franchement ; tu peux donner une indication générale en précisant que ce n'est pas dans la formation, et conseiller de vérifier sur la page officielle (Google, Shopify, Urssaf, impots.gouv, Service Public). Les écrans et les règles changent : rappelle-le quand tu parles d'un écran, d'un tarif ou d'un seuil.\n4. Les chiffres de la « boutique fil rouge » sont un exemple fictif : présente-les comme un exemple, jamais comme les chiffres de l'apprenant. Si l'apprenant a saisi ses propres chiffres dans le calculateur, ils sont indiqués avec la question : utilise-les pour lui répondre.\n5. Droit, fiscalité, cotisations, statut : donne une information générale et renvoie vers un expert-comptable, l'Urssaf ou le service des impôts pour une décision qui le concerne personnellement.\n6. Si la question n'a pas de rapport avec la formation, l'e-commerce, Shopify ou Google Ads, réponds en une phrase et propose de revenir à la formation.\n7. Ne demande jamais de mot de passe, de code reçu par SMS ou de numéro de carte, et rappelle de ne jamais les partager.\n8. Pas de titre, pas de formule d'introduction (« Bonne question »), pas de phrase finale du type « N'hésite pas ». Termine, quand c'est utile, par la prochaine action concrète à faire dans la formation.";
const API = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com') + '/v1/messages';
const GEMINI = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com';
const LIM = { question: 1500, context: 3000, passages: 12, passage: 1600, history: 8, turn: 3000 };
const hits = new Map(); // limite simple par adresse IP, le temps de vie de l'instance
const json = (o, status) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const str = (x, n) => String(x == null ? '' : x).slice(0, n);

// Une personne connectée à son compte du site (Supabase) n'a pas besoin du code d'accès.
// Un jeton vérifié est gardé 5 minutes en mémoire : les questions suivantes partent sans vérification.
const okTokens = new Map();
async function signedIn(request) {
  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, ''), key = (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
  const auth = request.headers.get('authorization') || '';
  if (!url || !key || !/^Bearer\s+\S+$/.test(auth)) return false;
  const now = Date.now(), hit = okTokens.get(auth);
  if (hit && hit > now) return true;
  try {
    const r = await fetch(url + '/auth/v1/user', { headers: { apikey: key, authorization: auth } });
    if (r.ok) { if (okTokens.size > 500) okTokens.clear(); okTokens.set(auth, now + 5 * 60 * 1000); }
    return r.ok;
  } catch (e) { return false; }
}
function tooMany(ip) {
  const now = Date.now(); const a = (hits.get(ip) || []).filter(t => now - t < 10 * 60 * 1000);
  a.push(now); hits.set(ip, a);
  if (hits.size > 5000) hits.clear();
  return a.length > 30;
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (request.method !== 'POST') return json({ error: 'method' }, 405);
    const gkey = process.env.GEMINI_API_KEY, key = process.env.ANTHROPIC_API_KEY;
    if (!gkey && !key) return json({ error: 'not_configured' }, 503);
    const origin = process.env.ALLOWED_ORIGIN;
    if (origin && request.headers.get('origin') && request.headers.get('origin') !== origin) return json({ error: 'origin' }, 403);
    const code = process.env.ASSISTANT_ACCESS_CODE;
    if (code && request.headers.get('x-access-code') !== code && !(await signedIn(request))) return json({ error: 'access_code' }, 401);
    const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'inconnu';
    if (tooMany(ip)) return json({ error: 'rate_limited' }, 429);

    let b;
    try { b = await request.json(); } catch (e) { return json({ error: 'bad_request' }, 400); }
    const question = str(b && b.question, LIM.question).trim();
    if (!question) return json({ error: 'bad_request' }, 400);
    const detail = b.mode === 'detaille';
    const passages = (Array.isArray(b.passages) ? b.passages : []).slice(0, detail ? LIM.passages : 8)
      .map((p, i) => `[${Number(p && p.n) || i + 1}] ${str(p && p.titre, 200)}\n${str(p && p.texte, LIM.passage)}`).join('\n\n');
    const history = [];
    for (const t of (Array.isArray(b.history) ? b.history : []).slice(-LIM.history)) {
      if (!t || (t.role !== 'user' && t.role !== 'assistant')) continue;
      const c = str(t.content, LIM.turn).trim(); if (!c) continue;
      if (!history.length && t.role !== 'user') continue;
      if (history.length && history[history.length - 1].role === t.role) history[history.length - 1].content += '\n\n' + c;
      else history.push({ role: t.role, content: c });
    }
    if (history.length && history[history.length - 1].role === 'user') history.pop();
    const final = `${str(b.context, LIM.context)}\n\nExtraits de la formation (sers-t'en en priorité et cite leur numéro entre crochets) :\n\n${passages || '(aucun extrait ne correspond)'}\n\n`
      + `${detail ? 'Réponse détaillée demandée : explique complètement, 400 mots au plus.' : 'Réponse courte demandée : 60 à 170 mots.'}\n\nQuestion de l'apprenant : ${question}`;

    if (gkey) return viaGemini(gkey, detail, history, final);
    let up;
    try {
      up = await fetch(API, {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: process.env.ASSISTANT_MODEL || 'claude-haiku-5-5',
          max_tokens: detail ? 6000 : 2500,
          output_config: { effort: detail ? 'high' : 'low' },
          system: RULES,
          messages: history.concat([{ role: 'user', content: final }]),
          stream: true }) });
    } catch (e) { return json({ error: 'upstream' }, 502); }
    if (!up.ok) {
      let t = ''; try { t = await up.text(); } catch (e) {}
      console.error('API Claude', up.status, t.slice(0, 500));
      if (/specified (workspace )?API usage limits|enforced_spend_limit_reached/.test(t)) return json({ error: 'quota' }, 429);
      if (up.status === 429 || up.status === 529) return json({ error: 'rate_limited' }, 429);
      return json({ error: 'upstream' }, 502);
    }

    const enc = new TextEncoder(), dec = new TextDecoder();
    const reader = up.body.getReader();
    const stream = new ReadableStream({
      async start(ctl) {
        let buf = '';
        const handle = line => {
          if (!line.startsWith('data:')) return;
          let ev; try { ev = JSON.parse(line.slice(5).trim()); } catch (e) { return; }
          if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') ctl.enqueue(enc.encode(ev.delta.text));
          else if (ev.type === 'message_delta' && ev.delta && ev.delta.stop_reason === 'max_tokens') ctl.enqueue(enc.encode('\u0000TRUNC'));
          else if (ev.type === 'error') ctl.enqueue(enc.encode('\u0000ERR:' + (ev.error && ev.error.type === 'overloaded_error' ? 'rate_limited' : 'upstream')));
        };
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const lines = buf.split('\n'); buf = lines.pop();
            lines.forEach(handle);
          }
          if (buf) handle(buf);
        } catch (e) { ctl.enqueue(enc.encode('\u0000ERR:upstream')); }
        ctl.close();
      },
      cancel() { try { reader.cancel(); } catch (e) {} } });
    return new Response(stream, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
  } };

// ----- Gemini (offre gratuite de l'API Gemini, clé Google AI Studio) -----
async function viaGemini(gkey, detail, history, final, think = true, alt = false) {
  const main = process.env.ASSISTANT_MODEL || 'gemini-3.8-flash', spare = process.env.ASSISTANT_FALLBACK_MODEL || 'gemini-3.5-flash-lite';
  const model = alt ? spare : main;
  // jamais plus de 60 s (réponse rapide) ou 120 s (détaillée), et au plus 30 s sans rien recevoir
  const ab = new AbortController(); const total = setTimeout(() => ab.abort(), detail ? 120000 : 60000);
  let up;
  try {
    up = await fetch(`${GEMINI}/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
      method: 'POST', signal: ab.signal,
      headers: { 'x-goog-api-key': gkey, 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: RULES }] },
        contents: history.concat([{ role: 'user', content: final }]).map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: Object.assign({ maxOutputTokens: detail ? 8000 : 4000, temperature: 0.3 }, think ? { thinkingConfig: { thinkingLevel: detail ? 'medium' : 'low' } } : {}) }) });
  } catch (e) { clearTimeout(total); return json({ error: 'upstream' }, 502); }
  // si le modèle n'accepte pas ce réglage de réflexion, on repart sans lui
  if (think && up.status === 400) { clearTimeout(total); try { console.error('API Gemini 400 avec réflexion réglée', model, (await up.text()).slice(0, 300)); } catch (e) {} return viaGemini(gkey, detail, history, final, false, alt); }
  if (!up.ok) {
    clearTimeout(total);
    let t = ''; try { t = await up.text(); } catch (e) {}
    console.error('API Gemini', model, up.status, t.slice(0, 300));
    // modèle surchargé ou quota gratuit épuisé : un second modèle gratuit prend le relais (il a son propre quota)
    if ((up.status === 503 || up.status === 429 || up.status === 500) && !alt && spare && spare !== main) return viaGemini(gkey, detail, history, final, think, true);
    if (up.status === 429) return json({ error: /quota|per day|PerDay/i.test(t) ? 'quota' : 'rate_limited' }, 429);
    if (up.status === 503) return json({ error: 'rate_limited' }, 429);
    return json({ error: 'upstream' }, 502);
  }
  const enc = new TextEncoder(), dec = new TextDecoder();
  const reader = up.body.getReader();
  let idle = 0;
  const stream = new ReadableStream({
    async start(ctl) {
      let buf = '', sent = false;
      const bump = () => { clearTimeout(idle); idle = setTimeout(() => ab.abort(), 30000); };
      const handle = line => {
        if (!line.startsWith('data:')) return;
        let ev; try { ev = JSON.parse(line.slice(5).trim()); } catch (e) { return; }
        if (ev.error) { ctl.enqueue(enc.encode('\u0000ERR:' + (ev.error.code === 429 || ev.error.code === 503 ? 'rate_limited' : 'upstream'))); return; }
        const c = ev.candidates && ev.candidates[0];
        if (!c) { if (ev.promptFeedback && ev.promptFeedback.blockReason) ctl.enqueue(enc.encode('\u0000ERR:upstream')); return; }
        const txt = ((c.content && c.content.parts) || []).filter(p => p && typeof p.text === 'string' && !p.thought).map(p => p.text).join('');
        if (txt) { ctl.enqueue(enc.encode(txt)); sent = true; }
        if (c.finishReason === 'MAX_TOKENS') ctl.enqueue(enc.encode('\u0000TRUNC'));
        else if (c.finishReason && !/^(STOP|FINISH_REASON_UNSPECIFIED|MAX_TOKENS)$/.test(c.finishReason) && !sent) ctl.enqueue(enc.encode('\u0000ERR:upstream'));
      };
      try {
        bump();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          bump();
          buf += dec.decode(value, { stream: true });
          const lines = buf.split(/\r?\n/); buf = lines.pop();
          lines.forEach(handle);
        }
        if (buf) handle(buf);
      } catch (e) { ctl.enqueue(enc.encode('\u0000ERR:' + (ab.signal.aborted ? 'rate_limited' : 'upstream'))); }
      clearTimeout(idle); clearTimeout(total);
      ctl.close();
    },
    cancel() { clearTimeout(idle); clearTimeout(total); try { ab.abort(); } catch (e) {} try { reader.cancel(); } catch (e) {} } });
  return new Response(stream, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
}
