// Використовуємо глобальний клієнт Supabase
const supabaseClient = window.supabaseClient;
let crewChart = null;

async function updateCrewStats() {
    if (!supabaseClient) {
        console.error("Supabase Client не знайдено!");
        return;
    }

    const period = document.getElementById("daysFilter").value;
    let query = supabaseClient.from("crew_daily_stats").select("*");

    // --- ЛОГІКА ОПЕРАТИВНОЇ ДОБИ (04:40) ---
    const now = new Date();
    const today0440 = new Date(now);
    today0440.setHours(4, 40, 0, 0);

    // Визначаємо поточну оперативну дату
    let currentOperationalDate = new Date(now);
    if (now < today0440) {
        // Якщо ще не настав час 04:40, ми все ще в попередній звітній добі
        currentOperationalDate.setDate(currentOperationalDate.getDate() - 1);
    }

    if (period !== "all") {
        const days = parseInt(period, 10);
        let fromDate = new Date(currentOperationalDate);
        
        // Віднімаємо кількість днів від оперативної дати
        // Для period="1" (За добу) покаже саме поточну оперативну дату
        fromDate.setDate(fromDate.getDate() - (days - 1)); 
        
        query = query.gte("flight_date", fromDate.toISOString().split('T')[0]);
    }
    // ---------------------------------------

    const { data, error } = await query;

    if (error) {
        console.error("Помилка завантаження даних:", error.message);
        return;
    }

    // Решта логіки агрегації залишається без змін
    const crewSummary = data.reduce((acc, item) => {
        acc[item.crew_name] = (acc[item.crew_name] || 0) + item.daily_count;
        return acc;
    }, {});

    let sorted = Object.entries(crewSummary)
        .map(([crew, count]) => ({ crew, count }))
        .sort((a, b) => b.count - a.count);
    
    const totalFlights = sorted.reduce((sum, item) => sum + item.count, 0);

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
