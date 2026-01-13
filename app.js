/* ==============================
   SUPABASE CLIENT
================================ */
const supabaseClient = window.supabase.createClient(
  "https://opuosltpihrhnpyxcxnm.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wdW9zbHRwaWhyaG5weXhjeG5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNTM4NjgsImV4cCI6MjA4MzYyOTg2OH0.3oLcak4XWxEFaP81HrzCss9BwekV6HoNB--82Zp3-uE"
);

/* ==============================
   HELPERS
================================ */
function formatDateUA(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

function formatDateForLabel(dateStr) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

function formatTimeNoSeconds(timeStr) {
  return timeStr ? timeStr.slice(0, 5) : "";
}

/* ==============================
   DATE HELPERS
================================ */
function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function monthsAgoISO(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().split("T")[0];
}

/* ==============================
   AUTH
================================ */
window.login = async function () {
  const status = document.getElementById("status");
  status.innerText = "⏳ Вхід…";

  const { error } = await supabaseClient.auth.signInWithPassword({
    email: emailInput.value,
    password: passwordInput.value
  });

  if (error) {
    status.innerText = "❌ " + error.message;
    return;
  }

  status.innerText = "✅ Вхід успішний";

  document.querySelector(".login-box").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");

  await loadSelect("locations", "f_from", "Звідки");
  await loadSelect("locations", "f_to", "Куди");
  await loadSelect("crews", "f_crew", "Екіпаж");
  await loadSelect("actions", "f_action", "Дія");

  loadLast10();
  initMolniya();
};

/* ==============================
   AUTH GUARD
================================ */
async function requireAuth() {
  const { data } = await supabaseClient.auth.getSession();
  return !!data.session;
}

/* ==============================
   LAST 10
================================ */
window.loadLast10 = async function () {
  const { data } = await supabaseClient
    .from("flights")
    .select("date,time,from_m,to_t,crew,video,action")
    .order("date", { ascending: false })
    .order("time", { ascending: false })
    .limit(10);

  const table = document.getElementById("last10");
  table.innerHTML = "";

  if (!data) return;

  table.innerHTML =
    "<tr><th>Дата</th><th>Час</th><th>Звідки</th><th>Куди</th><th>Екіпаж</th><th>Відео</th><th>Дії</th></tr>";

  data.reverse().forEach(r => {
    table.innerHTML += `
      <tr class="readonly">
        <td>${formatDateUA(r.date)}</td>
        <td>${formatTimeNoSeconds(r.time)}</td>
        <td>${r.from_m}</td>
        <td>${r.to_t}</td>
        <td>${r.crew}</td>
        <td>${r.video || ""}</td>
        <td>${r.action}</td>
      </tr>`;
  });
};

/* ==============================
   ADD FLIGHT
================================ */
window.addFlight = async function () {
  if (!(await requireAuth())) return;

  if (!f_date.value || !f_time.value ||
      !f_from.value || !f_to.value ||
      !f_crew.value || !f_action.value) {
    return alert("Заповни всі обовʼязкові поля");
  }

  const { error } = await supabaseClient.from("flights").insert({
    date: f_date.value,
    time: f_time.value,
    from_m: f_from.value,
    to_t: f_to.value,
    crew: f_crew.value,
    video: f_video.value,
    action: f_action.value
  });

  if (error) return alert(error.message);

  document.querySelectorAll("#addForm input").forEach(i => i.value = "");
  document.querySelectorAll("#addForm select").forEach(s => s.selectedIndex = 0);

  loadLast10();
  loadMolniyaReport(manualFrom, manualTo);
};

/* ==============================
   SELECT LOADERS
================================ */
async function loadSelect(table, id, placeholder) {
  const { data, error } = await supabaseClient
    .from(table)
    .select("name")
    .order("name");

  if (error) {
    console.error(error);
    return;
  }

  const sel = document.getElementById(id);
  sel.innerHTML = `<option value="">— ${placeholder} —</option>`;

  data.forEach(r => {
    sel.innerHTML += `<option value="${r.name}">${r.name}</option>`;
  });
}

/* ==============================
   ADD VALUE (⋯ BUTTONS)
================================ */
let currentTable = null;
let currentSelectId = null;

document.querySelectorAll(".add-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    currentTable = btn.dataset.table;
    currentSelectId = btn.dataset.select;

    document.getElementById("dialogTitle").innerText =
      `Додати значення до "${currentTable}"`;

    document.getElementById("dialogInput").value = "";
    document.getElementById("addDialog").classList.remove("hidden");
  });
});

