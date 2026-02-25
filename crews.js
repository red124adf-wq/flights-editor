// Використовуємо глобальний клієнт Supabase
const supabaseClient = window.supabaseClient;
let crewChart = null;

async function updateCrewStats() {
    // Перевірка наявності клієнта
    if (!supabaseClient) {
        console.error("Supabase Client не знайдено! Перевірте підключення supabaseClient.js");
        return;
    }

    const period = document.getElementById("daysFilter").value;
    
    // Запитуємо дані з нашої ефективної View
    let query = supabaseClient.from("crew_daily_stats").select("*");

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

    // Сумуємо daily_count
    const crewSummary = data.reduce((acc, item) => {
        acc[item.crew_name] = (acc[item.crew_name] || 0) + item.daily_count;
        return acc;
    }, {});

    // Сортуємо від більшого до меншого
    let sorted = Object.entries(crewSummary)
        .map(([crew, count]) => ({ crew, count }))
        .sort((a, b) => b.count - a.count);
    
    const totalFlights = sorted.reduce((sum, item) => sum + item.count, 0);

    // Логіка ТОП-10 + ІНШІ
    let labels = [], values = [];
    
    if (sorted.length > 10) {
        const top10 = sorted.slice(0, 10);
        const othersCount = sorted.slice(10).reduce((sum, item) => sum + item.count, 0);
        
        labels = top10.map(i => i.crew);
        values = top10.map(i => i.count);
        
        labels.push("ІНШІ");
        values.push(othersCount);
    } else {
        labels = sorted.map(i => i.crew);
        values = sorted.map(i => i.count);
    }

    renderChart(labels, values, totalFlights);
}

function renderChart(labels, values, total) {
    if (crewChart) crewChart.destroy();
    
    const canvas = document.getElementById("crewChart");
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    crewChart = new Chart(ctx, {
        type: 'bar',
        plugins: [ChartDataLabels],
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: labels.map(l => l === "ІНШІ" ? "#64748b" : "#38bdf8"),
                borderRadius: 4,
                barThickness: 18
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { right: 100 } },
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
                    ticks: { color: '#f8fafc', font: { size: 11 } } 
                }
            }
        }
    });
}

// Запускаємо при зміні селектора та при старті
document.getElementById("daysFilter").addEventListener("change", updateCrewStats);
updateCrewStats();