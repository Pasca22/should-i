import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/shared/auth/server";

// Better Auth's endpoints: sign-in, the Google callback (/api/auth/callback/google), session, sign-out.
export const { GET, POST } = toNextJsHandler(auth);
