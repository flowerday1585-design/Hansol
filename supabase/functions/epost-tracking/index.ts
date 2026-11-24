import { SaxesParser } from "npm:saxes@6.0.0";

const root = "LongitudinalDomesticListResponse";
const originSet = new Set(["https://hansolarchive.com", "https://www.hansolarchive.com"]);
const endpoint = "https://openapi.epost.go.kr/trace/retrieveLongitudinalService/retrieveLongitudinalService/getLongitudinalDomesticList";
const fields = new Set(["successYN", "errMsg", "dlvySttus", "rgist", "dlvyDate", "dlvyTime", "nowLc", "processSttus"]);
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

type Frame = { name: string; text: string; fields: Record<string, string> };
type Event = { date: string; time: string; location: string; status: string };

function deliveryDetails(xml: string, tracking: string) {
  if (xml.length > 300000) throw new Error("OVERSIZE_RESPONSE");
  const parser = new SaxesParser();
  const stack: Frame[] = [];
  const metadata: Record<string, string> = Object.create(null);
  const events: Event[] = [];

  const addText = (text: string) => {
    const current = stack.at(-1);
    if (current && fields.has(current.name)) current.text += text;
  };

  parser.on("doctype", () => { throw new Error("UNEXPECTED_DOCTYPE"); });
  parser.on("opentag", (element) => {
    const name = element.name.split(":").at(-1)!;
    if (!stack.length && name !== root) throw new Error("UNEXPECTED_RESPONSE");
    stack.push({ name, text: "", fields: Object.create(null) });
  });
  parser.on("text", addText);
  parser.on("cdata", addText);
  parser.on("closetag", () => {
    const current = stack.pop()!;
    const parent = stack.at(-1);
    if (parent && fields.has(current.name)) {
      const value = current.text.trim().slice(0, 200);
      parent.fields[current.name] = value;
      if (["successYN","errMsg","dlvySttus","rgist"].includes(current.name)) metadata[current.name] = value;
    }

    const { dlvyDate: date, dlvyTime: time, nowLc: location, processSttus: status } = current.fields;
    if (date && status) events.push({ date, time: time || "", location: location || "", status });
  });
  parser.write(xml).close();

  if (metadata.rgist && metadata.rgist !== tracking) throw new Error("UNEXPECTED_TRACKING");
  if (metadata.successYN === "N") {
    if (/조회\s*(결과|내역|정보).{0,12}없|등기번호.{0,15}없|등록되지/.test(metadata.errMsg || "")) {
      return { status: "", events: [] };
    }
    throw new Error("EPOST_REJECTED");
  }
  if (metadata.successYN !== "Y") throw new Error("UNEXPECTED_RESPONSE");
  events.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  return { status: metadata.dlvySttus || events[0]?.status || "", events: events.slice(0, 50) };
}

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin");
  const headers = new Headers({ "Cache-Control": "no-store", "Vary": "Origin" });
  if (origin && originSet.has(origin)) headers.set("Access-Control-Allow-Origin", origin);
  const reply = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers });

  if (origin && !originSet.has(origin)) return reply({ message: "ORIGIN_NOT_ALLOWED" }, 403);
  if (request.method === "OPTIONS") {
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "authorization, apikey, content-type");
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "POST") return reply({ message: "METHOD_NOT_ALLOWED" }, 405);
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return reply({ message: "LOGIN_REQUIRED" }, 401);

  const input = await request.json().catch(() => null);
  if (typeof input?.orderId !== "string" || !uuid.test(input.orderId)) {
    return reply({ message: "INVALID_ORDER_ID" }, 400);
  }

  const base = Deno.env.get("SUPABASE_URL");
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serverKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const epostKey = Deno.env.get("EPOST_SERVICE_KEY")?.trim();
  if (!base || !publicKey || !serverKey || !epostKey) return reply({ message: "TRACKING_UNAVAILABLE" }, 503);

  try {
    const auth = await fetch(new URL("/auth/v1/user", base), {
      headers: { apikey: publicKey, Authorization: authorization },
      signal: AbortSignal.timeout(4000), redirect: "error",
    });
    if ([401, 403].includes(auth.status)) return reply({ message: "LOGIN_REQUIRED" }, 401);
    if (!auth.ok) return reply({ message: "TRACKING_UNAVAILABLE" }, 503);
    const user = await auth.json();
    if (!user.email_confirmed_at || user.app_metadata?.hansol_signup_state === "pending" ||
        typeof user.id !== "string" || !uuid.test(user.id)) return reply({ message: "LOGIN_REQUIRED" }, 401);

    // This table is private. Use the verified account and requested order together in the same query.
    const orders = new URL("/rest/v1/hansol_orders", base);
    orders.search = new URLSearchParams({ select: "tracking", id: "eq." + input.orderId,
      customer_id: "eq." + user.id, carrier: "eq.우체국택배", limit: "1" }).toString();
    const orderResponse = await fetch(orders, {
      headers: { apikey: serverKey, Authorization: "Bearer " + serverKey },
      signal: AbortSignal.timeout(4000), redirect: "error",
    });
    if (!orderResponse.ok) return reply({ message: "TRACKING_UNAVAILABLE" }, 503);
    const [order] = await orderResponse.json();
    const tracking = String(order?.tracking ?? "").replace(/[\s-]+/g, "");
    if (!/^\d{13}$/.test(tracking)) return reply({ message: "TRACKING_NOT_FOUND" }, 404);

    const query = new URL(endpoint);
    query.searchParams.set("ServiceKey", epostKey);
    query.searchParams.set("rgist", tracking);
    const delivery = await fetch(query, { redirect: "error", signal: AbortSignal.timeout(8000) });
    if (!delivery.ok) return reply({ message: "EPOST_UNAVAILABLE" }, 502);
    return reply(deliveryDetails(await delivery.text(), tracking));
  } catch {
    return reply({ message: "TRACKING_UNAVAILABLE" }, 503);
  }
});
