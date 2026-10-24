#!/usr/bin/env node
/**
 * 从 GitHub API 拉取精选项目的实时数据（star 数、语言、更新时间等），
 * 与 data/curated.json 中的中文介绍合并，输出 data/live.json。
 *
 * 用法：node tools/fetch.mjs
 * 优先使用 `gh auth token` 的凭证（5000 次/小时），否则匿名（60 次/小时）。
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const curated = JSON.parse(readFileSync(join(root, "data", "curated.json"), "utf8"));

let token = "";
try {
  token = execSync("gh auth token", { stdio: ["ignore", "pipe", "ignore"] })
    .toString()
    .trim();
} catch {
  console.warn("未找到 gh 登录凭证，将匿名调用 GitHub API（限 60 次/小时）");
}

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "github-fun-projects-fetcher",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ghJson(url) {
  const res = await fetch(url, { headers, redirect: "follow" });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function fetchRepo(fullName) {
  const r = await ghJson(`https://api.github.com/repos/${fullName}`);
  return {
    full_name: r.full_name,
    html_url: r.html_url,
    homepage: (r.homepage || "").trim(),
    description: r.description || "",
    stargazers_count: r.stargazers_count,
    forks_count: r.forks_count,
    language: r.language,
    pushed_at: r.pushed_at,
    archived: !!r.archived,
    topics: r.topics || [],
    license: r.license ? r.license.spdx_id : null,
  };
}

async function searchRepo({ search, searchName, searchOwner }) {
  const q = encodeURIComponent(
    searchOwner ? `org:${searchOwner} ${search}` : search
  );
  const data = await ghJson(
    `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=5`
  );
  const items = data.items || [];
  if (!items.length) throw new Error(`搜索无结果: ${search}`);
  const picked =
    items.find((it) =>
      searchName ? it.name.toLowerCase() === searchName.toLowerCase() : false
    ) || items[0];
  return fetchRepo(picked.full_name);
}

const live = [];
const failed = [];
for (const p of curated.projects) {
  try {
    const stats = p.search ? await searchRepo(p) : await fetchRepo(p.full_name);
    live.push({
      ...stats,
      category: p.category,
      desc: p.desc,
      tags: p.tags,
    });
    console.log(`✓ ${stats.full_name}  ⭐${stats.stargazers_count.toLocaleString()}`);
  } catch (e) {
    failed.push(p.full_name || p.search);
    console.error(`✗ ${p.full_name || p.search}  ${e.message}`);
  }
  await sleep(120);
}

writeFileSync(
  join(root, "data", "live.json"),
  JSON.stringify({ fetched_at: new Date().toISOString(), projects: live }, null, 2)
);

console.log(`\n完成：成功 ${live.length} 个，失败 ${failed.length} 个`);
if (failed.length) console.log("失败列表:", failed.join(", "));
if (!live.length) process.exit(1);
