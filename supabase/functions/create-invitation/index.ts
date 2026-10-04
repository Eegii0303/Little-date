
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let photoPathToCleanup: string | null = null;

  let cleanupUploadedPhoto: (() => Promise<void>) | null = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Server configuration error" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    
    cleanupUploadedPhoto = async () => {
      if (!photoPathToCleanup) return;

      try {
        const photoSlug = photoPathToCleanup.split("/")[0];

        // Do not remove a photo if an invitation with this slug exists.
        const { data: existing, error: checkError } = await supabase
          .from("invitations")
          .select("slug")
          .eq("slug", photoSlug)
          .maybeSingle();

        if (checkError) {
          console.error("Photo cleanup check failed:", checkError.message);
          return;
        }

        if (existing) return;

        const { error: cleanupError } = await supabase.storage
          .from("invitation-photos")
          .remove([photoPathToCleanup]);

        if (cleanupError) {
          console.error("Photo cleanup failed:", cleanupError.message);
        }
      } catch (cleanupError) {
        console.error("Unexpected photo cleanup error:", cleanupError);
      }
    };

    // Read the client IP from the Supabase gateway header.
    const forwardedFor = req.headers.get("x-forwarded-for");
    if (!forwardedFor) {
      return jsonResponse({ error: "Unable to identify request source" }, 400);
    }

    const clientIp = forwardedFor.split(",")[0].trim();
    if (!clientIp || clientIp.length > 100) {
      return jsonResponse({ error: "Invalid request source" }, 400);
    }

    // Hash the IP so the raw address is not stored in the rate-limit table.
    const clientKey = await sha256(clientIp);

    // Allow up to 5 invitation requests per hour per client key.
    const { data: allowed, error: rateError } = await supabase.rpc(
      "check_invitation_rate_limit",
      {
        p_client_key: clientKey,
        p_limit: 5,
        p_window_seconds: 3600,
      },
    );

    if (rateError) {
      console.error("Rate limit check failed:", rateError.message);
      return jsonResponse({ error: "Request check failed" }, 500);
    }

    if (allowed !== true) {
      return jsonResponse(
        { error: "Too many requests. Please try again later." },
        429,
      );
    }

    const body = await req.json();

    
    if (body.action === "create-upload-url") {
      const { p_slug, p_content_type } = body;

      const extensions: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
      };

      if (
        typeof p_slug !== "string" ||
        !/^[a-zA-Z0-9-]{6,80}$/.test(p_slug) ||
        typeof p_content_type !== "string" ||
        !extensions[p_content_type]
      ) {
        return jsonResponse({ error: "Invalid upload request" }, 400);
      }

      const filePath =
        `${p_slug}/${crypto.randomUUID()}.${extensions[p_content_type]}`;

      const { data: uploadData, error: uploadError } =
        await supabase.storage
          .from("invitation-photos")
          .createSignedUploadUrl(filePath);

      if (uploadError || !uploadData) {
        console.error("Signed upload URL error:", uploadError?.message);
        return jsonResponse({ error: "Could not prepare image upload" }, 500);
      }

      return jsonResponse({
        success: true,
        path: uploadData.path,
        token: uploadData.token,
      });
    }

    const {
      p_slug,
      p_manage_token_hash,
      p_their_name,
      p_your_name,
      p_message,
      p_theme,
      p_date_text,
      p_time_text,
      p_location,
      p_place_name,
      p_photo_path,
      p_no_button_mode,
    } = body;

    const noButtonMode = p_no_button_mode ?? "runaway";

    if (noButtonMode !== "runaway" && noButtonMode !== "clickable") {
      return jsonResponse({ error: "Invalid NO button mode" }, 400);
    }

    // Validate the same fields as the secure database function.
    if (
      typeof p_slug !== "string" ||
      !/^[a-zA-Z0-9-]{6,80}$/.test(p_slug) ||
      typeof p_manage_token_hash !== "string" ||
      !/^[a-f0-9]{64}$/.test(p_manage_token_hash) ||
      typeof p_their_name !== "string" ||
      !p_their_name.trim() ||
      p_their_name.length > 100 ||
      (p_your_name !== null && p_your_name !== undefined &&
        (typeof p_your_name !== "string" || p_your_name.length > 100)) ||
      typeof p_message !== "string" ||
      !p_message.trim() ||
      p_message.length > 3000 ||
      typeof p_theme !== "string" ||
      !p_theme.trim() ||
      p_theme.length > 50 ||
      typeof p_date_text !== "string" ||
      !p_date_text.trim() ||
      p_date_text.length > 100 ||
      typeof p_time_text !== "string" ||
      !p_time_text.trim() ||
      p_time_text.length > 50 ||
      typeof p_location !== "string" ||
      !p_location.trim() ||
      p_location.length > 300 ||
      (p_place_name !== null && p_place_name !== undefined &&
        (typeof p_place_name !== "string" || p_place_name.length > 150))
    ) {
      return jsonResponse({ error: "Invalid invitation data" }, 400);
    }

    
    if (
      p_photo_path !== null &&
      p_photo_path !== undefined &&
      (
        typeof p_photo_path !== "string" ||
        !new RegExp(
          `^${p_slug}/[a-f0-9-]{36}\\.(jpg|png|webp)$`
        ).test(p_photo_path)
      )
    ) {
      return jsonResponse({ error: "Invalid photo path" }, 400);
    }

    photoPathToCleanup = p_photo_path || null;

    const photoUrl = p_photo_path
      ? supabase.storage
          .from("invitation-photos")
          .getPublicUrl(p_photo_path).data.publicUrl
      : null;

    const { data, error } = await supabase.rpc("create_invitation_secure", {
      p_slug,
      p_manage_token_hash,
      p_their_name: p_their_name.trim(),
      p_your_name: p_your_name?.trim() || null,
      p_message: p_message.trim(),
      p_theme,
      p_date_text: p_date_text.trim(),
      p_time_text: p_time_text.trim(),
      p_location: p_location.trim(),
      p_place_name: p_place_name?.trim() || null,
      p_photo_url: photoUrl,
      p_no_button_mode: noButtonMode,
    });

    if (error) {
      console.error("Invitation creation failed:", error.message);

      await cleanupUploadedPhoto?.();

      return jsonResponse(
        { error: "Could not create invitation" },
        400,
      );
    }

    return jsonResponse({ success: true, data });
  } catch (error) {
    console.error("Unexpected function error:", error);

    await cleanupUploadedPhoto?.();

    return jsonResponse({ error: "Invalid request" }, 400);
  }
});