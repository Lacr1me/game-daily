// 面板数字全部来自真实来源：GoatCounter 计数与仓库里的归档清单。
const COUNTER_URL = 'https://springhues.goatcounter.com/counter/TOTAL.json';

function withTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal, credentials: 'omit' })
    .then((response) => {
      if (!response.ok) throw new Error('http ' + response.status);
      return response.json();
    })
    .finally(() => clearTimeout(timer));
}

function set(name, value) {
  const node = document.querySelector('[data-stat="' + name + '"]');
  if (node) node.textContent = value;
}

function count(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return number.toLocaleString('zh-CN');
}

function editions(list) {
  if (!list) return [];
  if (Array.isArray(list)) return list;
  return Array.isArray(list.editions) ? list.editions : [];
}

export async function loadStats() {
  const [counter, game, civic, works] = await Promise.allSettled([
    withTimeout(COUNTER_URL, 5000),
    withTimeout('data/index.json', 5000),
    withTimeout('data/minsheng/index.json', 5000),
    withTimeout('site/works.json', 5000)
  ]);

  let hasCounter = false;
  if (counter.status === 'fulfilled' && counter.value) {
    const visits = counter.value.count;
    const visitors = counter.value.count_unique;
    if (visits !== undefined) {
      set('visits', count(visits));
      hasCounter = true;
    }
    if (visitors !== undefined) set('visitors', count(visitors));
  }

  const gameList = game.status === 'fulfilled' ? editions(game.value) : [];
  const civicList = civic.status === 'fulfilled' ? editions(civic.value) : [];
  const total = gameList.length + civicList.length;
  if (total > 0) set('issues', count(total));

  const dates = [...gameList, ...civicList]
    .map((item) => (item && item.date ? String(item.date) : ''))
    .filter(Boolean)
    .sort();
  if (dates.length) set('updated', dates[dates.length - 1]);

  if (works.status === 'fulfilled' && works.value && Array.isArray(works.value.works)) {
    set('works', count(works.value.works.length));
  }

  return { counter: hasCounter };
}
