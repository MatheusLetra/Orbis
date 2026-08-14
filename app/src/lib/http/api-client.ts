import { ApiError } from "./api-error";

interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
  };
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  authenticated?: boolean;
}

export interface BinaryResponse {
  blob: Blob;
  headers: Headers;
}

interface RefreshResponse {
  accessToken: string;
}

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

export class ApiClient {
  private accessToken: string | null = null;
  private refreshPromise: Promise<string> | null = null;
  private sessionLostListeners = new Set<() => void>();

  constructor(
    private readonly baseUrl = API_URL,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  onSessionLost(listener: () => void): () => void {
    this.sessionLostListeners.add(listener);
    return () => this.sessionLostListeners.delete(listener);
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const authenticated = options.authenticated ?? true;
    const tokenUsed = this.accessToken;
    const response = await this.send(path, options, authenticated);
    if (response.status === 401 && authenticated) {
      if (this.accessToken === tokenUsed) await this.refresh();
      const retry = await this.send(path, options, true);
      if (retry.status === 401) this.loseSession();
      return this.parse<T>(retry);
    }
    return this.parse<T>(response);
  }

  async requestBlob(path: string, options: RequestOptions = {}): Promise<BinaryResponse> {
    const authenticated = options.authenticated ?? true;
    const tokenUsed = this.accessToken;
    const response = await this.send(path, options, authenticated);
    if (response.status === 401 && authenticated) {
      if (this.accessToken === tokenUsed) await this.refresh();
      const retry = await this.send(path, options, true);
      if (retry.status === 401) this.loseSession();
      return this.parseBlob(retry);
    }
    return this.parseBlob(response);
  }

  refresh(): Promise<string> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.performRefresh().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  private async performRefresh(): Promise<string> {
    try {
      const response = await this.send("/auth/refresh", { method: "POST" }, false);
      const output = await this.parse<RefreshResponse>(response);
      this.accessToken = output.accessToken;
      return output.accessToken;
    } catch (error) {
      this.loseSession();
      throw error;
    }
  }

  private loseSession(): void {
    this.accessToken = null;
    for (const listener of this.sessionLostListeners) listener();
  }

  private send(path: string, options: RequestOptions, authenticated: boolean): Promise<Response> {
    const headers = new Headers(options.headers);
    const isFormDataBody = options.body instanceof FormData;
    const requestBody =
      options.body === undefined || isFormDataBody
        ? (options.body as BodyInit | undefined)
        : JSON.stringify(options.body);
    if (options.body !== undefined && !isFormDataBody)
      headers.set("Content-Type", "application/json");
    if (authenticated && this.accessToken) {
      headers.set("Authorization", `Bearer ${this.accessToken}`);
    }
    return this.fetcher.call(globalThis, `${this.baseUrl}${path}`, {
      ...options,
      body: requestBody,
      credentials: "include",
      headers,
    });
  }

  private async parse<T>(response: Response): Promise<T> {
    const text = await response.text();
    const payload = text ? (JSON.parse(text) as T | ApiErrorPayload) : undefined;
    if (!response.ok) {
      const error = (payload as ApiErrorPayload | undefined)?.error;
      throw new ApiError({
        status: response.status,
        code: error?.code ?? "HTTP_ERROR",
        message: error?.message ?? `Erro HTTP ${response.status}`,
        details: error?.details,
      });
    }
    return payload as T;
  }

  private async parseBlob(response: Response): Promise<BinaryResponse> {
    if (!response.ok) {
      await this.parse<unknown>(response);
    }
    const bytes = await response.arrayBuffer();
    return {
      blob: new Blob([bytes], { type: response.headers.get("Content-Type") ?? "" }),
      headers: response.headers,
    };
  }
}

export const apiClient = new ApiClient();
