import { customSessionClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { auth } from "./server";

/** Browser-side auth: sign in/out and the current session (including `user.isAdmin`). Talks to /api/auth. */
export const authClient = createAuthClient({ plugins: [customSessionClient<typeof auth>()] });
