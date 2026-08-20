import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import webpush from "web-push";

// Función programada (cron): corre de lunes a viernes y le manda una
// notificación push a cada técnico que tenga tarjetas sin cargar esta semana.

function pad(n: number) {
  return n.toString().padStart(2, "0");
}
function dateKey(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}
function mondayOfWeek(d: Date) {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export default async (req: Request, context: Context) => {
  const publicKey = Netlify.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Netlify.env.get("VAPID_PRIVATE_KEY");
  if (!publicKey || !privateKey) {
    return new Response("Faltan las claves VAPID, no se mandan notificaciones.", { status: 200 });
  }
  webpush.setVapidDetails("mailto:soporte@agroterra.com", publicKey, privateKey);

  const now = new Date();
  const dow = now.getDay();
  if (dow === 0 || dow === 6) {
    return new Response("Fin de semana, no se mandan recordatorios.", { status: 200 });
  }

  const mainStore = getStore("tarjetas-horarias");
  const state = (await mainStore.get("state", { type: "json" })) || { technicians: [], entries: {} };
  const subsStore = getStore("push-subscriptions");

  const todayStr = dateKey(now.getFullYear(), now.getMonth(), now.getDate());
  const monday = mondayOfWeek(now);

  for (const tech of state.technicians || []) {
    const missing: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const key = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
      if (key > todayStr) continue;
      const status = (state.entries[key] || {})[tech.id];
      if (!status) missing.push(key);
    }
    if (missing.length === 0) continue;

    const missingToday = missing.includes(todayStr);
    const previous = missing.filter((k) => k !== todayStr);

    let body = "";
    if (previous.length > 0) {
      const oldest = new Date(previous[0] + "T00:00:00");
      const diffDays = Math.max(1, Math.round((now.getTime() - oldest.getTime()) / 86400000));
      const plural = previous.length === 1 ? "una tarjeta pendiente" : `${previous.length} tarjetas pendientes`;
      body += `Tenés ${plural} de hace ${diffDays} día${diffDays === 1 ? "" : "s"}. `;
    }
    if (missingToday) {
      body += "Recordá entregar la de hoy.";
    }
    body = body.trim();
    if (!body) continue;

    const subs: any[] = (await subsStore.get(tech.id, { type: "json" })) || [];
    if (subs.length === 0) continue;

    const payload = JSON.stringify({ title: "Tarjeta horaria pendiente", body });
    const stillValid: any[] = [];
    for (const sub of subs) {
      try {
        await webpush.sendNotification(sub, payload);
        stillValid.push(sub);
      } catch (err: any) {
        // Suscripción vencida/inválida (410/404): se descarta. Otros errores, se conserva.
        if (err && err.statusCode !== 404 && err.statusCode !== 410) {
          stillValid.push(sub);
        }
      }
    }
    await subsStore.setJSON(tech.id, stillValid);
  }

  return new Response("OK", { status: 200 });
};

export const config: Config = {
  schedule: "0 21 * * 1-5",
};
