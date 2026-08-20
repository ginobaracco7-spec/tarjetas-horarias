import type { Context, Config } from "@netlify/functions";

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
  const ok = !!body.password && body.password === Netlify.env.get("ADMIN_PASSWORD");
  return new Response(JSON.stringify({ ok }), {
    status: ok ? 200 : 401,
    headers: { "content-type": "application/json" },
  });
};

export const config: Config = {
  path: "/api/login",
};