document.getElementById("dialogCancel").addEventListener("click", () => {
  document.getElementById("addDialog").classList.add("hidden");
});

document.getElementById("dialogOk").addEventListener("click", async () => {
  const value = document.getElementById("dialogInput").value.trim();
  if (!value) return;

  const { error } = await supabaseClient
    .from(currentTable)
    .insert({ name: value });

  if (error) {
    alert(error.message);
    return;
  }

  await loadSelect(currentTable, currentSelectId, "обрати");
  document.getElementById(currentSelectId).value = value;
  document.getElementById("addDialog").classList.add("hidden");
});

/* ==============================
   M O L N I Y A
================================ */
let manualFrom = null;
let manualTo   = null;

function setPeriodLabel(from, to) {
  const el = document.querySelector(".molniya-report .period-label");
  el.innerText = `За період з ${formatDateForLabel(from)} по ${formatDateForLabel(to)}`;
}

async function loadMolniyaReport(from, to) {
  let q = supabaseClient
    .from("flights")
    .select("action")
    .eq("crew", "МОЛНІЯ");

  if (from) q = q.gte("date", from);
  if (to)   q = q.lte("date", to);

  const { data } = await q;

  const stats = { "Збито":0, "Подавлено":0, "Зник":0, "Удар":0 };
  data?.forEach(r => stats[r.action] !== undefined && stats[r.action]++);

  const total = Object.values(stats).reduce((a,b)=>a+b,0);

  document.querySelectorAll(".molniya-report .report-table tr")
    .forEach((tr,i)=>{
      if(i===0) return;
      const name = tr.children[0].innerText;
      const count = name==="Виявлено" ? total : (stats[name]||0);
      tr.children[1].innerText = count;
      tr.children[2].innerText = total ? Math.round(count/total*100)+"%" : "0%";
    });
}

/* ==============================
   INIT MOLNIYA
================================ */
async function getMolniyaFirstDate() {
  const { data } = await supabaseClient
    .from("flights")
    .select("date")
    .eq("crew", "МОЛНІЯ")
    .order("date", { ascending: true })
    .limit(1);

  return data?.[0]?.date || todayISO();
}

function initMolniyaRange() {
  const inFrom = document.getElementById("molniya-from");
  const inTo   = document.getElementById("molniya-to");

  const today = todayISO();
  inFrom.value = today;
  inTo.value = today;

  manualFrom = today;
  manualTo = today;

  setPeriodLabel(manualFrom, manualTo);
  loadMolniyaReport(manualFrom, manualTo);

  inFrom.addEventListener("input", () => {
    manualFrom = inFrom.value;
    if (inTo.value < manualFrom) inTo.value = manualFrom;
    manualTo = inTo.value;
    setPeriodLabel(manualFrom, manualTo);
    loadMolniyaReport(manualFrom, manualTo);
  });

  inTo.addEventListener("input", () => {
    manualTo = inTo.value;
    if (manualTo < manualFrom) {
      manualTo = manualFrom;
      inTo.value = manualFrom;
    }
    setPeriodLabel(manualFrom, manualTo);
    loadMolniyaReport(manualFrom, manualTo);
  });
}

function initMolniyaPeriodButtons() {
  document
    .querySelectorAll(".molniya-report button[data-period]")
    .forEach(btn => {
      btn.addEventListener("click", async () => {
        let from, to = todayISO();
        const p = btn.dataset.period;

        if (p === "all") {
          from = await getMolniyaFirstDate();
        }
        if (p === "month") from = monthsAgoISO(1);
        if (p === "week")  from = daysAgoISO(7);
        if (p === "day")   from = todayISO();

        manualFrom = from;
        manualTo = to;

        document.getElementById("molniya-from").value = from;
        document.getElementById("molniya-to").value = to;

        setPeriodLabel(from, to);
        loadMolniyaReport(from, to);
      });
    });
}

function initMolniya() {
  initMolniyaPeriodButtons();
  initMolniyaRange();
}
