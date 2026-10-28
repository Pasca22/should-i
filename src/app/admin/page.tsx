import { Suspense } from "react";
import AdminContent from "./AdminContent";

export default function AdminPage() {
  // The session is read per request, so this part streams in after the static shell.
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading the beta list…</p>}>
      <AdminContent />
    </Suspense>
  );
}
