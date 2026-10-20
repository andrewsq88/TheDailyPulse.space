import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const allowedOrigins = new Set([
  "https://thedailypulse.space",
  "https://www.thedailypulse.space",
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allow = allowedOrigins.has(origin) ? origin : "https://www.thedailypulse.space";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
    "Vary": "Origin",
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function cleanField(value: string, max: number) {
  let cleaned = "";
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code > 31 && code !== 127) cleaned += char;
  }
  return cleaned.trim().slice(0, max);
}

interface SubscriptionRequest {
  name: string;
  email: string;
}

Deno.serve(async (req: Request) => {
  const headers = corsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers,
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
      }
    );
  }

  try {
    const { name, email }: SubscriptionRequest = await req.json();
    const safeName = typeof name === "string" ? cleanField(name, 200) : "";
    const safeEmail = typeof email === "string" ? cleanField(email, 320) : "";
    const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail);

    if (!safeName || !emailLooksValid) {
      return new Response(
        JSON.stringify({ error: "Name and a valid email are required" }),
        {
          status: 400,
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const emailBody = `
New Newsletter Subscription
============================

Name: ${safeName}
Email: ${safeEmail}
Subscribed at: ${new Date().toISOString()}

---
This is an automated notification from The Daily Pulse.
    `.trim();

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #f43f5e 0%, #be123c 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; }
    .info-row { margin: 10px 0; }
    .label { font-weight: bold; color: #e11d48; }
    .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>📰 New Newsletter Subscription</h2>
    </div>
    <div class="content">
      <div class="info-row">
        <span class="label">Name:</span> ${escapeHtml(safeName)}
      </div>
      <div class="info-row">
        <span class="label">Email:</span> ${escapeHtml(safeEmail)}
      </div>
      <div class="info-row">
        <span class="label">Subscribed at:</span> ${new Date().toLocaleString()}
      </div>
      <div class="footer">
        This is an automated notification from The Daily Pulse newsletter system.
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (resendApiKey) {
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: "The Daily Pulse <onboarding@resend.dev>",
          to: ["nextrendstudios@tuta.io"],
          subject: `New Newsletter Subscription: ${safeName}`,
          text: emailBody,
          html: emailHtml,
        }),
      });

      if (!emailResponse.ok) {
        console.error("Resend API error", emailResponse.status);
      }
    } else {
      console.log("RESEND_API_KEY not configured. Subscription notification was not sent.");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Subscription successful!"
      }),
      {
        status: 200,
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
      }
    );

  } catch {
    console.error("Error processing subscription");
    return new Response(
      JSON.stringify({ 
        error: "Failed to process subscription"
      }),
      {
        status: 500,
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
