import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}
async function signatureIsValid(raw: string, signature: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
  if (digest.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < digest.length; i++) mismatch |= digest.charCodeAt(i) ^ signature.charCodeAt(i);
  return mismatch === 0;
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const secret = Deno.env.get("LEMONSQUEEZY_WEBHOOK_SECRET");
  const signature = req.headers.get("x-signature") ?? "";
  if (!secret || !signature) return json({ error: "Webhook signature is missing." }, 401);
  const raw = await req.text();
  if (!(await signatureIsValid(raw, signature, secret))) return json({ error: "Invalid webhook signature." }, 401);
  try {
    const event = JSON.parse(raw);
    if (event?.meta?.event_name !== "order_created") return json({ received: true, ignored: true });
    const order = event?.data;
    const attributes = order?.attributes ?? {};
    if (attributes.status !== "paid") return json({ received: true, ignored: true });

const custom = event?.meta?.custom_data ?? {};

console.log("WEBHOOK META:", JSON.stringify(event?.meta));
console.log("CUSTOM DATA:", JSON.stringify(custom));

if (
  custom.product !== "little-date-invitation" ||
  typeof custom.slug !== "string" ||
  !/^[a-f0-9]{20}$/.test(custom.slug) ||
  !["custom", "surprise"].includes(custom.mode) ||
  typeof custom.sender !== "string" ||
  typeof custom.recipient !== "string" ||
  typeof custom.theme !== "string" ||
  !["true", "false"].includes(custom.no_dodge)
) {
  return json({ error: "Missing or invalid checkout metadata." }, 400);
}

const invitation = {
  slug: custom.slug,
  mode: custom.mode,
  sender: custom.sender,
  recipient: custom.recipient,
  place: custom.place || null,
  date: custom.date || null,
  time: custom.time || null,
  bring: custom.bring || null,
  then: custom.then || null,
  theme: custom.theme,
  no_dodge: custom.no_dodge === "true"
};
const expectedVariant = Deno.env.get("LEMONSQUEEZY_VARIANT_ID");
    const expectedStore = Deno.env.get("LEMONSQUEEZY_STORE_ID");
    const itemVariant = attributes.first_order_item?.variant_id;
    if (!expectedVariant || itemVariant == null || String(itemVariant) !== String(expectedVariant)) return json({ error: "Unexpected or missing purchased variant." }, 400);
    if (!expectedStore || String(attributes.store_id) !== String(expectedStore)) return json({ error: "Unexpected store." }, 400);
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return json({ error: "Server database is not configured." }, 503);
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const paidAt = new Date().toISOString();
    const record = {
      slug: invitation.slug, mode: invitation.mode, sender: invitation.sender, recipient: invitation.recipient,
      place: invitation.place, date: invitation.date, time: invitation.time, bring: invitation.bring,
      then: invitation.then, theme: invitation.theme, no_dodge: invitation.no_dodge,
      status: "pending", response_date: null, response_place: null, response_bring: null, response_then: null,
      is_paid: true, payment_order_id: String(order.id), paid_at: paidAt,
      expires_at: new Date(new Date(paidAt).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const { data: existing, error: lookupError } = await admin.from("invitations").select("payment_order_id").eq("slug", invitation.slug).maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) {
      if (existing.payment_order_id === String(order.id)) return json({ received: true, fulfilled: true, duplicate: true });
      return json({ error: "This invitation identifier has already been used." }, 409);
    }
    const { error } = await admin.from("invitations").insert(record);
    if (error) {
      console.error("Could not fulfill paid order", error);
      return json({ error: "Could not publish invitation." }, 500);
    }
    return json({ received: true, fulfilled: true });
  } catch (error) {
    console.error("Webhook processing failed", error);
    return json({ error: "Webhook processing failed." }, 400);
  }
});
