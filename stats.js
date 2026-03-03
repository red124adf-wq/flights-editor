// Використовуємо глобальний клієнт Supabase
const supabaseClient = window.supabaseClient;
let charts = {};

async function updateDirectionStats() {
    if (!supabaseClient) return;

    const period = document.getElementById("daysFilter").value;
    let query = supabaseClient.from("direction_daily_stats").select("*");

    // ЛОГІКА ОПЕРАТИВНОЇ ДОБИ (04:40)
    const now = new Date();
    const today0440 = new Date(now);
    today0440.setHours(4, 40, 0, 0);

    // Визначаємо поточну оперативну дату (якщо зараз до 04:40, то "сьогодні" — це ще вчорашнє число)
    let currentReportDate = new Date(now);
    if (now < today0440) {
        currentReportDate.setDate(currentReportDate.getDate() - 1);
    }
    const currentReportDateStr = currentReportDate.toISOString().split('T')[0];

    // Фільтрація по періоду
    if (period !== "all") {
        const days = parseInt(period, 10);
        let fromDate = new Date(currentReportDate);
        
        // Якщо вибрано "За добу" (days = 1), ми хочемо бачити дані лише за останню ПОВНУ зміну
        // Або за поточну, залежно від вашої задачі. Зазвичай для ТОП-напрямків беруть останню зміну:
        fromDate.setDate(fromDate.getDate() - (days - 1)); 
        
        query = query.gte("flight_date", fromDate.toISOString().split('T')[0]);
    }

    const { data, error } = await query;
    if (error) {
        console.error("Помилка завантаження даних:", error.message);
        return;
    }

    // Рендер графіків (використовуємо кириличні назви категорій, як у вашій таблиці DB)
    renderDirectionChart(data, "МОЛНІЯ", "molniyaChart", "molniya");
    renderDirectionChart(data, "ФПВ", "fpvChart", "fpv");
}

function renderDirectionChart(data, category, canvasId, key) {
    // Фільтруємо потрібну категорію дронів
    const subset = data.filter(r => r.drone_category === category);
    
    // Сумуємо daily_count по напрямках
    const groups = subset.reduce((acc, r) => {
        acc[r.direction] = (acc[r.direction] || 0) + r.daily_count;
        return acc;
    }, {});

    // Сортуємо від більшого до меншого
    let sorted = Object.entries(groups).sort((a, b) => b[1] - a[1]);
    let finalLabels = [], finalValues = [];

    // Логіка для ТОП-5 + ІНШІ
    if (sorted.length > 5) {
        const top5 = sorted.slice(0, 5);
        const others = sorted.slice(5).reduce((sum, el) => sum + el[1], 0);
        
        finalLabels = top5.map(e => e[0]);
        finalValues = top5.map(e => e[1]);
        
        finalLabels.push("ІНШІ");
        finalValues.push(others);
    } else {
        finalLabels = sorted.map(e => e[0]);
        finalValues = sorted.map(e => e[1]);
    }

    const total = finalValues.reduce((a, b) => a + b, 0);

    // Знищуємо старий графік перед малюванням нового
    if (charts[key]) charts[key].destroy();

    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    charts[key] = new Chart(ctx, {
        type: 'bar',
        plugins: [ChartDataLabels],
        data: {
            labels: finalLabels,
            datasets: [{
                data: finalValues,
                backgroundColor: finalLabels.map(l => l === "ІНШІ" ? "#64748b" : "#38bdf8"),
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
                    formatter: (val) => `${val} (${total > 0 ? Math.round((val / total) * 100) : 0}%)`
                }
            },
            scales: {
                x: { 
                    beginAtZero: true, 
                    grid: { color: '#334155', drawBorder: false }, 
                    ticks: { color: '#94a3b8' } 
                },
                y: { 
                    grid: { display: false }, 
                    ticks: { color: '#f8fafc', font: { weight: '600' } } 
                }
            }
        }
    });
}

// Запускаємо при зміні селектора та при старті
document.getElementById("daysFilter").addEventListener("change", updateDirectionStats);
updateDirectionStats();
