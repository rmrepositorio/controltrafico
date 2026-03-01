// ─── Paleta de colores dinámica (suficientes para muchas categorías) ───
const PALETA = [
  '#00d4aa','#7c6fe0','#ff6b6b','#ffd166','#06d6a0',
  '#118ab2','#ef476f','#f78c6b','#88d498','#c77dff',
  '#48cae4','#f4a261','#e76f51','#2ec4b6','#e9c46a',
  '#a8dadc','#457b9d','#e63946','#2a9d8f','#f3722c'
];

function generarColores(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(PALETA[i % PALETA.length]);
  return out;
}

// ─── Estado global ───
let charts       = {};
let filtrosActivos = {};
let modoOscuro   = true;
let tablaDT;
let historial    = [];
let historialIdx = -1;

// ─── Modo claro/oscuro ───
document.getElementById("toggleModo").addEventListener("click", () => {
  modoOscuro = !modoOscuro;
  document.body.classList.toggle("light-mode", !modoOscuro);
  document.getElementById("toggleModo").textContent = modoOscuro ? "☀ Modo claro" : "🌙 Modo oscuro";
  actualizarColoresGraficos();
  if (tablaDT) tablaDT.draw(false);
});

function getLegendColor() {
  return modoOscuro ? '#e0e0f0' : '#1a1a2e';
}

function actualizarColoresGraficos() {
  const color = getLegendColor();
  Object.values(charts).forEach(c => {
    if (c.options.plugins?.legend?.labels) {
      c.options.plugins.legend.labels.color = color;
    }
    if (c.options.scales) {
      Object.values(c.options.scales).forEach(scale => {
        if (scale.ticks) scale.ticks.color = color;
        if (scale.grid)  scale.grid.color  = modoOscuro ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
      });
    }
    c.update();
  });
}

// ─── Historial ───
function actualizarBotones() {
  document.getElementById("btnAtras").disabled    = historialIdx <= 0;
  document.getElementById("btnAdelante").disabled = historialIdx >= historial.length - 1;
}

document.getElementById("btnAtras").addEventListener("click", () => {
  if (historialIdx > 0) {
    historialIdx--;
    filtrosActivos = { ...historial[historialIdx] };
    renderizarFiltrosTags();
    actualizarGraficos();
    actualizarBotones();
  }
});
document.getElementById("btnAdelante").addEventListener("click", () => {
  if (historialIdx < historial.length - 1) {
    historialIdx++;
    filtrosActivos = { ...historial[historialIdx] };
    renderizarFiltrosTags();
    actualizarGraficos();
    actualizarBotones();
  }
});
document.getElementById("btnLimpiar").addEventListener("click", () => {
  filtrosActivos = {};
  pushHistorial();
  renderizarFiltrosTags();
  actualizarGraficos();
});

function pushHistorial() {
  historial = historial.slice(0, historialIdx + 1);
  historial.push({ ...filtrosActivos });
  historialIdx = historial.length - 1;
  actualizarBotones();
}

// ─── Tags de filtros activos ───
function renderizarFiltrosTags() {
  const cont = document.getElementById("filtrosActivos");
  cont.innerHTML = "";
  Object.entries(filtrosActivos).forEach(([key, val]) => {
    if (!val) return;
    const tag = document.createElement("span");
    tag.className = "filtro-tag";
    tag.textContent = `${key}: ${val}  ✕`;
    tag.title = "Click para quitar este filtro";
    tag.addEventListener("click", () => {
      delete filtrosActivos[key];
      pushHistorial();
      renderizarFiltrosTags();
      actualizarGraficos();
    });
    cont.appendChild(tag);
  });
}

// ─── Cargar JSON ───
fetch("resumen_full.json")
  .then(res => res.json())
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
  .catch(err => console.error("Error cargando JSON:", err));

