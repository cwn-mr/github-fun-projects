#!/usr/bin/env node
/**
 * 用 data/live.json + data/curated.json 生成自包含的 index.html：
 * - 全部项目卡片预渲染进 HTML（搜索引擎 / 无 JS 环境可见）
 * - 内嵌 CSS + 少量增强 JS（搜索、分类、语言筛选、排序、暗色模式）
 *
 * 用法：node tools/build.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const curated = JSON.parse(readFileSync(join(root, "data", "curated.json"), "utf8"));
const live = JSON.parse(readFileSync(join(root, "data", "live.json"), "utf8"));

const catById = Object.fromEntries(curated.categories.map((c) => [c.id, c]));
const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

const fmtStar = (n) => (n >= 1000 ? Math.round(n / 100) / 10 + "k" : String(n));
const fmtWan = (n) => (n >= 10000 ? Math.round(n / 1000) / 10 + "万" : String(n));

const LANG_COLORS = {
  JavaScript: "#f1e05a", TypeScript: "#3178c6", Python: "#3572A5",
  Go: "#00ADD8", Rust: "#dea584", C: "#555555", "C++": "#f34b7d",
  Ruby: "#701516", Java: "#b07219", Shell: "#89e051", HTML: "#e34c26",
  CSS: "#563d7c", SCSS: "#c6538c", Vue: "#41b883", Dart: "#00B4AB",
  "Jupyter Notebook": "#DA5B0B", Lua: "#000080", Zig: "#ec915c", MDX: "#fcb32c",
};
const langColor = (l) => LANG_COLORS[l] || "#8b949e";

// 组装项目数据（按 star 降序为默认顺序）
const projects = live.projects
  .map((p) => {
    const cat = catById[p.category] || {};
    const updated = (p.pushed_at || "").slice(0, 7); // YYYY-MM
    const search = [
      p.full_name, p.desc, p.description, p.language, cat.name,
      ...(p.tags || []), ...(p.topics || []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return { ...p, cat, updated, search };
  })
  .sort((a, b) => b.stargazers_count - a.stargazers_count);

const totalStars = projects.reduce((s, p) => s + p.stargazers_count, 0);
const fetchedDate = live.fetched_at.slice(0, 10);

// ---------- 卡片 ----------
function cardHTML(p) {
  const tags = (p.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("");
  const home = p.homepage && /^https?:\/\//.test(p.homepage)
    ? `<a class="demo" href="${escapeHtml(p.homepage)}" target="_blank" rel="noopener">在线体验 ↗</a>` : "";
  const lang = p.language
    ? `<span class="lang"><i style="background:${langColor(p.language)}"></i>${escapeHtml(p.language)}</span>` : "";
  return `<article class="card" data-cat="${p.category}" data-lang="${escapeHtml(p.language || "")}"
  data-stars="${p.stargazers_count}" data-name="${escapeHtml(p.full_name.toLowerCase())}"
  data-pushed="${p.pushed_at || ""}" data-search="${escapeHtml(p.search)}">
  <div class="card-top">
    <span class="cat-chip">${p.cat.emoji || "✨"} ${escapeHtml(p.cat.name || "")}</span>
    ${p.archived ? '<span class="archived">已归档</span>' : ""}
    <span class="stars" title="${p.stargazers_count.toLocaleString("en")} stars">★ ${fmtStar(p.stargazers_count)}</span>
  </div>
  <h3 class="repo-name">
    <a href="${p.html_url}" target="_blank" rel="noopener">${escapeHtml(p.full_name)}</a>
  </h3>
  <p class="desc">${escapeHtml(p.desc)}</p>
  <div class="tags">${tags}</div>
  <div class="meta">
    ${lang}
    <span class="updated" title="最近一次推送">${p.updated}</span>
    <span class="links">
      <a href="${p.html_url}" target="_blank" rel="noopener">GitHub ↗</a>${home}
    </span>
  </div>
</article>`;
}

// ---------- 分类 chips ----------
const catCounts = {};
for (const p of projects) catCounts[p.category] = (catCounts[p.category] || 0) + 1;
const chipsHTML =
  `<button class="chip active" data-cat="all">全部 <b>${projects.length}</b></button>` +
  curated.categories
    .map((c) => `<button class="chip" data-cat="${c.id}" title="${escapeHtml(c.blurb || "")}">${c.emoji} ${c.name} <b>${catCounts[c.id] || 0}</b></button>`)
    .join("");

// ---------- 语言下拉 ----------
const langSet = [...new Set(projects.map((p) => p.language).filter(Boolean))].sort();
const langOptions =
  `<option value="all">全部语言</option>` +
  langSet.map((l) => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join("");

// ---------- JSON-LD ----------
const jsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: curated.site.title,
  description: curated.site.subtitle,
  numberOfItems: projects.length,
  itemListElement: projects.map((p, i) => ({
    "@type": "ListItem", position: i + 1, name: p.full_name, url: p.html_url,
  })),
});

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(curated.site.title)} · 小而美开源项目精选导航</title>
<meta name="description" content="${escapeHtml(curated.site.subtitle)}。收录终端玩具、命令行神器、网页小游戏、微型 JS 库、学习宝库与中文开发者宝藏，支持即时搜索与筛选。">
<meta name="keywords" content="GitHub,小项目,开源项目,开源,好玩的项目,小而美,命令行工具,网页游戏,开源导航">
<meta name="robots" content="index,follow">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(curated.site.title)} · 小而美开源项目精选">
<meta property="og:description" content="${escapeHtml(curated.site.subtitle)}，所有人可搜索、可分享。">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎁</text></svg>">
<script type="application/ld+json">${jsonLd}</script>
<style>
:root{
  --bg:#f6f7fb; --card:#ffffff; --border:#e5e7eb; --text:#1f2328; --sub:#656d76;
  --accent:#5b5bd6; --accent2:#db2777; --chipbg:#ffffff; --shadow:0 8px 24px rgba(31,35,40,.09);
  --input:#ffffff;
}
[data-theme="dark"]{
  --bg:#0d1117; --card:#161b22; --border:#30363d; --text:#e6edf3; --sub:#8b949e;
  --chipbg:#161b22; --shadow:0 8px 24px rgba(0,0,0,.4); --input:#0d1117;
}
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",sans-serif;background:var(--bg);color:var(--text);line-height:1.6;transition:background .25s,color .25s}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}
.container{max-width:1120px;margin:0 auto;padding:0 20px}

/* ---------- 顶部 ---------- */
.topbar{display:flex;justify-content:space-between;align-items:center;padding:14px 0}
.topbar .src{font-size:14px;color:var(--sub)}
.hero{text-align:center;padding:36px 0 10px}
.hero h1{font-size:clamp(26px,4.5vw,40px);margin:0 0 8px;font-weight:800;letter-spacing:.5px}
.hero h1 span{background:linear-gradient(120deg,var(--accent),var(--accent2));-webkit-background-clip:text;background-clip:text;color:transparent}
.hero .sub{color:var(--sub);font-size:16px;margin:0 0 18px}
.stats{display:flex;justify-content:center;gap:28px;flex-wrap:wrap;margin:6px 0 4px}
.stat{font-size:14px;color:var(--sub)}
.stat b{display:block;font-size:20px;color:var(--text);font-weight:700}
.hint{font-size:12.5px;color:var(--sub);opacity:.85;margin-top:10px}
kbd{border:1px solid var(--border);border-radius:4px;padding:0 5px;font-size:11px;background:var(--card)}

