// === Supabase client ===
const supabaseClient = window.supabase.createClient(
  "https://opuosltpihrhnpyxcxnm.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wdW9zbHRwaWhyaG5weXhjeG5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNTM4NjgsImV4cCI6MjA4MzYyOTg2OH0.3oLcak4XWxEFaP81HrzCss9BwekV6HoNB--82Zp3-uE"
);
let chartInstance = null;

function toISO(d) {
  return d.toISOString().split("T")[0];
}

function daysBefore(baseDate, n) {
  const d = new Date(baseDate);
  d.setDate(d.getDate() - n);
  return toISO(d);
}

async function loadMolniyaMonth(baseDateISO) {
  const to = baseDateISO;
  const from = daysBefore(baseDateISO, 30);

  const { data, error } = await supabaseClient
    .from("flights")
    .select("date")
    .eq("crew", "МОЛНІЯ")
    .gte("date", from)
    .lte("date", to);

  if (error) {
    alert(error.message);
    return;
  }

  const map = {};
  data.forEach(r => {
    map[r.date] = (map[r.date] || 0) + 1;
  });

  const labels = [];
  const values = [];

  for (let i = 30; i >= 0; i--) {
    const d = daysBefore(baseDateISO, i);
    labels.push(d.split("-").reverse().join("."));
    values.push(map[d] || 0);
  }

  drawChart(labels, values);
}

function drawChart(labels, values) {
  const ctx = document.getElementById("molniyaChart");

  if (chartInstance) {
    chartInstance.destroy();
  }

  const maxValue = Math.max(...values);

  chartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        data: values,
        borderColor: "#4a90e2",
        backgroundColor: "rgba(74,144,226,0.12)",
        fill: true,
        tension: 0.35,
        pointRadius: values.map(v => v === maxValue ? 7 : 4),
        pointBackgroundColor: values.map(v =>
          v === maxValue ? "#e74c3c" : "#4a90e2"
        )
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

// === INIT ===
const baseDateInput = document.getElementById("baseDate");
const todayISO = new Date().toISOString().split("T")[0];

baseDateInput.value = todayISO;
loadMolniyaMonth(todayISO);

baseDateInput.addEventListener("change", e => {
  loadMolniyaMonth(e.target.value);
});
