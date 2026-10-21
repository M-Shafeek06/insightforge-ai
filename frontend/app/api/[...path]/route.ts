const BACKEND_URL =
  process.env.BACKEND_URL?.trim() || "http://127.0.0.1:8000";

async function proxy(request: Request, path: string[]) {
  const url = `${BACKEND_URL}/api/${path.join("/")}`;

  const headers = new Headers(request.headers);

  // Remove headers that should not be forwarded as-is.
  headers.delete("host");
  headers.delete("content-length");
  headers.delete("accept-encoding");

  const response = await fetch(url, {
    method: request.method,
    headers,
    body:
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await request.arrayBuffer(),
    cache: "no-store",
  });

  // Rebuild the response headers instead of forwarding potentially
  // incompatible compression and length metadata.
  const responseHeaders = new Headers(response.headers);

  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");
  responseHeaders.delete("transfer-encoding");
  responseHeaders.delete("connection");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  return proxy(request, path);
}