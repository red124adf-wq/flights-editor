// Використовуємо глобальний клієнт Supabase
const supabaseClient = window.supabaseClient;
let videoCharts = {};

/**
 * Отримання поточної оперативної дати (з урахуванням 04:40)
 */
function getOperationalDate() {
    const now = new Date();
    const today0440 = new Date(now);
    today0440.setHours(4, 40, 0, 0);

    let opDate = new Date(now);
    if (now < today0440) {
        opDate.setDate(opDate.getDate() - 1);
    }
    return opDate.toISOString().split('T')[0];
}

async function updateVideoAnalytics() {
    if (!supabaseClient) {
        console.error("Supabase Client не знайдено!");
        return;
    }

    const period = document.getElementById("daysFilter").value;
    let query = supabaseClient.from("video_frequency_stats").select("*");

    // Фільтрація по даті з урахуванням оперативної доби 04:40
    if (period !== "all") {
        const days = parseInt(period, 10);
        const fromDate = new Date(getOperationalDate()); 
        fromDate.setDate(fromDate.getDate() - (days - 1));
        query = query.gte("flight_date", fromDate.toISOString().split('T')[0]);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Помилка завантаження даних:", error.message);
        return;
    }

    // ПОВЕРНУТО: Латинські назви категорій
    renderVideoChart(data, "MOLNIYA", "molniyaVideoChart", "molniya");
    renderVideoChart(data, "FPV", "fpvVideoChart", "fpv");
}

function renderVideoChart(data, category, canvasId, chartKey) {
    // Фільтрація по категорії (MOLNIYA / FPV)
    const subset = data.filter(item => item.drone_category === category);
    
    // Агрегуємо дані по діапазонах
    const groupedData = subset.reduce((acc, item) => {
        acc[item.freq_range] = (acc[item.freq_range] || 0) + item.daily_count;
        return acc;
    }, {});

    const order = ['1.2 GHz', '2.4 GHz', '3.3 GHz', '4.3 GHz', '5.8 GHz', 'Інші частоти'];
    
    // Формуємо масиви для графіка
    const labels = order.filter(label => (groupedData[label] || 0) >= 0); 
    const values = labels.map(label => groupedData[label] || 0);

    const totalCount = values.reduce((a, b) => a + b, 0);

    if (videoCharts[chartKey]) {
        videoCharts[chartKey].destroy();
    }

    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');

    videoCharts[chartKey] = new Chart(ctx, {
        type: 'bar',
        plugins: [ChartDataLabels],
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: labels.map(l => l === 'Інші частоти' ? '#64748b' : '#38bdf8'),
                borderRadius: 4,
                barThickness: 24
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { right: 80 } },
            plugins: {
                legend: { display: false },
                datalabels: {
                    anchor: 'end',
                    align: 'right',
                    color: '#f8fafc',
                    font: { weight: 'bold', size: 12 },
                    formatter: (value) => {
                        const pct = totalCount > 0 ? Math.round((value / totalCount) * 100) : 0;
                        return value > 0 ? `${value} (${pct}%)` : '0';
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: '#334155', drawBorder: false },
                    ticks: { color: '#94a3b8', stepSize: 1 }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: '#f8fafc', font: { size: 12, weight: '600' } }
                }
            }
        }
    });
}

document.getElementById("daysFilter").addEventListener("change", updateVideoAnalytics);
updateVideoAnalytics();
