import { NextResponse, type NextRequest } from "next/server";

/** HTTP Basic auth for the admin. Set ADMIN_USER and ADMIN_PASSWORD in .env.local. */
export function middleware(req: NextRequest) {
  const user = process.env.ADMIN_USER ?? "admin";
  const pass = process.env.ADMIN_PASSWORD;
  if (!pass) return new NextResponse("Admin is locked. Set ADMIN_PASSWORD in .env.local and restart.", { status: 503 });

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    const i = decoded.indexOf(":");
    if (decoded.slice(0, i) === user && decoded.slice(i + 1) === pass) return NextResponse.next();
  }
  return new NextResponse("Sign in to manage the store.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Store admin", charset="UTF-8"' },
  });
}

export const config = { matcher: ["/admin/:path*"] };
