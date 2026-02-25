const supabaseClient = window.supabaseClient;

let chartInstance = null;

// Хелпери для дати
const toISO = (d) => d.toISOString().split("T")[0];
const reverseDate = (str) => str.split("-").reverse().join(".");

async function loadData(baseDateISO) {
    if (!supabaseClient) {
        console.error("Supabase Client не знайдено!");
        return;
    }

    const to = baseDateISO;
    const from = new Date(baseDateISO);
    from.setDate(from.getDate() - 30);
    const fromISO = toISO(from);

    // Оновлення підзаголовка
    document.getElementById("periodDisplay").innerText = `Період: ${reverseDate(fromISO)} — ${reverseDate(to)}`;

    const { data, error } = await supabaseClient
        .from("flights")
        .select("date")
        .eq("crew", "МОЛНІЯ")
        .gte("date", fromISO)
        .lte("date", to);

    if (error) {
        console.error("Помилка завантаження даних:", error.message);
        return;
    }

    // Агрегація даних: рахуємо кількість по кожному дню
    const counts = data.reduce((acc, r) => {
        acc[r.date] = (acc[r.date] || 0) + 1;
        return acc;
    }, {});

    const labels = [];
    const values = [];

    // Збираємо масив за останні 30 днів
    for (let i = 30; i >= 0; i--) {
        const d = new Date(baseDateISO);
        d.setDate(d.getDate() - i);
        const dateStr = toISO(d);
        
        // Перетворюємо YYYY-MM-DD у DD.MM для підписів знизу
        const shortDate = dateStr.slice(5).split('-').reverse().join('.');
        
        labels.push(shortDate);
        values.push(counts[dateStr] || 0);
    }

    const maxValue = Math.max(...values, 0);

    // Якщо графік вже існує, знищуємо перед новим малюванням
    if (chartInstance) chartInstance.destroy();

    const ctx = document.getElementById("molniyaChart").getContext("2d");

    chartInstance = new Chart(ctx, {
        type: 'bar',
        plugins: [ChartDataLabels],
        data: {
            labels: labels,
            datasets: [{
                label: "Кількість вильотів",
                data: values,
                // Найбільше значення (рекорд) - червоне, інші - блакитні
                backgroundColor: values.map(v => (v === maxValue && v > 0) ? '#ef4444' : '#0ea5e9'),
                borderRadius: 4,
                barThickness: 'flex'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                datalabels: {
                    align: 'top',
                    anchor: 'end',
                    offset: 4,
                    // Колір цифри над рекордним стовпчиком теж підсвічуємо
                    color: (ctx) => (ctx.dataset.data[ctx.dataIndex] === maxValue && maxValue > 0) ? '#f87171' : '#94a3b8',
                    font: { weight: 'bold', size: 11 },
                    formatter: (v) => v > 0 ? v : '' // не показуємо нулі для чистоти
                },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleColor: '#f8fafc',
                    bodyColor: '#f8fafc',
                    padding: 12,
                    titleFont: { size: 14 },
                    callbacks: {
                        label: (ctx) => ` Активність: ${ctx.raw} од.`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8', font: { size: 10 } }
                },
                y: {
                    beginAtZero: true,
                    // Додаємо трохи порожнього місця зверху, щоб цифри не обрізалися
                    suggestedMax: maxValue + Math.ceil(maxValue * 0.15) + 1,
                    grid: { color: '#334155', drawBorder: false },
                    ticks: { color: '#94a3b8', stepSize: 1 }
                }
            }
        }
    });
}

// ІНІЦІАЛІЗАЦІЯ
const baseDateInput = document.getElementById("baseDate");

// Встановлюємо правильний київський час для "сьогодні"
const kyivDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Kyiv" }));
const todayISO = toISO(kyivDate);

baseDateInput.value = todayISO;
baseDateInput.max = todayISO; // Забороняємо вибирати дати в майбутньому

// Оновлюємо графік при зміні дати
baseDateInput.addEventListener("change", (e) => loadData(e.target.value));

// Перший запуск
loadData(todayISO);