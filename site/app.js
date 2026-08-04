/* FinanceBuddy Skills Warehouse —— 复刻 OpenOcta 技能库交互 */
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
      if (it.package_url) tags.push('<span class="tag pkg">可下载</span>');
      return `<div class="card" data-idx="${start + idx}">
        <div class="card-head"><span class="card-icon">${icon}</span><span class="card-name">${esc(it.name)}</span></div>
        <div class="card-desc">${esc(it.description || "暂无描述")}</div>
        <div class="card-foot">${tags.join("")}</div>
      </div>`;
    })
    .join("");
}

function openDetail(idx) {
  const it = state.filtered[idx];
  if (!it) return;
  $("modalIcon").textContent = it.icon || "📦";
  $("modalName").textContent = it.name;
  $("modalStatus").textContent = it.status === "paid" ? "付费" : it.status === "private" ? "私有" : "开放";
  $("modalMeta").innerHTML = [
    `<span>分类：<b>${esc(it.category || "未分类")}</b></span>`,
    `<span>来源：<b>${esc(it.source)}</b></span>`,
    it.version ? `<span>版本：<b>${esc(it.version)}</b></span>` : "",
    it.tags ? `<span>标签：<b>${esc(it.tags)}</b></span>` : "",
    it.source_url ? `<span><a href="${esc(it.source_url)}" target="_blank">原始页面 ↗</a></span>` : "",
  ].filter(Boolean).join("");
  $("modalReadme").textContent = it.readme || `# ${it.name}\n\n${it.description || "暂无详细说明。"}`;
  const dl = $("modalDownload");
  if (it.package_url) {
    dl.href = it.package_url.replace(/^\//, "../");
    dl.classList.remove("hidden");
  } else {
    dl.classList.add("hidden");
  }
  $("modalMd5").textContent = it.md5 ? `MD5: ${it.md5}` : "";
  $("modalMask").classList.remove("hidden");
}

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

$("modalClose").addEventListener("click", () => $("modalMask").classList.add("hidden"));
$("modalMask").addEventListener("click", (e) => {
  if (e.target === $("modalMask")) $("modalMask").classList.add("hidden");
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") $("modalMask").classList.add("hidden");
});

loadKind("skill");
