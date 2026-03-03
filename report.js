const supabaseClient = window.supabaseClient;

const RESULTS = [
    { key: "detected",   label: "Виявлено",   icon: "🔍", css: "val-detected" },
    { key: "destroyed",  label: "Збито",      icon: "🎯", css: "val-destroyed" },
    { key: "suppressed", label: "Подавлено",  icon: "📡", css: "val-suppressed" },
    { key: "lost",       label: "Зникло",     icon: "❓", css: "val-lost" },
    { key: "strike",     label: "Удар",       icon: "💥", css: "val-strike" }
];

/**
 * Розрахунок періодів (поріг 04:40)
 */
function getPeriods() {
    const now = new Date();
    const reportStart = new Date(now);
    reportStart.setHours(4, 40, 0, 0);

    if (now < reportStart) {
        reportStart.setDate(reportStart.getDate() - 1);
    }

    const prevReportStart = new Date(reportStart.getTime() - 24 * 60 * 60 * 1000);
    const prevReportEnd = new Date(reportStart);

    return { now, reportStart, prevReportStart, prevReportEnd };
}

/**
 * Головна функція
 */
async function generateReport() {
    if (!supabaseClient) return;

    const { now, reportStart, prevReportStart, prevReportEnd } = getPeriods();
    const format = (d) => d.toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

    // Оновлення заголовків періодів
    document.getElementById("periodInfo").innerText = `Поточна зміна: ${format(reportStart)} — ${format(now)}`;
    document.getElementById("prevPeriodInfo").innerText = `Підсумки за попередню зміну (${format(prevReportStart)} — ${format(prevReportEnd)})`;

    // 1. ЗАПИТИ (Паралельне виконання для швидкості)
    const [statsResponse, prevResponse] = await Promise.all([
        supabaseClient.from('flight_statistics').select('*'),
        supabaseClient.from('flight_summary_last_day').select('*')
    ]);

    // 2. ОБРОБКА ДАНИХ ТАБЛИЦЬ (Поточна зміна)
    const tableStats = {};
    statsResponse.data?.forEach(row => {
        tableStats[row.unit_type] = {
            detected: row.day_detected,
            destroyed: row.day_shot_down,
            suppressed: row.day_suppressed,
            lost: row.day_lost,
            strike: row.day_strike
        };
    });

    // 3. ОБРОБКА ДАНИХ КАРТОК (Минула зміна з View)
    const prevStats = {};
    prevResponse.data?.forEach(row => {
        prevStats[row.drone_type] = row;
    });

    // 4. ВІЗУАЛІЗАЦІЯ
    const mappings = [
        { dbKey: 'Молнія', jsKey: 'MOLNIYA', table: 'table-molniya', summary: 'summary-molniya', prev: 'prev-molniya' },
        { dbKey: 'ФПВ',    jsKey: 'FPV',     table: 'table-fpv',     summary: 'summary-fpv',     prev: 'prev-fpv' },
        { dbKey: 'Оптика', jsKey: 'OPTIC',   table: 'table-optic',   summary: 'summary-optic',   prev: 'prev-optic' }
    ];

    mappings.forEach(m => {
        // Поточна зміна
        if (tableStats[m.dbKey]) {
            renderTable(m.table, tableStats[m.dbKey]);
            renderSummary(m.summary, tableStats[m.dbKey]);
        }
        // Минула зміна (картки)
        if (prevStats[m.jsKey]) {
            renderPrevPeriod(m.prev, prevStats[m.jsKey]);
        }
    });
}

function renderTable(id, p) {
    const el = document.getElementById(id);
    if (!el) return;
    let html = `<thead><tr><th>Результат</th><th>Зміна</th></tr></thead><tbody>`;
    RESULTS.forEach(res => {
        html += `<tr><td>${res.icon} ${res.label}</td><td class="${res.css}">${p[res.key] || 0}</td></tr>`;
    });
    el.innerHTML = html + `</tbody>`;
}

function renderSummary(id, p) {
    const el = document.getElementById(id);
    if (!el) return;
    const eff = p.detected > 0 ? Math.round(((Number(p.destroyed) + Number(p.suppressed)) / p.detected) * 100) : 0;
    el.innerHTML = `Ефективність протидії: <strong>${eff}%</strong>`;
}

function renderPrevPeriod(id, p) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = RESULTS.map(res => `
        <div class="prev-stat-item">
            <span>${res.icon} ${res.label}:</span> 
            <strong class="${res.css}">${p[res.key] || 0}</strong>
        </div>
    `).join('');
}

// Запуск
generateReport();
