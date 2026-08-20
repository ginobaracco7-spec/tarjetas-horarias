import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

const VALID_STATUSES = [
  "ENTREGADA",
  "AUSENTE_CON_AVISO",
  "AUSENTE_SIN_AVISO",
  "NO_CORRESPONDE",
  "FALTANTE",
  "FERIADO",
  "VACACIONES",
  "CURSO",
];

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const password = req.headers.get("x-admin-password") || "";
  if (password !== Netlify.env.get("ADMIN_PASSWORD")) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const { techId, date, status } = body;
  if (!techId || !date || (status !== null && !VALID_STATUSES.includes(status))) {
    return new Response("Bad request", { status: 400 });
  }

  const store = getStore("tarjetas-horarias");
  const state = (await store.get("state", { type: "json" })) || {
    technicians: [],
    entries: {},
    updatedAt: null,
  };

  if (!state.entries[date]) state.entries[date] = {};
  if (status === null) {
    delete state.entries[date][techId];
  } else {
    state.entries[date][techId] = status;
  }
  state.updatedAt = new Date().toISOString();

  await store.setJSON("state", state);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" },
  });
};

export const config: Config = {
  path: "/api/save-status",
};
