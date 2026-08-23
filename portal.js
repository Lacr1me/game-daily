const channelConfig = {
  civic: { manifest: "data/minsheng/index.json", fallback: "民生与科技每日35条精选", link: "minsheng/" },
  game: { manifest: "data/index.json", fallback: "今日游戏与方块世界", link: "game/" }
};

const isPublished = (edition) => new Date(edition.publishAt).getTime() <= Date.now();
const formatDate = (iso) => {
  const [year, month, day] = iso.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
};

async function hydrateChannel(name) {
  const config = channelConfig[name];
  const card = document.querySelector(`#${name}Card`);
  try {
    const manifest = await fetch(config.manifest, { cache: "no-store" }).then((response) => {
      if (!response.ok) throw new Error("归档索引暂时不可用");
      return response.json();
    });
    const edition = [...manifest.editions].filter(isPublished).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!edition) throw new Error("尚无已发布日报");
    document.querySelector(`#${name}Date`).textContent = formatDate(edition.date);
    document.querySelector(`#${name}Headline`).textContent = edition.headline || edition.title || config.fallback;
    document.querySelector(`#${name}Meta`).textContent = `第 ${edition.issue || 1} 期 · 北京时间 11:00 发布`;
    document.querySelector(`#${name}Link`).href = `${config.link}?date=${edition.date}`;
  } catch (error) {
    document.querySelector(`#${name}Date`).textContent = "暂时无法读取";
    document.querySelector(`#${name}Headline`).textContent = error.message;
    showToast("部分频道数据暂时不可用");
  } finally {
    card.setAttribute("aria-busy", "false");
  }
}

let toastTimer;
function showToast(message) {
  const toast = document.querySelector("#toast");
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

Promise.allSettled([hydrateChannel("civic"), hydrateChannel("game")]);
