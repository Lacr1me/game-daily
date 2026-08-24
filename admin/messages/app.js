import { adminServiceConfigured, MESSAGE_CONFIG } from "../../message-config.js";
import { AdminAuth, AdminMessagesApi, AdminRequestError } from "./client.js";

const loginPanel = document.querySelector("#loginPanel");
const loginForm = document.querySelector("#loginForm");
const loginStatus = document.querySelector("#loginStatus");
const dashboard = document.querySelector("#dashboard");
const sessionEmail = document.querySelector("#sessionEmail");
const logoutButton = document.querySelector("#logoutButton");
const filterBar = document.querySelector("#filterBar");
const queueStatus = document.querySelector("#queueStatus");
const list = document.querySelector("#adminMessageList");
const loadMore = document.querySelector("#adminLoadMore");

const configured = adminServiceConfigured();
const auth = configured ? new AdminAuth(MESSAGE_CONFIG) : null;
const api = configured ? new AdminMessagesApi(MESSAGE_CONFIG, auth) : null;
let activeStatus = "pending";
let nextCursor = null;
let loading = false;

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
  await loadMessages({ reset: true });
}

function showLogin(message = "") {
  dashboard.hidden = true;
  loginPanel.hidden = false;
  list.replaceChildren();
  nextCursor = null;
  setStatus(loginStatus, message, message ? "success" : "");
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

function formatBeijingTime(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false
  }).format(new Date(value));
}
