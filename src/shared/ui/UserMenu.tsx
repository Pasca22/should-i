"use client";

import { LogOut, MessageSquareText, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/shared/auth/client";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

/** The signed-in user's avatar; opens a menu with feedback, the admin page (admins only) and sign-out. */
export default function UserMenu() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  if (!session) return null;
  const { user } = session;

  async function signOut() {
    await authClient.signOut();
    // A full page load: drops all client state and lets the proxy send us to /login.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="rounded-full ring-2 ring-border transition hover:ring-primary focus-visible:ring-primary focus-visible:outline-none"
      >
        <Avatar size="lg">
          {user.image && <AvatarImage src={user.image} alt="" referrerPolicy="no-referrer" />}
          <AvatarFallback className="bg-muted text-sm font-semibold">{initials(user.name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-foreground">
            <div className="truncate text-sm font-semibold">{user.name}</div>
            <div className="truncate text-xs font-normal text-muted-foreground">{user.email}</div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/feedback")}>
          <MessageSquareText /> Send feedback
        </DropdownMenuItem>
        {user.isAdmin && (
          <DropdownMenuItem onClick={() => router.push("/admin")}>
            <ShieldCheck /> Beta admin
          </DropdownMenuItem>
        )}
        <DropdownMenuItem variant="destructive" onClick={signOut}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
