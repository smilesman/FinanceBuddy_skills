/* FinanceBuddy Skills Warehouse —— 资源市场站点交互 */
"use strict";

const KIND_META = {
  skill: { title: "技能库", desc: "浏览与发现可安装的 Skill 资源。", file: "skills.json" },
  employee: { title: "数字员工库", desc: "浏览与发现可装配的数字员工角色。", file: "employees.json" },
  mcp: { title: "工具库", desc: "浏览与发现可接入的 MCP 工具连接。", file: "mcps.json" },
};

const PAGE_SIZE = 24;

const state = {
  kind: "skill",
  items: [],
  filtered: [],
  page: 1,
  q: "",
  category: "__all__",
};

const $ = (id) => document.getElementById(id);

async function loadKind(kind) {
  state.kind = kind;
  state.page = 1;
  $("cardGrid").innerHTML = '<p style="color:#9ca3af">加载中…</p>';
  try {
    const resp = await fetch(`../api/${KIND_META[kind].file}`);
    state.items = await resp.json();
  } catch (err) {
    $("cardGrid").innerHTML = `<p style="color:#dc2626">加载失败：${err.message}</p>`;
    return;
  }
  $("pageTitle").textContent = KIND_META[kind].title;
  $("pageDesc").textContent = KIND_META[kind].desc;
  buildCategories();
  applyFilter();
}

function buildCategories() {
  const counts = new Map();
  for (const it of state.items) {
    const key = it.category || "未分类";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const sel = $("categorySelect");
  sel.innerHTML = "";
  const all = document.createElement("option");
  all.value = "__all__";
  all.textContent = `全部分类（${state.items.length}）`;
  sel.appendChild(all);
  for (const [key, count] of [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], "zh"))) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = `${key}（${count}）`;
    sel.appendChild(opt);
  }
  if (![...counts.keys()].includes(state.category) && state.category !== "__all__") {
    state.category = "__all__";
  }
  sel.value = state.category;
}

function applyFilter() {
  const kw = state.q.trim().toLowerCase();
  state.filtered = state.items.filter((it) => {
    if (state.category !== "__all__" && (it.category || "未分类") !== state.category) return false;
    if (!kw) return true;
    return (
      it.name.toLowerCase().includes(kw) ||
      (it.description || "").toLowerCase().includes(kw) ||
      (it.tags || "").toLowerCase().includes(kw)
    );
  });
  state.page = 1;
  render();
}

function esc(s) {
  const div = document.createElement("div");
  div.textContent = s == null ? "" : String(s);
  return div.innerHTML;
}

function render() {
  const totalPages = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE));
  if (state.page > totalPages) state.page = totalPages;
  const start = (state.page - 1) * PAGE_SIZE;
  const slice = state.filtered.slice(start, start + PAGE_SIZE);

  $("countLabel").textContent = `共 ${state.filtered.length} 项`;
  $("pageLabel").textContent = state.filtered.length ? `${state.page} / ${totalPages}` : "";
  $("prevBtn").disabled = state.page <= 1;
  $("nextBtn").disabled = state.page >= totalPages;

  if (!slice.length) {
    $("cardGrid").innerHTML = '<p style="color:#9ca3af">没有匹配的资源。</p>';
    return;
  }
  $("cardGrid").innerHTML = slice
    .map((it, idx) => {
      const icon = it.icon || "📦";
      const tags = [];
      if (it.category) tags.push(`<span class="tag">${esc(it.category)}</span>`);
      if (it.source === "community") tags.push('<span class="tag community">社区</span>');
      if (it.package_url || it.details_url) tags.push('<span class="tag pkg">可下载</span>');
      return `<div class="card" data-idx="${start + idx}">
        <div class="card-head"><span class="card-icon">${icon}</span><span class="card-name">${esc(it.name)}</span></div>
        <div class="card-desc">${esc(it.description || "暂无描述")}</div>
        <div class="card-foot">${tags.join("")}</div>
      </div>`;
    })
    .join("");
}

async function openDetail(idx) {
  const it = state.filtered[idx];
  if (!it) return;
  $("modalIcon").textContent = it.icon || "📦";
  $("modalName").textContent = it.name;
  // 标签：分类 + tags（逗号分隔）
  const tagList = [];
  if (it.category) tagList.push(it.category);
  for (const t of (it.tags || "").split(/[,，]/)) {
    const v = t.trim();
    if (v && !tagList.includes(v)) tagList.push(v);
  }
  $("modalTags").innerHTML = tagList.map((t) => `<span class="tag">${esc(t)}</span>`).join("");
  $("modalMd5").textContent = it.md5 ? `MD5 指纹：${it.md5}` : "";
  $("modalReadme").textContent = "加载中…";
  const dl = $("modalDownload");
  // 下载：优先现成安装包；无包时走仓库动态打包（/build/<kind>/<id>.zip）
  const dlHref = it.package_url
    ? it.package_url.replace(/^\//, "../")
    : it.details_url
      ? it.details_url.replace(/^\/details\//, "../build/").replace(/\.json$/, ".zip")
      : "";
  if (dlHref) {
    dl.href = dlHref;
    dl.classList.remove("hidden");
  } else {
    dl.classList.add("hidden");
  }
  $("modalMask").classList.remove("hidden");

  // 拉取完整详情（readme/config 均存于仓库本地，不依赖外部站点）
  let detail = null;
  if (it.details_url) {
    try {
      const resp = await fetch(it.details_url.replace(/^\//, "../"));
      if (resp.ok) detail = await resp.json();
    } catch {
      detail = null;
    }
  }
  const readme =
    (detail && detail.readme) ||
    it.readme ||
    `# ${it.name}\n\n${it.description || "暂无详细说明。"}`;
  $("modalReadme").textContent = readme;
  if (detail && detail.fingerprint_md5 && !$("modalMd5").textContent) {
    $("modalMd5").textContent = `MD5 指纹：${detail.fingerprint_md5}`;
  }
}

// 复制内容到剪贴板
$("modalCopy").addEventListener("click", async () => {
  const text = $("modalReadme").textContent || "";
  try {
    await navigator.clipboard.writeText(text);
    $("modalCopy").textContent = "已复制 ✓";
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    $("modalCopy").textContent = "已复制 ✓";
  }
  setTimeout(() => { $("modalCopy").textContent = "复制内容"; }, 1600);
});

// ── 事件绑定 ──
$("kindTabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".tab");
  if (!btn || btn.dataset.kind === state.kind) return;
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === btn));
  state.category = "__all__";
  state.q = "";
  $("searchInput").value = "";
  loadKind(btn.dataset.kind);
});

$("searchInput").addEventListener("input", (e) => {
  state.q = e.target.value;
  applyFilter();
});

$("categorySelect").addEventListener("change", (e) => {
  state.category = e.target.value;
  applyFilter();
});

$("prevBtn").addEventListener("click", () => { state.page -= 1; render(); });
$("nextBtn").addEventListener("click", () => { state.page += 1; render(); });

$("cardGrid").addEventListener("click", (e) => {
  const card = e.target.closest(".card");
  if (card) openDetail(Number(card.dataset.idx));
});

$("modalBack").addEventListener("click", () => $("modalMask").classList.add("hidden"));
$("modalMask").addEventListener("click", (e) => {
  if (e.target === $("modalMask")) $("modalMask").classList.add("hidden");
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") $("modalMask").classList.add("hidden");
});

loadKind("skill");
