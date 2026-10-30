// Fonte oficial: Graph API da Meta, "Business Discovery". Funciona em qualquer aparelho (sem servidor),
// mas só enxerga perfis Criador/Empresa, sem views nem stories. O token fica só neste aparelho.
import { IgError } from "./errors";
import { nativeNet, note, type Net } from "./net";
import { tokens, type ParsedPost, type ParsedProfile } from "./parse";

export interface GraphConfig { id: string; token: string }
const KEY = "mirante:graph";
const HOST = "https://graph.facebook.com";  // sem versão: a Meta usa a mais antiga ainda aceita

export function loadGraph(): GraphConfig | null {
  try { const c = JSON.parse(localStorage.getItem(KEY) || "null"); return c?.id && c?.token ? c : null; } catch { return null; }
}
export function saveGraph(c: GraphConfig | null) {
  try { c ? localStorage.setItem(KEY, JSON.stringify(c)) : localStorage.removeItem(KEY); } catch { /* armazenamento bloqueado */ }
}

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const num = (v: unknown): number | null => (typeof v === "number" && isFinite(v) && v >= 0 ? v : null);
const FIELDS = (h: string) =>
  `business_discovery.username(${h}){id,username,name,biography,profile_picture_url,followers_count,follows_count,media_count,` +
  `media.limit(12){caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count,children{media_type,media_url}}}`;

/** Traduz o erro da Meta: token vencido = pedir outro; limite = pausa; perfil fora do alcance = aviso no perfil. */
export function classifyGraph(status: number, json: unknown): void {
  const e = (json as Json)?.error as Json | undefined;
  if (!e) { if (status >= 500) throw new IgError("network", "A Meta está fora do ar agora."); return; }
  const code = Number(e.code), sub = Number(e.error_subcode), msg = String(e.message || "").slice(0, 120);
  if (code === 190 || code === 102 || code === 10 || (code >= 200 && code < 300)) throw new IgError("auth", `A Meta recusou o token (${msg}). Gere outro em Ajustes.`);
  if ([4, 17, 32, 613, 80002].includes(code)) throw new IgError("blocked", `A Meta pediu calma (${msg}).`);
  if (code === 110 || sub === 2207013 || /business_discovery|Invalid user id/i.test(msg))
    throw new IgError("notfound", "A API oficial só enxerga perfis Criador ou Empresa. Este é pessoal, privado ou não existe.");
  throw new IgError("format", `A Meta recusou o pedido (${code}: ${msg}).`);
}

export function parseDiscovery(json: unknown): { profile: ParsedProfile; posts: ParsedPost[] } {
  const d = (json as Json)?.business_discovery as Json | undefined;
  if (!d?.id || !d.username) throw new IgError("format", "A Meta respondeu de um jeito que eu não entendi.");
  const profile: ParsedProfile = {
    ig_id: String(d.id), handle: String(d.username).toLowerCase(), name: d.name || null, bio: d.biography || null,
    avatar_src: d.profile_picture_url || null, followers: num(d.followers_count), following: num(d.follows_count),
    posts_count: num(d.media_count), is_business: true, is_private: false,
  };
  const posts: ParsedPost[] = [];
  for (const m of (d.media?.data as Json[]) || []) {
    const code = String(m.permalink || "").match(/\/(?:p|reels?|tv)\/([\w-]+)/)?.[1];
    const at = Date.parse(m.timestamp);
    if (!code || !isFinite(at)) continue;
    const video = m.media_type === "VIDEO";
    const kind: ParsedPost["kind"] = m.media_type === "CAROUSEL_ALBUM" ? "carousel" : video ? (m.media_product_type === "REELS" ? "reel" : "video") : "image";
    const media = (kind === "carousel" ? (m.children?.data as Json[]) || [] : [m])
      .map(c => ({ kind: (c.media_type === "VIDEO" ? "video" : "image") as "video" | "image", url: c.media_url as string })).filter(c => c.url);
    const caption: string | null = m.caption ?? null;
    posts.push({
      id: code, kind, taken_at: at, caption, hashtags: tokens(caption, /#([\p{L}\p{N}_]+)/gu), mentions: tokens(caption, /@([\w.]+)/g),
      location: null, duration: null, likes: num(m.like_count), comments: num(m.comments_count), views: null, is_pinned: false,
      media, thumb_src: (video ? m.thumbnail_url : m.media_url) || m.thumbnail_url || null,
    });
  }
  return { profile, posts };
}

async function call(path: string, c: GraphConfig, fields: string): Promise<unknown> {
  const url = `${HOST}/${encodeURIComponent(c.id)}?fields=${encodeURIComponent(fields)}`;
  let status: number, json: unknown;
  try {
    const r = await fetch(`${url}&access_token=${encodeURIComponent(c.token)}`);
    status = r.status; json = await r.json().catch(() => null);
  } catch (e) {
    note(path, "erro", (e as Error)?.message);
    throw new IgError("network", "Sem conexão com a Meta agora: " + ((e as Error)?.message || "erro de rede"));
  }
  note(path, status, json);  // o token nunca entra no diagnóstico
  classifyGraph(status, json);
  return json;
}

export const graphNet = (c: GraphConfig): Net => ({
  async profile(handle) {
    return parseDiscovery(await call(`graph.facebook.com/${c.id}?business_discovery.username(${handle})`, c, FIELDS(handle)));
  },
  async ownerOf() { throw new IgError("notfound", "Com a API da Meta não dá para descobrir o dono de um post. Cole o link do perfil."); },
  image: nativeNet.image,
});

/** Botão "Testar": devolve o @ da conta ligada ao token. */
export async function testGraph(c: GraphConfig): Promise<string> {
  const j = (await call(`graph.facebook.com/${c.id}?fields=username`, c, "username")) as Json;
  if (!j?.username) throw new IgError("format", "O token funcionou, mas esse ID não é de uma conta do Instagram.");
  return String(j.username);
}
