/* =====================================================
   КЛАСИФІКАЦІЯ БпЛА
===================================================== */
function isMolniya(crew) {
  return crew === "МОЛНІЯ";
}

function isOptic(crew) {
  if (!crew) return false;
  const c = crew.toUpperCase();
  return (
    c.includes("OPTIC") ||
    c.includes("ОПТИК") ||
    c.includes("FIBER") ||
    c.includes("FIBRE")
  );
}

function isFPV(crew) {
  return !isMolniya(crew) && !isOptic(crew);
}

/* =====================================================
   КОНСТАНТИ
===================================================== */
const RESULT_ORDER = [
  { key: "detected",   label: "Виявлено",   icon: "🔍" },
  { key: "destroyed",  label: "Збито",      icon: "🎯" },
  { key: "suppressed", label: "Подавлено",  icon: "📡" },
  { key: "lost",       label: "Зникло",     icon: "❓" },
  { key: "strike",     label: "Удар",       icon: "💥" }
];

/* =====================================================
   ЧАСОВІ ПЕРІОДИ
===================================================== */
function getPeriods() {
  const now = new Date();

  // початок календарної доби
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  // сьогодні 05:30
  const today0530 = new Date(now);
  today0530.setHours(5, 30, 0, 0);

  // звітний період (05:30)
  const reportStart =
    now >= today0530
      ? new Date(today0530)
      : new Date(today0530.setDate(today0530.getDate() - 1));

  return { now, startOfDay, reportStart };
}

/* =====================================================
   ПІДРАХУНОК З flights (ВЕРХ)
===================================================== */
async function loadStats(filterFn, from, to) {
  const { data, error } = await supabaseClient
    .from("flights")
    .select("date, time, action, crew")
    .gte("date", from.toISOString().slice(0, 10))
    .lte("date", to.toISOString().slice(0, 10));

  if (error) {
    console.error("Flights error:", error);
    return emptyStats();
  }

  const stats = emptyStats();

  data.forEach(row => {
    if (!filterFn(row.crew)) return;

    const ts = new Date(`${row.date}T${row.time}`);
    if (ts < from || ts >= to) return;

    switch (row.action) {
      case "Збито":
        stats.destroyed++;
        stats.detected++;
        break;
      case "Подавлено":
        stats.suppressed++;
        stats.detected++;
        break;
      case "Зникло":
        stats.lost++;
        stats.detected++;
        break;
      case "Удар":
        stats.strike++;
        stats.detected++;
        break;
      case "Відсутні":
        if (isOptic(row.crew)) stats.detected++;
        break;
    }
  });

  return stats;
}

function emptyStats() {
  return {
    detected: 0,
    destroyed: 0,
    suppressed: 0,
    lost: 0,
    strike: 0
  };
}

/* =====================================================
   РЕНДЕР ВЕРХНІХ ТАБЛИЦЬ
===================================================== */
function renderTable(tableId, period, day) {
  const table = document.getElementById(tableId);

  table.innerHTML = `
    <tr>
      <th>Результат</th>
      <th>Звітний період</th>
      <th>З початку доби</th>
    </tr>
  `;

  RESULT_ORDER.forEach(r => {
    table.innerHTML += `
      <tr>
        <td>${r.label}</td>
        <td>${period[r.key]}</td>
        <td>${day[r.key]}</td>
      </tr>
    `;
  });
}

/* =====================================================
   НИЖНІ БЛОКИ (daily_report_summary)
===================================================== */
async function loadSummary(droneType) {
  const { data, error } = await supabaseClient
    .from("daily_report_summary")
    .select("detected, destroyed, suppressed, lost, strike")
    .eq("drone_type", droneType)
    .single(); // гарантовано 1 рядок

  if (error) {
    console.error("Summary load error:", error);
    return null;
  }

  return data;
}

function renderSummary(elId, s, periodLabel) {
  if (!s) return;

  document.getElementById(elId).innerHTML = `
    <div class="summary-title">
      ← За попередній звітний період: ${periodLabel}
    </div>

    <ul class="summary-list">
      ${RESULT_ORDER.map(r =>
        `<li>${r.icon} ${r.label}: <strong>${s[r.key]}</strong></li>`
      ).join("")}
    </ul>
  `;
}


/* =====================================================
   INIT
===================================================== */
(async function init() {
  const { now, startOfDay, reportStart } = getPeriods();

  document.getElementById("periodInfo").innerText =
    `Звітний період: ${formatDT(reportStart)} — ${formatDT(now)}`;

  // верхні таблиці
  const molP = await loadStats(isMolniya, reportStart, now);
  const molD = await loadStats(isMolniya, startOfDay, now);

  const fpvP = await loadStats(isFPV, reportStart, now);
  const fpvD = await loadStats(isFPV, startOfDay, now);

  const optP = await loadStats(isOptic, reportStart, now);
  const optD = await loadStats(isOptic, startOfDay, now);

  renderTable("table-molniya", molP, molD);
  renderTable("table-fpv", fpvP, fpvD);
  renderTable("table-optic", optP, optD);

  // 🔹 ОДИН раз формуємо строку
  const prevPeriodLabel = getPreviousPeriodLabel();

  // нижні блоки (БЕЗ ДАТ, тільки значення)
  renderSummary(
    "summary-molniya",
    await loadSummary("MOLNIYA"),
    prevPeriodLabel
  );

  renderSummary(
    "summary-fpv",
    await loadSummary("FPV"),
    prevPeriodLabel
  );

  renderSummary(
    "summary-optic",
    await loadSummary("OPTIC"),
    prevPeriodLabel
  );
})();

/* =====================================================
   FORMAT
===================================================== */
function formatDT(d) {
  return d.toLocaleString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

/* =====================================================
   FORMAT СТРОКИ 
===================================================== */
function getPreviousPeriodLabel() {
  const now = new Date();

  // знаходимо сьогоднішні 05:30
  const today0530 = new Date(now);
  today0530.setHours(5, 30, 0, 0);

  const end =
    now >= today0530
      ? today0530
      : new Date(today0530.setDate(today0530.getDate() - 1));

  const start = new Date(end);
  start.setDate(start.getDate() - 1);

  return `${formatDate(start)}, 05:30 — ${formatDate(end)}, 05:30`;
}

function formatDate(d) {
  const pad = n => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}
