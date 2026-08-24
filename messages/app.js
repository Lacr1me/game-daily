import { MESSAGE_CONFIG, messageServiceConfigured } from "../message-config.js";
import { bindMessageForm, formatBeijingTime, MessageApi } from "../message-client.js";

const form = document.querySelector("[data-message-form]");
const list = document.querySelector("#messageList");
const state = document.querySelector("#messageState");
const loadMore = document.querySelector("#loadMore");
const api = messageServiceConfigured() ? new MessageApi(MESSAGE_CONFIG) : null;
let nextCursor = null;
let loading = false;
const renderedIds = new Set();

document.querySelector("#beijingDate").textContent = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  month: "long",
  day: "numeric"
}).format(new Date());

bindMessageForm(form, { config: MESSAGE_CONFIG });

async function loadMessages({ reset = false } = {}) {
  if (!api || loading) return;
  loading = true;
  loadMore.disabled = true;
  state.textContent = reset ? "正在读取留言…" : "正在读取更多留言…";
  try {
    const result = await api.list({ cursor: reset ? "" : nextCursor, limit: 20 });
    if (reset) {
      list.replaceChildren();
      renderedIds.clear();
    }
    for (const item of result.items) {
      if (renderedIds.has(item.id)) continue;
      renderedIds.add(item.id);
      list.append(createMessage(item));
    }
    nextCursor = result.nextCursor;
    state.textContent = renderedIds.size ? `共显示 ${renderedIds.size} 条已审核留言` : "还没有公开留言，欢迎留下第一句话。";
    loadMore.hidden = !nextCursor;
    loadMore.dataset.mode = "more";
    loadMore.textContent = "加载更多";
  } catch (error) {
    state.textContent = error?.message || "留言暂时无法读取，请稍后重试。";
    loadMore.hidden = false;
    loadMore.dataset.mode = reset ? "retry-reset" : "retry-more";
    loadMore.textContent = "重新加载";
  } finally {
    loading = false;
    loadMore.disabled = false;
  }
}

function createMessage(item) {
  const article = document.createElement("article");
  article.className = "message-item";
  const header = document.createElement("header");
  const nickname = document.createElement("h3");
  const time = document.createElement("time");
  const content = document.createElement("p");
  nickname.textContent = item.nickname;
  time.dateTime = item.approvedAt;
  time.textContent = formatBeijingTime(item.approvedAt);
  content.textContent = item.content;
  header.append(nickname, time);
  article.append(header, content);
  return article;
}

loadMore.addEventListener("click", () => loadMessages({ reset: loadMore.dataset.mode === "retry-reset" }));

if (api) loadMessages({ reset: true });
else {
  state.textContent = "留言服务正在配置，公开留言将在配置完成后显示。";
  loadMore.hidden = true;
}
