import { adminServiceConfigured, MESSAGE_CONFIG } from "../../message-config.js";
import { AdminAuth, AdminLogsApi, AdminMessagesApi, AdminRequestError } from "./client.js";

const loginPanel = document.querySelector("#loginPanel");
const loginForm = document.querySelector("#loginForm");
const loginStatus = document.querySelector("#loginStatus");
const dashboard = document.querySelector("#dashboard");
const sessionEmail = document.querySelector("#sessionEmail");
const logoutButton = document.querySelector("#logoutButton");
const adminTabs = document.querySelector("#adminTabs");
const filterBar = document.querySelector("#filterBar");
const queueStatus = document.querySelector("#queueStatus");
const list = document.querySelector("#adminMessageList");
const loadMore = document.querySelector("#adminLoadMore");
const websiteDateNav = document.querySelector("#websiteDateNav");
const websiteDateLatest = document.querySelector("#websiteDateLatest");
const websiteDateNewer = document.querySelector("#websiteDateNewer");
const websiteDateOlder = document.querySelector("#websiteDateOlder");
const websiteDateButtons = document.querySelector("#websiteDateButtons");
const WEBSITE_LOG_PAGE_SIZE = 7;

const configured = adminServiceConfigured();
const auth = configured ? new AdminAuth(MESSAGE_CONFIG) : null;
const api = configured ? new AdminMessagesApi(MESSAGE_CONFIG, auth) : null;
const logsApi = configured ? new AdminLogsApi(MESSAGE_CONFIG, auth) : null;
let activeStatus = "pending";
let nextCursor = null;
let loading = false;
let messagesLoaded = false;
const logStates = {
  website: createLogState("website_change", "#websiteChangesPanel", "#websiteChangesStatus", "#websiteChangesList"),
  maintenance: createLogState("maintenance", "#maintenancePanel", "#maintenanceStatus", "#maintenanceList", "#maintenanceLoadMore")
};
logStates.website.pages = [];
logStates.website.pageIndex = -1;

if (!configured) {
  loginForm.querySelector("button").disabled = true;
  setStatus(loginStatus, "后台登录尚未完成部署配置。", "error");
} else {
  auth.session().then((session) => session ? openDashboard(session) : showLogin()).catch((error) => showLogin(error.message));
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!configured) return;
  const button = loginForm.querySelector("button");
  button.disabled = true;
  setStatus(loginStatus, "正在登录…", "loading");
  try {
    const data = new FormData(loginForm);
    const session = await auth.signIn(data.get("email"), data.get("password"));
    loginForm.reset();
    await openDashboard(session);
  } catch (error) {
    setStatus(loginStatus, error?.message || "登录失败，请稍后重试。", "error");
  } finally {
    button.disabled = false;
  }
});

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;
  await auth.signOut();
  showLogin("已退出登录。");
  logoutButton.disabled = false;
});

adminTabs.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-tab]");
  if (button) activateTab(button.dataset.tab);
});

adminTabs.addEventListener("keydown", (event) => {
  if (!new Set(["ArrowLeft", "ArrowRight", "Home", "End"]).has(event.key)) return;
  const tabs = [...adminTabs.querySelectorAll('[role="tab"]')];
  const current = tabs.indexOf(document.activeElement);
  let next = current;
  if (event.key === "Home") next = 0;
  else if (event.key === "End") next = tabs.length - 1;
  else next = (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
  event.preventDefault();
  tabs[next].focus();
  activateTab(tabs[next].dataset.tab);
});

filterBar.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-status]");
  if (!button || button.dataset.status === activeStatus || loading) return;
  activeStatus = button.dataset.status;
  filterBar.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
  loadMessages({ reset: true });
});

loadMore.addEventListener("click", () => loadMessages());
websiteDateLatest.addEventListener("click", () => {
  if (logStates.website.pages.length) showWebsitePage(0);
  else loadWebsitePage({ reset: true });
});
websiteDateNewer.addEventListener("click", () => {
  if (logStates.website.pageIndex > 0) showWebsitePage(logStates.website.pageIndex - 1);
});
websiteDateOlder.addEventListener("click", () => loadOlderWebsitePage());

async function openDashboard(session) {
  loginPanel.hidden = true;
  dashboard.hidden = false;
  sessionEmail.textContent = session.user.email || "管理员";
  activateTab("website", { load: false });
  await loadWebsitePage({ reset: true });
}

function showLogin(message = "") {
  dashboard.hidden = true;
  loginPanel.hidden = false;
  list.replaceChildren();
  nextCursor = null;
  messagesLoaded = false;
  for (const state of Object.values(logStates)) resetLogState(state);
  setStatus(loginStatus, message, message ? "success" : "");
}

