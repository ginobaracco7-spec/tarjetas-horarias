import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

// Guarda la suscripción push de un técnico (su celular/navegador), para
// poder mandarle recordatorios más adelante. No requiere contraseña: no hay
// login para los técnicos, cualquiera puede suscribirse a SU propio id.
export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const { techId, subscription } = body;
  if (!techId || !subscription || !subscription.endpoint) {
    return new Response("Bad request", { status: 400 });
  }

  const store = getStore("push-subscriptions");
  const list: any[] = (await store.get(techId, { type: "json" })) || [];
  const filtered = list.filter((s) => s.endpoint !== subscription.endpoint);
  filtered.push(subscription);
  await store.setJSON(techId, filtered);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" },
  });
};

export const config: Config = {
  path: "/api/subscribe",
};
