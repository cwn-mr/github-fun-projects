# 🎁 GitHub 宝藏小项目

> 精选 43 个小而美的 GitHub 开源项目，中文介绍、即时搜索、分类筛选，一键直达。
>
> **在线访问：https://cwn-mr.github.io/github-fun-projects/**

一个**纯静态**单文件网页（无后端、无数据库、零运行费用），托管在免费的 GitHub Pages 上，任何人都能访问和搜索。

## ✨ 功能

- 🔍 **即时搜索**：按项目名、中文介绍、标签、语言、分类全文匹配（按 <kbd>/</kbd> 快速聚焦）
- 🏷️ **6 大分类**：终端乐趣 / 命令行神器 / 网页玩具 / 小而美库 / 学习宝库 / 中文宝藏
- 🌐 **语言筛选** + 📊 **三种排序**（热度 / 最近更新 / 名称）
- 🌙 **深色 / 浅色模式**自动切换
- 📱 响应式布局，手机、平板、桌面都好看
- 🕷️ **SEO 友好**：所有卡片预渲染进 HTML（不执行 JS 的搜索引擎也能抓到内容），内置 meta / JSON-LD 结构化数据

## 🚀 免费部署（已完成：GitHub Pages）

本站已通过 **GitHub Pages** 发布，完全免费。如果想自己重新部署或换平台：

<details>
<summary><b>方式一：GitHub Pages（推荐，本站使用）</b></summary>

1. Fork 或新建仓库，把本目录内容推送到 `main` 分支
2. 仓库 → `Settings` → `Pages` → Source 选 `main` 分支 / `root`
3. 约 1 分钟后访问 `https://<用户名>.github.io/<仓库名>/`

</details>

<details>
<summary><b>方式二：Vercel / Netlify / Cloudflare Pages（也都免费）</b></summary>

三个平台都支持直接拖拽文件夹部署或关联 GitHub 仓库自动构建，无需任何配置——因为本站只有一个 `index.html` 静态文件。

</details>

## 🔧 本地预览

```bash
# 任意静态服务器均可，例如：
python -m http.server 8000
# 然后访问 http://127.0.0.1:8000/
```

## 🔄 更新数据（刷新 star 数、更新时间）

```bash
node tools/fetch.mjs    # 从 GitHub API 拉取最新 star/语言/更新时间 → data/live.json
node tools/build.mjs    # 重新生成 index.html
```

之后 commit + push，GitHub Pages 自动更新。

## ➕ 增删项目

编辑 [`data/curated.json`](data/curated.json)：每项包含仓库全名 `full_name`、分类 `category`、中文介绍 `desc`、标签 `tags`，改完重新执行上面两条命令即可。

## 📁 目录结构

```
├── index.html          # 最终网页（自包含单文件，直接部署它就行）
├── data/
│   ├── curated.json    # 人工维护：项目清单 + 中文介绍
│   └── live.json       # 自动生成：GitHub 实时数据
└── tools/
    ├── fetch.mjs       # 拉取 GitHub API 数据
    └── build.mjs       # 生成 index.html
```

## 📄 许可

页面代码以 [MIT](LICENSE) 许可开源；各项目的著作权归原作者所有，卡片均附原文仓库链接。
