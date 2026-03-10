// Central config for operational day calculations across all pages.
(function initOperationalDayConfig() {
    const TIMEZONE = "Europe/Kyiv";
    const STORAGE_KEY = "operational_day_start_time";
    const DEFAULT_START_HOUR = 4;
    const DEFAULT_START_MINUTE = 40;
    let startHour = DEFAULT_START_HOUR;
    let startMinute = DEFAULT_START_MINUTE;

    const KYIV_FORMATTER = new Intl.DateTimeFormat("en-CA", {
        timeZone: TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
    });

    function getKyivDateTimeParts(date = new Date()) {
        const parts = {};
        KYIV_FORMATTER.formatToParts(date).forEach(({ type, value }) => {
            if (type !== "literal") parts[type] = value;
        });
        return {
            year: Number(parts.year),
            month: Number(parts.month),
            day: Number(parts.day),
            hour: Number(parts.hour),
            minute: Number(parts.minute),
            second: Number(parts.second)
        };
    }

    function pad2(num) {
        return String(num).padStart(2, "0");
    }

    function getStartLabel() {
        return `${pad2(startHour)}:${pad2(startMinute)}`;
    }

    function getStartLabelDot() {
        return `${pad2(startHour)}.${pad2(startMinute)}`;
    }

    function updateExposedValues() {
        window.OPERATIONAL_DAY.START_HOUR = startHour;
        window.OPERATIONAL_DAY.START_MINUTE = startMinute;
        window.OPERATIONAL_DAY.START_LABEL = getStartLabel();
        window.OPERATIONAL_DAY.START_LABEL_DOT = getStartLabelDot();
    }

    function parseTimeLabel(value) {
        const match = String(value || "").trim().match(/^(\d{2}):(\d{2})$/);
        if (!match) return null;
        const hour = Number(match[1]);
        const minute = Number(match[2]);
        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
        return { hour, minute };
    }

    function readStartFromStorage() {
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            return parseTimeLabel(raw);
        } catch (_err) {
            return null;
        }
    }

    function persistStartToStorage() {
        try {
            window.localStorage.setItem(STORAGE_KEY, getStartLabel());
        } catch (_err) {
            // Ignore storage errors (private mode / restrictions).
        }
    }

    function shiftISODate(isoDate, days) {
        const [year, month, day] = isoDate.split("-").map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        date.setUTCDate(date.getUTCDate() + days);
        return date.toISOString().slice(0, 10);
    }

    function getKyivCalendarDateISO(date = new Date()) {
        const p = getKyivDateTimeParts(date);
        return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
    }

    function getOperationalDateISO(date = new Date()) {
        const p = getKyivDateTimeParts(date);
        const kyivDateISO = `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
        const isBeforeOperationalStart =
            p.hour < startHour || (p.hour === startHour && p.minute < startMinute);
        return isBeforeOperationalStart ? shiftISODate(kyivDateISO, -1) : kyivDateISO;
    }

    function setStartTime(valueOrHour, minuteMaybe) {
        let next = null;
        if (typeof valueOrHour === "string") next = parseTimeLabel(valueOrHour);
        else if (Number.isInteger(valueOrHour) && Number.isInteger(minuteMaybe)) next = parseTimeLabel(`${pad2(valueOrHour)}:${pad2(minuteMaybe)}`);
        if (!next) return false;

        startHour = next.hour;
        startMinute = next.minute;
        persistStartToStorage();
        updateExposedValues();
        window.dispatchEvent(new CustomEvent("operational-day-config-updated", {
            detail: { startHour, startMinute, startLabel: getStartLabel() }
        }));
        return true;
    }

    const stored = readStartFromStorage();
    if (stored) {
        startHour = stored.hour;
        startMinute = stored.minute;
    }

    window.OPERATIONAL_DAY = {
        TIMEZONE,
        STORAGE_KEY,
        START_HOUR: startHour,
        START_MINUTE: startMinute,
        START_LABEL: getStartLabel(),
        START_LABEL_DOT: getStartLabelDot(),
        getKyivDateTimeParts,
        getKyivCalendarDateISO,
        getOperationalDateISO,
        shiftISODate,
        setStartTime,
        getStartTime: getStartLabel
    };
})();
