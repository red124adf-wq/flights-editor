// === Supabase client ===
const supabaseClient = window.supabase.createClient(
  "https://opuosltpihrhnpyxcxnm.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wdW9zbHRwaWhyaG5weXhjeG5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNTM4NjgsImV4cCI6MjA4MzYyOTg2OH0.3oLcak4XWxEFaP81HrzCss9BwekV6HoNB--82Zp3-uE"
);

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
async function loadStats(isMolniya, from, to) {
  let query = supabaseClient
    .from("flights")
    .select("date, time, action")
    .gte("date", from.toISOString().split("T")[0])
    .lte("date", to.toISOString().split("T")[0]);

  query = isMolniya
    ? query.eq("crew", "МОЛНІЯ")
    : query.neq("crew", "МОЛНІЯ");

  const { data, error } = await query;

  if (error) {
    console.error(error);
    return {};
  }

  // 🔒 ЖОРСТКА ініціалізація під таблицю
  const map = {
    "Виявлено": 0,
    "Збито": 0,
    "Подавлено": 0,
    "Зникло": 0,
    "Удар": 0
  };

  data.forEach(row => {
    const ts = new Date(`${row.date}T${row.time}`);

    if (ts >= from && ts <= to) {
      const action = row.action;

      // рахунок конкретної дії
      if (map[action] !== undefined) {
        map[action]++;
      }

      // будь-яка бойова дія = виявлено
      if (["Збито", "Подавлено", "Удар"].includes(action)) {
        map["Виявлено"]++;
      }
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

  const molniyaPeriod = await loadStats(true, reportStart, now);
  const molniyaDay = await loadStats(true, startOfDay, now);

  const vpvPeriod = await loadStats(false, reportStart, now);
  const vpvDay = await loadStats(false, startOfDay, now);

  renderTable("table-molniya", molniyaPeriod, molniyaDay);
  renderTable("table-vpv", vpvPeriod, vpvDay);
})();
