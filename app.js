const state = { manifest: null, brief: null, activeDate: null };
const $ = (selector) => document.querySelector(selector);
const pad = (n) => String(n).padStart(2, "0");
const cnDate = (iso) => {
  const [y,m,d] = iso.split("-");
  return `${y}年${Number(m)}月${Number(d)}日`;
};
const safeImg = (src, alt) => `<img src="${src || ""}" alt="${alt}" loading="lazy" onerror="this.style.display='none';this.parentElement.classList.add('image-missing')">`;
const linkAttrs = (url, label) => `href="${url}" target="_blank" rel="noopener noreferrer" aria-label="${label}（打开原文）"`;

async function init() {
  try {
    const embedded = globalThis.__GAME_BRIEF_ARCHIVE__;
    state.manifest = embedded?.manifest || await fetch("data/index.json", { cache: "no-store" }).then(r => {
      if (!r.ok) throw new Error("无法读取归档索引");
      return r.json();
    });
    buildArchive();
    const requested = new URLSearchParams(location.search).get("date");
    const available = getPublishedEditions();
    const chosen = available.find(x => x.date === requested) || available[0];
    if (!chosen) throw new Error("11:00 后发布今日简报，请稍后再来");
    await loadBrief(chosen);
    scheduleEditionRefresh();
  } catch (error) {
    showToast(error.message, 5000);
  }
}

function nowInShanghai() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Shanghai" }));
}

function getPublishedEditions() {
  const now = Date.now();
  return [...state.manifest.editions]
    .filter(x => new Date(x.publishAt).getTime() <= now)
    .sort((a,b) => b.date.localeCompare(a.date));
}

async function loadBrief(edition) {
  const data = globalThis.__GAME_BRIEF_ARCHIVE__?.briefs?.[edition.date] || await fetch(edition.file, { cache: "no-store" }).then(r => {
    if (!r.ok) throw new Error("这期日报暂时无法读取");
    return r.json();
  });
  state.brief = data;
  state.activeDate = edition.date;
  render(data);
  const url = new URL(location.href);
  url.searchParams.set("date", edition.date);
  history.replaceState({}, "", url);
  $("#archiveDialog").close();
  scrollTo({ top: 0, behavior: "smooth" });
}

function render(b) {
  document.title = `${b.date} 游戏方块日报`;
  $("#editionLabel").textContent = `今日刊 · ${b.date} · 11:00 发布`;
  $("#dateLabel").textContent = cnDate(b.date);
  $("#coverDate").textContent = b.date.replaceAll("-", ".");
  $("#coverIssue").textContent = `NO. ${String(b.issue || 1).padStart(3,"0")}`;
  $("#features").innerHTML = b.features.map((x,i) => `
    <a class="feature-card ${i ? "green" : ""}" ${linkAttrs(x.url, x.title)}>
      ${safeImg(x.image, x.title)}
      <div class="feature-content"><span class="tag">${i ? "MINECRAFT" : "今日头条"}</span><span class="out-link">↗</span><h3>${x.title}</h3><p>${x.summary}</p><p class="feature-meta">${x.source} · ${x.date}</p></div>
    </a>`).join("");
  $("#newsList").innerHTML = b.news.map((x,i) => `
    <a class="news-row" ${linkAttrs(x.url, x.title)}><span class="rank">${pad(i+1)}</span>${safeImg(x.image,x.title)}<div><h3>${x.title}<span class="inline-link">↗</span></h3><p>${x.summary}</p><small>${x.source} · ${x.date}</small></div></a>`).join("");
  $("#packList").innerHTML = b.packs.map((x,i) => `
    <a class="pack-row" ${linkAttrs(x.url, x.name)}><span class="pack-rank">${pad(i+1)}</span>${safeImg(x.image,x.name)}<div><h3>${x.name}<span class="inline-link">↗</span></h3><p>${x.summary}</p><small>${x.category} · ${x.source}</small></div><span class="heat">${x.heat}<small>HEAT</small></span></a>`).join("");
  $("#modsList").innerHTML = b.mods.map(x => `
    <a class="mod-row" ${linkAttrs(x.url, x.name)}><div><b>${x.name} <span class="inline-link">↗</span></b><p>${x.version} · ${x.loader}</p></div><div>${x.summary}</div><div class="mod-meta">${x.date}<br>${x.source}</div></a>`).join("");
  $("#dealList").innerHTML = b.deals.map(x => `
    <a class="deal-row" ${linkAttrs(x.url, x.name)}>${safeImg(x.image,x.name)}<div><h3>${x.name}<span class="inline-link">↗</span></h3><p>${x.discount} · ${x.label} · ${x.ends}</p></div><div class="deal-price"><b>${x.price}</b><small><s>${x.original}</s></small></div></a>`).join("");
  $("#trendList").innerHTML = b.trends.map(x => `<li>${x}</li>`).join("");
  $("#dataWindow").textContent = b.dataWindow;
  $("#sourceSummary").textContent = `主要来源：${b.sources.join("、")}。检索截止 ${b.cutoff}。`;
}

function buildArchive() {
  const list = $("#archiveList");
  const editions = getPublishedEditions();
  list.innerHTML = editions.map(x => `<button class="archive-item" data-date="${x.date}" type="button"><time>${x.date}</time><b>${x.title}</b><span>→</span></button>`).join("");
  list.addEventListener("click", async (event) => {
    const button = event.target.closest(".archive-item");
    if (!button || button.dataset.date === state.activeDate) return $("#archiveDialog").close();
    const edition = editions.find(x => x.date === button.dataset.date);
    if (edition) await loadBrief(edition);
  });
}

function openArchive() { $("#archiveDialog").showModal(); }
$("#archiveButton").addEventListener("click", openArchive);
$("#dateTrigger").addEventListener("click", openArchive);
$("#closeArchive").addEventListener("click", () => $("#archiveDialog").close());
$("#archiveDialog").addEventListener("click", e => { if (e.target === $("#archiveDialog")) $("#archiveDialog").close(); });

function scheduleEditionRefresh() {
  const now = nowInShanghai();
  const next = new Date(now);
  next.setHours(11,0,3,0);
  if (now >= next) next.setDate(next.getDate()+1);
  const wait = Math.min(next.getTime()-now.getTime(), 2147483647);
  setTimeout(() => location.reload(), wait);
}

let toastTimer;
function showToast(message, duration=2600) {
  clearTimeout(toastTimer);
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), duration);
}

init();
