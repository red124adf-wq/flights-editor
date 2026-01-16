// === Supabase client ===


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

// === Константи ===
const RESULT_ORDER = [
  "Виявлено",
  "Збито",
  "Подавлено",
  "Зникло",
  "Удар"
];

// === Часові інтервали ===
function getPeriods() {
  const now = new Date();

  // початок календарної доби
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  // 05:30 сьогодні
  const today0530 = new Date(now);
  today0530.setHours(5, 30, 0, 0);

  let reportStart;

  if (now >= today0530) {
    // після 05:30 → беремо СЬОГОДНІ
    reportStart = new Date(today0530);
  } else {
    // до 05:30 → беремо ВЧОРА
    reportStart = new Date(today0530);
    reportStart.setDate(reportStart.getDate() - 1);
  }

  return { now, startOfDay, reportStart };
}


// === Завантаження статистики ===
// isMolniya = true  → crew = 'МОЛНІЯ'
// isMolniya = false → crew != 'МОЛНІЯ'
async function loadStatsByFilter(filterFn, from, to) {
  const { data, error } = await supabaseClient
    .from("flights")
    .select("date, time, action, crew")
    .gte("date", from.toISOString().split("T")[0])
    .lte("date", to.toISOString().split("T")[0]);

  if (error) {
    console.error(error);
    return {};
  }

  const map = {
    "Виявлено": 0,
    "Збито": 0,
    "Подавлено": 0,
    "Зникло": 0,
    "Удар": 0
  };

  data.forEach(row => {
    if (!filterFn(row.crew)) return;

    const ts = new Date(`${row.date}T${row.time}`);
    if (ts < from || ts >= to) return;

    // рахуємо конкретні дії
if (map[row.action] !== undefined) {
  map[row.action]++;
}

// бойові дії → автоматично "Виявлено"
if (["Збито", "Подавлено", "Удар", "Зникло"].includes(row.action)) {
  map["Виявлено"]++;
}

// OPTIKA + "Відсутні" → теж "Виявлено"
if (
  row.action === "Відсутні" &&
  isOptic(row.crew)
) {
  map["Виявлено"]++;
}

  });

  return map;
}


// === Побудова таблиці ===
function renderTable(tableId, periodStats, dayStats) {
  const table = document.getElementById(tableId);

  table.innerHTML = `
    <tr>
      <th>Результат</th>
      <th>Звітний період</th>
      <th>З початку доби</th>
    </tr>
  `;

  RESULT_ORDER.forEach(result => {
    table.innerHTML += `
      <tr>
        <td>${result}</td>
        <td>${periodStats[result] || 0}</td>
        <td>${dayStats[result] || 0}</td>
      </tr>
    `;
  });
}


// === INIT ===
(async function init() {
  const { now, startOfDay, reportStart } = getPeriods();

  document.getElementById("periodInfo").innerText =
    `Звітний період: ${reportStart.toLocaleString("uk-UA")} — ${now.toLocaleString("uk-UA")}`;

  const molniyaPeriod = await loadStatsByFilter(isMolniya, reportStart, now);
  const molniyaDay    = await loadStatsByFilter(isMolniya, startOfDay, now);

  const fpvPeriod = await loadStatsByFilter(isFPV, reportStart, now);
  const fpvDay    = await loadStatsByFilter(isFPV, startOfDay, now);

  const opticPeriod = await loadStatsByFilter(isOptic, reportStart, now);
  const opticDay    = await loadStatsByFilter(isOptic, startOfDay, now);

  renderTable("table-molniya", molniyaPeriod, molniyaDay);
  renderTable("table-fpv", fpvPeriod, fpvDay);
  renderTable("table-optic", opticPeriod, opticDay);
  
	const molniyaSummary = await loadDailySummary("MOLNIYA");
	renderSummary("summary-molniya", molniyaSummary);

	const fpvSummary = await loadDailySummary("FPV");
	renderSummary("summary-fpv", fpvSummary);

	const opticSummary = await loadDailySummary("OPTIC");
	renderSummary("summary-optic", opticSummary);

})();

// === ВЧОРАШНІЙ ЗВІТ ===
async function loadDailySummary(droneType) {
  const { data, error } = await supabaseClient
    .from("daily_report_summary")
    .select("*")
    .eq("drone_type", droneType)
    .order("report_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Summary error:", error);
    return null;
  }

  return data;
}

function renderSummary(elId, summary) {
  if (!summary) return;

  // report_date = YYYY-MM-DD
  const baseDate = new Date(summary.report_date + "T05:30:00");

  const from = new Date(baseDate);
  const to = new Date(baseDate);
  to.setDate(to.getDate() + 1);

  document.getElementById(elId).innerHTML = `
    <div class="summary-text">
      <div class="summary-title">
        ← За попередній звітний період
        (${formatDateTimeUA(from)} - ${formatDateTimeUA(to)})
      </div>

      <ul class="summary-list">
        <li>🔍 Виявлено: <strong>${summary.detected}</strong></li>
        <li>🎯 Збито: <strong>${summary.destroyed}</strong></li>
        <li>📡 Подавлено: <strong>${summary.suppressed}</strong></li>
        <li>❓ Зникло: <strong>${summary.lost}</strong></li>
        <li>💥 Удар: <strong>${summary.strike}</strong></li>
      </ul>
    </div>
  `;
}

function formatDateTimeUA(d) {
  const pad = n => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ` +
         `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
