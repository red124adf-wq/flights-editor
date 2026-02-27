/**
 * DASHBOARD.JS - ПОВНА ОЧИЩЕНА ВЕРСІЯ
 */

// 1. НАЛАШТУВАННЯ ТА ДОПОМІЖНІ ФУНКЦІЇ
let charts = {};
Chart.defaults.color = '#64748b';
Chart.defaults.font.size = 10;

function getReportingDate() {
    const now = new Date();
    // Логіка зміни 04:40
    if (now.getHours() < 4 || (now.getHours() === 4 && now.getMinutes() < 40)) {
        now.setDate(now.getDate() - 1);
    }
    return now.toISOString().split('T')[0];
}

// 2. ОТРИМАННЯ ДАНИХ (ГОЛОВНИЙ ГРАФІК)
async function fetchRealData(period = 'month') {
    if (!window.supabaseClient) return null;

    if (period === 'day') {
        const { data, error } = await window.supabaseClient.from('daily_activity_report').select('*');
        if (error) return null;
        return {
            labels: data.map(row => row.flight_time),
            mol: data.map(row => row.molniya_count),
            fpv: data.map(row => row.fpv_count)
        };
    } else {
        let query = window.supabaseClient.from('daily_stats').select('*');
        const now = new Date();
        let startDate = new Date();

        if (period === 'week') startDate.setDate(now.getDate() - 7);
        else if (period === 'month') startDate.setDate(now.getDate() - 30);
        
        if (period !== 'all') {
            query = query.gte('flight_date', startDate.toISOString().split('T')[0]);
        }

        const { data, error } = await query.order('flight_date', { ascending: true });
        if (error) return null;

        return {
            labels: data.map(row => {
                const date = new Date(row.flight_date);
                return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}`;
            }),
            mol: data.map(row => row.molniya_count),
            fpv: data.map(row => row.fpv_count)
        };
    }
}

// 3. ТОП НАПРЯМКІВ (04:40) - Використовуємо твою в'юху зі скріншота image_0bb97d.png
async function updateDirectionCharts(period) {
    if (!window.supabaseClient) return;
    let query = window.supabaseClient.from('direction_daily_stats').select('*');
    
    if (period === 'day') {
        query = query.eq('flight_date', getReportingDate()); 
    } else {
        const d = new Date();
        const days = period === 'week' ? 7 : 30;
        if (period !== 'all') {
            d.setDate(d.getDate() - days);
            query = query.gte('flight_date', d.toISOString().split('T')[0]);
        }
    }

    const { data, error } = await query;
    if (error) return;

    const processCategory = (categoryName, color, chartId) => {
        // Фільтруємо за drone_category як на скріншоті
        const filtered = data.filter(item => item.drone_category?.trim() === categoryName);
        const totals = filtered.reduce((acc, item) => {
            if (item.direction) {
                const dir = item.direction.trim();
                acc[dir] = (acc[dir] || 0) + parseInt(item.daily_count);
            }
            return acc;
        }, {});

        const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
        const top5 = sorted.slice(0, 5);
        const othersCount = sorted.slice(5).reduce((sum, item) => sum + item[1], 0);

        const labels = top5.map(item => item[0]);
        const values = top5.map(item => item[1]);
        if (othersCount > 0) { labels.push('ІНШІ'); values.push(othersCount); }

        createBarChart(chartId, labels, values, color);
    };

    processCategory('МОЛНІЯ', '#f43f5e', 'molniyaDirChart');
    processCategory('ФПВ', '#22d3ee', 'fpvDirChart');
}

// 4. ІНШІ ТОПИ ТА КАРТКИ
async function updateCrewChart(period) {
    if (!window.supabaseClient) return;
    let query = window.supabaseClient.from('crew_daily_stats').select('*');
    if (period === 'day') query = query.eq('flight_date', getReportingDate()); 
    else {
        const d = new Date();
        const days = period === 'week' ? 7 : 30;
        if (period !== 'all') {
            d.setDate(d.getDate() - days);
            query = query.gte('flight_date', d.toISOString().split('T')[0]);
        }
    }
    const { data, error } = await query;
    if (error) return;

    const totals = data.reduce((acc, item) => {
        if (item.crew_name) {
            const name = item.crew_name.trim();
            acc[name] = (acc[name] || 0) + parseInt(item.daily_count);
        }
        return acc;
    }, {});

    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    const top10 = sorted.slice(0, 10);
    const labels = top10.map(item => item[0]);
    const values = top10.map(item => item[1]);
    createBarChart('crewChart', labels, values, '#22d3ee');
}

async function updateFrequencyCharts(period) {
    if (!window.supabaseClient) return;
    let query = window.supabaseClient.from('video_frequency_stats').select('*');

    if (period === 'day') {
        // Суворе порівняння зі звітною датою (04:40)
        query = query.eq('flight_date', getReportingDate());
    } else {
        // Фільтрація за період
        const d = new Date();
        const days = period === 'week' ? 7 : 30;
        if (period !== 'all') {
            d.setDate(d.getDate() - days);
            query = query.gte('flight_date', d.toISOString().split('T')[0]);
        }
    }

    const { data, error } = await query;
    if (error) return;

    const processFreq = (categoryName, color, chartId) => {
        const filtered = data.filter(item => item.drone_category?.trim() === categoryName);
        
        // Групування та підсумовування
        const totals = filtered.reduce((acc, item) => {
            if (item.freq_range) {
                acc[item.freq_range] = (acc[item.freq_range] || 0) + parseInt(item.daily_count);
            }
            return acc;
        }, {});

        // Сортування від більшого до меншого
        const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
        
        const labels = sorted.map(item => item[0]);
        const values = sorted.map(item => item[1]);

        createBarChart(chartId, labels, values, color);
    };

    processFreq('MOLNIYA', '#f43f5e', 'molniyaFreqChart');
    processFreq('FPV', '#22d3ee', 'fpvFreqChart');
}

async function updateStatCards(period) {
    if (!window.supabaseClient) return;
    const { data, error } = await window.supabaseClient.from('flight_statistics').select('*');
    if (error || !data) return;
    const prefix = { 'day': 'day_', 'week': 'week_', 'month': 'month_', 'all': 'total_' }[period];
    const cardMap = { 'Молнія': '#stat-molniya', 'ФПВ': '#stat-fpv', 'Оптика': '#stat-optics' };

    data.forEach(row => {
        const card = document.querySelector(cardMap[row.unit_type]);
        if (!card) return;
        const stats = [row[`${prefix}detected`], row[`${prefix}shot_down`], row[`${prefix}suppressed`], row[`${prefix}lost`], row[`${prefix}strike`]];
        const spans = card.querySelectorAll('.stat-row span:last-child');
        stats.forEach((val, i) => { if (spans[i]) spans[i].innerText = val ?? 0; });
    });
}

// 5. МАЛЮВАННЯ (CHART.JS)
function initMainChart(data) {
    if (charts.main) charts.main.destroy();
    const ctx = document.getElementById('mainChart').getContext('2d');
    const gMol = ctx.createLinearGradient(0, 0, 0, 400); gMol.addColorStop(0, 'rgba(244, 63, 94, 0.4)'); gMol.addColorStop(1, 'rgba(244, 63, 94, 0)');
    const gFpv = ctx.createLinearGradient(0, 0, 0, 400); gFpv.addColorStop(0, 'rgba(34, 211, 238, 0.4)'); gFpv.addColorStop(1, 'rgba(34, 211, 238, 0)');

    charts.main = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [
                { label: 'Молнія', data: data.mol, borderColor: '#f43f5e', backgroundColor: gMol, fill: true, tension: 0.4, borderWidth: 2.5 },
                { label: 'ФПВ', data: data.fpv, borderColor: '#22d3ee', backgroundColor: gFpv, fill: true, tension: 0.4, borderWidth: 2.5 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}

function createBarChart(id, labels, data, color) {
    if (charts[id]) charts[id].destroy();
    const canvas = document.getElementById(id);
    if (!canvas) return;
    charts[id] = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{ data: data, backgroundColor: 'rgba(0,0,0,0)', borderColor: color, borderWidth: 2, borderRadius: 4, barThickness: 10 }]
        },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { grid: { display: false } } } }
    });
}

// 6. СИНХРОНІЗАЦІЯ ТА REALTIME
function syncChartVisibility() {
    if (!charts.main) return;
    [{ id: 'legend-molniya', index: 0 }, { id: 'legend-fpv', index: 1 }].forEach(item => {
        const el = document.getElementById(item.id);
        if (el) charts.main.setDatasetVisibility(item.index, !el.classList.contains('disabled'));
    });
    charts.main.update();
}

function setupLegendToggles() {
    [{ id: 'legend-molniya', index: 0 }, { id: 'legend-fpv', index: 1 }].forEach(item => {
        const el = document.getElementById(item.id);
        if (!el) return;
        el.onclick = () => {
            const isVisible = charts.main.isDatasetVisible(item.index);
            charts.main.setDatasetVisibility(item.index, !isVisible);
            charts.main.update();
            el.classList.toggle('disabled', isVisible);
        };
    });
}

// ОСНОВНА ФУНКЦІЯ (ТА САМА, ЩО БУЛА ДУБЛЬОВАНА)
async function updateDashboard(period) {
    const titleEl = document.getElementById('main-chart-title');
    if (titleEl) titleEl.innerText = (period === 'day') ? "Активність за день (МОЛНІЯ та ФПВ)" : "Динаміка прольотів (МОЛНІЯ та ФПВ)";

    const mainData = await fetchRealData(period);
    if (mainData) {
        initMainChart(mainData);
        syncChartVisibility(); 
    }
    
    await updateStatCards(period);
    await updateDirectionCharts(period);
    await updateCrewChart(period);
    await updateFrequencyCharts(period);

    document.querySelectorAll('.period-btn').forEach(btn => {
        const isActive = btn.getAttribute('data-period') === period;
        btn.classList.toggle('bg-blue-600', isActive);
        btn.classList.toggle('text-white', isActive);
        btn.classList.toggle('bg-slate-800', !isActive);
    });
}

function enableRealtime() {
    if (!window.supabaseClient) return;
    window.supabaseClient.channel('db-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'flights' }, () => {
        const activeBtn = document.querySelector('.period-btn.bg-blue-600');
        updateDashboard(activeBtn ? activeBtn.getAttribute('data-period') : 'month');
    }).subscribe();
}

document.addEventListener('DOMContentLoaded', () => {
    updateDashboard('month');
    enableRealtime();
    setupLegendToggles();
    document.getElementById('period-filters')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('period-btn')) updateDashboard(e.target.getAttribute('data-period'));
    });
});