function activateTab(name, { load = true } = {}) {
  if (!new Set(["website", "maintenance", "messages"]).has(name)) return;
  adminTabs.querySelectorAll("button[data-tab]").forEach((button) => {
    const selected = button.dataset.tab === name;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
    document.querySelector(`#${button.getAttribute("aria-controls")}`).hidden = !selected;
  });
  if (!load) return;
  if (name === "messages" && !messagesLoaded) loadMessages({ reset: true });
  else if (name === "website" && !logStates.website.loaded) loadWebsitePage({ reset: true });
  else if (name === "maintenance" && !logStates.maintenance.loaded) loadLogs(logStates.maintenance, { reset: true });
}

async function loadMessages({ reset = false } = {}) {
  if (loading) return;
  loading = true;
  loadMore.disabled = true;
  if (reset) {
    list.replaceChildren();
    nextCursor = null;
  }
  setStatus(queueStatus, reset ? "正在读取审核队列…" : "正在读取更多留言…", "loading");
  try {
    const result = await api.list({ status: activeStatus, cursor: nextCursor, limit: 20 });
    result.items.forEach((item) => list.append(createMessageCard(item)));
    nextCursor = result.nextCursor;
    messagesLoaded = true;
    loadMore.hidden = !nextCursor;
    setStatus(queueStatus, list.children.length ? `共显示 ${list.children.length} 条留言` : "当前筛选下没有留言。", "success");
  } catch (error) {
    handleAdminError(error, queueStatus);
    loadMore.hidden = true;
  } finally {
    loading = false;
    loadMore.disabled = false;
  }
}

function createMessageCard(item) {
  const article = document.createElement("article");
  article.className = "admin-message-card";
  article.dataset.id = item.id;

  const heading = document.createElement("header");
  const identity = document.createElement("div");
  const nickname = document.createElement("h2");
  const createdAt = document.createElement("time");
  const badge = document.createElement("span");
  nickname.textContent = item.nickname;
  createdAt.dateTime = item.createdAt;
  createdAt.textContent = formatBeijingTime(item.createdAt);
  badge.className = `status-badge ${item.status}`;
  badge.textContent = statusLabel(item.status);
  identity.append(nickname, createdAt);
  heading.append(identity, badge);

  const content = document.createElement("p");
  content.className = "admin-message-content";
  content.textContent = item.content;

  const replyLabel = document.createElement("label");
  const replyTitle = document.createElement("span");
  const replyCounter = document.createElement("small");
  const textarea = document.createElement("textarea");
  replyTitle.textContent = "Springhues 回复";
  replyCounter.textContent = `${Array.from(item.reply?.content || "").length}/500`;
  textarea.maxLength = 500;
  textarea.rows = 4;
  textarea.value = item.reply?.content || "";
  textarea.addEventListener("input", () => { replyCounter.textContent = `${Array.from(textarea.value).length}/500`; });
  replyLabel.className = "admin-reply-field";
  replyLabel.append(replyTitle, replyCounter, textarea);

  const actions = document.createElement("div");
  actions.className = "admin-card-actions";
  actions.append(
    actionButton("保存回复", "primary", () => updateCard(article, { id: item.id, reply: textarea.value })),
    actionButton("撤回回复", "quiet", () => updateCard(article, { id: item.id, reply: null }), !item.reply),
    actionButton("批准", "approve", () => updateCard(article, { id: item.id, status: "approved" }), item.status === "approved"),
    actionButton("拒绝", "reject", () => updateCard(article, { id: item.id, status: "rejected" }), item.status === "rejected"),
    actionButton("恢复待审核", "quiet", () => updateCard(article, { id: item.id, status: "pending" }), item.status === "pending")
  );
  const cardStatus = document.createElement("p");
  cardStatus.className = "admin-status card-status";
  cardStatus.setAttribute("role", "status");
  cardStatus.setAttribute("aria-live", "polite");
  article.append(heading, content, replyLabel, actions, cardStatus);
  return article;
}

function createLogState(kind, panelSelector, statusSelector, listSelector, loadMoreSelector) {
  const state = {
    kind,
    panel: document.querySelector(panelSelector),
    status: document.querySelector(statusSelector),
    list: document.querySelector(listSelector),
    loadMore: loadMoreSelector ? document.querySelector(loadMoreSelector) : null,
    cursor: null,
    loading: false,
    loaded: false
  };
  state.loadMore?.addEventListener("click", () => loadLogs(state));
  return state;
}

function resetLogState(state) {
  state.list.replaceChildren();
  state.cursor = null;
  state.loading = false;
  state.loaded = false;
  if (state.loadMore) state.loadMore.hidden = true;
  if (state.kind === "website_change") {
    state.pages = [];
    state.pageIndex = -1;
    websiteDateButtons.replaceChildren();
    websiteDateNav.hidden = true;
  }
  setStatus(state.status, "", "");
}

