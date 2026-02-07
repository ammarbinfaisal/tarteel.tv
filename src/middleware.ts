import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    const authHeader = request.headers.get("authorization");

    if (authHeader) {
      const auth = authHeader.split(" ")[1];
      const decoded = atob(auth);
      const [user, pwd] = decoded.split(":");

      if (
        user === process.env.ADMIN_USERNAME &&
        pwd === process.env.ADMIN_PASSWORD
      ) {
        return NextResponse.next();
      }
    }

    return new NextResponse("Unauthorized", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Admin Access"',
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
