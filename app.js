/* =====================================
   1. КОНФІГУРАЦІЯ ТА УТИЛІТИ
===================================== */
const supabaseClient = window.supabaseClient;
const GLOBAL_START_DATE = "2025-12-05";

const formatDateUA = (s) => s ? s.split("-").reverse().join(".") : "";
const formatTimeNoSeconds = (s) => s ? s.slice(0, 5) : "";

const todayISO = () => {
    const kyivDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Kyiv" }));
    return kyivDate.toISOString().split("T")[0];
};

const daysAgoISO = (n) => {
    const kyivDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Kyiv" }));
    kyivDate.setDate(kyivDate.getDate() - n);
    return kyivDate.toISOString().split("T")[0];
};

const monthsAgoISO = (n) => {
    const kyivDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Kyiv" }));
    kyivDate.setMonth(kyivDate.getMonth() - n);
    return kyivDate.toISOString().split("T")[0];
};

/* =====================================
   2. АВТОРИЗАЦІЯ ТА СТАРТ ДОДАТКУ
===================================== */
// Автоматична перевірка сесії при завантаженні сторінки
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        initApp(); // Якщо сесія є - відразу запускаємо додаток
    }
});

// Ручний вхід
window.login = async function () {
    const status = document.getElementById("status");
    const emailInput = document.getElementById("emailInput").value;
    const passwordInput = document.getElementById("passwordInput").value;

    status.innerText = "⏳ Вхід…";

    const { error } = await supabaseClient.auth.signInWithPassword({
        email: emailInput,
        password: passwordInput
    });

    if (error) {
        status.innerText = "❌ " + error.message;
        return;
    }
    initApp();
};

// Вихід з системи
window.logout = async function () {
    await supabaseClient.auth.signOut();
    document.getElementById("app").classList.add("hidden");
    document.getElementById("loginBox").classList.remove("hidden");
    document.getElementById("status").innerText = "";
    document.getElementById("passwordInput").value = "";
};

// Головна функція ініціалізації робочої зони
async function initApp() {
    document.getElementById("loginBox").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");

    await checkUserAccess(); // Перевіряємо права на форму
    
    await Promise.all([
        loadSelect("locations", "f_from", "Звідки"),
        loadSelect("locations", "f_to", "Куди"),
        loadSelect("crews", "f_crew", "Екіпаж"),
        loadSelect("actions", "f_action", "Дія")
    ]);

    loadLast100();
    initAllReports();
}

/* =====================================
   3. ПРАВА ДОСТУПУ (БЛОКУВАННЯ ФОРМИ)
===================================== */
async function checkUserAccess() {
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
        disableFlightForm("Будь ласка, авторизуйтесь");
        return;
    }

    const { data: roleData, error: roleError } = await supabaseClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

    if (roleError || !roleData || roleData.role !== 'admin') {
        disableFlightForm("Тільки адміністратори можуть додавати записи.");
    }
}

function disableFlightForm(message) {
    const container = document.getElementById('addForm');
    const msgElement = document.getElementById('accessMessage');

    if (container) {
        const elements = container.querySelectorAll('input, select, button');
        elements.forEach(el => {
            el.disabled = true;
            el.style.opacity = '0.4';
            el.style.cursor = 'not-allowed';
            el.style.pointerEvents = 'none'; 
        });
        container.style.filter = 'grayscale(0.5)';
    }

    if (msgElement) {
        msgElement.textContent = `⚠️ ${message}`;
        msgElement.classList.remove('hidden');
    }
}

