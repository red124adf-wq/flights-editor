const supabaseClient = window.supabaseClient;

/* --- КОНФІГУРАЦІЯ --- */
const RESULTS = [
    { key: "detected",   label: "Виявлено",   icon: "🔍", css: "val-detected" },
    { key: "destroyed",  label: "Збито",      icon: "🎯", css: "val-destroyed" },
    { key: "suppressed", label: "Подавлено",  icon: "📡", css: "val-suppressed" },
    { key: "lost",       label: "Зникло",     icon: "❓", css: "val-lost" },
    { key: "strike",     label: "Удар",       icon: "💥", css: "val-strike" }
];

/* --- ЛОГІКА ДЛЯ НИЖНІХ КАРТОК (ЗАЛИШАЄМО ЯК БУЛО) --- */
const getDroneType = (crew) => {
    if (!crew) return 'FPV';
    const c = crew.toUpperCase();
    if (c.includes("МОЛНІЯ") || c.includes("MOLNIYA")) return 'MOLNIYA';
    const opticTerms = ["OPTIC", "ОПТИК", "FIBER", "FIBRE", "ОПТИКА"];
    if (opticTerms.some(term => c.includes(term))) return 'OPTIC';
    return 'FPV';
};

function getPeriods() {
    const now = new Date();
    const today0530 = new Date(now);
    today0530.setHours(5, 30, 0, 0);
    const reportStart = now >= today0530 ? new Date(today0530) : new Date(today0530.setDate(today0530.getDate() - 1));
    const prevReportStart = new Date(reportStart.getTime() - 24 * 60 * 60 * 1000);
    const prevReportEnd = new Date(reportStart);
    return { now, reportStart, prevReportStart, prevReportEnd };
}

/* --- ГОЛОВНА ФУНКЦІЯ --- */
async function generateReport() {
    if (!supabaseClient) return;

    const { now, reportStart, prevReportStart, prevReportEnd } = getPeriods();
    const format = (d) => new Date(d).toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

    // 1. ЗАПИТ ДО flight_statistics (ДЛЯ ТАБЛИЦЬ)
    const { data: statsData } = await supabaseClient.from('flight_statistics').select('*');

    // 2. ЗАПИТ ДО flights (ТІЛЬКИ ДЛЯ НИЖНІХ КАРТОК "МИНУЛА")
    const queryDate = new Date(prevReportStart).toISOString().split('T')[0];
    const { data: rawFlights } = await supabaseClient.from('flights').select('date, time, crew, action').gte('date', queryDate);

    // Оновлення заголовків
    document.getElementById("periodInfo").innerText = `Поточна зміна: ${format(reportStart)} — ${format(now)}`;
    document.getElementById("prevPeriodInfo").innerText = `Підсумки за попередню зміну (${format(prevReportStart)} — ${format(prevReportEnd)})`;

    // 3. ОБРОБКА ДАНИХ ДЛЯ ТАБЛИЦЬ (З flight_statistics)
    const tableStats = {};
    statsData?.forEach(row => {
        tableStats[row.unit_type] = {
            period: {
                detected: row.day_detected,
                destroyed: row.day_shot_down,
                suppressed: row.day_suppressed,
                lost: row.day_lost,
                strike: row.day_strike
            }
        };
    });

    // 4. ОБРОБКА ДАНИХ ДЛЯ НИЖНІХ КАРТОК (СТАРИЙ МЕТОД)
    const initObj = () => ({ detected: 0, destroyed: 0, suppressed: 0, lost: 0, strike: 0 });
    const prevStats = { MOLNIYA: initObj(), FPV: initObj(), OPTIC: initObj() };

    rawFlights?.forEach(row => {
        const type = getDroneType(row.crew);
        const rowTime = new Date(`${row.date}T${row.time || '00:00:00'}`).getTime();
        const action = (row.action || "").toLowerCase();

        if (rowTime >= prevReportStart.getTime() && rowTime < prevReportEnd.getTime()) {
            prevStats[type].detected++;
            if (action.includes("збито")) prevStats[type].destroyed++;
            else if (action.includes("подавл") || action.includes("реб")) prevStats[type].suppressed++;
            else if (action.includes("зник")) prevStats[type].lost++;
            else if (action.includes("удар")) prevStats[type].strike++;
        }
    });

    // 5. ВІЗУАЛІЗАЦІЯ
    const mappings = [
        { dbKey: 'Молнія', jsKey: 'MOLNIYA', table: 'table-molniya', summary: 'summary-molniya', prev: 'prev-molniya' },
        { dbKey: 'ФПВ',    jsKey: 'FPV',     table: 'table-fpv',     summary: 'summary-fpv',     prev: 'prev-fpv' },
        { dbKey: 'Оптика', jsKey: 'OPTIC',   table: 'table-optic',   summary: 'summary-optic',   prev: 'prev-optic' }
    ];

    mappings.forEach(m => {
        const tS = tableStats[m.dbKey]; // Дані для таблиці
        const pS = prevStats[m.jsKey];  // Дані для карток "Минула"

        if (tS) {
            renderTable(m.table, tS.period);
            renderSummary(m.summary, tS.period);
        }
        if (pS) {
            renderPrevPeriod(m.prev, pS);
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
            <strong class="${res.css}">${p[res.key]}</strong>
        </div>
    `).join('');
}

generateReport();
