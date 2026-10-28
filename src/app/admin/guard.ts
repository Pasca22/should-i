import { redirect } from "next/navigation";
import { getSession } from "@/shared/auth/server";
import { isAdmin } from "@/shared/beta";

/** For admin pages: not signed in → /login; signed in but not an admin → the app. */
export async function requireAdminPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!isAdmin(s.user.email)) redirect("/run");
  return s.user;
}