/* =====================================
   4. ТАБЛИЦЯ І ДОДАВАННЯ ДАНИХ
===================================== */
window.loadLast100 = async function () {
    const { data } = await supabaseClient
        .from("flights")
        .select("*")
        .order("date", { ascending: false })
        .order("time", { ascending: false })
        .limit(100);

    const table = document.getElementById("last10");
    if (!data) return;

    let html = `<thead><tr><th>Дата</th><th>Час</th><th>Звідки</th><th>Куди</th><th>Екіпаж</th><th>Відео</th><th>Результат</th></tr></thead><tbody>`;
    data.forEach(r => {
        html += `<tr class="readonly">
            <td>${formatDateUA(r.date)}</td>
            <td>${formatTimeNoSeconds(r.time)}</td>
            <td>${r.from_m}</td>
            <td>${r.to_t}</td>
            <td>${r.crew}</td>
            <td>${r.video || "—"}</td>
            <td><strong>${r.action}</strong></td>
        </tr>`;
    });
    table.innerHTML = html + "</tbody>";
};

window.addFlight = async function () {
    const fields = {
        date: document.getElementById("f_date").value,
        time: document.getElementById("f_time").value,
        from_m: document.getElementById("f_from").value,
        to_t: document.getElementById("f_to").value,
        crew: document.getElementById("f_crew").value,
        video: document.getElementById("f_video").value,
        action: document.getElementById("f_action").value
    };

    if (!fields.date || !fields.time || !fields.action) return alert("Заповніть обов'язкові поля!");

    const { error } = await supabaseClient.from("flights").insert(fields);
    if (error) return alert("Помилка БД: " + error.message);

    document.getElementById("f_video").value = "";
    loadLast100();
    updateAllReports();
};

/* =====================================
   5. СТАТИСТИКА (ЗВІТИ ПО БПЛА)
===================================== */
async function loadReport(type, containerClass) {
    const { data, error } = await supabaseClient.from("flight_statistics").select("*");
    if (error || !data) return;

    const cont = document.querySelector(containerClass);
    if (!cont) return;

    const period = cont.dataset.activePeriod || "day";
    const prefix = period === "all" ? "total" : period;

    let unitName = type === "MOLNIYA" ? 'Молнія' : type === "OPTICS" ? 'Оптика' : 'ФПВ';
    const row = data.find(r => r.unit_type === unitName) || {};

    let fromDate = todayISO();
    if (period === "week") fromDate = daysAgoISO(7);
    if (period === "month") fromDate = monthsAgoISO(1);
    if (period === "all") fromDate = GLOBAL_START_DATE;
    
    const dateLabel = (period === "all") 
        ? `з ${formatDateUA(GLOBAL_START_DATE)} по сьогодні`
        : `з ${formatDateUA(fromDate)} по ${formatDateUA(todayISO())}`;

    const labelEl = cont.querySelector(".period-label");
    if (labelEl) labelEl.innerText = `Період: ${dateLabel}`;

    const totalDetected = row[`${prefix}_detected`] || 0;
    const map = {
        "Виявлено": totalDetected,
        "Збито": row[`${prefix}_shot_down`] || 0,
        "Подавлено": row[`${prefix}_suppressed`] || 0,
        "Зник": row[`${prefix}_lost`] || 0,
        "Удар": row[`${prefix}_strike`] || 0
    };

    cont.querySelectorAll(".report-table tbody tr").forEach(tr => {
        const actionName = tr.cells[0].innerText.trim();
        const count = map[actionName] || 0;
        tr.cells[1].innerText = count;
        tr.cells[2].innerText = totalDetected ? Math.round(count / totalDetected * 100) + "%" : "0%";
    });
}

function updateAllReports() {
    loadReport("MOLNIYA", ".molniya-report");
    loadReport("FPV", ".fpv-report");
    loadReport("OPTICS", ".optics-report");
}

function initAllReports() {
    document.querySelectorAll(".card-block[data-active-period]").forEach(cont => {
        cont.querySelectorAll("button[data-period]").forEach(btn => {
            btn.addEventListener("click", () => {
                cont.querySelectorAll("button").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                cont.dataset.activePeriod = btn.dataset.period;
                updateAllReports();
            });
        });
    });
    updateAllReports();
}

/* =====================================
   6. ВИПАДАЮЧІ СПИСКИ (СЕЛЕКТИ) ТА ДІАЛОГИ
===================================== */
async function loadSelect(table, id, placeholder) {
    const { data } = await supabaseClient.from(table).select("name").order("name");
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = `<option value="">— ${placeholder} —</option>`;
    data?.forEach(r => sel.innerHTML += `<option value="${r.name}">${r.name}</option>`);
}

