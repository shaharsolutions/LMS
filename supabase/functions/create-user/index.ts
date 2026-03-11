import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

// הגדרת כותרות לפתרון בעיות CORS בקריאות מפרונט אנד
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // מענה לבקשת preflight של הדפדפן (CORS)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  try {
    // אתחול לקוח Supabase עזרת SERVICE_ROLE_KEY שיש לו הרשאות מלאות!
    // חשוב: מפתח זה אסור שיגיע לעולם לצד הלקוח (הדפדפן)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // משיכת הפרטים שנשלחו מהלקוח
    const { email, password, fullName, phone, role, orgId, callerId } = await req.json();

    // Verify caller has permissions
    const { data: callerData, error: callerError } = await supabaseAdmin
      .from("profiles")
      .select("role, org_id")
      .eq("id", callerId)
      .single();

    if (callerError || (callerData.role !== 'org_admin' && callerData.role !== 'super_admin')) {
       throw new Error("Unauthorized: Only admins can create users");
    }

    // 1. יצירת המשתמש בהגדרות האימות (Auth) של Supabase
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // חוסך שליחת מייל אישור
        phone: phone || undefined, // Optional
        user_metadata: { full_name: fullName, phone: phone, role: role, org_id: orgId },
      });

    if (authError) throw authError;

    // 2. עדכון או יצירת טבלת profiles הציבורית
    // (שימוש ב-upsert כדי להבטיח שהשורה תיווצר גם אם אין trigger במסד)
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: authData.user.id,
        email: email, // שמירת המייל לצורך תצוגה
        full_name: fullName,
        phone: phone || null,
        role: role,
        org_id: orgId,
      });

    if (profileError) throw profileError;

    return new Response(
      JSON.stringify({
        message: "המשתמש נוצר בהצלחה",
        user: { id: authData.user.id, email },
      }),
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
