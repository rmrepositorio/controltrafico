let charts = {};
let filtrosActivos = {};
let modoOscuro = true;
let tablaDT;
let historial = [];
let historialIdx = -1;

// Modo claro/oscuro
document.getElementById("toggleModo").addEventListener("click", ()=>{
    modoOscuro = !modoOscuro;
    document.body.style.backgroundColor = modoOscuro ? "#4A4646" : "#D1F0F0";
    document.body.style.color = modoOscuro ? "#eee" : "#000";
    document.querySelectorAll(".kpi").forEach(k => {
        k.style.backgroundColor = modoOscuro ? "#5a5555" : "#b3eaea";
        k.style.color = modoOscuro ? "#fff" : "#000";
    });
    if(tablaDT) tablaDT.draw(false);
    Object.values(charts).forEach(c=>{
        if(c.options.plugins && c.options.plugins.legend) c.options.plugins.legend.labels.color='#fff';
        c.update();
    });
});

// Historial botones
document.getElementById("btnAtras").addEventListener("click", ()=>{
    if(historialIdx>0){
        historialIdx--;
        filtrosActivos = {...historial[historialIdx]};
        actualizarGraficos();
    }
});
document.getElementById("btnAdelante").addEventListener("click", ()=>{
    if(historialIdx<historial.length-1){
        historialIdx++;
        filtrosActivos = {...historial[historialIdx]};
        actualizarGraficos();
    }
});

// Cargar JSON
fetch("resumen_full.json")
  .then(res => res.json())
  .then(data => {
      data.forEach(d=>{
          const [d1,m1,y1] = d["FECHA AVISO"].split("/").map(Number);
          d.fechaJS = new Date(y1,m1-1,d1);
      });
      window.dataTabla = data;
      inicializarSliders();
      inicializarTabla();
      crearGraficos();
      actualizarGraficos();
  });

// Slider fechas
function inicializarSliders(){
    const fechas = window.dataTabla.map(d=>d.fechaJS);
    const minF = new Date(Math.min(...fechas));
    const maxF = new Date(Math.max(...fechas));
    document.getElementById("fechaInicio").valueAsDate = minF;
    document.getElementById("fechaFin").valueAsDate = maxF;
    document.getElementById("fechaInicio").addEventListener("change", actualizarGraficos);
    document.getElementById("fechaFin").addEventListener("change", actualizarGraficos);
}

// Crear gráficos
function crearGraficos(){
    charts.familia = crearGraficoFamilia("graficoFamilia","FAMILIA AVERIA");
    charts.turno = crearGrafico("graficoTurno","polarArea","TURNO");
    charts.origen = crearGrafico("graficoOrigen","bar","ORIGEN AVISO");
    charts.familiaVeh = crearGraficoFamilia("graficoFamiliaVeh","FAMILIA");
    charts.vhlo = crearGrafico("graficoVHLO","bar","VHLO");
    charts.evolucion = crearGraficoEvolucion("graficoEvolucion");
}

// Crear gráfico genérico con leyenda blanca y tamaño manejable
function crearGrafico(id,tipo,label){
    const ctx = document.getElementById(id).getContext("2d");
    return new Chart(ctx,{
        type: tipo,
        data: { labels: [], datasets:[{label, data:[], backgroundColor:[], borderColor:[], borderWidth:1}] },
        options:{
            responsive:true,
            maintainAspectRatio:false,
            plugins:{ legend:{ labels:{ color:'#fff' } } },
            onClick:(evt, elems)=>{
                if(elems.length){
                    const idx = elems[0].index;
                    const valor = evt.chart.data.labels[idx];
                    filtrosActivos[label] = filtrosActivos[label]===valor ? null : valor;
                    historial = historial.slice(0, historialIdx+1);
                    historial.push({...filtrosActivos});
                    historialIdx = historial.length-1;
                    actualizarGraficos();
                }
            },
            interaction:{mode:'nearest', intersect:true}
        }
    });
}

// Gráfico familia averías con leyenda por categoría
function crearGraficoFamilia(id, label){
    const ctx = document.getElementById(id).getContext("2d");
    return new Chart(ctx,{
        type: 'bar',
        data: { labels: [], datasets:[{label, data:[], backgroundColor:[], borderColor:[], borderWidth:1}] },
        options:{
            responsive:true,
            maintainAspectRatio:false,
            plugins:{
                legend:{
                    labels:{
                        color:'#fff',
                        generateLabels: function(chart){
                            const data = chart.data;
                            if(data.labels.length && data.datasets.length){
                                const ds = data.datasets[0];
                                return data.labels.map((lbl, i) => ({
                                    text: lbl,
                                    fillStyle: ds.backgroundColor[i],
                                    strokeStyle: ds.borderColor[i] || ds.backgroundColor[i],
                                    lineWidth: ds.borderWidth || 0,
                                    hidden: false,
                                    index: i
                                }));
                            }
                            return [];
                        }
                    },
                    onClick: function(evt, legendItem, legend){
                        // Clicking legend item acts like clicking that bar
                        const idx = legendItem.index;
                        const chart = legend.chart;
                        const valor = chart.data.labels[idx];
                        filtrosActivos[label] = filtrosActivos[label]===valor ? null : valor;
                        historial = historial.slice(0, historialIdx+1);
                        historial.push({...filtrosActivos});
                        historialIdx = historial.length-1;
                        actualizarGraficos();
                    }
                }
            },
            onClick:(evt, elems)=>{
                if(elems.length){
                    const idx = elems[0].index;
                    const valor = evt.chart.data.labels[idx];
                    filtrosActivos[label] = filtrosActivos[label]===valor ? null : valor;
                    historial = historial.slice(0, historialIdx+1);
                    historial.push({...filtrosActivos});
                    historialIdx = historial.length-1;
                    actualizarGraficos();
                }
            },
            interaction:{mode:'nearest', intersect:true}
        }
    });
}

