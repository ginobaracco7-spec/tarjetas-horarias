import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

function makeId() {
  return "t_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

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

  const store = getStore("tarjetas-horarias");
  const state = (await store.get("state", { type: "json" })) || {
    technicians: [],
    entries: {},
    updatedAt: null,
  };

  if (body.action === "add" && body.name) {
    state.technicians.push({ id: makeId(), name: String(body.name).trim() });
  } else if (body.action === "rename" && body.id && body.name) {
    const t = state.technicians.find((x: any) => x.id === body.id);
    if (t) t.name = String(body.name).trim();
  } else if (body.action === "remove" && body.id) {
    state.technicians = state.technicians.filter((x: any) => x.id !== body.id);
  } else if (body.action === "reorder" && Array.isArray(body.technicians)) {
    state.technicians = body.technicians;
  } else {
    return new Response("Bad request", { status: 400 });
  }

  state.updatedAt = new Date().toISOString();
  await store.setJSON("state", state);

  return new Response(JSON.stringify({ ok: true, technicians: state.technicians }), {
    headers: { "content-type": "application/json" },
  });
};

export const config: Config = {
  path: "/api/manage-technicians",
};
