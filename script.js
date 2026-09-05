// ---------- utilidades ----------
function fnum(x, dec){
  dec = dec === undefined ? 1 : dec;
  if (x === null || x === undefined || isNaN(x)) x = 0;
  return x.toLocaleString('es-PY', {minimumFractionDigits: dec, maximumFractionDigits: dec});
}
function esc(s){
  return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
function setStatus(msg, kind){
  var el = document.getElementById('statusMsg');
  el.textContent = msg;
  el.className = 'status-msg' + (kind ? ' ' + kind : '');
}
function getMonday(d){
  var date = new Date(d);
  var day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  date.setHours(0,0,0,0);
  return date;
}
function fmtShortDate(d){
  var dd = String(d.getDate()).padStart(2,'0');
  var mm = String(d.getMonth()+1).padStart(2,'0');
  return dd + '/' + mm;
}
var CROP_COLORS = { 'soja': 'var(--soja)', 'trigo': 'var(--trigo)', 'maiz': 'var(--maiz)', 'maíz': 'var(--maiz)' };
var FALLBACK_PALETTE = ['var(--ok)', 'var(--alerta)', 'var(--gold-2)', '#7a8fae', '#a06fae', '#5aa3a3'];
var fallbackIdx = 0;
var cropColorCache = {};
function cropColor(cultivo){
  var key = String(cultivo).trim().toLowerCase();
  if (CROP_COLORS[key]) return CROP_COLORS[key];
  if (!cropColorCache[key]){ cropColorCache[key] = FALLBACK_PALETTE[fallbackIdx % FALLBACK_PALETTE.length]; fallbackIdx++; }
  return cropColorCache[key];
}

// ---------- parseo de un excel local (solo para la vista previa manual) ----------
function normalizeRow(r){
  var keys = Object.keys(r);
  function find(name){
    var k = keys.find(function(k){ return k.trim().toLowerCase() === name; });
    return k !== undefined ? r[k] : undefined;
  }
  var fecha = find('fecha');
  var productor = find('productor');
  var cultivo = find('cultivo');
  var contrato = find('contrato');
  if (fecha === undefined || productor === undefined || cultivo === undefined || contrato === undefined) return null;

  var fechaDate;
  if (fecha instanceof Date) fechaDate = fecha;
  else fechaDate = new Date(fecha);
  if (isNaN(fechaDate.getTime())) return null;

  return {
    fecha: fechaDate,
    productor: String(productor).trim(),
    cultivo: String(cultivo).trim(),
    contrato: String(contrato).trim(),
    recibida: Number(find('cantidad_recibida_tn')) || 0,
    liquidada: Number(find('cantidad_liquidada_tn')) || 0,
    facturada: Number(find('cantidad_facturada_tn')) || 0,
    precio: Number(find('precio_liquidacion_usd_tn')) || 0,
    monto: Number(find('monto_liquidado_usd')) || 0,
    estado: String(find('estado_contrato') || '').trim()
  };
}

function parseWorkbookFile(file){
  var reader = new FileReader();
  reader.onload = function(e){
    try{
      var wb = XLSX.read(e.target.result, {type:'array', cellDates:true});
      var ws = wb.Sheets[wb.SheetNames[0]];
      var json = XLSX.utils.sheet_to_json(ws, {defval:null});
      var rows = json.map(normalizeRow).filter(Boolean);
      if (rows.length === 0) throw new Error('no se encontraron filas con las columnas esperadas.');
      render(rows, new Date().toISOString(), false, true);
      setStatus('Vista previa local: ' + rows.length + ' contratos (no se publicó).', 'ok');
    }catch(err){
      setStatus('No se pudo leer el archivo: ' + err.message, 'err');
    }
  };
  reader.onerror = function(){ setStatus('Error al leer el archivo.', 'err'); };
  reader.readAsArrayBuffer(file);
}

// ---------- render principal ----------
// preview=true cuando los datos vienen de una carga manual local (no publicada)
function render(rows, updatedIso, isDefault, preview){
  rows = rows.slice().sort(function(a,b){ return new Date(a.fecha) - new Date(b.fecha); });

  var totRecibida=0, totLiquidada=0, totFacturada=0, totMonto=0, nCerrado=0, nAbierto=0;
  var producers = {};
  var crops = {};
  var weeks = {};

  rows.forEach(function(r){
    totRecibida += r.recibida; totLiquidada += r.liquidada; totFacturada += r.facturada; totMonto += r.monto;
    if (r.estado.toLowerCase() === 'cerrado') nCerrado++; else nAbierto++;

    if (!producers[r.productor]) producers[r.productor] = {recibida:0, liquidada:0, cropTn:{}};
    var p = producers[r.productor];
    p.recibida += r.recibida; p.liquidada += r.liquidada;
    p.cropTn[r.cultivo] = (p.cropTn[r.cultivo]||0) + r.recibida;

    if (!crops[r.cultivo]) crops[r.cultivo] = {recibida:0, liquidada:0, facturada:0, monto:0, n:0, precioSum:0};
    var c = crops[r.cultivo];
    c.recibida += r.recibida; c.liquidada += r.liquidada; c.facturada += r.facturada;
    c.monto += r.monto; c.n += 1; c.precioSum += r.precio;

    var mon = getMonday(r.fecha).toISOString();
    if (!weeks[mon]) weeks[mon] = {recibida:0, precioSum:0, precioN:0};
    weeks[mon].recibida += r.recibida;
    weeks[mon].precioSum += r.precio; weeks[mon].precioN += 1;
  });

  // ---- header ----
  document.getElementById('contractCount').textContent = rows.length + ' contratos';
  var dot = document.getElementById('liveDot');
  var updEl = document.getElementById('updatedText');
  if (preview){
    dot.className = 'dot-live stale';
    updEl.textContent = 'Vista previa local — sin publicar';
  } else if (isDefault){
    dot.className = 'dot-live stale';
    updEl.textContent = 'No se pudo conectar con data.json — mostrando datos de ejemplo';
  } else {
    dot.className = 'dot-live';
    var d = new Date(updatedIso);
    updEl.textContent = 'Actualizado ' + d.toLocaleDateString('es-PY') + ' ' + d.toLocaleTimeString('es-PY', {hour:'2-digit', minute:'2-digit'}) + ' (desde Google Drive)';
  }

  // ---- KPIs ----
  var pctLiq = totRecibida ? (totLiquidada/totRecibida*100) : 0;
  var pendienteFactura = totRecibida - totFacturada;
  document.getElementById('kpisSection').innerHTML =
    '<div class="kpi"><div class="kpi-label">Tn recibidas</div><div class="kpi-value">' + fnum(totRecibida) + '</div>' +
      '<div class="kpi-sub">' + rows.length + ' contratos · ' + Object.keys(producers).length + ' productores</div></div>' +
    '<div class="kpi"><div class="kpi-label">Tn liquidadas</div><div class="kpi-value">' + fnum(totLiquidada) + '</div>' +
      '<div class="kpi-sub"><b>' + Math.round(pctLiq) + '%</b> de avance sobre lo recibido</div>' +
      '<div class="kpi-bar"><div style="width:' + Math.min(100,pctLiq).toFixed(0) + '%"></div></div></div>' +
    '<div class="kpi"><div class="kpi-label">Tn facturadas</div><div class="kpi-value">' + fnum(totFacturada) + '</div>' +
      '<div class="kpi-sub">Pendiente de facturar: <b>' + fnum(pendienteFactura) + ' tn</b></div></div>' +
    '<div class="kpi"><div class="kpi-label">Monto liquidado</div><div class="kpi-value" style="font-size:26px;">US$ ' + fnum(totMonto,0) + '</div>' +
      '<div class="kpi-sub">' + nCerrado + ' cerrados · <b>' + nAbierto + ' abiertos</b></div></div>';

  // ---- silos por productor ----
  var prodArr = Object.keys(producers).map(function(name){
    var p = producers[name];
    var pct = p.recibida ? (p.liquidada/p.recibida*100) : 0;
    var mainCrop = Object.keys(p.cropTn).sort(function(a,b){ return p.cropTn[b]-p.cropTn[a]; })[0] || '';
    return {name:name, pct:pct, crop:mainCrop};
  }).sort(function(a,b){ return b.pct - a.pct; });

  document.getElementById('siloRow').innerHTML = prodArr.map(function(p){
    var statusCls = 'status-alerta', statusLbl = 'Alerta plazo';
    if (p.pct >= 80){ statusCls='status-vigente'; statusLbl='Al día'; }
    else if (p.pct >= 60){ statusCls='status-cumplido'; statusLbl='Vigente'; }
    var pctR = Math.round(p.pct);
    return '<div class="silo-card">' +
      '<div class="silo"><div class="fill" style="height:' + Math.min(100,pctR) + '%"></div><div class="pct">' + pctR + '%</div></div>' +
      '<div class="silo-name">' + esc(p.name) + '</div>' +
      '<div class="silo-crop">' + esc(p.crop) + '</div>' +
      '<span class="silo-status ' + statusCls + '">' + statusLbl + '</span></div>';
  }).join('');

  // ---- barras semanales ----
  var weekKeys = Object.keys(weeks).sort();
  var maxWeek = Math.max.apply(null, weekKeys.map(function(k){ return weeks[k].recibida; }).concat([1]));
  document.getElementById('barsRow').innerHTML = weekKeys.map(function(k){
    var w = weeks[k];
    var monday = new Date(k);
    var sunday = new Date(monday); sunday.setDate(sunday.getDate()+6);
    var h = Math.max(2, Math.round(w.recibida/maxWeek*100));
    return '<div class="bar-col"><div class="bar-value">' + fnum(w.recibida,0) + '</div>' +
      '<div class="bar" style="height:' + h + '%"></div>' +
      '<div class="bar-label">' + fmtShortDate(monday) + '–' + fmtShortDate(sunday) + '</div></div>';
  }).join('');

  // ---- tarjetas por cultivo ----
  var cropKeys = Object.keys(crops).sort(function(a,b){ return crops[b].recibida - crops[a].recibida; });
  document.getElementById('cropGrid').innerHTML = cropKeys.map(function(name){
    var c = crops[name];
    var pct = c.recibida ? (c.liquidada/c.recibida*100) : 0;
    var precioProm = c.n ? (c.precioSum/c.n) : 0;
    var color = cropColor(name);
    return '<div class="crop-card">' +
      '<div class="crop-head"><span class="crop-dot" style="background:' + color + '; width:10px; height:10px;"></span><span class="crop-name">' + esc(name) + '</span></div>' +
      '<div class="crop-stats">' +
        '<div><div class="stat-label">Recibida</div><div class="stat-value">' + fnum(c.recibida) + ' tn</div></div>' +
        '<div><div class="stat-label">Liquidada</div><div class="stat-value">' + fnum(c.liquidada) + ' tn</div></div>' +
        '<div><div class="stat-label">Contratos</div><div class="stat-value">' + c.n + '</div></div>' +
        '<div><div class="stat-label">Precio prom.</div><div class="stat-value">US$ ' + fnum(precioProm,0) + '</div></div>' +
      '</div>' +
      '<div class="crop-bar"><div style="width:' + Math.min(100,pct).toFixed(0) + '%; background:' + color + ';"></div></div>' +
    '</div>';
  }).join('');

  // ---- gráfico de precios ----
  renderPriceChart(weekKeys, weeks);

  // ---- tabla de contratos ----
  var sortedDesc = rows.slice().sort(function(a,b){ return new Date(b.fecha) - new Date(a.fecha); });
  document.getElementById('tableBody').innerHTML = sortedDesc.map(function(r){
    var estadoCls = r.estado.toLowerCase() === 'cerrado' ? 'status-cumplido' : 'status-vigente';
    var d = new Date(r.fecha);
    var fechaStr = String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear();
    return '<tr>' +
      '<td class="cell-muted">' + esc(r.contrato) + '</td>' +
      '<td>' + fechaStr + '</td>' +
      '<td>' + esc(r.productor) + '</td>' +
      '<td><span class="crop-dot" style="background:' + cropColor(r.cultivo) + '"></span>' + esc(r.cultivo) + '</td>' +
      '<td class="cell-muted">' + fnum(r.recibida) + '</td>' +
      '<td>' + fnum(r.liquidada) + '</td>' +
      '<td class="cell-muted">' + fnum(r.facturada) + '</td>' +
      '<td class="cell-muted">US$ ' + fnum(r.precio,2) + '</td>' +
      '<td><span class="pill ' + estadoCls + '">' + esc(r.estado) + '</span></td>' +
    '</tr>';
  }).join('');
}

function renderPriceChart(weekKeys, weeks){
  var wrap = document.getElementById('priceChartWrap');
  var caption = document.getElementById('priceCaption');
  var pts = weekKeys.map(function(k){
    var w = weeks[k];
    return {monday: new Date(k), avg: w.precioN ? (w.precioSum/w.precioN) : 0};
  }).filter(function(p){ return p.avg > 0; });

  if (pts.length < 2){
    wrap.innerHTML = '<div class="empty-note">No hay suficientes datos de precio para graficar una tendencia.</div>';
    caption.textContent = '';
    return;
  }

  var vals = pts.map(function(p){ return p.avg; });
  var rawMin = Math.min.apply(null, vals), rawMax = Math.max.apply(null, vals);
  var pad = Math.max(5, (rawMax-rawMin)*0.15);
  var domMin = Math.floor((rawMin-pad)/10)*10;
  var domMax = Math.ceil((rawMax+pad)/10)*10;
  if (domMax === domMin) domMax = domMin + 10;

  var x0=60, x1=600, y0=180, y1=20;
  function xFor(i){ return pts.length===1 ? x0 : x0 + (x1-x0)*i/(pts.length-1); }
  function yFor(v){ return y0 - (v-domMin)/(domMax-domMin)*(y0-y1); }

  var gridLines = '', gridCount = 4;
  for (var g=0; g<=gridCount; g++){
    var val = domMin + (domMax-domMin)*g/gridCount;
    var y = yFor(val);
    gridLines += '<line x1="40" y1="' + y.toFixed(1) + '" x2="620" y2="' + y.toFixed(1) + '" stroke="var(--line)" stroke-width="1"' + (g>0 && g<gridCount ? ' stroke-dasharray="3,4"' : '') + '/>';
    gridLines += '<text x="30" y="' + (y+3).toFixed(1) + '" text-anchor="end" font-size="10" fill="#a89a80" font-family="Inter">' + Math.round(val) + '</text>';
  }

  var polyPoints = pts.map(function(p,i){ return xFor(i).toFixed(1) + ',' + yFor(p.avg).toFixed(1); }).join(' ');

  var labels = '';
  var step = Math.max(1, Math.ceil(pts.length/9));
  pts.forEach(function(p,i){
    if (i % step !== 0 && i !== pts.length-1) return;
    labels += '<text x="' + xFor(i).toFixed(1) + '" y="198" text-anchor="middle" font-size="9.5" fill="#a89a80" font-family="Inter">' + fmtShortDate(p.monday) + '</text>';
  });

  var maxIdx = vals.indexOf(rawMax), minIdx = vals.indexOf(rawMin);
  var markers = '';
  [maxIdx, minIdx, pts.length-1].forEach(function(i){
    if (i < 0) return;
    var cx = xFor(i), cy = yFor(pts[i].avg);
    var color = i===maxIdx ? 'var(--gold)' : (i===minIdx ? 'var(--alerta)' : 'var(--gold-2)');
    markers += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="5" fill="' + color + '" stroke="var(--bg)" stroke-width="2"/>';
    markers += '<text x="' + cx.toFixed(1) + '" y="' + (cy-12).toFixed(1) + '" text-anchor="middle" font-size="10.5" fill="#f3efe6" font-family=\'Big Shoulders Display\' font-weight="700">' + Math.round(pts[i].avg) + '</text>';
  });

  wrap.innerHTML = '<svg viewBox="0 0 640 220" style="width:100%; height:auto; overflow:visible;" preserveAspectRatio="xMidYMid meet">' +
    gridLines +
    '<line x1="40" y1="' + y0 + '" x2="40" y2="' + y1 + '" stroke="var(--line)" stroke-width="1"/>' +
    '<polyline points="' + polyPoints + '" fill="none" stroke="var(--gold-2)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' +
    labels + markers +
    '</svg>';

  caption.textContent = 'Precio promedio de liquidación por semana, todos los cultivos combinados. Rango del período: US$ ' + fnum(rawMin,2) + ' a US$ ' + fnum(rawMax,2) + ' por tonelada.';
}

// ---------- carga de datos publicados ----------
function loadPublished(){
  setStatus('Cargando datos publicados…', '');
  fetch('./data.json?v=' + Date.now(), {cache:'no-store'})
    .then(function(res){ if(!res.ok) throw new Error('data.json no encontrado (HTTP ' + res.status + ')'); return res.json(); })
    .then(function(payload){
      var rows = (payload.rows || []).map(function(d){ d = Object.assign({}, d); d.fecha = new Date(d.fecha); return d; });
      if (rows.length === 0) throw new Error('data.json está vacío');
      render(rows, payload.updated, false, false);
      setStatus('', '');
    })
    .catch(function(err){
      var rows = DEFAULT_DATA.map(function(d){ d = Object.assign({}, d); d.fecha = new Date(d.fecha); return d; });
      render(rows, null, true, false);
      setStatus('No se pudo cargar data.json (' + err.message + '). Mostrando datos de ejemplo.', 'err');
    });
}

document.getElementById('loadBtn').addEventListener('click', function(){
  document.getElementById('fileInput').click();
});
document.getElementById('fileInput').addEventListener('change', function(e){
  if (e.target.files && e.target.files[0]) parseWorkbookFile(e.target.files[0]);
});
document.getElementById('resetBtn').addEventListener('click', function(){
  loadPublished();
});

loadPublished();