/* ---------- 工具栏 ---------- */
.toolbarwrap{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--bg) 82%,transparent);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid var(--border);padding:10px 0;margin-top:18px}
.toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.searchbox{flex:1 1 260px;position:relative}
.searchbox svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);width:16px;height:16px;stroke:var(--sub);fill:none;stroke-width:2}
#q{width:100%;padding:10px 34px 10px 36px;border:1px solid var(--border);border-radius:10px;background:var(--input);color:var(--text);font-size:15px;outline:none;transition:border .15s,box-shadow .15s}
#q:focus{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 18%,transparent)}
#clearq{position:absolute;right:6px;top:50%;transform:translateY(-50%);border:0;background:none;color:var(--sub);cursor:pointer;font-size:15px;padding:4px 6px;border-radius:6px;display:none}
#clearq:hover{color:var(--text)}
select{padding:9px 10px;border:1px solid var(--border);border-radius:10px;background:var(--input);color:var(--text);font-size:14px;cursor:pointer;outline:none}
#themebtn{border:1px solid var(--border);background:var(--input);color:var(--text);border-radius:10px;width:40px;height:40px;font-size:17px;cursor:pointer;transition:transform .15s}
#themebtn:hover{transform:scale(1.08)}
.chips{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 4px}
.chip{border:1px solid var(--border);background:var(--chipbg);color:var(--sub);padding:6px 13px;border-radius:999px;font-size:13.5px;cursor:pointer;transition:all .15s}
.chip b{font-weight:600;opacity:.75;margin-left:2px;font-size:12px}
.chip:hover{color:var(--text);border-color:var(--accent)}
.chip.active{background:linear-gradient(120deg,var(--accent),var(--accent2));color:#fff;border-color:transparent}
.chip.active b{color:#fff;opacity:.9}
.resultline{font-size:13px;color:var(--sub);margin:10px 2px 0}

/* ---------- 卡片网格 ---------- */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:16px;padding:14px 0 8px}
.card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:18px;display:flex;flex-direction:column;gap:10px;cursor:pointer;transition:transform .16s,box-shadow .16s,border-color .16s}
.card[hidden]{display:none}
.card:hover{transform:translateY(-3px);box-shadow:var(--shadow);border-color:color-mix(in srgb,var(--accent) 45%,var(--border))}
.card-top{display:flex;align-items:center;gap:8px}
.cat-chip{font-size:12px;color:var(--sub);background:color-mix(in srgb,var(--accent) 8%,transparent);border-radius:6px;padding:2px 8px}
.archived{font-size:11px;color:#9a6700;background:#fff8c5;border-radius:6px;padding:1px 7px}
[data-theme="dark"] .archived{color:#d4a72c;background:#3f2e00}
.stars{margin-left:auto;font-size:13.5px;font-weight:700;color:#e3b341;white-space:nowrap}
.repo-name{margin:0;font-size:16.5px;font-weight:650;word-break:break-all}
.repo-name a{color:var(--text)}
.repo-name a:hover{color:var(--accent);text-decoration:none}
.desc{margin:0;color:var(--sub);font-size:14px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.tags{display:flex;gap:6px;flex-wrap:wrap}
.tag{font-size:11.5px;color:var(--sub);border:1px solid var(--border);border-radius:999px;padding:1px 9px}
.meta{margin-top:auto;display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:12.5px;color:var(--sub);border-top:1px dashed var(--border);padding-top:11px}
.lang{display:inline-flex;align-items:center;gap:5px}
.lang i{width:9px;height:9px;border-radius:50%;display:inline-block}
.links{margin-left:auto;display:flex;gap:10px}
.links a{font-size:12.5px}
.demo{color:var(--accent2)}
.empty{display:none;text-align:center;padding:60px 0;color:var(--sub);font-size:15px}
.empty .big{font-size:44px;margin-bottom:8px}

/* ---------- 页脚 ---------- */
footer{border-top:1px solid var(--border);margin-top:28px;padding:22px 0 34px;text-align:center;font-size:13px;color:var(--sub)}
footer .row{margin:4px 0}
@media (max-width:560px){.stats{gap:18px}.stat b{font-size:17px}.toolbarwrap{padding:8px 0}}
</style>
</head>
<body>
<div class="container">
  <div class="topbar">
    <span class="src">🎁 开源小项目导航</span>
    <a class="src" href="${escapeHtml(curated.site.githubRepo)}" target="_blank" rel="noopener">本站源码 GitHub ↗</a>
  </div>

  <header class="hero">
    <h1><span>${escapeHtml(curated.site.title)}</span></h1>
    <p class="sub">${escapeHtml(curated.site.subtitle)} · 所有人可搜索、可分享</p>
    <div class="stats">
      <div class="stat"><b>${projects.length}</b>精选项目</div>
      <div class="stat"><b>${fmtWan(totalStars)}</b>累计 Stars</div>
      <div class="stat"><b>${curated.categories.length}</b>个分类</div>
      <div class="stat"><b>0</b>后端依赖</div>
    </div>
    <p class="hint">纯静态页面 · 数据来自 GitHub 公开 API（${fetchedDate} 获取）· 按 <kbd>/</kbd> 快速聚焦搜索</p>
  </header>
</div>

<div class="toolbarwrap">
  <div class="container">
    <div class="toolbar">
      <div class="searchbox">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
        <input id="q" type="search" placeholder="搜索项目名、介绍、标签…（按 / 聚焦）" autocomplete="off">
        <button id="clearq" title="清空">✕</button>
      </div>
      <select id="langsel" title="按主语言筛选">${langOptions}</select>
      <select id="sortsel" title="排序">
        <option value="stars">按热度排序</option>
        <option value="updated">按最近更新</option>
        <option value="name">按名称 A–Z</option>
      </select>
      <button id="themebtn" title="切换深浅色">🌙</button>
    </div>
    <nav class="chips" id="chips">${chipsHTML}</nav>
  </div>
</div>

<main class="container">
  <p class="resultline" id="resultline">共 ${projects.length} 个项目</p>
  <section class="grid" id="grid">
${projects.map(cardHTML).join("\n")}
  </section>
  <div class="empty" id="empty"><div class="big">🙈</div>没有找到匹配的项目，换个关键词试试</div>

  <footer>
    <div class="row">数据获取于 ${fetchedDate} · Star 数与语言来自 GitHub 公开 API · 每个项目著作权归原作者所有</div>
    <div class="row">本页为纯静态页面（单 HTML 文件），可部署在 GitHub Pages / Vercel / Netlify 任意平台</div>
    <div class="row">想增删项目或刷新数据？查看仓库 README，两条命令搞定</div>
  </footer>
</main>

<script>
(function () {
  var cards = Array.prototype.slice.call(document.querySelectorAll(".card"));
  var q = document.getElementById("q");
  var clearq = document.getElementById("clearq");
  var langsel = document.getElementById("langsel");
  var sortsel = document.getElementById("sortsel");
  var themebtn = document.getElementById("themebtn");
  var chips = Array.prototype.slice.call(document.querySelectorAll(".chip"));
  var resultline = document.getElementById("resultline");
  var empty = document.getElementById("empty");
  var state = { q: "", cat: "all", lang: "all", sort: "stars" };

  function apply() {
    var kw = state.q.trim().toLowerCase();
    var shown = 0;
    cards.forEach(function (c) {
      var ok = true;
      if (state.cat !== "all" && c.dataset.cat !== state.cat) ok = false;
      if (ok && state.lang !== "all" && c.dataset.lang !== state.lang) ok = false;
      if (ok && kw && c.dataset.search.indexOf(kw) === -1) ok = false;
      c.hidden = !ok;
      if (ok) shown++;
    });
    // 排序：通过 order 属性重排，无需重建 DOM
    var key = state.sort;
    var sorted = cards.slice().sort(function (a, b) {
      if (key === "name") return a.dataset.name.localeCompare(b.dataset.name);
      if (key === "updated") return (a.dataset.pushed < b.dataset.pushed ? 1 : a.dataset.pushed > b.dataset.pushed ? -1 : 0);
      return (+b.dataset.stars) - (+a.dataset.stars);
    });
    sorted.forEach(function (c, i) { c.style.order = i; });
    resultline.textContent = kw || state.cat !== "all" || state.lang !== "all"
      ? "当前显示 " + shown + " / " + cards.length + " 个项目"
      : "共 " + cards.length + " 个项目";
    empty.style.display = shown ? "none" : "block";
    clearq.style.display = kw ? "block" : "none";
  }

  var t;
  q.addEventListener("input", function () { state.q = q.value; clearTimeout(t); t = setTimeout(apply, 90); });
  clearq.addEventListener("click", function () { q.value = ""; state.q = ""; apply(); q.focus(); });
  langsel.addEventListener("change", function () { state.lang = langsel.value; apply(); });
  sortsel.addEventListener("change", function () { state.sort = sortsel.value; apply(); });
  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      chips.forEach(function (c) { c.classList.remove("active"); });
      chip.classList.add("active");
      state.cat = chip.dataset.cat;
      apply();
    });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && document.activeElement !== q) { e.preventDefault(); q.focus(); }
    if (e.key === "Escape" && document.activeElement === q) { q.value = ""; state.q = ""; apply(); }
  });
  // 点击卡片空白处打开仓库；点链接时不拦截
  document.getElementById("grid").addEventListener("click", function (e) {
    if (e.target.closest("a")) return;
    var card = e.target.closest(".card");
    if (card) window.open(card.querySelector(".repo-name a").href, "_blank", "noopener");
  });

  // 深浅色
  var saved = null;
  try { saved = localStorage.getItem("theme"); } catch (e) {}
  var dark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  function setTheme() {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    themebtn.textContent = dark ? "☀️" : "🌙";
    try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch (e) {}
  }
  themebtn.addEventListener("click", function () { dark = !dark; setTheme(); });
  setTheme();
})();
</script>
</body>
</html>
`;

writeFileSync(join(root, "index.html"), html);
console.log(`✓ 已生成 index.html（${projects.length} 个项目，累计 ${totalStars.toLocaleString("en")} stars）`);
