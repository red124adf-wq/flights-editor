// Р’РёРєРѕСЂРёСЃС‚РѕРІСѓС”РјРѕ РіР»РѕР±Р°Р»СЊРЅРёР№ РєР»С–С”РЅС‚ Supabase
const supabaseClient = window.supabaseClient;
const opDay = window.OPERATIONAL_DAY;
let crewChart = null;

async function updateCrewStats() {
    if (!supabaseClient) {
        console.error("Supabase Client РЅРµ Р·РЅР°Р№РґРµРЅРѕ!");
        return;
    }

    const period = document.getElementById("daysFilter").value;
    let query = supabaseClient.from("crew_daily_stats").select("*");

    const currentOperationalDateStr = opDay?.getOperationalDateISO
        ? opDay.getOperationalDateISO()
        : new Date().toISOString().split("T")[0];

    if (period !== "all") {
        const days = parseInt(period, 10);
        const fromDateStr = opDay?.shiftISODate
            ? opDay.shiftISODate(currentOperationalDateStr, -(days - 1))
            : currentOperationalDateStr;
        query = query.gte("flight_date", fromDateStr);
    }

    const { data, error } = await query;

    if (error) {
        console.error("РџРѕРјРёР»РєР° Р·Р°РІР°РЅС‚Р°Р¶РµРЅРЅСЏ РґР°РЅРёС…:", error.message);
        return;
    }

    const crewSummary = data.reduce((acc, item) => {
        acc[item.crew_name] = (acc[item.crew_name] || 0) + item.daily_count;
        return acc;
    }, {});

    const sorted = Object.entries(crewSummary)
        .map(([crew, count]) => ({ crew, count }))
        .sort((a, b) => b.count - a.count);

    const totalFlights = sorted.reduce((sum, item) => sum + item.count, 0);

    let labels = [];
    let values = [];

    if (sorted.length > 15) {
        const top15 = sorted.slice(0, 15);
        const othersCount = sorted.slice(15).reduce((sum, item) => sum + item.count, 0);
        labels = top15.map((i) => i.crew);
        values = top15.map((i) => i.count);
        labels.push("\u0406\u043D\u0448\u0456 \u0435\u043A\u0456\u043F\u0430\u0436\u0456");
        values.push(othersCount);
    } else {
        labels = sorted.map((i) => i.crew);
        values = sorted.map((i) => i.count);
    }

    renderChart(labels, values, totalFlights);
}

function renderChart(labels, values, total) {
    if (crewChart) crewChart.destroy();

    const canvas = document.getElementById("crewChart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    crewChart = new Chart(ctx, {
        type: "bar",
        plugins: [ChartDataLabels],
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: labels.map((l) => (l === "\u0406\u043D\u0448\u0456 \u0435\u043A\u0456\u043F\u0430\u0436\u0456" ? "#64748b" : "#38bdf8")),
                borderRadius: 4,
                barThickness: 18
            }]
        },
        options: {
            indexAxis: "x",
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 30 } },
            plugins: {
                legend: { display: false },
                datalabels: {
                    anchor: "end",
                    align: "top",
                    color: "#f8fafc",
                    font: { weight: "bold", size: 12 },
                    formatter: (val) => `${val} (${total > 0 ? Math.round((val / total) * 100) : 0}%)`
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: "#f8fafc", font: { size: 11, weight: "600" } }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: "#334155", drawBorder: false },
                    ticks: { color: "#94a3b8" }
                }
            }
        }
    });
}

document.getElementById("daysFilter").addEventListener("change", updateCrewStats);
updateCrewStats();
