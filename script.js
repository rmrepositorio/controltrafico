// ─── Paleta ───
const PALETA = [
  '#00d4aa','#7c6fe0','#ff6b6b','#ffd166','#06d6a0',
  '#118ab2','#ef476f','#f78c6b','#88d498','#c77dff',
  '#48cae4','#f4a261','#e76f51','#2ec4b6','#e9c46a',
  '#a8dadc','#457b9d','#e63946','#2a9d8f','#f3722c'
];
function generarColores(n) {
  return Array.from({length: n}, (_, i) => PALETA[i % PALETA.length]);
}

// ─── Estado global ───
let charts         = {};
let filtrosActivos = {};   // { campo: valor_seleccionado }
let exclusiones    = {};   // { campo: Set(valores_excluidos) }
let modoOscuro     = true;
let tablaDT;
let historial      = [];
let historialIdx   = -1;

// ─── Helpers color ───
function getLegendColor() { return modoOscuro ? '#e0e0f0' : '#1a1a2e'; }
function getGridColor()   { return modoOscuro ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'; }

// ─── Modo claro/oscuro ───
document.getElementById("toggleModo").addEventListener("click", () => {
  modoOscuro = !modoOscuro;
  document.body.classList.toggle("light-mode", !modoOscuro);
  document.getElementById("toggleModo").textContent = modoOscuro ? "☀ Modo claro" : "🌙 Modo oscuro";
  const color = getLegendColor();
  const grid  = getGridColor();
  Object.values(charts).forEach(c => {
    if (c.options.plugins?.legend?.labels) c.options.plugins.legend.labels.color = color;
    if (c.options.scales) {
      Object.values(c.options.scales).forEach(s => {
        if (s.ticks) s.ticks.color = color;
        if (s.grid)  s.grid.color  = grid;
      });
    }
    c.update();
  });
  if (tablaDT) tablaDT.draw(false);
});

// ─── Historial ───
function actualizarBotones() {
  document.getElementById("btnAtras").disabled    = historialIdx <= 0;
  document.getElementById("btnAdelante").disabled = historialIdx >= historial.length - 1;
}
function pushHistorial() {
  historial = historial.slice(0, historialIdx + 1);
  historial.push(JSON.parse(JSON.stringify(filtrosActivos)));
  historialIdx = historial.length - 1;
  actualizarBotones();
}
document.getElementById("btnAtras").addEventListener("click", () => {
  if (historialIdx > 0) { historialIdx--; filtrosActivos = JSON.parse(JSON.stringify(historial[historialIdx])); renderizarFiltrosTags(); actualizarGraficos(); actualizarBotones(); }
});
document.getElementById("btnAdelante").addEventListener("click", () => {
  if (historialIdx < historial.length - 1) { historialIdx++; filtrosActivos = JSON.parse(JSON.stringify(historial[historialIdx])); renderizarFiltrosTags(); actualizarGraficos(); actualizarBotones(); }
});
document.getElementById("btnLimpiar").addEventListener("click", () => {
  filtrosActivos = {}; pushHistorial(); renderizarFiltrosTags(); actualizarGraficos();
});

// ─── Tags filtros activos ───
function renderizarFiltrosTags() {
  const cont = document.getElementById("filtrosActivos");
  cont.innerHTML = "";
  Object.entries(filtrosActivos).forEach(([key, val]) => {
    if (!val) return;
    const tag = document.createElement("span");
    tag.className = "filtro-tag";
    tag.textContent = `${key}: ${val}  ✕`;
    tag.addEventListener("click", () => { delete filtrosActivos[key]; pushHistorial(); renderizarFiltrosTags(); actualizarGraficos(); });
    cont.appendChild(tag);
  });
  // Tags de exclusiones activas
  Object.entries(exclusiones).forEach(([campo, setExcl]) => {
    if (!setExcl.size) return;
    const tag = document.createElement("span");
    tag.className = "filtro-tag filtro-excluido";
    tag.textContent = `Excluidos en ${campo}: ${setExcl.size}  ✕`;
    tag.title = [...setExcl].join(", ");
    tag.addEventListener("click", () => { exclusiones[campo] = new Set(); renderizarFiltrosTags(); actualizarGraficos(); });
    cont.appendChild(tag);
  });
}

// ─── Menú de exclusión por campo ───
// Crea un popup con checkboxes para excluir valores de un campo
function abrirMenuExclusion(campo, allValues, anchorEl) {
  // Cerrar cualquier menú abierto
  cerrarMenuExclusion();

  const menu = document.createElement("div");
  menu.id = "menuExclusion";
  menu.className = "excl-menu";

  const titulo = document.createElement("div");
  titulo.className = "excl-title";
  titulo.textContent = `Filtrar: ${campo}`;
  menu.appendChild(titulo);

  // Botones seleccionar todo / ninguno
  const barra = document.createElement("div");
  barra.className = "excl-barra";
  const btnTodo = document.createElement("button");
  btnTodo.textContent = "✓ Todo";
  btnTodo.onclick = () => { menu.querySelectorAll('input[type=checkbox]').forEach(c => c.checked = true); };
  const btnNada = document.createElement("button");
  btnNada.textContent = "✗ Ninguno";
  btnNada.onclick = () => { menu.querySelectorAll('input[type=checkbox]').forEach(c => c.checked = false); };
  barra.appendChild(btnTodo);
  barra.appendChild(btnNada);
  menu.appendChild(barra);

  const lista = document.createElement("div");
  lista.className = "excl-lista";

  const excActual = exclusiones[campo] || new Set();
  allValues.forEach(val => {
    const row = document.createElement("label");
    row.className = "excl-row";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = val;
    cb.checked = !excActual.has(val); // marcado = visible (no excluido)
    const txt = document.createElement("span");
    txt.textContent = val;
    row.appendChild(cb);
    row.appendChild(txt);
    lista.appendChild(row);
  });
  menu.appendChild(lista);

  const btnAplicar = document.createElement("button");
  btnAplicar.className = "excl-aplicar";
  btnAplicar.textContent = "Aplicar";
  btnAplicar.onclick = () => {
    const excl = new Set();
    menu.querySelectorAll('input[type=checkbox]').forEach(cb => {
      if (!cb.checked) excl.add(cb.value);
    });
    exclusiones[campo] = excl;
    renderizarFiltrosTags();
    actualizarGraficos();
    cerrarMenuExclusion();
  };
  menu.appendChild(btnAplicar);

  document.body.appendChild(menu);

  // Posicionar junto al botón
  const rect = anchorEl.getBoundingClientRect();
  menu.style.top  = (rect.bottom + window.scrollY + 4) + "px";
  menu.style.left = (rect.left + window.scrollX) + "px";

  // Cerrar al click fuera
  setTimeout(() => {
    document.addEventListener("click", cerrarAlClickFuera);
  }, 10);
}

function cerrarAlClickFuera(e) {
  const menu = document.getElementById("menuExclusion");
  if (menu && !menu.contains(e.target)) cerrarMenuExclusion();
}

function cerrarMenuExclusion() {
  const m = document.getElementById("menuExclusion");
  if (m) m.remove();
  document.removeEventListener("click", cerrarAlClickFuera);
}

// ─── Cargar JSON ───
fetch("resumen_full.json")
  .then(r => r.json())
  .then(data => {
    data.forEach(d => {
      if (!d["FECHA AVISO"]) return;
      const [d1, m1, y1] = d["FECHA AVISO"].split("/").map(Number);
      d.fechaJS = new Date(y1, m1 - 1, d1);
    });
    window.dataTabla = data;
    inicializarSliders();
    inicializarTabla();
    crearGraficos();
    actualizarGraficos();
  })
  .catch(err => console.error("Error JSON:", err));

// ─── Sliders de fecha ───
function inicializarSliders() {
  const fechas = window.dataTabla.filter(d => d.fechaJS).map(d => d.fechaJS);
  document.getElementById("fechaInicio").valueAsDate = new Date(Math.min(...fechas));
  document.getElementById("fechaFin").valueAsDate    = new Date(Math.max(...fechas));
  document.getElementById("fechaInicio").addEventListener("change", actualizarGraficos);
  document.getElementById("fechaFin").addEventListener("change",    actualizarGraficos);
}

// ─── Crear gráficos ───
function crearGraficos() {
  const color = getLegendColor();
  const grid  = getGridColor();

  function onClickBarra(campo) {
    return (evt, elems) => {
      if (!elems.length) return;
      const valor = evt.chart.data.labels[elems[0].index];
      if (filtrosActivos[campo] === valor) delete filtrosActivos[campo];
      else filtrosActivos[campo] = valor;
      pushHistorial();
      renderizarFiltrosTags();
      actualizarGraficos();
    };
  }

  function crearBarra(id, campo) {
    const ctx = document.getElementById(id).getContext("2d");
    return new Chart(ctx, {
      type: 'bar',
      data: { labels: [], datasets: [{ label: campo, data: [], backgroundColor: [], borderWidth: 0, borderRadius: 4 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color, maxRotation: 45 }, grid: { color: grid } },
          y: { ticks: { color }, grid: { color: grid } }
        },
        onClick: onClickBarra(campo)
      }
    });
  }

  // Gráfico Familia Avería — barras horizontales con leyenda lateral
  const ctxFam = document.getElementById("graficoFamilia").getContext("2d");
  charts.familia = new Chart(ctxFam, {
    type: 'bar',
    data: { labels: [], datasets: [{ label: 'Familia Avería', data: [], backgroundColor: [], borderWidth: 0, borderRadius: 4 }] },
    options: {
      indexAxis: 'y',  // barras horizontales para leer mejor las familias
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'bottom', labels: { color, boxWidth: 12, font: { size: 10 } } }
      },
      scales: {
        x: { ticks: { color }, grid: { color: grid } },
        y: { ticks: { color, font: { size: 10 } }, grid: { color: grid } }
      },
      onClick: onClickBarra("FAMILIA AVERIA")
    }
  });

  // Gráfico Turno — radial (doughnut)
  const ctxTurno = document.getElementById("graficoTurno").getContext("2d");
  charts.turno = new Chart(ctxTurno, {
    type: 'doughnut',
    data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderWidth: 2, borderColor: modoOscuro ? '#1e1e2e' : '#f0f4ff' }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color, boxWidth: 12, padding: 10 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} (${((ctx.parsed / ctx.dataset.data.reduce((a,b)=>a+b,0))*100).toFixed(1)}%)` } }
      },
      onClick: (evt, elems) => {
        if (!elems.length) return;
        const valor = evt.chart.data.labels[elems[0].index];
        if (filtrosActivos["TURNO"] === valor) delete filtrosActivos["TURNO"];
        else filtrosActivos["TURNO"] = valor;
        pushHistorial(); renderizarFiltrosTags(); actualizarGraficos();
      }
    }
  });

  charts.origen     = crearBarra("graficoOrigen",     "ORIGEN AVISO");

  // Gráfico Familia Vehículo — horizontal con leyenda
  const ctxFamVeh = document.getElementById("graficoFamiliaVeh").getContext("2d");
  charts.familiaVeh = new Chart(ctxFamVeh, {
    type: 'bar',
    data: { labels: [], datasets: [{ label: 'Tipo Vehículo', data: [], backgroundColor: [], borderWidth: 0, borderRadius: 4 }] },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'bottom', labels: { color, boxWidth: 12, font: { size: 10 } } }
      },
      scales: {
        x: { ticks: { color }, grid: { color: grid } },
        y: { ticks: { color, font: { size: 10 } }, grid: { color: grid } }
      },
      onClick: onClickBarra("FAMILIA")
    }
  });

  charts.vhlo = crearBarra("graficoVHLO", "VHLO");

  // Evolución mensual
  const ctxEv = document.getElementById("graficoEvolucion").getContext("2d");
  charts.evolucion = new Chart(ctxEv, {
    type: 'line',
    data: { labels: [], datasets: [] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color, boxWidth: 12 } } },
      scales: {
        x: { ticks: { color }, grid: { color: grid } },
        y: { ticks: { color }, grid: { color: grid } }
      }
    }
  });

  // Botones de filtro (embudo) en cada panel
  document.querySelectorAll('.btn-filtro-panel').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const campo = btn.dataset.campo;
      const allVals = [...new Set(
        window.dataTabla.map(d => d[campo]).filter(v => v && v !== "****")
      )].sort();
      abrirMenuExclusion(campo, allVals, btn);
    });
  });
}

// ─── Inicializar tabla con filtros por columna ───
function inicializarTabla() {
  // Añadir fila de inputs de búsqueda por columna
  $('#tablaAverias thead').clone(true).appendTo('#tablaAverias thead');
  $('#tablaAverias thead tr:eq(1) th').each(function(i) {
    const title = $(this).text();
    $(this).html(`<input type="text" placeholder="${title}" style="width:100%;font-size:11px;padding:2px 4px;background:var(--input-bg);color:var(--input-text);border:1px solid var(--border);border-radius:3px;" />`);
    $('input', this).on('keyup change', function() {
      if (tablaDT.column(i).search() !== this.value) {
        tablaDT.column(i).search(this.value).draw();
      }
    });
  });

  tablaDT = $('#tablaAverias').DataTable({
    data: [],
    columns: [
      { title: "Vehículo",         data: "VHLO" },
      { title: "Familia Veh.",     data: "FAMILIA" },
      { title: "Familia Avería",   data: "FAMILIA AVERIA" },
      { title: "Deficiencias",     data: "DEFICIENCIAS DETECTADAS" },
      { title: "Fecha Aviso",      data: "FECHA AVISO" },
      { title: "Turno",            data: "TURNO" },
      { title: "Origen Aviso",     data: "ORIGEN AVISO" },
      { title: "Tipo Orden",       data: "TIPO ORDEN" }
    ],
    orderCellsTop: true,
    colReorder: true,
    scrollX: true,
    pageLength: 25,
    language: {
      search: "Buscar:", lengthMenu: "Mostrar _MENU_ registros",
      info: "Mostrando _START_–_END_ de _TOTAL_",
      paginate: { previous: "‹", next: "›" }
    }
  });
}

// ─── Actualizar gráficos ───
function actualizarGraficos() {
  const fechaInicio = document.getElementById("fechaInicio").valueAsDate;
  const fechaFin    = document.getElementById("fechaFin").valueAsDate;

  let datos = window.dataTabla.filter(d => {
    if (!d.fechaJS) return false;
    return compareSoloFecha(d.fechaJS, fechaInicio) >= 0 &&
           compareSoloFecha(d.fechaJS, fechaFin)    <= 0;
  });

  // Aplicar filtros de selección (click en barra)
  for (const key in filtrosActivos) {
    if (filtrosActivos[key]) datos = datos.filter(d => d[key] === filtrosActivos[key]);
  }

  // Aplicar exclusiones (menú de embudo)
  for (const campo in exclusiones) {
    const excl = exclusiones[campo];
    if (excl.size) datos = datos.filter(d => !excl.has(d[campo]));
  }

  // ── Actualizar gráficos de barras ──
  const barrasConfig = [
    { key: "familia",    campo: "FAMILIA AVERIA" },
    { key: "origen",     campo: "ORIGEN AVISO" },
    { key: "familiaVeh", campo: "FAMILIA" },
    { key: "vhlo",       campo: "VHLO" }
  ];

  barrasConfig.forEach(({ key, campo }) => {
    const conteo = {};
    datos.forEach(d => { const v = d[campo]; if (v && v !== "****") conteo[v] = (conteo[v]||0)+1; });
    const sorted  = Object.entries(conteo).sort((a,b) => b[1]-a[1]);
    const labels   = sorted.map(e => e[0]);
    const values   = sorted.map(e => e[1]);
    const colores  = generarColores(labels.length);
    const filtroV  = filtrosActivos[campo];
    const bgColors = labels.map((l, i) => filtroV && l !== filtroV ? colores[i]+'55' : colores[i]);

    charts[key].data.labels                      = labels;
    charts[key].data.datasets[0].data            = values;
    charts[key].data.datasets[0].backgroundColor = bgColors;
    // Para gráficos horizontales, actualizar leyenda con colores
    if (charts[key].config.options.indexAxis === 'y') {
      charts[key].data.datasets[0].backgroundColor = bgColors;
    }
    charts[key].options.plugins.legend.labels.color = getLegendColor();
    charts[key].update();
  });

  // ── Turno (doughnut) ──
  const conteoTurno = {};
  datos.forEach(d => { const v = d["TURNO"]; if (v && v !== "****") conteoTurno[v] = (conteoTurno[v]||0)+1; });
  const turnoLabels = Object.keys(conteoTurno);
  const turnoVals   = Object.values(conteoTurno);
  const turnoColors = generarColores(turnoLabels.length);
  charts.turno.data.labels                      = turnoLabels;
  charts.turno.data.datasets[0].data            = turnoVals;
  charts.turno.data.datasets[0].backgroundColor = turnoColors;
  charts.turno.data.datasets[0].borderColor     = modoOscuro ? '#1e1e2e' : '#f0f4ff';
  charts.turno.options.plugins.legend.labels.color = getLegendColor();
  charts.turno.update();

  // ── Evolución mensual ──
  const conteoEvol = {};
  datos.forEach(d => {
    const mes = `${d.fechaJS.getFullYear()}-${String(d.fechaJS.getMonth()+1).padStart(2,'0')}`;
    if (!conteoEvol[mes]) conteoEvol[mes] = {};
    const fam = d["FAMILIA AVERIA"];
    if (fam && fam !== "****") conteoEvol[mes][fam] = (conteoEvol[mes][fam]||0)+1;
  });
  const labelsEv = Object.keys(conteoEvol).sort();
  const familias = [...new Set(datos.map(d => d["FAMILIA AVERIA"]).filter(f => f && f !== "****"))];
  const colEv    = generarColores(familias.length);
  charts.evolucion.data.labels   = labelsEv;
  charts.evolucion.data.datasets = familias.map((fam, i) => ({
    label: fam, data: labelsEv.map(l => conteoEvol[l][fam]||0),
    borderColor: colEv[i], backgroundColor: colEv[i]+'22',
    fill: false, tension: 0.3, pointRadius: 3
  }));
  charts.evolucion.options.plugins.legend.labels.color = getLegendColor();
  charts.evolucion.update();

  // ── Tabla ──
  tablaDT.clear(); tablaDT.rows.add(datos); tablaDT.draw();

  // ── KPIs ──
  document.getElementById("totalAverias").textContent = datos.length.toLocaleString('es-ES');
  const dias = new Set(datos.filter(d=>d.fechaJS).map(d=>d.fechaJS.toDateString())).size;
  document.getElementById("promedioDiario").textContent = dias ? (datos.length/dias).toFixed(1) : '0';
  const vhloCount = {};
  datos.forEach(d => { if (d.VHLO && d.VHLO !== "****") vhloCount[d.VHLO] = (vhloCount[d.VHLO]||0)+1; });
  document.getElementById("vehiculoTop").textContent = Object.keys(vhloCount).length
    ? Object.keys(vhloCount).reduce((a,b) => vhloCount[a]>vhloCount[b]?a:b) : '-';
}

function compareSoloFecha(a, b) {
  return new Date(a.getFullYear(),a.getMonth(),a.getDate()) -
         new Date(b.getFullYear(),b.getMonth(),b.getDate());
}

// ─── Drag-to-resize ───
(function () {
  let dragging = null, startY = 0, startH = 0;
  document.querySelectorAll('.resize-handle').forEach(h => {
    h.addEventListener('mousedown', e => {
      e.preventDefault();
      dragging = document.getElementById(h.dataset.panel);
      startY = e.clientY; startH = dragging.offsetHeight;
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
    });
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    dragging.style.height = Math.max(150, startH + (e.clientY - startY)) + 'px';
    Object.values(charts).forEach(c => c.resize());
  });
  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
})();