let curTbl = null, curSelId = null;
document.querySelectorAll(".add-btn").forEach(btn => {
    btn.onclick = () => {
        curTbl = btn.dataset.table;
        curSelId = btn.dataset.select;
        document.getElementById("dialogTitle").innerText = `Додати до "${curTbl}"`;
        document.getElementById("dialogInput").value = "";
        document.getElementById("addDialog").classList.remove("hidden");
    };
});

document.getElementById("dialogOk").onclick = async () => {
    const val = document.getElementById("dialogInput").value.trim();
    if (!val) return;
    const { error } = await supabaseClient.from(curTbl).insert({ name: val });
    if (error) return alert(error.message);
    await loadSelect(curTbl, curSelId, "обрати");
    document.getElementById(curSelId).value = val;
    document.getElementById("addDialog").classList.add("hidden");
};

document.getElementById("dialogCancel").onclick = () => document.getElementById("addDialog").classList.add("hidden");

/* =====================================
   7. ВІКНО "ЗМІНИ" (SHIFT MODAL)
===================================== */
function pluralMolniya(n) {
    if (n === 1) return "МОЛНІЯ";
    if (n >= 2 && n <= 4) return "МОЛНІЇ";
    return "МОЛНІЙ";
}

function formatLocs(loc) {
    return loc ? `<span style="color: #0284c7;">${loc}</span>` : "—";
}

window.openShiftModal = async function () {
    const { data, error } = await supabaseClient.from("flights_shift_live").select("*");
    if (error) return alert("Помилка отримання даних: " + error.message);

    const kyivNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Kyiv" }));
    const minutesNow = kyivNow.getHours() * 60 + kyivNow.getMinutes();
    const isDayActive = minutesNow >= (4 * 60 + 40) && minutesNow < (15 * 60 + 40);

    let dayData = { m: 0, o: 0, mLoc: "", oLoc: "", period: "" };
    let nightData = { m: 0, o: 0, mLoc: "", oLoc: "", period: "" };

    data.forEach(row => {
        const isDayRow = row.period_label.split(" - ")[0].slice(-5) === "04.40";
        let target = isDayRow ? dayData : nightData;
        
        target.period = row.period_label;
        if (row.crew_type === "МОЛНІЯ") { target.m = row.total; target.mLoc = row.location; }
        else if (row.crew_type === "ІНШІ") { target.o = row.total; target.oLoc = row.location; }
    });

    const renderShift = (type, obj, isActive) => `
        <div class="${isActive ? "shift-active" : "shift-frozen"}" style="font-family: monospace; line-height: 1.6;">
            <div style="display: flex; justify-content: space-between; font-weight: bold;">
                <span>${type === "day" ? "🌞 ДЕНЬ" : "🌙 НІЧ"}</span>
                <span style="opacity: 0.8;">${obj.period || "—"}</span>
            </div>
            <hr style="margin: 8px 0; opacity: 0.3;">
            <div style="margin-bottom: 8px;">
                <b>🛩️ ${pluralMolniya(obj.m)} : <span style="color: #ef4444; font-size: 1.2em;">${obj.m}</span></b><br>
                <small>🌍 ЛОКАЦІЇ : ${formatLocs(obj.mLoc)}</small>
            </div>
            <div>
                <b>🛸 ФПВ/ІНШІ : <span style="color: #ef4444; font-size: 1.2em;">${obj.o}</span></b><br>
                <small>🌍 ЛОКАЦІЇ : ${formatLocs(obj.oLoc)}</small>
            </div>
        </div>`;

    document.getElementById("shiftDayText").innerHTML = renderShift("day", dayData, isDayActive);
    document.getElementById("shiftNightText").innerHTML = renderShift("night", nightData, !isDayActive);
    document.getElementById("shiftModal").classList.remove("hidden");
};

window.closeShiftModal = () => document.getElementById("shiftModal").classList.add("hidden");