import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/kcv/admin-dashboard";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export default async function AdminRoomPage({params}:{params:Promise<{roomId:string}>}){if(!hasSupabaseConfig())redirect("/admin");const supabase=await createSupabaseServerClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/admin/login");const{roomId}=await params;return <AdminDashboard roomId={roomId}/>}