// Gráfico de evolución
function crearGraficoEvolucion(id){
    const ctx = document.getElementById(id).getContext("2d");
    return new Chart(ctx,{
        type:'line',
        data:{labels:[], datasets:[]},
        options:{
            responsive:true,
            maintainAspectRatio:false,
            plugins:{legend:{labels:{color:'#fff'}}}
        }
    });
}

// Inicializar DataTable
function inicializarTabla(){
    tablaDT = $('#tablaAverias').DataTable({
        data: [],
        columns: [
            { title:"Vehículo", data:"VHLO" },
            { title:"Familia Vehículo", data:"FAMILIA" },
            { title:"Familia Avería", data:"FAMILIA AVERIA" },
            { title:"Deficiencias Detectadas", data:"DEFICIENCIAS DETECTADAS" },
            { title:"Fecha Aviso", data:"FECHA AVISO" },
            { title:"Turno", data:"TURNO" },
            { title:"Origen Aviso", data:"ORIGEN AVISO" },
            { title:"Tipo Orden", data:"TIPO ORDEN" }
        ],
        colReorder:true,
        dom:'Plfrtip',
        scrollX:true
    });
}

// Actualizar gráficos y tabla
function actualizarGraficos(){
    const fechaInicio = document.getElementById("fechaInicio").valueAsDate;
    const fechaFin = document.getElementById("fechaFin").valueAsDate;

    let datos = window.dataTabla.filter(d=>{
        if(!d.fechaJS) return false;
        const f=d.fechaJS;
        return compareSoloFecha(f, fechaInicio) >=0 && compareSoloFecha(f, fechaFin) <=0;
    });

    for(const key in filtrosActivos){
        if(filtrosActivos[key]) datos = datos.filter(d=>d[key]===filtrosActivos[key]);
    }

    const claves = ["FAMILIA AVERIA","TURNO","ORIGEN AVISO","FAMILIA","VHLO"];
    const graficos = ["familia","turno","origen","familiaVeh","vhlo"];
    const paleta = ['#FF6384','#36A2EB','#FFCE56','#4BC0C0','#9966FF','#FF9F40','#C9CBCF'];
    graficos.forEach((g,i)=>{
        const conteo = {};
        datos.forEach(d=>{
            const val = d[claves[i]];
            if(val && val!=="****") conteo[val] = (conteo[val]||0)+1;
        });
        const keys = Object.keys(conteo);
        charts[g].data.labels = keys;
        charts[g].data.datasets[0].data = Object.values(conteo);
        charts[g].data.datasets[0].backgroundColor = keys.map((_,j) => paleta[j % paleta.length]);
        charts[g].data.datasets[0].borderColor = keys.map((_,j) => paleta[j % paleta.length]);
        charts[g].options.plugins.legend.labels.color = '#fff';
        charts[g].update();
    });

    // Evolución
    const conteoEvol = {};
    datos.forEach(d=>{
        const f=d.fechaJS;
        const key = `${f.getFullYear()}-${String(f.getMonth()+1).padStart(2,'0')}`;
        if(!conteoEvol[key]) conteoEvol[key]={};
        const fam=d["FAMILIA AVERIA"];
        if(fam && fam!=="****") conteoEvol[key][fam]=(conteoEvol[key][fam]||0)+1;
    });
    const labels = Object.keys(conteoEvol).sort();
    const familias = [...new Set(datos.map(d=>d["FAMILIA AVERIA"]).filter(f=>f && f!=="****"))];
    charts.evolucion.data.labels = labels;
    charts.evolucion.data.datasets = familias.map((fam,i)=>({
        label:fam,
        data:labels.map(l=>conteoEvol[l][fam]||0),
        borderColor:paleta[i % paleta.length],
        backgroundColor:'transparent',
        tension:0.3
    }));
    charts.evolucion.options.plugins.legend.labels.color = '#fff';
    charts.evolucion.update();

    // Tabla
    tablaDT.clear();
    tablaDT.rows.add(datos);
    tablaDT.draw();

    // KPIs
    document.getElementById("totalAverias").textContent = datos.length;
    const dias = new Set(datos.map(d=>d.fechaJS.toDateString())).size;
    document.getElementById("promedioDiario").textContent = dias ? (datos.length/dias).toFixed(1) : 0;
    const vhloCount = {};
    datos.forEach(d=>{ if(d.VHLO && d.VHLO!=="****") vhloCount[d.VHLO] = (vhloCount[d.VHLO]||0)+1; });
    document.getElementById("vehiculoTop").textContent = Object.keys(vhloCount).reduce((a,b)=>vhloCount[a]>vhloCount[b]?a:b,"-");
}

// Comparar fechas solo año/mes/día
function compareSoloFecha(a,b){
    return new Date(a.getFullYear(),a.getMonth(),a.getDate()) - new Date(b.getFullYear(),b.getMonth(),b.getDate());
}