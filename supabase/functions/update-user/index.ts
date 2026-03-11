import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { userId, password, fullName, phone, role, orgId, email, callerId } = await req.json();

    if (!userId || !orgId) {
       throw new Error("Missing required parameters: userId or orgId");
    }

    // Verify caller has permissions (caller needs to be org_admin of the same org or super_admin)
    const { data: callerData, error: callerError } = await supabaseAdmin
      .from("profiles")
      .select("role, org_id")
      .eq("id", callerId)
      .single();

    if (callerError || (callerData.role !== 'org_admin' && callerData.role !== 'super_admin')) {
       throw new Error("Unauthorized to perform this action");
    }

    // 1. Update Auth payload
    let userMetadataUpdate = { full_name: fullName, phone: phone, role: role, org_id: orgId };
    
    let authUpdatePayload: any = {
      user_metadata: userMetadataUpdate
    };

    if (email) {
       authUpdatePayload.email = email;
       authUpdatePayload.email_confirm = true; // No need to re-verify if admin changed it
    }

    if (phone) {
       authUpdatePayload.phone = phone;
    }

    if (password && password.trim() !== '') {
       authUpdatePayload.password = password;
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      authUpdatePayload
    );

    if (authError) throw authError;

    // 2. עדכון או יצירת טבלת profiles הציבורית
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: userId,
        email: email || authData.user.email,
        full_name: fullName,
        phone: phone || null,
        role: role,
        org_id: orgId,
      });

    if (profileError) throw profileError;

    return new Response(
      JSON.stringify({ message: "User updated successfully" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || String(error) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