// ─── Fechas ───
function inicializarSliders() {
  const fechas = window.dataTabla.filter(d => d.fechaJS).map(d => d.fechaJS);
  const minF = new Date(Math.min(...fechas));
  const maxF = new Date(Math.max(...fechas));
  document.getElementById("fechaInicio").valueAsDate = minF;
  document.getElementById("fechaFin").valueAsDate   = maxF;
  document.getElementById("fechaInicio").addEventListener("change", actualizarGraficos);
  document.getElementById("fechaFin").addEventListener("change",    actualizarGraficos);
}

// ─── Crear gráficos ───
function crearGraficos() {
  const color = getLegendColor();
  const gridColor = 'rgba(255,255,255,0.07)';

  function baseOptions(label) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color } },
        tooltip: { mode: 'index' }
      },
      scales: {
        x: { ticks: { color, maxRotation: 45 }, grid: { color: gridColor } },
        y: { ticks: { color }, grid: { color: gridColor } }
      },
      onClick: (evt, elems) => {
        if (elems.length) {
          const idx   = elems[0].index;
          const valor = evt.chart.data.labels[idx];
          if (filtrosActivos[label] === valor) {
            delete filtrosActivos[label];
          } else {
            filtrosActivos[label] = valor;
          }
          pushHistorial();
          renderizarFiltrosTags();
          actualizarGraficos();
        }
      },
      interaction: { mode: 'nearest', intersect: true }
    };
  }

  function crearGrafico(id, campo) {
    const ctx = document.getElementById(id).getContext("2d");
    return new Chart(ctx, {
      type: 'bar',
      data: { labels: [], datasets: [{ label: campo, data: [], backgroundColor: [], borderWidth: 0, borderRadius: 4 }] },
      options: baseOptions(campo)
    });
  }

  charts.familia    = crearGrafico("graficoFamilia",    "FAMILIA AVERIA");
  charts.turno      = crearGrafico("graficoTurno",      "TURNO");
  charts.origen     = crearGrafico("graficoOrigen",     "ORIGEN AVISO");
  charts.familiaVeh = crearGrafico("graficoFamiliaVeh", "FAMILIA");
  charts.vhlo       = crearGrafico("graficoVHLO",       "VHLO");

  // Evolución
  const ctxEv = document.getElementById("graficoEvolucion").getContext("2d");
  charts.evolucion = new Chart(ctxEv, {
    type: 'line',
    data: { labels: [], datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color } } },
      scales: {
        x: { ticks: { color }, grid: { color: gridColor } },
        y: { ticks: { color }, grid: { color: gridColor } }
      }
    }
  });
}

// ─── Inicializar DataTable (sin SearchPanes) ───
function inicializarTabla() {
  tablaDT = $('#tablaAverias').DataTable({
    data: [],
    columns: [
      { title: "Vehículo",              data: "VHLO" },
      { title: "Familia Vehículo",      data: "FAMILIA" },
      { title: "Familia Avería",        data: "FAMILIA AVERIA" },
      { title: "Deficiencias",          data: "DEFICIENCIAS DETECTADAS" },
      { title: "Fecha Aviso",           data: "FECHA AVISO" },
      { title: "Turno",                 data: "TURNO" },
      { title: "Origen Aviso",          data: "ORIGEN AVISO" },
      { title: "Tipo Orden",            data: "TIPO ORDEN" }
    ],
    colReorder: true,
    scrollX: true,
    pageLength: 25,
    language: {
      search:       "Buscar:",
      lengthMenu:   "Mostrar _MENU_ registros",
      info:         "Mostrando _START_–_END_ de _TOTAL_",
      paginate:     { previous: "‹", next: "›" }
    }
  });
}

