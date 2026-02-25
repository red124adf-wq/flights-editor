// Використовуємо глобальний клієнт Supabase
const supabaseClient = window.supabaseClient;
let videoCharts = {};

async function updateVideoAnalytics() {
    // Перевірка наявності клієнта
    if (!supabaseClient) {
        console.error("Supabase Client не знайдено! Перевірте підключення supabaseClient.js");
        return;
    }

    const period = document.getElementById("daysFilter").value;
    let query = supabaseClient.from("video_frequency_stats").select("*");

    // Фільтрація по даті (якщо не вибрано "Весь період")
    if (period !== "all") {
        const days = parseInt(period, 10);
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - days);
        query = query.gte("flight_date", fromDate.toISOString().split('T')[0]);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Помилка завантаження даних:", error.message);
        return;
    }

    // Рендеримо два графіки
    renderVideoChart(data, "MOLNIYA", "molniyaVideoChart", "molniya");
    renderVideoChart(data, "FPV", "fpvVideoChart", "fpv");
}

function renderVideoChart(data, category, canvasId, chartKey) {
    // Фільтрація по категорії БпЛА
    const subset = data.filter(item => item.drone_category === category);
    
    // Агрегуємо дані по діапазонах
    const groupedData = subset.reduce((acc, item) => {
        acc[item.freq_range] = (acc[item.freq_range] || 0) + item.daily_count;
        return acc;
    }, {});

    // Визначаємо жорсткий порядок для осей
    const order = ['1.2 GHz', '2.4 GHz', '3.3 GHz', '4.3 GHz', '5.8 GHz', 'Інші частоти'];
    
    // Формуємо масиви для графіка (беремо лише ті, де кількість > 0)
    const labels = order.filter(label => groupedData[label] > 0);
    const values = labels.map(label => groupedData[label]);

    const totalCount = values.reduce((a, b) => a + b, 0);

    // Знищуємо старий графік перед створенням нового
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
            layout: {
                padding: { right: 80 }
            },
            plugins: {
                legend: { display: false },
                datalabels: {
                    anchor: 'end',
                    align: 'right',
                    color: '#f8fafc',
                    font: { weight: 'bold', size: 12 },
                    formatter: (value) => {
                        const pct = totalCount > 0 ? Math.round((value / totalCount) * 100) : 0;
                        return `${value} (${pct}%)`;
                    }
                },
                tooltip: {
                    backgroundColor: '#1e293b',
                    callbacks: {
                        label: (ctx) => ` Кількість: ${ctx.raw} од.`
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

// Запускаємо при зміні селектора та при старті сторінки
document.getElementById("daysFilter").addEventListener("change", updateVideoAnalytics);
updateVideoAnalytics();