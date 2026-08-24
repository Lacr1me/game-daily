const SESSION_KEY = "springhues-message-admin-session";

export class AdminRequestError extends Error {
  constructor(code, message, status = 0) {
    super(message);
    this.name = "AdminRequestError";
    this.code = code;
    this.status = status;
  }
}

export class AdminAuth {
  constructor(config, fetchImpl = globalThis.fetch.bind(globalThis)) {
    this.config = config;
    this.fetch = fetchImpl;
  }

  async signIn(email, password) {
    const response = await this.fetch(`${this.config.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: this.config.supabasePublishableKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email: String(email || "").trim(), password: String(password || "") })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.access_token || !data?.refresh_token) {
      throw new AdminRequestError("LOGIN_FAILED", "邮箱或密码不正确。", response.status);
    }
    return this.saveSession(data);
  }

  async session() {
    const current = this.readSession();
    if (!current) return null;
    if (current.expiresAt > Math.floor(Date.now() / 1000) + 60) return current;
    return this.refresh(current.refreshToken);
  }

  async refresh(refreshToken) {
    if (!refreshToken) return null;
    const response = await this.fetch(`${this.config.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: this.config.supabasePublishableKey, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.access_token || !data?.refresh_token) {
      this.clearSession();
      throw new AdminRequestError("SESSION_EXPIRED", "登录已过期，请重新登录。", 401);
    }
    return this.saveSession(data);
  }

  async authorizedFetch(url, options = {}, retry = true) {
    const session = await this.session();
    if (!session) throw new AdminRequestError("SESSION_REQUIRED", "请先登录后台。", 401);
    const response = await this.fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        apikey: this.config.supabasePublishableKey,
        Authorization: `Bearer ${session.accessToken}`,
        ...(options.headers || {})
      }
    });
    if (response.status === 401 && retry) {
      await this.refresh(session.refreshToken);
      return this.authorizedFetch(url, options, false);
    }
    return response;
  }

  async signOut() {
    const current = this.readSession();
    this.clearSession();
    if (!current?.accessToken) return;
    await this.fetch(`${this.config.supabaseUrl}/auth/v1/logout`, {
      method: "POST",
      headers: { apikey: this.config.supabasePublishableKey, Authorization: `Bearer ${current.accessToken}` }
    }).catch(() => null);
  }

  saveSession(data) {
    const session = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600),
      user: { id: data.user?.id || "", email: data.user?.email || "" }
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  readSession() {
    try {
      const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
      return session?.accessToken && session?.refreshToken ? session : null;
    } catch {
      this.clearSession();
      return null;
    }
  }

  clearSession() { sessionStorage.removeItem(SESSION_KEY); }
}

export class AdminMessagesApi {
  constructor(config, auth) {
    this.endpoint = `${config.apiBaseUrl}/manage-messages`;
    this.auth = auth;
  }

  async list({ status = "pending", cursor = "", limit = 20 } = {}) {
    const url = new URL(this.endpoint);
    url.searchParams.set("status", status);
    url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 50)));
    if (cursor) url.searchParams.set("cursor", cursor);
    return parseResponse(await this.auth.authorizedFetch(url, { cache: "no-store" }));
  }

  async update(input) {
    return parseResponse(await this.auth.authorizedFetch(this.endpoint, {
      method: "PATCH",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    }));
  }
}

async function parseResponse(response) {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = data?.error || {};
    throw new AdminRequestError(error.code || "REQUEST_FAILED", error.message || "请求失败，请稍后重试。", response.status);
  }
  return data || {};
}
