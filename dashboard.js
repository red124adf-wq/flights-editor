// 1. Глобальні змінні та налаштування
let charts = {};
Chart.defaults.color = '#64748b';
Chart.defaults.font.size = 10;

// 2. Отримання даних для головного графіка (лінії)
async function fetchRealData(period = 'month') {
    if (!window.supabaseClient) return null;
    let query = window.supabaseClient.from('daily_stats').select('*');
    const now = new Date();
    let startDate = new Date();

    if (period === 'day') startDate.setDate(now.getDate() - 1);
    else if (period === 'week') startDate.setDate(now.getDate() - 7);
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

// 3. Отримання статистики для нижніх карток
async function fetchFlightStats() {
    if (!window.supabaseClient) return null;
    const { data, error } = await window.supabaseClient.from('flight_statistics').select('*');
    return error ? null : data;
}

// 4. ТОП напрямків (Молнія / ФПВ)
async function updateDirectionCharts(period) {
    if (!window.supabaseClient) return;
    let query = window.supabaseClient.from('direction_daily_stats').select('*');
    const now = new Date();
    let startDate = new Date();
    
    if (period === 'day') startDate.setDate(now.getDate() - 1);
    else if (period === 'week') startDate.setDate(now.getDate() - 7);
    else if (period === 'month') startDate.setDate(now.getDate() - 30);
    
    if (period !== 'all') {
        query = query.gte('flight_date', startDate.toISOString().split('T')[0]);
    }

    const { data, error } = await query;
    if (error) return;

    const processCategory = (categoryName, color, chartId) => {
        const filtered = data.filter(item => 
            item.drone_category && item.drone_category.trim() === categoryName
        );

        const totals = filtered.reduce((acc, item) => {
            if (item.direction) {
                acc[item.direction] = (acc[item.direction] || 0) + parseInt(item.daily_count);
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

    // Виклик за вашим SQL View (використовуємо кирилицю, як домовились)
    processCategory('МОЛНІЯ', '#f43f5e', 'molniyaDirChart');
    processCategory('ФПВ', '#22d3ee', 'fpvDirChart');
}

// 5. ТОП екіпажів (Білі бари)
async function updateCrewChart(period) {
    if (!window.supabaseClient) return;
    let query = window.supabaseClient.from('crew_daily_stats').select('*');
    const now = new Date();
    let startDate = new Date();

    if (period === 'day') startDate.setDate(now.getDate() - 1);
    else if (period === 'week') startDate.setDate(now.getDate() - 7);
    else if (period === 'month') startDate.setDate(now.getDate() - 30);
    
    if (period !== 'all') {
        query = query.gte('flight_date', startDate.toISOString().split('T')[0]);
    }

    const { data, error } = await query;
    if (error) return;

    const totals = data.reduce((acc, item) => {
        if (item.crew_name) {
            acc[item.crew_name] = (acc[item.crew_name] || 0) + parseInt(item.daily_count);
        }
        return acc;
    }, {});

    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    const top10 = sorted.slice(0, 10);
    const othersCount = sorted.slice(10).reduce((sum, item) => sum + item[1], 0);

    const labels = top10.map(item => item[0]);
    const values = top10.map(item => item[1]);
    if (othersCount > 0) { labels.push('ІНШІ'); values.push(othersCount); }

    createBarChart('crewChart', labels, values, '#22d3ee');
}

// 6. Оновлення нижніх карток
const updateStatCards = async (period) => {
    const data = await fetchFlightStats();
    if (!data) return;

    const prefix = { 'day': 'day_', 'week': 'week_', 'month': 'month_', 'all': 'total_' }[period];
    const cardMap = { 'Молнія': '#stat-molniya', 'ФПВ': '#stat-fpv', 'Оптика': '#stat-optics' };

    data.forEach(row => {
        const card = document.querySelector(cardMap[row.unit_type]);
        if (!card) return;

        const stats = [
            row[`${prefix}detected`], row[`${prefix}shot_down`],
            row[`${prefix}suppressed`], row[`${prefix}lost`], row[`${prefix}strike`]
        ];

        const valueSpans = card.querySelectorAll('.stat-row span:last-child');
        stats.forEach((val, i) => { if (valueSpans[i]) valueSpans[i].innerText = val ?? 0; });
    });
};

// 6. ТОП відеочастот (Молнія / ФПВ)
async function updateFrequencyCharts(period) {
    if (!window.supabaseClient) return;
    let query = window.supabaseClient.from('video_frequency_stats').select('*');
    const now = new Date();
    let startDate = new Date();
    
    if (period === 'day') startDate.setDate(now.getDate() - 1);
    else if (period === 'week') startDate.setDate(now.getDate() - 7);
    else if (period === 'month') startDate.setDate(now.getDate() - 30);
    
    if (period !== 'all') {
        query = query.gte('flight_date', startDate.toISOString().split('T')[0]);
    }

    const { data, error } = await query;
    if (error) {
        console.error("Помилка частот:", error);
        return;
    }

    const processFreq = (categoryName, color, chartId) => {
        // Фільтруємо за категорією (MOLNIYA / FPV)
        const filtered = data.filter(item => 
            item.drone_category && item.drone_category.trim() === categoryName
        );

        // Групуємо суми за частотними діапазонами
        const totals = filtered.reduce((acc, item) => {
            if (item.freq_range) {
                acc[item.freq_range] = (acc[item.freq_range] || 0) + parseInt(item.daily_count);
            }
            return acc;
        }, {});

        // Сортуємо за популярністю
        const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);

        const labels = sorted.map(item => item[0]);
        const values = sorted.map(item => item[1]);

        createBarChart(chartId, labels, values, color);
    };

    // Виклик з використанням латиниці, як у вашій в'юсі
    processFreq('MOLNIYA', '#f43f5e', 'molniyaFreqChart');
    processFreq('FPV', '#22d3ee', 'fpvFreqChart');
}

// 7. Функції малювання (Chart.js)
const initMainChart = (data) => {
    if (charts.main) charts.main.destroy();
    const ctx = document.getElementById('mainChart').getContext('2d');
    const gMol = ctx.createLinearGradient(0, 0, 0, 400); gMol.addColorStop(0, 'rgba(244, 63, 94, 0.4)'); gMol.addColorStop(1, 'rgba(244, 63, 94, 0)');
    const gFpv = ctx.createLinearGradient(0, 0, 0, 400); gFpv.addColorStop(0, 'rgba(34, 211, 238, 0.4)'); gFpv.addColorStop(1, 'rgba(34, 211, 238, 0)');

    charts.main = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [
                { label: 'Молнія', data: data.mol, borderColor: '#f43f5e', backgroundColor: gMol, fill: true, tension: 0.4, borderWidth: 2.5, pointRadius: 2 },
                { label: 'ФПВ', data: data.fpv, borderColor: '#22d3ee', backgroundColor: gFpv, fill: true, tension: 0.4, borderWidth: 2.5, pointRadius: 2 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
};

const createBarChart = (id, labels, data, color) => {
    if (charts[id]) charts[id].destroy();
    const canvas = document.getElementById(id);
    if (!canvas) return;

    // Створюємо напівпрозору версію кольору для легкого відтінку всередині (опціонально)
    // Якщо хочеш зовсім порожньо - став 'transparent'
    const shadowColor = color; 

    charts[id] = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{ 
                data: data, 
                // Робимо заповнення майже прозорим (0.1) або зовсім 'transparent'
                backgroundColor: (ctx) => (labels[ctx.index] === 'ІНШІ') ? 'rgba(51, 65, 85, 0.2)' : 'rgba(0, 0, 0, 0)', 
                
                // Налаштовуємо яскраву окантовку
                borderColor: (ctx) => (labels[ctx.index] === 'ІНШІ') ? '#334155' : color,
                borderWidth: 2, // Товщина лінії контуру
                
                borderRadius: 4, 
                barThickness: 10,
                
                // Ефект світіння (працює в більшості сучасних браузерів через Canvas Shadow)
                hoverBorderWidth: 3,
                hoverBorderColor: color,
            }]
        },
        options: { 
            indexAxis: 'y', 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                legend: { display: false } 
            },
            // Додаємо невеликий хак для світіння через фільтр канвасу (за бажанням)
            animation: {
                duration: 1000
            },
            scales: {
                y: { 
                    grid: { display: false, drawBorder: false }, 
                    ticks: { color: '#94a3b8', autoSkip: false, font: { size: 10 } } 
                },
                x: { display: false, grid: { display: false } }
            }
        }
    });
};

// 8. Головна логіка оновлення
const updateDashboard = async (period) => {
    const mainData = await fetchRealData(period);
    if (mainData) {
        initMainChart(mainData);
        // --- ДОДАЙ ЦЕЙ РЯДОК ТУТ ---
        syncChartVisibility(); 
        // ---------------------------
    }
    
    await updateStatCards(period);
    await updateDirectionCharts(period);
    await updateCrewChart(period);
    await updateFrequencyCharts(period);

    // Підсвічування кнопок (твій існуючий код...)
    document.querySelectorAll('.period-btn').forEach(btn => {
        const isActive = btn.getAttribute('data-period') === period;
        btn.classList.toggle('bg-blue-600', isActive);
        btn.classList.toggle('text-white', isActive);
        btn.classList.toggle('bg-slate-800', !isActive);
    });
};

/// 9. ФУНКЦІЯ ДЛЯ ПЕРЕМИКАННЯ ЛЕГЕНДИ (ОКРЕМО)
function setupLegendToggles() {
    const legendItems = [
        { id: 'legend-molniya', index: 0 }, 
        { id: 'legend-fpv', index: 1 }      
    ];

    legendItems.forEach(item => {
        const el = document.getElementById(item.id);
        if (!el) return;

        el.addEventListener('click', () => {
            if (!charts.main) return;

            const isVisible = charts.main.isDatasetVisible(item.index);
            charts.main.setDatasetVisibility(item.index, !isVisible);
            charts.main.update();

            // Візуальний фідбек
            el.style.opacity = isVisible ? '0.3' : '1';
            el.style.textDecoration = isVisible ? 'line-through' : 'none';
        });
    });
}

// Функція для синхронізації графіка з поточним станом легенди
function syncChartVisibility() {
    if (!charts.main) return;

    const legendItems = [
        { id: 'legend-molniya', index: 0 },
        { id: 'legend-fpv', index: 1 }
    ];

    legendItems.forEach(item => {
        const el = document.getElementById(item.id);
        if (!el) return;

        // Перевіряємо, чи напис зараз напівпрозорий (значить вимкнений)
        const isHidden = el.style.opacity === '0.3';
        
        // Встановлюємо видимість у новому графіку відповідно до стану кнопки
        charts.main.setDatasetVisibility(item.index, !isHidden);
    });

    charts.main.update();
}

// 10. REALTIME ПЕРЕДПЛАТА (ОКРЕМО)
function enableRealtime() {
    if (!window.supabaseClient) return;

    window.supabaseClient
        .channel('schema-db-changes')
        .on(
            'postgres_changes', 
            { event: '*', schema: 'public', table: 'flights' }, 
            (payload) => {
                console.log('Дані оновлено! Синхронізація...');
                const activeBtn = document.querySelector('.period-btn.bg-blue-600');
                const activePeriod = activeBtn ? activeBtn.getAttribute('data-period') : 'month';
                updateDashboard(activePeriod);
            }
        )
        .subscribe();
}

// 11. ЄДИНИЙ ЗАПУСК ПРИ ЗАВАНТАЖЕННІ
document.addEventListener('DOMContentLoaded', () => {
    // 1. Завантажуємо дані
    updateDashboard('month');
    
    // 2. Вмикаємо Realtime
    enableRealtime();
    
    // 3. Налаштовуємо перемикачі легенди
    setupLegendToggles();

    // 4. Обробка кліків на фільтри періодів
    document.getElementById('period-filters')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('period-btn')) {
            updateDashboard(e.target.getAttribute('data-period'));
        }
    });
});