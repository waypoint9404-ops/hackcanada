"use server";

import { auth0 } from "@/lib/auth0";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export async function updateProfile(formData: FormData) {
  const session = await auth0.getSession();
  if (!session) {
    redirect("/auth/login");
  }

  const name = formData.get("name") as string;
  const phone = formData.get("phone") as string;

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("users")
    .update({
      name: name || null,
      phone: phone || null,
      updated_at: new Date().toISOString(),
    })
    .eq("auth0_id", session.user.sub);

  if (error) {
    console.error("[updateProfile] Supabase update failed:", error.message);
    // In a real app, return the error to the form
  }

  redirect("/profile");
}
