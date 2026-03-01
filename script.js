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
let filtrosActivos = {};
let exclusiones    = {};   // { campo: Set(valores_excluidos) }
let modoOscuro     = true;
let tablaDT;
let historial      = [];
let historialIdx   = -1;

// ─── Persistencia con localStorage ───
function guardarEstado() {
  try {
    const exclSer = {};
    for (const k in exclusiones) exclSer[k] = [...exclusiones[k]];
    localStorage.setItem('ct_filtros',    JSON.stringify(filtrosActivos));
    localStorage.setItem('ct_exclusiones', JSON.stringify(exclSer));
  } catch(e) {}
}
function cargarEstado() {
  try {
    const f = localStorage.getItem('ct_filtros');
    const e = localStorage.getItem('ct_exclusiones');
    if (f) filtrosActivos = JSON.parse(f);
    if (e) {
      const raw = JSON.parse(e);
      for (const k in raw) exclusiones[k] = new Set(raw[k]);
    }
  } catch(e) {}
}

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
    if (c.options.scales) Object.values(c.options.scales).forEach(s => {
      if (s.ticks) s.ticks.color = color;
      if (s.grid)  s.grid.color  = grid;
    });
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
  guardarEstado();
}
document.getElementById("btnAtras").addEventListener("click", () => {
  if (historialIdx > 0) { historialIdx--; filtrosActivos = JSON.parse(JSON.stringify(historial[historialIdx])); renderizarFiltrosTags(); actualizarGraficos(); actualizarBotones(); guardarEstado(); }
});
document.getElementById("btnAdelante").addEventListener("click", () => {
  if (historialIdx < historial.length - 1) { historialIdx++; filtrosActivos = JSON.parse(JSON.stringify(historial[historialIdx])); renderizarFiltrosTags(); actualizarGraficos(); actualizarBotones(); guardarEstado(); }
});
document.getElementById("btnLimpiar").addEventListener("click", () => {
  filtrosActivos = {}; exclusiones = {}; pushHistorial(); renderizarFiltrosTags(); actualizarGraficos(); guardarEstado();
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
  Object.entries(exclusiones).forEach(([campo, setExcl]) => {
    if (!setExcl.size) return;
    const tag = document.createElement("span");
    tag.className = "filtro-tag filtro-excluido";
    tag.textContent = `Excluidos en ${campo}: ${setExcl.size}  ✕`;
    tag.title = [...setExcl].join(", ");
    tag.addEventListener("click", () => { exclusiones[campo] = new Set(); guardarEstado(); renderizarFiltrosTags(); actualizarGraficos(); });
    cont.appendChild(tag);
  });
}

// ─── Menú exclusión ───
function abrirMenuExclusion(campo, allValues, anchorEl) {
  cerrarMenuExclusion();
  const menu = document.createElement("div");
  menu.id = "menuExclusion";
  menu.className = "excl-menu";

  const titulo = document.createElement("div");
  titulo.className = "excl-title";
  titulo.textContent = `Filtrar: ${campo}`;
  menu.appendChild(titulo);

  const barra = document.createElement("div");
  barra.className = "excl-barra";
  const btnTodo = document.createElement("button");
  btnTodo.textContent = "✓ Todo";
  btnTodo.onclick = () => menu.querySelectorAll('input[type=checkbox]').forEach(c => c.checked = true);
  const btnNada = document.createElement("button");
  btnNada.textContent = "✗ Ninguno";
  btnNada.onclick = () => menu.querySelectorAll('input[type=checkbox]').forEach(c => c.checked = false);
  barra.appendChild(btnTodo); barra.appendChild(btnNada);
  menu.appendChild(barra);

  const lista = document.createElement("div");
  lista.className = "excl-lista";
  const excActual = exclusiones[campo] || new Set();
  allValues.forEach(val => {
    const row = document.createElement("label");
    row.className = "excl-row";
    const cb = document.createElement("input");
    cb.type = "checkbox"; cb.value = val; cb.checked = !excActual.has(val);
    const txt = document.createElement("span");
    txt.textContent = val;
    row.appendChild(cb); row.appendChild(txt);
    lista.appendChild(row);
  });
  menu.appendChild(lista);

  const btnAplicar = document.createElement("button");
  btnAplicar.className = "excl-aplicar";
  btnAplicar.textContent = "Aplicar";
  btnAplicar.onclick = () => {
    const excl = new Set();
    menu.querySelectorAll('input[type=checkbox]').forEach(cb => { if (!cb.checked) excl.add(cb.value); });
    exclusiones[campo] = excl;
    guardarEstado(); renderizarFiltrosTags(); actualizarGraficos(); cerrarMenuExclusion();
  };
  menu.appendChild(btnAplicar);
  document.body.appendChild(menu);

  const rect = anchorEl.getBoundingClientRect();
  menu.style.top  = (rect.bottom + window.scrollY + 4) + "px";
  menu.style.left = (rect.left + window.scrollX) + "px";

  setTimeout(() => document.addEventListener("click", cerrarAlClickFuera), 10);
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
    cargarEstado();
    inicializarSliders();
    inicializarTabla();
    crearGraficos();
    renderizarFiltrosTags();
    actualizarGraficos();
    iniciarDragPaneles();
    iniciarResizePaneles();
  })
  .catch(err => console.error("Error JSON:", err));

