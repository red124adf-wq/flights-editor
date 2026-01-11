/* ================= AUTH ================= */
window.login = async function () {
  const { error } = await supabaseClient.auth.signInWithPassword({
    email: emailInput.value,
    password: passwordInput.value
  });

  status.innerText = error ? error.message : "Успішно";

  if (!error) {
    await loadSelect("locations", "f_from");
    await loadSelect("locations", "f_to");
    await loadSelect("crews", "f_crew");
    await loadSelect("actions", "f_action");
    loadLast10();
  }
};

/* ================= SELECT LOAD ================= */
async function loadSelect(table, selectId) {
  const { data } = await supabaseClient
    .from(table)
    .select("name")
    .order("name");

  const s = document.getElementById(selectId);
  s.innerHTML = "<option value=''>— обрати —</option>";

  data.forEach(r => {
    const o = document.createElement("option");
    o.value = r.name;
    o.textContent = r.name;
    s.appendChild(o);
  });
}

/* ================= FLIGHTS ================= */
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
  if (error) alert(error.message);
  loadLast10();
};

window.loadLast10 = async function () {
  const { data } = await supabaseClient
    .from("flights")
    .select("date,time,from_m,to_t,crew,video,action")
    .order("date", { ascending: false })
    .order("time", { ascending: false })
    .limit(10);

  const t = document.getElementById("last10");
  t.innerHTML = `
    <tr>
      <th>Дата</th><th>Час</th><th>Звідки</th><th>Куди</th>
      <th>Екіпаж</th><th>Відео</th><th>Дія</th>
    </tr>`;

  data.reverse().forEach(r => {
    t.innerHTML += `
      <tr>
        <td>${r.date}</td><td>${r.time}</td>
        <td>${r.from_m}</td><td>${r.to_t}</td>
        <td>${r.crew}</td><td>${r.video}</td><td>${r.action}</td>
      </tr>`;
  });
};

/* ================= DIALOG ================= */

let currentTable = null;
let currentSelectId = null;

window.openDialog = function (table, selectId) {
  currentTable = table;
  currentSelectId = selectId;

  document.getElementById("dialogInput").value = "";
  document.getElementById("dialogTitle").innerText = "Додати";

  document.getElementById("dictDialog").classList.remove("hidden");
};

window.closeDialog = function () {
  document.getElementById("dictDialog").classList.add("hidden");
};

window.confirmDialog = async function () {
  const value = document.getElementById("dialogInput").value.trim();
  if (!value) return;

  const { error } = await supabaseClient
    .from(currentTable)
    .insert({ name: value });

  if (error) {
    alert(error.message);
    return;
  }

  await loadSelect(currentTable, currentSelectId);
  document.getElementById(currentSelectId).value = value;

  window.closeDialog();
};
