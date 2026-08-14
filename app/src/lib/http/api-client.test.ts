import { describe, expect, it, vi } from "vitest";
import { ApiClient } from "./api-client";
import { ApiError } from "./api-error";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ApiClient", () => {
  it("invoca o fetch armazenado com o contexto global do navegador", async () => {
    const fetcher = vi.fn(function (this: unknown) {
      expect(this).toBe(globalThis);
      return Promise.resolve(json({ ok: true }));
    });
    const client = new ApiClient("https://api.orbis.test", fetcher);

    await client.request("/health", { authenticated: false });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("envia bearer, credentials, JSON e AbortSignal", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({ ok: true }));
    const client = new ApiClient("https://api.orbis.test", fetcher);
    const controller = new AbortController();
    client.setAccessToken("access-token");

    await client.request("/tasks", {
      method: "POST",
      body: { title: "Teste" },
      signal: controller.signal,
    });

    const [, init] = fetcher.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer access-token");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(init?.credentials).toBe("include");
    expect(init?.body).toBe('{"title":"Teste"}');
    expect(init?.signal).toBe(controller.signal);
  });

  it("preserva o erro real da API", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        json(
          { error: { code: "CONFLICT", message: "Estado conflitante", details: { field: "x" } } },
          409,
        ),
      );
    const client = new ApiClient("https://api.orbis.test", fetcher);

    const request = client.request("/conflict", { authenticated: false });
    await expect(request).rejects.toMatchObject({
      status: 409,
      code: "CONFLICT",
      message: "Estado conflitante",
      details: { field: "x" },
    });
    await request.catch((error: unknown) => expect(error).toBeInstanceOf(ApiError));
  });

  it("envia FormData intacto sem Content-Type manual", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({ ok: true }));
    const client = new ApiClient("https://api.orbis.test", fetcher);
    client.setAccessToken("access-token");
    const body = new FormData();
    body.append("file", new Blob(["file"], { type: "application/pdf" }), "file.pdf");
    await client.request("/upload", { method: "POST", body });
    const [, init] = fetcher.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);
    expect(init?.body).toBe(body);
    expect(headers.get("Content-Type")).toBeNull();
    expect(headers.get("Authorization")).toBe("Bearer access-token");
    expect(init?.credentials).toBe("include");
  });

  it("retorna Blob e headers no caminho binário e preserva erro JSON", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("file", { headers: { "Content-Type": "text/plain" } }));
    const client = new ApiClient("https://api.orbis.test", fetcher);
    const controller = new AbortController();
    const result = await client.requestBlob("/file", { signal: controller.signal });
    expect(result.blob).toBeInstanceOf(Blob);
    expect(await result.blob.text()).toBe("file");
    expect(result.headers.get("Content-Type")).toContain("text/plain");
    expect(fetcher.mock.calls[0]?.[1]?.signal).toBe(controller.signal);

    fetcher.mockResolvedValueOnce(json({ error: { code: "FORBIDDEN", message: "Negado" } }, 403));
    await expect(client.requestBlob("/file")).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
      message: "Negado",
    });
  });

  it("envia bearer, credentials e AbortSignal no caminho binário", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(new Blob(["file"])));
    const client = new ApiClient("https://api.orbis.test", fetcher);
    const controller = new AbortController();
    client.setAccessToken("binary-access-token");

    await client.requestBlob("/file", { signal: controller.signal });

    const [, init] = fetcher.mock.calls[0] ?? [];
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer binary-access-token");
    expect(init?.credentials).toBe("include");
    expect(init?.signal).toBe(controller.signal);
  });

  it("renova uma vez e repete o request binário com o novo bearer", async () => {
    let refreshCalls = 0;
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      if (String(input).endsWith("/auth/refresh")) {
        refreshCalls += 1;
        expect(init?.credentials).toBe("include");
        return json({ accessToken: "renewed" });
      }
      return new Headers(init?.headers).get("Authorization") === "Bearer renewed"
        ? new Response("file")
        : json({}, 401);
    });
    const client = new ApiClient("https://api.orbis.test", fetcher);
    client.setAccessToken("expired");

    const result = await client.requestBlob("/file");

    expect(result.blob.size).toBe(4);
    expect(refreshCalls).toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("mantém refresh single-flight entre requests JSON e binários concorrentes", async () => {
    let refreshCalls = 0;
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      if (String(input).endsWith("/auth/refresh")) {
        refreshCalls += 1;
        await Promise.resolve();
        return json({ accessToken: "renewed" });
      }
      if (new Headers(init?.headers).get("Authorization") !== "Bearer renewed") {
        return json({}, 401);
      }
      return String(input).endsWith("/file") ? new Response("file") : json({ ok: true });
    });
    const client = new ApiClient("https://api.orbis.test", fetcher);
    client.setAccessToken("expired");

    await Promise.all([client.requestBlob("/file"), client.request("/tasks")]);

    expect(refreshCalls).toBe(1);
  });

  it("propaga ApiError e limpa a sessão quando o refresh binário falha", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) =>
      String(input).endsWith("/auth/refresh")
        ? json({ error: { code: "UNAUTHORIZED", message: "Refresh inválido" } }, 401)
        : json({}, 401),
    );
    const client = new ApiClient("https://api.orbis.test", fetcher);
    client.setAccessToken("expired");

    const request = client.requestBlob("/file");
    await expect(request).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });
    await request.catch((error: unknown) => expect(error).toBeInstanceOf(ApiError));
    expect(client.getAccessToken()).toBeNull();
  });

  it("propaga AbortError no caminho binário sem tentar refresh", async () => {
    const abortError = new DOMException("Aborted", "AbortError");
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(abortError);
    const client = new ApiClient("https://api.orbis.test", fetcher);
    client.setAccessToken("access-token");

    await expect(client.requestBlob("/file")).rejects.toBe(abortError);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("faz um único refresh para 401 concorrentes e repete cada request uma vez", async () => {
    let protectedCalls = 0;
    let refreshCalls = 0;
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) {
        refreshCalls += 1;
        await Promise.resolve();
        return json({ accessToken: "renewed" });
      }
      protectedCalls += 1;
      const authorization = new Headers(init?.headers).get("Authorization");
      return authorization === "Bearer renewed" ? json({ authorization }) : json({}, 401);
    });
    const client = new ApiClient("https://api.orbis.test", fetcher);
    client.setAccessToken("expired");

    const outputs = await Promise.all([
      client.request<{ authorization: string }>("/a"),
      client.request<{ authorization: string }>("/b"),
      client.request<{ authorization: string }>("/c"),
    ]);

    expect(refreshCalls).toBe(1);
    expect(protectedCalls).toBe(6);
    expect(outputs.every((output) => output.authorization === "Bearer renewed")).toBe(true);
  });

  it("limpa a sessão quando refresh falha", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) =>
      String(input).endsWith("/auth/refresh")
        ? json({ error: { code: "UNAUTHORIZED", message: "Inválido" } }, 401)
        : json({}, 401),
    );
    const client = new ApiClient("https://api.orbis.test", fetcher);
    const lost = vi.fn();
    client.setAccessToken("expired");
    client.onSessionLost(lost);

    await expect(client.request("/tasks")).rejects.toMatchObject({ status: 401 });
    expect(client.getAccessToken()).toBeNull();
    expect(lost).toHaveBeenCalledOnce();
  });

  it("não tenta um segundo refresh quando o retry também recebe 401", async () => {
    let refreshCalls = 0;
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      if (String(input).endsWith("/auth/refresh")) {
        refreshCalls += 1;
        return json({ accessToken: "renewed" });
      }
      return json({ error: { code: "UNAUTHORIZED", message: "Negado" } }, 401);
    });
    const client = new ApiClient("https://api.orbis.test", fetcher);
    client.setAccessToken("expired");

    await expect(client.request("/tasks")).rejects.toMatchObject({ status: 401 });
    expect(refreshCalls).toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(client.getAccessToken()).toBeNull();
  });

  it("não renova novamente para um 401 atrasado do token anterior", async () => {
    let refreshCalls = 0;
    const pendingResponses: Array<(response: Response) => void> = [];
    const fetcher = vi.fn<typeof fetch>((input, init) => {
      if (String(input).endsWith("/auth/refresh")) {
        refreshCalls += 1;
        return Promise.resolve(json({ accessToken: "renewed" }));
      }
      if (new Headers(init?.headers).get("Authorization") === "Bearer renewed") {
        return Promise.resolve(json({ ok: true }));
      }
      return new Promise((resolve) => pendingResponses.push(resolve));
    });
    const client = new ApiClient("https://api.orbis.test", fetcher);
    client.setAccessToken("expired");
    const first = client.request("/first");
    const late = client.request("/late");

    pendingResponses[0]?.(json({}, 401));
    await first;
    pendingResponses[1]?.(json({}, 401));
    await late;

    expect(refreshCalls).toBe(1);
  });
});