async function loadLogs(state, { reset = false } = {}) {
  if (state.loading) return;
  state.loading = true;
  state.loadMore.disabled = true;
  if (reset) {
    state.list.replaceChildren();
    state.cursor = null;
  }
  setStatus(state.status, reset ? "正在读取日志…" : "正在读取更多日志…", "loading");
  try {
    const result = await logsApi.list({ kind: state.kind, cursor: state.cursor, limit: 20 });
    result.items.forEach((item) => state.list.append(createLogCard(item)));
    state.cursor = result.nextCursor;
    state.loaded = true;
    state.loadMore.textContent = "加载更多";
    state.loadMore.hidden = !state.cursor;
    setStatus(state.status, state.list.children.length ? `共显示 ${state.list.children.length} 条日志` : "目前没有日志。", "success");
  } catch (error) {
    handleAdminError(error, state.status);
    if (!(error instanceof AdminRequestError && error.status === 401)) {
      state.loadMore.textContent = "重试";
      state.loadMore.hidden = false;
    }
  } finally {
    state.loading = false;
    state.loadMore.disabled = false;
  }
}

async function loadWebsitePage({ reset = false, cursor = "" } = {}) {
  const state = logStates.website;
  if (state.loading) return;
  state.loading = true;
  setWebsiteNavigationBusy(true);
  if (reset) {
    state.list.replaceChildren();
    state.pages = [];
    state.pageIndex = -1;
  }
  setStatus(state.status, "正在读取日志…", "loading");
  try {
    const result = await logsApi.list({ kind: state.kind, cursor, limit: WEBSITE_LOG_PAGE_SIZE });
    const page = { items: result.items, cursor, nextCursor: result.nextCursor };
    if (reset) state.pages = [page];
    else state.pages.push(page);
    state.pageIndex = state.pages.length - 1;
    state.loaded = true;
    renderWebsitePage(page);
  } catch (error) {
    handleAdminError(error, state.status);
    if (!(error instanceof AdminRequestError && error.status === 401)) websiteDateNav.hidden = false;
  } finally {
    state.loading = false;
    setWebsiteNavigationBusy(false);
  }
}

function loadOlderWebsitePage() {
  const state = logStates.website;
  if (state.loading || state.pageIndex < 0) return;
  if (state.pageIndex < state.pages.length - 1) return showWebsitePage(state.pageIndex + 1);
  const cursor = state.pages[state.pageIndex]?.nextCursor;
  if (cursor) loadWebsitePage({ cursor });
}

function showWebsitePage(index) {
  const state = logStates.website;
  if (!state.pages[index]) return;
  state.pageIndex = index;
  renderWebsitePage(state.pages[index]);
}

function renderWebsitePage(page) {
  const state = logStates.website;
  state.list.replaceChildren();
  websiteDateButtons.replaceChildren();
  page.items.forEach((item, index) => {
    const date = beijingDateKey(item.occurredAt);
    state.list.append(createLogCard(item));
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = formatNavigationDate(date);
    button.dataset.date = date;
    button.setAttribute("aria-current", index === 0 ? "date" : "false");
    button.classList.toggle("active", index === 0);
    button.addEventListener("click", () => focusWebsiteLog(date, button));
    websiteDateButtons.append(button);
  });
  websiteDateNav.hidden = page.items.length === 0;
  websiteDateNewer.disabled = state.pageIndex === 0;
  websiteDateLatest.disabled = state.pageIndex === 0;
  websiteDateOlder.disabled = !page.nextCursor && state.pageIndex === state.pages.length - 1;
  setStatus(
    state.status,
    page.items.length ? `第 ${state.pageIndex + 1} 批，共显示 ${page.items.length} 天日志` : "目前没有日志。",
    "success"
  );
}

function focusWebsiteLog(date, selectedButton) {
  websiteDateButtons.querySelectorAll("button").forEach((button) => {
    const selected = button === selectedButton;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-current", selected ? "date" : "false");
  });
  const card = [...logStates.website.list.children].find((item) => item.dataset.logDate === date);
  if (!card) return;
  card.scrollIntoView({ behavior: "smooth", block: "start" });
  card.focus({ preventScroll: true });
}

function setWebsiteNavigationBusy(busy) {
  websiteDateNav.querySelectorAll("button").forEach((button) => { button.disabled = busy || button.disabled; });
  if (!busy && logStates.website.pages.length) {
    const page = logStates.website.pages[logStates.website.pageIndex];
    websiteDateNewer.disabled = logStates.website.pageIndex === 0;
    websiteDateLatest.disabled = logStates.website.pageIndex === 0;
    websiteDateOlder.disabled = !page?.nextCursor && logStates.website.pageIndex === logStates.website.pages.length - 1;
    websiteDateButtons.querySelectorAll("button").forEach((button) => { button.disabled = false; });
  } else if (!busy) {
    websiteDateLatest.disabled = false;
  }
}