// ─── Fechas ───
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
      pushHistorial(); renderizarFiltrosTags(); actualizarGraficos();
    };
  }

  function legendaBase(posicion) {
    return {
      display: true,
      position: posicion || 'bottom',
      labels: {
        color,
        boxWidth: 12,
        padding: 8,
        font: { size: 10 }
      }
    };
  }

  // ── Familia Avería (barras horizontales) ──
  const ctxFam = document.getElementById("graficoFamilia").getContext("2d");
  charts.familia = new Chart(ctxFam, {
    type: 'bar',
    data: { labels: [], datasets: [{ label: 'Familia Avería', data: [], backgroundColor: [], borderWidth: 0, borderRadius: 3 }] },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: legendaBase('bottom') },
      scales: {
        x: { ticks: { color }, grid: { color: grid } },
        y: { ticks: { color, font: { size: 10 } }, grid: { color: grid } }
      },
      onClick: onClickBarra("FAMILIA AVERIA")
    }
  });

  // ── Turno (doughnut) ──
  const ctxTurno = document.getElementById("graficoTurno").getContext("2d");
  charts.turno = new Chart(ctxTurno, {
    type: 'doughnut',
    data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderWidth: 2, borderColor: modoOscuro ? '#1e1e2e' : '#f0f4ff' }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: legendaBase('right'),
        tooltip: { callbacks: { label: ctx => {
          const total = ctx.dataset.data.reduce((a,b)=>a+b,0);
          return ` ${ctx.label}: ${ctx.parsed} (${((ctx.parsed/total)*100).toFixed(1)}%)`;
        }}}
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

  // ── Origen Aviso (barras) ──
  const ctxOrig = document.getElementById("graficoOrigen").getContext("2d");
  charts.origen = new Chart(ctxOrig, {
    type: 'bar',
    data: { labels: [], datasets: [{ label: 'Origen Aviso', data: [], backgroundColor: [], borderWidth: 0, borderRadius: 3 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: legendaBase('bottom') },
      scales: {
        x: { ticks: { color, maxRotation: 40, font: { size: 10 } }, grid: { color: grid } },
        y: { ticks: { color }, grid: { color: grid } }
      },
      onClick: onClickBarra("ORIGEN AVISO")
    }
  });

  // ── Familia Vehículo (barras horizontales) ──
  const ctxFamV = document.getElementById("graficoFamiliaVeh").getContext("2d");
  charts.familiaVeh = new Chart(ctxFamV, {
    type: 'bar',
    data: { labels: [], datasets: [{ label: 'Familia Vehículo', data: [], backgroundColor: [], borderWidth: 0, borderRadius: 3 }] },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: legendaBase('bottom') },
      scales: {
        x: { ticks: { color }, grid: { color: grid } },
        y: { ticks: { color, font: { size: 10 } }, grid: { color: grid } }
      },
      onClick: onClickBarra("FAMILIA")
    }
  });

  // ── VHLO (barras) ──
  const ctxVhlo = document.getElementById("graficoVHLO").getContext("2d");
  charts.vhlo = new Chart(ctxVhlo, {
    type: 'bar',
    data: { labels: [], datasets: [{ label: 'Vehículo', data: [], backgroundColor: [], borderWidth: 0, borderRadius: 3 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: legendaBase('bottom') },
      scales: {
        x: { ticks: { color, maxRotation: 45, font: { size: 9 } }, grid: { color: grid } },
        y: { ticks: { color }, grid: { color: grid } }
      },
      onClick: onClickBarra("VHLO")
    }
  });

  // ── Evolución mensual (líneas) ──
  const ctxEv = document.getElementById("graficoEvolucion").getContext("2d");
  charts.evolucion = new Chart(ctxEv, {
    type: 'line',
    data: { labels: [], datasets: [] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: legendaBase('bottom') },
      scales: {
        x: { ticks: { color }, grid: { color: grid } },
        y: { ticks: { color }, grid: { color: grid } }
      }
    }
  });

  // Botones filtro embudo
  document.querySelectorAll('.btn-filtro-panel').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const campo = btn.dataset.campo;
      const allVals = [...new Set(window.dataTabla.map(d => d[campo]).filter(v => v && v !== "****"))].sort();
      abrirMenuExclusion(campo, allVals, btn);
    });
  });
}

