import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

const DEFAULT_STATE = {
  technicians: [] as { id: string; name: string }[],
  entries: {} as Record<string, Record<string, string>>,
  updatedAt: null as string | null,
};

export default async (req: Request, context: Context) => {
  const store = getStore("tarjetas-horarias");
  const state = (await store.get("state", { type: "json" })) || DEFAULT_STATE;
  return new Response(JSON.stringify(state), {
    headers: { "content-type": "application/json" },
  });
};

export const config: Config = {
  path: "/api/data",
};
