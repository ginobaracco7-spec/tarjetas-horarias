// Configuración y utilidades compartidas entre la vista pública y la de admin.

const STATUS_META = {
  ENTREGADA: { label: "Entregada", short: "E", color: "#4CAF50", text: "#ffffff" },
  AUSENTE_CON_AVISO: { label: "Ausente con aviso", short: "AA", color: "#F0954B", text: "#ffffff" },
  AUSENTE_SIN_AVISO: { label: "Ausente sin aviso", short: "AS", color: "#3F6FC4", text: "#ffffff" },
  NO_CORRESPONDE: { label: "No corresponde", short: "—", color: "#A6A6A6", text: "#ffffff" },
  FALTANTE: { label: "Faltante", short: "F", color: "#FFFFFF", text: "#333333" },
  FERIADO: { label: "Feriado", short: "FE", color: "#FFEB3B", text: "#333333" },
  VACACIONES: { label: "Vacaciones", short: "V", color: "#F5C99B", text: "#333333" },
  CURSO: { label: "Curso", short: "C", color: "#E53935", text: "#ffffff" },
};

const STATUS_ORDER = [
  "ENTREGADA",
  "AUSENTE_CON_AVISO",
  "AUSENTE_SIN_AVISO",
  "NO_CORRESPONDE",
  "FALTANTE",
  "FERIADO",
  "VACACIONES",
  "CURSO",
];

const DAY_NAMES = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
const DAY_NAMES_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
// Semana arrancando el lunes, para el calendario mensual.
const DAY_NAMES_MONDAY_FIRST = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MES_ABBR = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MES_NOMBRE = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// Paleta para distinguir técnicos dentro de una misma celda del calendario.
const TECH_COLORS = [
  "#00205B", "#2B4578", "#6C8FC7", "#8C6FB0", "#B0527A",
  "#C77B2B", "#3F8F6B", "#4C7EA6", "#8A4B8C", "#5A6B8C",
];

function techColor(techId, techs) {
  const idx = (techs || []).findIndex((t) => t.id === techId);
  return TECH_COLORS[idx >= 0 ? idx % TECH_COLORS.length : 0];
}

function techInitials(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function pad(n) {
  return n.toString().padStart(2, "0");
}

function dateKey(y, m, d) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function parseDateKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function daysInMonth(y, m) {
  return new Date(y, m + 1, 0).getDate();
}

function todayKey() {
  const t = new Date();
  return dateKey(t.getFullYear(), t.getMonth(), t.getDate());
}

function formatMonthLabel(y, m) {
  return `${MES_NOMBRE[m]} ${y}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// Lunes de la semana que contiene `d` (Date)
function mondayOfWeek(d) {
  const day = d.getDay(); // 0=domingo
  const diff = (day === 0 ? -6 : 1 - day);
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

async function fetchState() {
  const res = await fetch("/api/data", { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo cargar la información");
  return res.json();
}

function renderLegend(container) {
  let html = "";
  STATUS_ORDER.forEach((key) => {
    const meta = STATUS_META[key];
    html += `<span class="legend-item"><span class="swatch" style="background:${meta.color}"></span>${meta.label}</span>`;
  });
  container.innerHTML = html;
}

// Calendario mensual compacto: una celda por día, con un chip chiquito por
// técnico (sus iniciales, coloreado según el estado cargado ese día).
// En modo editable, tocar un día abre el selector (definido en cada página).
function renderGrid({ container, state, year, month, editable, onDayClick }) {
  const nDays = daysInMonth(year, month);
  const techs = state.technicians || [];
  const today = todayKey();

  if (techs.length === 0) {
    container.innerHTML = `<p class="empty">Todavía no hay técnicos cargados.</p>`;
    return;
  }

  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // lunes=0

  let html = '<div class="cal-wrap"><table class="cal"><thead><tr>';
  DAY_NAMES_MONDAY_FIRST.forEach((n) => { html += `<th>${n}</th>`; });
  html += "</tr></thead><tbody><tr>";

  for (let i = 0; i < firstDow; i++) html += '<td class="blank"></td>';

  let col = firstDow;
  for (let d = 1; d <= nDays; d++) {
    const dateObj = new Date(year, month, d);
    const dow = dateObj.getDay();
    const key = dateKey(year, month, d);
    const isToday = key === today;
    const isWeekend = dow === 0 || dow === 6;

    const cls = ["day-cell"];
    if (isToday) cls.push("today");
    if (isWeekend) cls.push("weekend");
    if (editable) cls.push("editable");

    let dots = "";
    techs.forEach((t) => {
      const status = (state.entries[key] || {})[t.id] || null;
      const meta = status ? STATUS_META[status] : null;
      if (meta) {
        dots += `<span class="tech-dot" style="background:${meta.color};color:${meta.text}" title="${escapeHtml(t.name)}: ${meta.label}">${techInitials(t.name)}</span>`;
      } else if (key <= today) {
        dots += `<span class="tech-dot empty-dot" title="${escapeHtml(t.name)}: sin cargar"></span>`;
      }
    });

    html += `<td class="${cls.join(" ")}" data-date="${key}"><div class="day-num">${d}</div><div class="tech-dots">${dots}</div></td>`;

    col++;
    if (col === 7) { html += "</tr><tr>"; col = 0; }
  }
  if (col !== 0) {
    for (let i = col; i < 7; i++) html += '<td class="blank"></td>';
  }
  html += "</tr></tbody></table></div>";
  container.innerHTML = html;

  if (editable && onDayClick) {
    container.querySelectorAll("td.editable").forEach((td) => {
      td.addEventListener("click", () => onDayClick(td.dataset.date, td));
    });
  }
}

// Devuelve, para la semana que contiene `refDate`, las tarjetas FALTANTE (adeudadas)
// de días <= hoy, agrupadas por técnico.
function pendingThisWeek(state, refDate) {
  const monday = mondayOfWeek(refDate);
  const today = todayKey();
  const techs = state.technicians || [];
  const result = techs.map((t) => ({ tech: t, days: [] }));

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
    if (key > today) continue;
    techs.forEach((t, idx) => {
      const status = (state.entries[key] || {})[t.id] || null;
      if (!status) {
        result[idx].days.push({ key, dow: d.getDay() });
      }
    });
  }
  return result.filter((r) => r.days.length > 0);
}
