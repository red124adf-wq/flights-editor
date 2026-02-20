/* ==============================
   SUPABASE CLIENT
================================ */
const supabaseClient = window.supabase.createClient(
  "https://opuosltpihrhnpyxcxnm.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wdW9zbHRwaWhyaG5weXhjeG5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNTM4NjgsImV4cCI6MjA4MzYyOTg2OH0.3oLcak4XWxEFaP81HrzCss9BwekV6HoNB--82Zp3-uE"
);
const GLOBAL_START_DATE = "2025-12-05";

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
  initFPV();
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
let fpvFrom = null;
let fpvTo   = null;

function setPeriodLabel(from, to) {
  const el = document.querySelector(".molniya-report .period-label");
  el.innerText = `Стат. за період з ${formatDateForLabel(from)} по ${formatDateForLabel(to)}`;
}

function setFPVPeriodLabel(from, to) {
  const el = document.querySelector(".fpv-report .period-label");
  el.innerText = `Стат. за період з ${formatDateForLabel(from)} по ${formatDateForLabel(to)}`;
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

async function loadFPVReport(from, to) {
  let q = supabaseClient
    .from("flights")
    .select("action")
    .not("crew", "in", '("МОЛНІЯ","ОПТОВОЛОКНО")');

  if (from) q = q.gte("date", from);
  if (to)   q = q.lte("date", to);

  const { data } = await q;

  const stats = { "Збито":0, "Подавлено":0, "Зник":0, "Удар":0 };
  data?.forEach(r => stats[r.action] !== undefined && stats[r.action]++);

  const total = Object.values(stats).reduce((a,b)=>a+b,0);

  document
    .querySelectorAll(".fpv-report .report-table tr")
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

function initFPVRange() {
  const inFrom = document.getElementById("fpv-from");
  const inTo   = document.getElementById("fpv-to");

  const today = todayISO();
  inFrom.value = today;
  inTo.value = today;

  fpvFrom = today;
  fpvTo = today;

  setFPVPeriodLabel(fpvFrom, fpvTo);
  loadFPVReport(fpvFrom, fpvTo);

  inFrom.addEventListener("input", () => {
    fpvFrom = inFrom.value;
    if (inTo.value < fpvFrom) inTo.value = fpvFrom;
    fpvTo = inTo.value;
    setFPVPeriodLabel(fpvFrom, fpvTo);
    loadFPVReport(fpvFrom, fpvTo);
  });

  inTo.addEventListener("input", () => {
    fpvTo = inTo.value;
    if (fpvTo < fpvFrom) {
      fpvTo = fpvFrom;
      inTo.value = fpvFrom;
    }
    setFPVPeriodLabel(fpvFrom, fpvTo);
    loadFPVReport(fpvFrom, fpvTo);
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
			from = GLOBAL_START_DATE;
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

function initFPVPeriodButtons() {
  document
    .querySelectorAll(".fpv-report button[data-period]")
    .forEach(btn => {
      btn.addEventListener("click", async () => {
        let from, to = todayISO();
        const p = btn.dataset.period;

        if (p === "all")   from = GLOBAL_START_DATE;;
        if (p === "month") from = monthsAgoISO(1);
        if (p === "week")  from = daysAgoISO(7);
        if (p === "day")   from = todayISO();

        fpvFrom = from;
        fpvTo = to;

        document.getElementById("fpv-from").value = from;
        document.getElementById("fpv-to").value = to;

        setFPVPeriodLabel(from, to);
        loadFPVReport(from, to);
      });
    });
}

function initMolniya() {
  initMolniyaPeriodButtons();
  initMolniyaRange();
}

function initFPV() {
  initFPVPeriodButtons();
  initFPVRange();
}

/* ==============================
   SHIFT MODAL
================================ */
function pluralMolniya(n) {
  if (n === 1) return "МОЛНІЯ";
  if (n >= 2 && n <= 4) return "МОЛНІЇ";
  return "МОЛНІЙ";
}

function pluralOther(n) {
  if (n === 1) return "ФПВ";
  if (n >= 2 && n <= 4) return "ФПВ";
  return "ФПВ";
}

window.openShiftModal = async function () {

  const { data, error } = await supabaseClient
    .from("flights_shift_live")
    .select("*");

  if (error) {
    console.error(error);
    alert("Помилка отримання даних");
    return;
  }

  let dayMolniya = 0;
let dayOther = 0;
let nightMolniya = 0;
let nightOther = 0;

let dayMolniyaLoc = "";
let dayOtherLoc = "";
let nightMolniyaLoc = "";
let nightOtherLoc = "";
let dayPeriod = "";
let nightPeriod = "";

  data.forEach(row => {

    const isDay =
      row.period_label.includes("04.40") &&
      row.period_label.includes("15.40");
if (isDay) {
  dayPeriod = row.period_label;
} else {
  nightPeriod = row.period_label;
}
    if (isDay) {

  if (row.crew_type === "МОЛНІЯ") {
    dayMolniya = row.total;
    dayMolniyaLoc = row.location || "";
  }

  if (row.crew_type === "ІНШІ") {
    dayOther = row.total;
    dayOtherLoc = row.location || "";
  }

} else {

  if (row.crew_type === "МОЛНІЯ") {
    nightMolniya = row.total;
    nightMolniyaLoc = row.location || "";
  }

  if (row.crew_type === "ІНШІ") {
    nightOther = row.total;
    nightOtherLoc = row.location || "";
  }

}
  });

  document.getElementById("shiftNightText").innerHTML =
  `<div style="font-family:monospace; line-height:1.6;">
     <div style="display:flex; justify-content:space-between; font-weight:700;">
        <span>🌙 НІЧ</span>
        <span>${nightPeriod || ""}</span>
     </div>
     <div style="border-top:2px solid #000; margin:6px 0 10px 0;"></div>

     🛩️ МОЛНІЯ : ${nightMolniya}<br>
     🌍 ЛОКАЦІЇ : ${nightMolniyaLoc || "—"}<br><br>

     🛸 ФПВ     : ${nightOther}<br>
     🌍 ЛОКАЦІЇ : ${nightOtherLoc || "—"}<br>

     <div style="border-bottom:2px solid #000; margin:10px 0;"></div>
   </div>`;

document.getElementById("shiftDayText").innerHTML =
  `<div style="font-family:monospace; line-height:1.6;">
     <div style="display:flex; justify-content:space-between; font-weight:700;">
        <span>🌞 ДЕНЬ</span>
        <span>${dayPeriod || ""}</span>
     </div>
     <div style="border-top:2px solid #000; margin:6px 0 10px 0;"></div>

     🛩️ МОЛНІЯ : ${dayMolniya}<br>
     🌍 ЛОКАЦІЇ : ${dayMolniyaLoc || "—"}<br><br>

     🛸 ФПВ     : ${dayOther}<br>
     🌍 ЛОКАЦІЇ : ${dayOtherLoc || "—"}<br>

     <div style="border-bottom:2px solid #000; margin:10px 0;"></div>
   </div>`;

  document.getElementById("shiftModal").classList.remove("hidden");
}

window.closeShiftModal = function () {
  document.getElementById("shiftModal").classList.add("hidden");
}
