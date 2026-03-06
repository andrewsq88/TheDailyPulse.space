import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SubscriptionRequest {
  name: string;
  email: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { name, email }: SubscriptionRequest = await req.json();

    if (!name || !email) {
      return new Response(
        JSON.stringify({ error: "Name and email are required" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const emailBody = `
New Newsletter Subscription
============================

Name: ${name}
Email: ${email}
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
        <span class="label">Name:</span> ${name}
      </div>
      <div class="info-row">
        <span class="label">Email:</span> ${email}
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
          subject: `New Newsletter Subscription: ${name}`,
          text: emailBody,
          html: emailHtml,
        }),
      });

      if (!emailResponse.ok) {
        const errorData = await emailResponse.text();
        console.error("Resend API error:", errorData);
      }
    } else {
      console.log("RESEND_API_KEY not configured. Email would be sent to: nextrendstudios@tuta.io");
      console.log("Subscription details:", { name, email });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Subscription successful!"
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );

  } catch (error) {
    console.error("Error processing subscription:", error);
    return new Response(
      JSON.stringify({ 
        error: "Failed to process subscription",
        details: error.message 
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
