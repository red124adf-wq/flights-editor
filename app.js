/* =====================================
   1. КОНФІГУРАЦІЯ ТА УТИЛІТИ
===================================== */
const supabaseClient = window.supabaseClient;
const GLOBAL_START_DATE = "2025-12-05";
const opDay = window.OPERATIONAL_DAY;
const OPERATIONAL_DAY_SETTINGS_PASSWORD = "1306";
let isCurrentUserAdmin = false;

const formatDateUA = (s) => s ? s.split("-").reverse().join(".") : "";
const formatTimeNoSeconds = (s) => s ? s.slice(0, 5) : "";

const todayISO = () => {
    if (opDay?.getOperationalDateISO) return opDay.getOperationalDateISO();
    const fallback = new Date();
    return fallback.toISOString().split("T")[0];
};

const daysAgoISO = (n) => {
    if (opDay?.shiftISODate) return opDay.shiftISODate(todayISO(), -n);
    const d = new Date(todayISO());
    d.setDate(d.getDate() - n);
    return d.toISOString().split("T")[0];
};

const monthsAgoISO = (n) => {
    const [year, month, day] = todayISO().split("-").map(Number);
    const d = new Date(Date.UTC(year, month - 1, day));
    d.setUTCMonth(d.getUTCMonth() - n);
    return d.toISOString().slice(0, 10);
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
    scheduleReportReminders();
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
    isCurrentUserAdmin = false;
    document.getElementById("operationalDayBtn")?.classList.add("hidden");
    document.getElementById("app").classList.add("hidden");
    document.getElementById("loginBox").classList.remove("hidden");
    document.getElementById("status").innerText = "";
    document.getElementById("passwordInput").value = "";
};

// Головна функція ініціалізації робочої зони
async function initApp() {
    document.getElementById("loginBox").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");

    isCurrentUserAdmin = await checkUserAccess();
    document.getElementById("operationalDayBtn")?.classList.toggle("hidden", !isCurrentUserAdmin);
    
    await Promise.all([
        loadSelect("locations", "f_from", "Звідки"),
        loadSelect("locations", "f_to", "Куди"),
        loadSelect("crews", "f_crew", "Екіпаж"),
        loadSelect("actions", "f_action", "Дія")
    ]);

    initLastRecordsToggle();
    loadLast100();
    initAllReports();
}

function initLastRecordsToggle() {
    const section = document.getElementById("lastRecordsSection");
    const btn = document.getElementById("lastRecordsToggle");
    if (!section || !btn) return;

    const storageKey = "lastRecordsCollapsed";
    const applyState = (collapsed) => {
        section.classList.toggle("is-collapsed", collapsed);
        btn.setAttribute("aria-expanded", String(!collapsed));
        btn.innerText = collapsed ? "Розгорнути" : "Згорнути";
    };

    const saved = localStorage.getItem(storageKey);
    if (saved !== null) applyState(saved === "1");

    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const collapsed = !section.classList.contains("is-collapsed");
        applyState(collapsed);
        localStorage.setItem(storageKey, collapsed ? "1" : "0");
    });

    const header = section.querySelector(".last-records-header");
    if (header) {
        header.addEventListener("click", (e) => {
            if (e.target === btn) return;
            btn.click();
        });
    }
}

/* =====================================
   3. ПРАВА ДОСТУПУ (БЛОКУВАННЯ ФОРМИ)
===================================== */
async function checkUserAccess() {
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
        disableFlightForm(true, "Будь ласка, авторизуйтесь");
        return false;
    }

    const { data: roleData, error: roleError } = await supabaseClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

    if (roleError || !roleData || roleData.role !== 'admin') {
        disableFlightForm(true, "Тільки адміністратори можуть додавати записи.");
        return false;
    }

    disableFlightForm(false);
    return true;
}

/* function disableFlightForm(message) {
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
} */

