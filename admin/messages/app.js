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

const configured = adminServiceConfigured();
const auth = configured ? new AdminAuth(MESSAGE_CONFIG) : null;
const api = configured ? new AdminMessagesApi(MESSAGE_CONFIG, auth) : null;
const logsApi = configured ? new AdminLogsApi(MESSAGE_CONFIG, auth) : null;
let activeStatus = "pending";
let nextCursor = null;
let loading = false;
const logStates = {
  website: createLogState("website_change", "#websiteChangesPanel", "#websiteChangesStatus", "#websiteChangesList", "#websiteChangesLoadMore"),
  maintenance: createLogState("maintenance", "#maintenancePanel", "#maintenanceStatus", "#maintenanceList", "#maintenanceLoadMore")
};

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

async function openDashboard(session) {
  loginPanel.hidden = true;
  dashboard.hidden = false;
  sessionEmail.textContent = session.user.email || "管理员";
  activateTab("messages", { load: false });
  await loadMessages({ reset: true });
}

function showLogin(message = "") {
  dashboard.hidden = true;
  loginPanel.hidden = false;
  list.replaceChildren();
  nextCursor = null;
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
  if (load && name !== "messages" && !logStates[name].loaded) loadLogs(logStates[name], { reset: true });
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
    loadMore: document.querySelector(loadMoreSelector),
    cursor: null,
    loading: false,
    loaded: false
  };
  state.loadMore.addEventListener("click", () => loadLogs(state));
  return state;
}

function resetLogState(state) {
  state.list.replaceChildren();
  state.cursor = null;
  state.loading = false;
  state.loaded = false;
  state.loadMore.hidden = true;
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

function createLogCard(item) {
  const article = document.createElement("article");
  article.className = "admin-log-card";

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
  header.append(identity, badge);

  const summary = document.createElement("p");
  summary.className = "admin-log-summary";
  summary.textContent = item.summary;

  const source = document.createElement("p");
  source.className = "admin-log-source";
  source.textContent = `来源：${sourceLabel(item.source)}`;
  article.append(header, summary, source);

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
