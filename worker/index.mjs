// Personal API responses must never enter the edge cache.
export async function handle(request, env, upstream = fetch) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
  let origin;
  try {
    origin = new URL(env.AZURE_API_ORIGIN);
    if (
      origin.protocol !== "https:" ||
      origin.username ||
      origin.password ||
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash
    )
      throw new Error();
  } catch {
    return Response.json(
      {
        error: { code: "BACKEND_NOT_CONFIGURED", message: "服务尚未配置完成" },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  const target = new URL(origin);
  target.pathname = url.pathname;
  target.search = url.search;
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("forwarded");
  headers.delete("x-forwarded-for");
  headers.delete("x-forwarded-host");
  headers.delete("x-forwarded-proto");
  try {
    const result = await upstream(
      new Request(target, {
        method: request.method,
        headers,
        body: ["GET", "HEAD"].includes(request.method)
          ? undefined
          : request.body,
        redirect: "manual",
        duplex: "half",
      }),
      { cache: "no-store" },
    );
    const response = new Response(result.body, result);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("CDN-Cache-Control", "no-store");
    return response;
  } catch {
    return Response.json(
      {
        error: {
          code: "BACKEND_UNAVAILABLE",
          message: "服务暂时不可用，请稍后重试",
        },
      },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
export default {
  fetch(request, env) {
    return handle(request, env);
  },
};