function disableFlightForm(isDisabled, message = '') {
    const container = document.getElementById('addForm');
    const msgElement = document.getElementById('accessMessage');

    if (container) {
        // Керуємо доступністю елементів
        const elements = container.querySelectorAll('input, select, button');
        elements.forEach(el => {
            el.disabled = isDisabled;
        });

        // Керуємо візуальним станом через клас
        container.classList.toggle('is-disabled', isDisabled);
    }

    if (msgElement) {
        msgElement.textContent = isDisabled ? `⚠️ ${message}` : '';
        msgElement.classList.toggle('hidden', !isDisabled);
        
        // Додаємо ARIA-атрибут для безпеки
        if (isDisabled) msgElement.setAttribute('role', 'alert');
        else msgElement.removeAttribute('role');
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
    if (!val || !curTbl || !curSelId) return;
    const { error } = await supabaseClient.from(curTbl).insert({ name: val });
    if (error) return alert(error.message);
    await loadSelect(curTbl, curSelId, "обрати");
    document.getElementById(curSelId).value = val;
    document.getElementById("addDialog").classList.add("hidden");
};

document.getElementById("dialogCancel").onclick = () => document.getElementById("addDialog").classList.add("hidden");

function refreshOperationalDaySettingsUI() {
    const currentEl = document.getElementById("operationalDayCurrent");
    const inputEl = document.getElementById("operationalDayTimeInput");
    if (currentEl) currentEl.innerText = `Поточний час: ${opDay?.getStartTime ? opDay.getStartTime() : "04:40"}`;
    if (inputEl && opDay?.getStartTime) inputEl.value = opDay.getStartTime();
}

window.openOperationalDaySettings = function () {
    if (!isCurrentUserAdmin) return;
    const enteredPassword = prompt("Введіть пароль доступу:");
    if (enteredPassword === null || enteredPassword === "") return;
    if (enteredPassword !== OPERATIONAL_DAY_SETTINGS_PASSWORD) {
        alert("Невірний пароль.");
        return;
    }
    refreshOperationalDaySettingsUI();
    document.getElementById("operationalDayModal")?.classList.remove("hidden");
};

window.closeOperationalDaySettings = function () {
    document.getElementById("operationalDayModal")?.classList.add("hidden");
};

window.saveOperationalDaySettings = function () {
    const inputEl = document.getElementById("operationalDayTimeInput");
    const value = inputEl?.value;
    if (!value) return alert("Вкажіть час у форматі ГГ:ХХ");
    if (!opDay?.setStartTime || !opDay.setStartTime(value)) {
        return alert("Не вдалося зберегти час. Формат: ГГ:ХХ");
    }
    refreshOperationalDaySettingsUI();
    updateAllReports();
    closeOperationalDaySettings();
};

window.addEventListener("operational-day-config-updated", () => {
    refreshOperationalDaySettingsUI();
});

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
    if (!Array.isArray(data)) return;

    const kyivParts = opDay?.getKyivDateTimeParts ? opDay.getKyivDateTimeParts() : null;
    const nowHour = kyivParts ? kyivParts.hour : new Date().getHours();
    const nowMinute = kyivParts ? kyivParts.minute : new Date().getMinutes();
    const minutesNow = nowHour * 60 + nowMinute;
    const dayStart = (opDay?.START_HOUR ?? 4) * 60 + (opDay?.START_MINUTE ?? 40);
    const isDayActive = minutesNow >= dayStart && minutesNow < ((15 * 60) + 40);

    let dayData = { m: 0, o: 0, mLoc: "", oLoc: "", period: "" };
    let nightData = { m: 0, o: 0, mLoc: "", oLoc: "", period: "" };

    data.forEach(row => {
        const periodLabel = String(row.period_label || "");
        const isDayRow = periodLabel.split(" - ")[0].slice(-5) === (opDay?.START_LABEL_DOT ?? "04.40");
        let target = isDayRow ? dayData : nightData;
        
        target.period = periodLabel;
        if (row.crew_type === "МОЛНІЯ") { target.m = Number(row.total) || 0; target.mLoc = row.location || ""; }
        else if (row.crew_type === "ІНШІ") { target.o = Number(row.total) || 0; target.oLoc = row.location || ""; }
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

/* =====================================
   8. Р—РђРћРџРћР’Р†Р”Р¬ РџРћ Р§РђРЎУ (POPUP)
===================================== */
let reportReminderTimers = [];
let reportReminderIntervals = [];

function getKyivNow() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Kiev' }));
}

function getNextKyivTarget(hours, minutes) {
    const now = getKyivNow();
    const target = new Date(now);
    target.setHours(hours, minutes, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    return target;
}

function scheduleReportReminders() {
    reportReminderTimers.forEach(id => clearTimeout(id));
    reportReminderIntervals.forEach(id => clearInterval(id));
    reportReminderTimers = [];
    reportReminderIntervals = [];

    const targets = [
        { h: 5, m: 45 },
        { h: 16, m: 45 }
    ];

    targets.forEach(t => {
        const next = getNextKyivTarget(t.h, t.m);
        const delay = Math.max(0, next - getKyivNow());
        const timerId = setTimeout(() => {
            showReportReminder();
            const intervalId = setInterval(() => {
                showReportReminder();
            }, 24 * 60 * 60 * 1000);
            reportReminderIntervals.push(intervalId);
        }, delay);
        reportReminderTimers.push(timerId);
    });
}

function showReportReminder() {
    const el = document.getElementById("reportReminder");
    if (!el) return;
    const icon = document.getElementById("reportReminderIcon");
    const title = document.getElementById("reportReminderTitle");
    const msg = document.getElementById("reportReminderMsg");
    if (icon) icon.textContent = "\uD83D\uDEE1\uFE0F";
    if (title) title.textContent = "\u041D\u0430\u0433\u0430\u0434\u0443\u0432\u0430\u043D\u043D\u044F";
    if (msg) msg.textContent = "\u041D\u0435 \u0437\u0430\u0431\u0443\u0442\u0438 \u0437\u0440\u043E\u0431\u0438\u0442\u0438 \u0434\u043E\u043F\u043E\u0432\u0456\u0434\u044C";
    el.classList.remove("hidden");
}

window.closeReportReminder = function () {
    const el = document.getElementById("reportReminder");
    if (!el) return;
    el.classList.add("hidden");
};

window.showReportReminder = showReportReminder;



