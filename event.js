let reportRebActive = false;
let reportSelectedTime = '';
let reportModalLoaded = false;

async function ensureReportModal() {
    if (reportModalLoaded) return true;
    const host = document.getElementById('eventModalHost');
    if (!host) return false;

    const res = await fetch('event.html', { cache: 'no-cache' });
    if (!res.ok) {
        alert('Не вдалося завантажити модальне вікно доповіді.');
        return false;
    }

    host.innerHTML = await res.text();
    reportModalLoaded = true;
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeReportModal();
    });
    return true;
}

window.openReportModal = async function () {
    const ok = await ensureReportModal();
    if (!ok) return;
    const overlay = document.getElementById('reportOverlay');
    if (!overlay) return;
    overlay.classList.add('active');
    const auto = getReportAutoTime();
    selectReportTime(auto);
    const label = document.getElementById('time_auto_label');
    if (label) label.textContent = '← авто';
};

window.closeReportModal = function () {
    const overlay = document.getElementById('reportOverlay');
    if (overlay) overlay.classList.remove('active');
};

window.reportOverlayClick = function (e) {
    const overlay = document.getElementById('reportOverlay');
    if (e.target === overlay) closeReportModal();
};

window.toggleReportReb = function () {
    reportRebActive = !reportRebActive;
    const row = document.querySelector('.report-modal .checkbox-row');
    if (row) row.classList.toggle('checked', reportRebActive);
    const field = document.getElementById('reb_field');
    if (field) field.style.display = reportRebActive ? 'flex' : 'none';
    if (!reportRebActive) {
        const input = document.getElementById('f_reb');
        const cnt = document.getElementById('cnt_reb');
        if (input) input.value = '';
        if (cnt) cnt.textContent = '0';
    }
};

function getReportAutoTime() {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Kiev' }));
    const h = now.getHours();
    const m = now.getMinutes();
    const totalMin = h * 60 + m;
    return (totalMin >= 1020 || totalMin < 420) ? '07:00' : '17:00';
}

window.selectReportTime = function (t) {
    reportSelectedTime = t;
    const pill07 = document.getElementById('pill_07');
    const pill17 = document.getElementById('pill_17');
    if (pill07) pill07.classList.toggle('active', t === '07:00');
    if (pill17) pill17.classList.toggle('active', t === '17:00');
    const label = document.getElementById('time_auto_label');
    if (label) label.textContent = '';
};

window.clearErr = function (id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('error');
    const er = document.getElementById('err_' + id.replace('f_', ''));
    if (er) er.classList.remove('show');
};

window.updateCount = function (el, cntId) {
    const cnt = document.getElementById(cntId);
    if (cnt) cnt.textContent = el.value.length;
};

function formatReportDate(str) {
    if (!str) return '—';
    const [y, m, d] = str.split('-');
    return `${d}.${m}.${y}`;
}

window.generateReport = function () {
    const unit = document.getElementById('f_unit')?.value.trim();
    const eventDate = document.getElementById('f_event_date')?.value;
    const desc = document.getElementById('f_desc')?.value.trim();
    let ok = true;

    if (!unit) {
        document.getElementById('f_unit')?.classList.add('error');
        document.getElementById('err_unit')?.classList.add('show');
        ok = false;
    }
    if (!eventDate) {
        document.getElementById('f_event_date')?.classList.add('error');
        document.getElementById('err_event_date')?.classList.add('show');
        ok = false;
    }
    if (!desc) {
        document.getElementById('f_desc')?.classList.add('error');
        document.getElementById('err_desc')?.classList.add('show');
        ok = false;
    }

    if (!ok) {
        const first = document.querySelector('.report-modal .error');
        if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    const reb = reportRebActive ? document.getElementById('f_reb')?.value.trim() : '';
    const stamp = reportSelectedTime || getReportAutoTime();
    const sep = '━━━━━━━━━━━━━━━━━━';

    const lines = [];
    lines.push(`🗒️ *ДОПОВІДЬ СТАНОМ НА ${stamp}*`);
    lines.push(sep);
    lines.push(`🛡️ *ПІДРОЗДІЛ:* ${unit}`);
    lines.push(`📅 *ДАТА ПОДІЇ:* ${formatReportDate(eventDate)}`);
    lines.push(sep);
    lines.push('📝 *ОПИС ПОДІЇ:*');
    lines.push(desc);
    if (reportRebActive && reb) {
        lines.push(sep);
        lines.push(`📡 *Застосовувався засіб РЕБ:* ${reb}`);
    }
    lines.push(sep);
    lines.push('🏁 *ДОПОВІДЬ ЗАКІНЧИВ*');

    const previewText = document.getElementById('previewText');
    if (previewText) previewText.textContent = lines.join('\n');
    const previewWrap = document.getElementById('previewWrap');
    if (previewWrap) previewWrap.classList.add('show');
    const copyBtn = document.getElementById('copyBtn');
    if (copyBtn) {
        copyBtn.textContent = '📋 Копіювати';
        copyBtn.classList.remove('copied');
    }

    setTimeout(() => {
        previewWrap?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
};

window.copyReportText = function () {
    const text = document.getElementById('previewText')?.textContent || '';
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('copyBtn');
        if (!btn) return;
        btn.textContent = '✓ Скопійовано!';
        btn.classList.add('copied');
        setTimeout(() => {
            btn.textContent = '📋 Копіювати';
            btn.classList.remove('copied');
        }, 2500);
    });
};

window.resetReportForm = function () {
    ['f_unit', 'f_event_date', 'f_desc', 'f_reb'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const cntDesc = document.getElementById('cnt_desc');
    const cntReb = document.getElementById('cnt_reb');
    if (cntDesc) cntDesc.textContent = '0';
    if (cntReb) cntReb.textContent = '0';
    if (reportRebActive) toggleReportReb();
    document.getElementById('previewWrap')?.classList.remove('show');
    document.querySelectorAll('.report-modal .error').forEach((el) => el.classList.remove('error'));
    document.querySelectorAll('.report-modal .error-msg.show').forEach((el) => el.classList.remove('show'));
    const auto = getReportAutoTime();
    selectReportTime(auto);
    const label = document.getElementById('time_auto_label');
    if (label) label.textContent = '← авто';
};
