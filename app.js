/* ==============================
   SUPABASE CLIENT
================================ */
const supabaseClient = window.supabase.createClient(
  "https://opuosltpihrhnpyxcxnm.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wdW9zbHRwaWhyaG5weXhjeG5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNTM4NjgsImV4cCI6MjA4MzYyOTg2OH0.3oLcak4XWxEFaP81HrzCss9BwekV6HoNB--82Zp3-uE"
);

/* ==============================
   HELPERS (FORMAT)
================================ */
function formatDateUA(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

function formatTimeNoSeconds(timeStr) {
  if (!timeStr) return "";
  return timeStr.slice(0, 5);
}

/* ==============================
   AUTH
================================ */
window.login = async function () {
  const status = document.getElementById("status");
  status.innerText = "⏳ Вхід…";

  const email = emailInput.value;
  const password = passwordInput.value;

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    status.innerText = "❌ " + error.message;
    return;
  }

  status.innerText = "✅ Вхід успішний";
  loadLast10();
  loadData();
};

/* ==============================
   LAST 10 RECORDS
================================ */
window.loadLast10 = async function () {
  const { data, error } = await supabaseClient
    .from("flights")
    .select("date, time, from_m, to_t, crew, video, action")
    .order("date", { ascending: false })
    .order("time", { ascending: false })
    .limit(10);

  if (error) return console.error(error);

  const table = document.getElementById("last10");
  table.innerHTML = "";
  if (!data || data.length === 0) return;

  const rows = data.reverse();

  const columns = [
    { key: "date", label: "Дата", format: formatDateUA },
    { key: "time", label: "Час", format: formatTimeNoSeconds },
    { key: "from_m", label: "Звідки" },
    { key: "to_t", label: "Куди" },
    { key: "crew", label: "Екіпаж" },
    { key: "video", label: "Відео" },
    { key: "action", label: "Дії" }
  ];

  table.innerHTML =
    "<tr>" + columns.map(c => `<th>${c.label}</th>`).join("") + "</tr>";

  rows.forEach(row => {
    table.innerHTML +=
      "<tr class='readonly'>" +
      columns.map(c =>
        `<td>${c.format ? c.format(row[c.key]) : (row[c.key] ?? "")}</td>`
      ).join("") +
      "</tr>";
  });
};

/* ==============================
   ADD NEW FLIGHT
================================ */
window.addFlight = async function () {
  const payload = {
    date: f_date.value,
    time: f_time.value,
    from_m: f_from.value,
    to_t: f_to.value,
    crew: f_crew.value,
    video: f_video.value,
    action: f_action.value
  };

  const { error } = await supabaseClient.from("flights").insert(payload);
  if (error) return alert(error.message);

  document.querySelectorAll("#addForm input").forEach(i => i.value = "");
  loadLast10();
  loadData();
};

/* ==============================
   FULL TABLE
================================ */
window.loadData = async function () {
  const { data, error } = await supabaseClient
    .from("flights")
    .select("*")
    .order("id");

  if (error) return alert(error.message);

  const table = document.getElementById("table");
  table.innerHTML = "";
  if (!data || data.length === 0) return;

  const headers = Object.keys(data[0]);
  table.innerHTML =
    "<tr>" + headers.map(h => `<th>${h}</th>`).join("") + "</tr>";

  data.forEach(row => {
    table.innerHTML +=
      "<tr>" +
      headers.map(h =>
        h === "id"
          ? `<td>${row[h]}</td>`
          : `<td contenteditable onblur="save(${row.id}, '${h}', this.innerText)">
              ${row[h] ?? ""}
            </td>`
      ).join("") +
      "</tr>";
  });
};

/* ==============================
   SAVE CELL
================================ */
window.save = async function (id, field, value) {
  await supabaseClient
    .from("flights")
    .update({ [field]: value })
    .eq("id", id);
};