// ─── Actualizar gráficos y tabla ───
function actualizarGraficos() {
  const fechaInicio = document.getElementById("fechaInicio").valueAsDate;
  const fechaFin    = document.getElementById("fechaFin").valueAsDate;

  let datos = window.dataTabla.filter(d => {
    if (!d.fechaJS) return false;
    return compareSoloFecha(d.fechaJS, fechaInicio) >= 0 &&
           compareSoloFecha(d.fechaJS, fechaFin)    <= 0;
  });

  for (const key in filtrosActivos) {
    if (filtrosActivos[key]) datos = datos.filter(d => d[key] === filtrosActivos[key]);
  }

  // Gráficos de barras
  const config = [
    { key: "familia",    campo: "FAMILIA AVERIA" },
    { key: "turno",      campo: "TURNO" },
    { key: "origen",     campo: "ORIGEN AVISO" },
    { key: "familiaVeh", campo: "FAMILIA" },
    { key: "vhlo",       campo: "VHLO" }
  ];

  config.forEach(({ key, campo }) => {
    const conteo = {};
    datos.forEach(d => {
      const val = d[campo];
      if (val && val !== "****") conteo[val] = (conteo[val] || 0) + 1;
    });

    // Ordenar de mayor a menor
    const sorted   = Object.entries(conteo).sort((a, b) => b[1] - a[1]);
    const labels    = sorted.map(e => e[0]);
    const values    = sorted.map(e => e[1]);
    const colores   = generarColores(labels.length);

    // Resaltar el valor filtrado actualmente
    const filtroVal = filtrosActivos[campo];
    const bgColors  = labels.map((l, i) =>
      filtroVal && l !== filtroVal ? colores[i] + '55' : colores[i]
    );

    charts[key].data.labels                        = labels;
    charts[key].data.datasets[0].data              = values;
    charts[key].data.datasets[0].backgroundColor   = bgColors;
    charts[key].options.plugins.legend.labels.color = getLegendColor();
    charts[key].update();
  });

  // Evolución mensual
  const conteoEvol = {};
  datos.forEach(d => {
    const f   = d.fechaJS;
    const mes = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`;
    if (!conteoEvol[mes]) conteoEvol[mes] = {};
    const fam = d["FAMILIA AVERIA"];
    if (fam && fam !== "****") conteoEvol[mes][fam] = (conteoEvol[mes][fam] || 0) + 1;
  });
  const labelsEv  = Object.keys(conteoEvol).sort();
  const familias  = [...new Set(datos.map(d => d["FAMILIA AVERIA"]).filter(f => f && f !== "****"))];
  const coloresEv = generarColores(familias.length);

  charts.evolucion.data.labels   = labelsEv;
  charts.evolucion.data.datasets = familias.map((fam, i) => ({
    label:           fam,
    data:            labelsEv.map(l => conteoEvol[l][fam] || 0),
    borderColor:     coloresEv[i],
    backgroundColor: coloresEv[i] + '22',
    fill:            false,
    tension:         0.3,
    pointRadius:     3
  }));
  charts.evolucion.options.plugins.legend.labels.color = getLegendColor();
  charts.evolucion.update();

  // Tabla
  tablaDT.clear();
  tablaDT.rows.add(datos);
  tablaDT.draw();

  // KPIs
  document.getElementById("totalAverias").textContent = datos.length.toLocaleString('es-ES');

  const dias = new Set(datos.filter(d => d.fechaJS).map(d => d.fechaJS.toDateString())).size;
  document.getElementById("promedioDiario").textContent =
    dias ? (datos.length / dias).toFixed(1) : '0';

  const vhloCount = {};
  datos.forEach(d => {
    if (d.VHLO && d.VHLO !== "****") vhloCount[d.VHLO] = (vhloCount[d.VHLO] || 0) + 1;
  });
  const topVhlo = Object.keys(vhloCount).length
    ? Object.keys(vhloCount).reduce((a, b) => vhloCount[a] > vhloCount[b] ? a : b)
    : '-';
  document.getElementById("vehiculoTop").textContent = topVhlo;
}

function compareSoloFecha(a, b) {
  return new Date(a.getFullYear(), a.getMonth(), a.getDate()) -
         new Date(b.getFullYear(), b.getMonth(), b.getDate());
}