// ─── Tabla con filtros por columna ───
function inicializarTabla() {
  $('#tablaAverias thead').clone(true).appendTo('#tablaAverias thead');
  $('#tablaAverias thead tr:eq(1) th').each(function(i) {
    const title = $(this).text();
    $(this).html(`<input type="text" placeholder="${title}" style="width:100%;font-size:11px;padding:2px 4px;background:var(--input-bg);color:var(--input-text);border:1px solid var(--border);border-radius:3px;" />`);
    $('input', this).on('keyup change', function() {
      if (tablaDT.column(i).search() !== this.value) tablaDT.column(i).search(this.value).draw();
    });
  });
  tablaDT = $('#tablaAverias').DataTable({
    data: [],
    columns: [
      { title: "Vehículo",       data: "VHLO",                   width: "80px" },
      { title: "Familia Veh.",   data: "FAMILIA",                 width: "110px" },
      { title: "Familia Avería", data: "FAMILIA AVERIA",          width: "130px" },
      { title: "Descripción",    data: "DESCRIPCION AVERIA",      width: "220px", defaultContent: "-",
        render: function(d) { return d ? '<span title="' + d + '" style="display:block;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + d + '</span>' : '-'; } },
      { title: "Deficiencias",   data: "DEFICIENCIAS DETECTADAS", width: "180px", defaultContent: "-",
        render: function(d) { return d ? '<span title="' + d + '" style="display:block;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + d + '</span>' : '-'; } },
      { title: "Fecha Aviso",    data: "FECHA AVISO",             width: "90px" },
      { title: "Turno",          data: "TURNO",                   width: "70px" },
      { title: "Origen Aviso",   data: "ORIGEN AVISO",            width: "110px" },
      { title: "Tipo Orden",     data: "TIPO ORDEN",              width: "90px" },
      { title: "Conductor",       data: "CONDUCTOR",               width: "100px", defaultContent: "-" },
      { title: "Nº Aviso",        data: null,                      width: "110px", defaultContent: "-",
        render: function(data, type, row) {
          return row["Nº AVISO"] || row["Nº AVISO"] || row["N AVISO"] || row["NUM AVISO"] || "-";
        }
      }
    ],
    orderCellsTop: true, colReorder: true, scrollX: true, pageLength: 25,
    language: { search: "Buscar:", lengthMenu: "Mostrar _MENU_ registros", info: "Mostrando _START_–_END_ de _TOTAL_", paginate: { previous: "\u2039", next: "\u203a" } }
  });

  // Columnas redimensionables
  if ($.fn.colResizable) {
    $('#tablaAverias').colResizable({
      liveDrag: true,
      gripInnerHtml: "<div class='col-grip'></div>",
      draggingClass: "col-dragging",
      minWidth: 50
    });
  }

  // Botón mostrar/ocultar columnas
  iniciarSelectorColumnas();
}

// ─── Selector de columnas visibles ───
function iniciarSelectorColumnas() {
  const btn = document.getElementById("btnColumnas");
  if (!btn) return;

  btn.addEventListener("click", e => {
    e.stopPropagation();
    let menu = document.getElementById("menuColumnas");
    if (menu) { menu.remove(); return; }

    menu = document.createElement("div");
    menu.id = "menuColumnas";
    menu.className = "excl-menu";

    const titulo = document.createElement("div");
    titulo.className = "excl-title";
    titulo.textContent = "Columnas visibles";
    menu.appendChild(titulo);

    const barra = document.createElement("div");
    barra.className = "excl-barra";
    const btnTodo = document.createElement("button");
    btnTodo.textContent = "✓ Todas";
    btnTodo.onclick = () => {
      menu.querySelectorAll("input[type=checkbox]").forEach(cb => {
        cb.checked = true;
        tablaDT.column(cb.dataset.col).visible(true);
      });
    };
    const btnNada = document.createElement("button");
    btnNada.textContent = "✗ Ninguna";
    btnNada.onclick = () => {
      menu.querySelectorAll("input[type=checkbox]").forEach(cb => {
        cb.checked = false;
        tablaDT.column(cb.dataset.col).visible(false);
      });
    };
    barra.appendChild(btnTodo);
    barra.appendChild(btnNada);
    menu.appendChild(barra);

    const lista = document.createElement("div");
    lista.className = "excl-lista";

    tablaDT.columns().every(function(i) {
      const title = $(this.header()).text().trim();
      if (!title) return;
      const row = document.createElement("label");
      row.className = "excl-row";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.dataset.col = i;
      cb.checked = this.visible();
      cb.addEventListener("change", () => tablaDT.column(i).visible(cb.checked));
      const txt = document.createElement("span");
      txt.textContent = title;
      row.appendChild(cb);
      row.appendChild(txt);
      lista.appendChild(row);
    });

    menu.appendChild(lista);
    document.body.appendChild(menu);

    const rect = btn.getBoundingClientRect();
    menu.style.top  = (rect.bottom + window.scrollY + 4) + "px";
    menu.style.left = (rect.left + window.scrollX) + "px";

    setTimeout(() => {
      document.addEventListener("click", function cerrar(e) {
        if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener("click", cerrar); }
      });
    }, 10);
  });
}

// ─── Actualizar gráficos ───
function actualizarGraficos() {
  const fechaInicio = document.getElementById("fechaInicio").valueAsDate;
  const fechaFin    = document.getElementById("fechaFin").valueAsDate;

  let datos = window.dataTabla.filter(d => {
    if (!d.fechaJS) return false;
    return compareSoloFecha(d.fechaJS, fechaInicio) >= 0 && compareSoloFecha(d.fechaJS, fechaFin) <= 0;
  });
  for (const key in filtrosActivos) {
    if (filtrosActivos[key]) datos = datos.filter(d => d[key] === filtrosActivos[key]);
  }
  for (const campo in exclusiones) {
    const excl = exclusiones[campo];
    if (excl.size) datos = datos.filter(d => !excl.has(d[campo]));
  }

  // Barras genéricas
  [
    { key: "familia",    campo: "FAMILIA AVERIA" },
    { key: "origen",     campo: "ORIGEN AVISO" },
    { key: "familiaVeh", campo: "FAMILIA" },
    { key: "vhlo",       campo: "VHLO" }
  ].forEach(({ key, campo }) => {
    const conteo = {};
    datos.forEach(d => { const v = d[campo]; if (v && v !== "****") conteo[v] = (conteo[v]||0)+1; });
    const sorted = Object.entries(conteo).sort((a,b) => b[1]-a[1]);
    const labels  = sorted.map(e => e[0]);
    const values  = sorted.map(e => e[1]);
    const colores = generarColores(labels.length);
    const filtroV = filtrosActivos[campo];
    const bgColors = labels.map((l,i) => filtroV && l !== filtroV ? colores[i]+'55' : colores[i]);

    const c = charts[key];
    c.data.labels = labels;
    c.data.datasets[0].data = values;
    c.data.datasets[0].backgroundColor = bgColors;
    // Actualizar colores de leyenda por dataset (cada barra su color en la leyenda)
    c.data.datasets[0].pointBackgroundColor = bgColors;
    c.options.plugins.legend.labels.color = getLegendColor();
    c.update();
  });

  // Turno doughnut
  const ctTurno = {};
  datos.forEach(d => { const v = d["TURNO"]; if (v && v !== "****") ctTurno[v] = (ctTurno[v]||0)+1; });
  const tLabels = Object.keys(ctTurno), tVals = Object.values(ctTurno), tColors = generarColores(tLabels.length);
  charts.turno.data.labels = tLabels;
  charts.turno.data.datasets[0].data = tVals;
  charts.turno.data.datasets[0].backgroundColor = tColors;
  charts.turno.data.datasets[0].borderColor = modoOscuro ? '#1e1e2e' : '#f0f4ff';
  charts.turno.options.plugins.legend.labels.color = getLegendColor();
  charts.turno.update();

  // Evolución
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
  charts.evolucion.data.labels = labelsEv;
  charts.evolucion.data.datasets = familias.map((fam, i) => ({
    label: fam, data: labelsEv.map(l => conteoEvol[l][fam]||0),
    borderColor: colEv[i], backgroundColor: colEv[i]+'22', fill: false, tension: 0.3, pointRadius: 3
  }));
  charts.evolucion.options.plugins.legend.labels.color = getLegendColor();
  charts.evolucion.update();

  // Tabla
  tablaDT.clear(); tablaDT.rows.add(datos); tablaDT.draw();

  // KPIs
  document.getElementById("totalAverias").textContent = datos.length.toLocaleString('es-ES');
  const dias = new Set(datos.filter(d=>d.fechaJS).map(d=>d.fechaJS.toDateString())).size;
  document.getElementById("promedioDiario").textContent = dias ? (datos.length/dias).toFixed(1) : '0';
  const vhloCount = {};
  datos.forEach(d => { if (d.VHLO && d.VHLO !== "****") vhloCount[d.VHLO] = (vhloCount[d.VHLO]||0)+1; });
  document.getElementById("vehiculoTop").textContent = Object.keys(vhloCount).length
    ? Object.keys(vhloCount).reduce((a,b) => vhloCount[a]>vhloCount[b]?a:b) : '-';
}

function compareSoloFecha(a, b) {
  return new Date(a.getFullYear(),a.getMonth(),a.getDate()) - new Date(b.getFullYear(),b.getMonth(),b.getDate());
}

// ─── Drag & Drop reubicación de paneles ───
function iniciarDragPaneles() {
  let dragSrc = null;

  document.querySelectorAll('.chart-cell').forEach(cell => {
    cell.setAttribute('draggable', 'true');

    cell.addEventListener('dragstart', e => {
      dragSrc = cell;
      cell.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    cell.addEventListener('dragend', () => {
      cell.classList.remove('dragging');
      document.querySelectorAll('.chart-cell').forEach(c => c.classList.remove('drag-over'));
    });
    cell.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (cell !== dragSrc) cell.classList.add('drag-over');
    });
    cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
    cell.addEventListener('drop', e => {
      e.preventDefault();
      cell.classList.remove('drag-over');
      if (dragSrc && dragSrc !== cell) {
        const grid = cell.parentNode;
        const cells = [...grid.children];
        const srcIdx = cells.indexOf(dragSrc);
        const tgtIdx = cells.indexOf(cell);
        if (srcIdx < tgtIdx) grid.insertBefore(dragSrc, cell.nextSibling);
        else                  grid.insertBefore(dragSrc, cell);
        // Redibujar charts después del reorder
        setTimeout(() => Object.values(charts).forEach(c => c.resize()), 50);
      }
    });
  });
}

// ─── Resize bidireccional (ancho + alto) con handles ───
function iniciarResizePaneles() {
  document.querySelectorAll('.chart-panel').forEach(panel => {
    // Handle sur (altura)
    const hS = panel.querySelector('.resize-s');
    // Handle este (anchura)
    const hE = panel.querySelector('.resize-e');
    // Handle esquina SE (ambos)
    const hSE = panel.querySelector('.resize-se');

    let dragging = false, dir = '', startX = 0, startY = 0, startW = 0, startH = 0;

    function onDown(e, direction) {
      e.preventDefault(); e.stopPropagation();
      dragging = true; dir = direction;
      startX = e.clientX; startY = e.clientY;
      startW = panel.offsetWidth; startH = panel.offsetHeight;
      document.body.style.userSelect = 'none';
      document.body.style.cursor = direction === 's' ? 'ns-resize' : direction === 'e' ? 'ew-resize' : 'nwse-resize';
    }

    if (hS)  hS.addEventListener('mousedown',  e => onDown(e, 's'));
    if (hE)  hE.addEventListener('mousedown',  e => onDown(e, 'e'));
    if (hSE) hSE.addEventListener('mousedown', e => onDown(e, 'se'));

    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      if (dir === 's' || dir === 'se') panel.style.height = Math.max(150, startH + (e.clientY - startY)) + 'px';
      if (dir === 'e' || dir === 'se') panel.style.width  = Math.max(200, startW + (e.clientX - startX)) + 'px';
      Object.values(charts).forEach(c => c.resize());
    });
    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    });
  });
}
