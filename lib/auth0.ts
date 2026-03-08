import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { NextResponse } from "next/server";

export const auth0 = new Auth0Client({
  authorizationParameters: {
    scope: "openid profile email",
  },

  async onCallback(error, context, session) {
    if (error) {
      console.error("[Auth0] Authentication error:", error);
      return NextResponse.redirect(
        new URL("/?error=auth_failed", process.env.APP_BASE_URL)
      );
    }

    // session is guaranteed here for successful logins
    if (session) {
      console.log(
        `[Auth0] User ${session.user.sub} authenticated via ${session.user.sub.split("|")[0]}`
      );
    }

    return NextResponse.redirect(
      new URL(context.returnTo || "/dashboard", process.env.APP_BASE_URL)
    );
  },
});
