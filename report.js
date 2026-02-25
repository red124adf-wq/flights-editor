const supabaseClient = window.supabaseClient;

const RESULTS = [
    { key: "detected",   label: "Виявлено",   icon: "🔍", css: "val-detected" },
    { key: "destroyed",  label: "Збито",      icon: "🎯", css: "val-destroyed" },
    { key: "suppressed", label: "Подавлено",  icon: "📡", css: "val-suppressed" },
    { key: "lost",       label: "Зникло",     icon: "❓", css: "val-lost" },
    { key: "strike",     label: "Удар",       icon: "💥", css: "val-strike" }
];

/* --- КЛАСИФІКАЦІЯ БпЛА --- */
const isMolniya = (crew) => crew === "МОЛНІЯ";
const isOptic = (crew) => {
    if (!crew) return false;
    const c = crew.toUpperCase();
    return ["OPTIC", "ОПТИК", "FIBER", "FIBRE", "ОПТИКА"].some(term => c.includes(term));
};
const isFPV = (crew) => !isMolniya(crew) && !isOptic(crew);

/* --- ЧАСОВІ МЕЖІ --- */
function getPeriods() {
    const now = new Date();
    const startOfDay = new Date(now).setHours(0, 0, 0, 0);
    const today0530 = new Date(now).setHours(5, 30, 0, 0);
    
    // Поточна зміна
    const reportStart = now >= today0530 
        ? today0530 
        : new Date(now.setDate(now.getDate() - 1)).setHours(5, 30, 0, 0);
        
    // Попередня зміна (рівно мінус 24 години від початку поточної)
    const prevReportStart = reportStart - (24 * 60 * 60 * 1000);
    const prevReportEnd = reportStart;

    return { now: now.getTime(), startOfDay, reportStart, prevReportStart, prevReportEnd };
}

/* --- ГОЛОВНА ЛОГІКА --- */
async function generateReport() {
    if (!supabaseClient) {
        console.error("Supabase Client не знайдено!");
        return;
    }

    const { now, startOfDay, reportStart, prevReportStart, prevReportEnd } = getPeriods();
    
    const format = (ms) => new Date(ms).toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    
    // Заголовки
    document.getElementById("periodInfo").innerText = `Поточна зміна: ${format(reportStart)} — ${format(now)}`;
    document.getElementById("prevPeriodInfo").innerText = `Підсумки за попередню зміну (${format(prevReportStart)} — ${format(prevReportEnd)})`;

    // Беремо дані за останні 3 дні, щоб гарантовано захопити попередню зміну
    const queryDate = new Date(prevReportStart - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const { data, error } = await supabaseClient
        .from('flights')
        .select('date, time, crew, action')
        .gte('date', queryDate);

    if (error) {
        console.error(error);
        return;
    }

    // Обчислюємо статистику
    const molniyaStats = processStats(data, isMolniya, reportStart, startOfDay, now, prevReportStart, prevReportEnd);
    const fpvStats = processStats(data, isFPV, reportStart, startOfDay, now, prevReportStart, prevReportEnd);
    const opticStats = processStats(data, isOptic, reportStart, startOfDay, now, prevReportStart, prevReportEnd);

    // Малюємо Поточну зміну
    renderTable("table-molniya", molniyaStats);
    renderTable("table-fpv", fpvStats);
    renderTable("table-optic", opticStats);

    renderSummary("summary-molniya", molniyaStats.period);
    renderSummary("summary-fpv", fpvStats.period);
    renderSummary("summary-optic", opticStats.period);

    // Малюємо Попередню зміну
    renderPrevPeriod("prev-molniya", molniyaStats.prevPeriod);
    renderPrevPeriod("prev-fpv", fpvStats.prevPeriod);
    renderPrevPeriod("prev-optic", opticStats.prevPeriod);
}

/* --- АНАЛІЗ ДАНИХ --- */
function processStats(data, conditionFn, reportStart, startOfDay, now, prevReportStart, prevReportEnd) {
    let stats = {
        period: { detected: 0, destroyed: 0, suppressed: 0, lost: 0, strike: 0 },
        daily: { detected: 0, destroyed: 0, suppressed: 0, lost: 0, strike: 0 },
        prevPeriod: { detected: 0, destroyed: 0, suppressed: 0, lost: 0, strike: 0 }
    };

    data.forEach(row => {
        if (!conditionFn(row.crew)) return;

        const rowTime = new Date(`${row.date}T${row.time || '00:00'}`).getTime();
        if (rowTime > now) return;

        const action = (row.action || "").toLowerCase();
        const addStat = (target) => {
            target.detected++;
            if (action.includes("збито")) target.destroyed++;
            else if (action.includes("подавл") || action.includes("реб")) target.suppressed++;
            else if (action.includes("зник")) target.lost++;
            else if (action.includes("удар")) target.strike++;
        };

        // Поточна зміна і доба
        if (rowTime >= reportStart) addStat(stats.period); 
        if (rowTime >= startOfDay && rowTime <= now) addStat(stats.daily);   
        
        // Попередня зміна
        if (rowTime >= prevReportStart && rowTime < prevReportEnd) addStat(stats.prevPeriod);
    });

    return stats;
}

/* --- ВІЗУАЛІЗАЦІЯ --- */
function renderTable(elementId, stats) {
    const tbody = document.getElementById(elementId);
    let html = `<thead><tr><th>Результат</th><th>Зміна<br><small>(з 05:30)</small></th><th>Доба<br><small>(з 00:00)</small></th></tr></thead><tbody>`;
    
    RESULTS.forEach(res => {
        html += `<tr>
            <td>${res.icon} ${res.label}</td>
            <td class="${res.css}">${stats.period[res.key]}</td>
            <td class="${res.css}">${stats.daily[res.key]}</td>
        </tr>`;
    });
    
    tbody.innerHTML = html + `</tbody>`;
}

function renderSummary(elementId, pStats) {
    const el = document.getElementById(elementId);
    const successCount = pStats.destroyed + pStats.suppressed;
    const pct = pStats.detected > 0 ? Math.round((successCount / pStats.detected) * 100) : 0;
    el.innerHTML = `Ефективність протидії за зміну: <strong>${pct}%</strong>`;
}

// Вивід даних ПОПЕРЕДНЬОЇ зміни
function renderPrevPeriod(elementId, pStats) {
    const el = document.getElementById(elementId);
    if(!el) return;

    let html = ``;
    RESULTS.forEach(res => {
        html += `
            <div class="prev-stat-item">
                <span>${res.icon} ${res.label}:</span> 
                <strong class="${res.css}">${pStats[res.key]}</strong>
            </div>
        `;
    });

    el.innerHTML = html;
}

// Запуск
generateReport();