function createLogCard(item) {
  const article = document.createElement("article");
  article.className = "admin-log-card";
  article.tabIndex = -1;
  if (item.kind === "website_change") article.dataset.logDate = beijingDateKey(item.occurredAt);

  const header = document.createElement("header");
  const identity = document.createElement("div");
  const title = document.createElement("h3");
  const time = document.createElement("time");
  const badge = document.createElement("span");
  title.textContent = item.title;
  time.dateTime = item.occurredAt;
  time.textContent = formatBeijingTime(item.occurredAt);
  badge.className = `log-status-badge ${item.status}`;
  badge.textContent = logStatusLabel(item.status);
  identity.append(title, time);
  header.append(identity);
  if (item.kind === "maintenance") header.append(badge);

  const summary = item.kind === "website_change" ? createLogItemList(item.summary) : document.createElement("p");
  summary.className = item.kind === "website_change" ? "admin-log-items" : "admin-log-summary";
  if (item.kind !== "website_change") summary.textContent = item.summary;

  article.append(header, summary);

  if (item.kind === "maintenance") {
    const source = document.createElement("p");
    source.className = "admin-log-source";
    source.textContent = `来源：${sourceLabel(item.source)}`;
    article.append(source);
  }

  if (item.kind === "maintenance" && item.metadata && Object.keys(item.metadata).length) {
    const details = document.createElement("details");
    const detailsTitle = document.createElement("summary");
    const content = document.createElement("pre");
    detailsTitle.textContent = "查看安全详情";
    content.textContent = JSON.stringify(item.metadata, null, 2);
    details.append(detailsTitle, content);
    article.append(details);
  }
  return article;
}

function createLogItemList(value) {
  const list = document.createElement("ul");
  const items = String(value || "").split(/\r?\n/u)
    .map((line) => line.replace(/^\s*[•*-]\s*/u, "").trim())
    .filter(Boolean);
  (items.length ? items : ["当天无修改"]).forEach((text) => {
    const item = document.createElement("li");
    item.textContent = text;
    list.append(item);
  });
  return list;
}

function actionButton(label, variant, action, disabled = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = variant;
  button.textContent = label;
  button.disabled = disabled;
  button.dataset.defaultDisabled = String(disabled);
  button.addEventListener("click", action);
  return button;
}

async function updateCard(article, input) {
  const status = article.querySelector(".card-status");
  setCardBusy(article, true);
  setStatus(status, "正在保存…", "loading");
  try {
    const result = await api.update(input);
    if (activeStatus !== "all" && result.item.status !== activeStatus) {
      article.remove();
      setStatus(queueStatus, list.children.length ? `共显示 ${list.children.length} 条留言` : "当前筛选下没有留言。", "success");
    } else {
      article.replaceWith(createMessageCard(result.item));
    }
  } catch (error) {
    setCardBusy(article, false);
    handleAdminError(error, status);
  }
}

function setCardBusy(article, busy) {
  article.setAttribute("aria-busy", String(busy));
  article.querySelectorAll("button, textarea").forEach((control) => {
    control.disabled = busy || control.dataset.defaultDisabled === "true";
  });
}

function handleAdminError(error, target) {
  if (error instanceof AdminRequestError && error.status === 401) {
    auth.clearSession();
    return showLogin(error.message);
  }
  setStatus(target, error?.message || "操作失败，请稍后重试。", "error");
}

function setStatus(element, message, state) {
  element.textContent = message;
  if (state) element.dataset.state = state; else delete element.dataset.state;
}

function statusLabel(status) {
  return { pending: "待审核", approved: "已批准", rejected: "已拒绝" }[status] || status;
}

function logStatusLabel(status) {
  return { info: "记录", success: "成功", warning: "警告", failure: "失败" }[status] || status;
}

function sourceLabel(source) {
  return {
    github_pages: "网站部署",
    nightly_summary: "夜间定稿",
    initial_import: "历史导入",
    health_check: "健康检查",
    daily_publish: "日报发布",
    publish_readiness: "发布准备",
    rerun: "失败补跑",
    data_correction: "数据修正",
    local_cleanup: "本地产物维护",
    daily_operations: "日报维护"
  }[source] || source;
}

function formatBeijingTime(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false
  }).format(new Date(value));
}

function beijingDateKey(value) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatNavigationDate(date) {
  const [, month, day] = date.split("-");
  return `${Number(month)}月${Number(day)}日`;
}
