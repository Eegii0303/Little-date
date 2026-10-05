import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders });
const themes = new Set(["midnight", "pastel", "rose", "minimal", "starlight"]);
const choices = new Set(["Flowers", "Something sweet", "A playlist", "Just me"]);
const activities = new Set(["Dessert", "Stargazing", "A drive", "Not going home"]);

function validText(value: unknown, max: number, required: true): value is string;
function validText(value: unknown, max: number, required?: false): value is string | null;
function validText(value: unknown, max: number, required = false): boolean {
  return (typeof value === "string" && value.trim().length <= max && (!required || value.trim().length > 0)) || (!required && value === null);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const { invitation } = await req.json();
    if (!invitation || typeof invitation !== "object") return json({ error: "Invitation draft is required." }, 400);
    const { slug, mode, sender, recipient, place, date, time, bring, then: activity, theme, no_dodge } = invitation;
    if (typeof slug !== "string" || !/^[a-f0-9]{20}$/.test(slug)) return json({ error: "Invalid invitation identifier." }, 400);
    if (!new Set(["custom", "surprise"]).has(mode)) return json({ error: "Invalid invitation type." }, 400);
    if (!validText(sender, 60, true) || !validText(recipient, 60, true) || !themes.has(theme) || typeof no_dodge !== "boolean") return json({ error: "Please check the invitation details." }, 400);
    if (mode === "custom" && (!validText(place, 100, true) || !validText(date, 10, true) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00.000Z`)) || new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date || !validText(time, 30, true) || !choices.has(bring) || !activities.has(activity))) return json({ error: "Please complete the custom date details." }, 400);
    const siteUrl = Deno.env.get("SITE_URL");
    const apiKey = Deno.env.get("LEMONSQUEEZY_API_KEY");
    const storeId = Deno.env.get("LEMONSQUEEZY_STORE_ID");
    const variantId = Deno.env.get("LEMONSQUEEZY_VARIANT_ID");
    if (!siteUrl || !apiKey || !storeId || !variantId) return json({ error: "Payment service is not configured yet." }, 503);
    const normalized = {
      slug, mode, sender: sender.trim(), recipient: recipient.trim(),
      place: mode === "custom" ? place.trim() : null,
      date: mode === "custom" ? date : null,
      time: mode === "custom" ? time.trim() : null,
      bring: mode === "custom" ? bring : null,
      then: mode === "custom" ? activity : null,
      theme, no_dodge, status: "pending", response_date: null,
      response_place: null, response_bring: null, response_then: null,
    };
    const redirect = `${siteUrl.replace(/\/$/, "")}/?payment=success&slug=${encodeURIComponent(slug)}`;
    
    console.log("Checkout custom field types:", {
      place: typeof String(normalized.place ?? ""),
      date: typeof String(normalized.date ?? ""),
      time: typeof String(normalized.time ?? ""),
      bring: typeof String(normalized.bring ?? ""),
      then: typeof String(normalized.then ?? ""),
    });

    const customData = {
      product: "little-date-invitation",
      slug: String(normalized.slug),
      mode: String(normalized.mode),
      sender: String(normalized.sender),
      recipient: String(normalized.recipient),
      place: String(normalized.place ?? ""),
      date: String(normalized.date ?? ""),
      time: String(normalized.time ?? ""),
      bring: String(normalized.bring ?? ""),
      then: String(normalized.then ?? ""),
      theme: String(normalized.theme),
      no_dodge: String(normalized.no_dodge),
    };

    console.log("CUSTOM DATA TYPES", Object.fromEntries(
      Object.entries(customData).map(([key, value]) => [key, typeof value])
    ));
    console.log("OUTGOING CHECKOUT CUSTOM:", JSON.stringify(customData));
    console.log("CHECKOUT CUSTOM DATA:", JSON.stringify(customData));
    console.log(
      "CHECKOUT CUSTOM TYPES:",
      Object.fromEntries(
        Object.entries(customData).map(([key, value]) => [key, typeof value])
      )
    );


    const checkoutResponse = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
      method: "POST",
      headers: { "Accept": "application/vnd.api+json", "Content-Type": "application/vnd.api+json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        data: {
          type: "checkouts",
          attributes: {
            checkout_options: { embed: false },
          checkout_data: {
            custom: customData,
          },
            test_mode: Deno.env.get("LEMONSQUEEZY_TEST_MODE") === "true",
            product_options: { enabled_variants: [Number(variantId)], redirect_url: redirect },
          },
          relationships: {
            store: { data: { type: "stores", id: String(storeId) } },
            variant: { data: { type: "variants", id: String(variantId) } },
          },
        },
      }),
    });
    const result = await checkoutResponse.json();
    if (!checkoutResponse.ok) {
      console.error("Lemon Squeezy checkout error", checkoutResponse.status, result);
      return json({ error: "Could not create checkout. Verify your Lemon Squeezy store and variant settings." }, 502);
    }
    const url = result?.data?.attributes?.url;
    if (typeof url !== "string" || !url.startsWith("https://")) return json({ error: "Payment provider returned an invalid checkout URL." }, 502);
    return json({ url });
  } catch (error) {
    console.error("create-checkout failed", error);
    return json({ error: "Unable to start checkout. Please try again." }, 400);
  }
});
