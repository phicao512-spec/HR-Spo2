// web_ui.h — Web Dashboard HTML
// Được nhúng vào firmware qua PROGMEM, không cần LittleFS

#pragma once

const char INDEX_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SpO2 &amp; HR Monitor</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%}
body{
  font-family:'Segoe UI',sans-serif;
  background:linear-gradient(135deg,#0f0c29,#302b63,#24243e);
  min-height:100vh;color:#fff;
  display:flex;flex-direction:column;
  padding:14px;gap:10px;
}

/* ── HEADER / TOP PANEL ── */
h1{text-align:center;font-size:1.2em;font-weight:700;
   text-shadow:0 0 18px #9b59b6;letter-spacing:1px;margin-bottom:2px}

/* Metric cards */
.cards{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.card{
  background:rgba(255,255,255,.08);
  border:1px solid rgba(255,255,255,.15);
  border-radius:14px;padding:14px 24px;min-width:120px;
  text-align:center;backdrop-filter:blur(10px);
  transition:transform .2s,box-shadow .2s
}
.card:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(0,0,0,.3)}
.lbl{font-size:.68em;color:#aaa;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
.val{font-size:2.3em;font-weight:800;line-height:1}
.unit{font-size:.7em;color:#bbb;margin-top:3px}
#hr-val{color:#ff6b6b}
#spo2-val{color:#74b9ff}

/* Status */
.status-row{display:flex;gap:10px;align-items:stretch;flex-wrap:wrap}
.status{
  flex:1;min-width:140px;
  text-align:center;padding:11px 16px;border-radius:12px;
  font-size:1em;font-weight:700;
  border:1px solid rgba(255,255,255,.1);transition:background .5s
}

/* AI confidence */
.conf-row{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.ci{
  background:rgba(255,255,255,.07);border-radius:10px;
  padding:8px 14px;min-width:88px;text-align:center;
  border:1px solid rgba(255,255,255,.08)
}
.cl{font-size:.65em;color:#bbb;margin-bottom:2px}
.pct{font-size:1.3em;font-weight:700}
#pct-n{color:#2ecc71}#pct-w{color:#f1c40f}#pct-d{color:#e74c3c}

/* SpO2 bar */
.spo2-bar-wrap{padding:0 2px}
.bar-bg{background:rgba(255,255,255,.1);border-radius:99px;height:8px;overflow:hidden}
.bar-fill{height:100%;border-radius:99px;
  background:linear-gradient(90deg,#74b9ff,#0984e3);transition:width .5s ease;width:0%}
.bar-lbl{display:flex;justify-content:space-between;
  font-size:.68em;color:#888;margin-top:3px}

/* Anomaly */
.anom{text-align:center;color:#666;font-size:.75em}
#anom{color:#e67e22;font-weight:600}

/* ── BOTTOM CHART PANEL ── */
.chart-panel{
  flex:1;                /* chiếm toàn bộ không gian còn lại */
  min-height:220px;
  background:rgba(0,0,0,.4);
  border:1px solid rgba(255,107,107,.2);
  border-radius:16px;padding:12px 14px;
  backdrop-filter:blur(8px);
  display:flex;flex-direction:column;gap:8px
}
.chart-hdr{display:flex;justify-content:space-between;align-items:center;flex-shrink:0}
.chart-title{font-size:.75em;color:#ff6b6b;font-weight:700;
  letter-spacing:1px;text-transform:uppercase}
.chart-meta{display:flex;gap:16px;align-items:center}
.chart-bpm{font-size:1.05em;font-weight:800;color:#ff6b6b}
.chart-spo2{font-size:.85em;font-weight:700;color:#74b9ff}
.chart-time{font-size:.65em;color:#555}
canvas#hr-chart{flex:1;width:100%;min-height:0;display:block;border-radius:8px}

/* Footer */
.foot{text-align:center;color:#444;font-size:.68em;flex-shrink:0}
.dot{display:inline-block;width:7px;height:7px;border-radius:50%;
  background:#2ecc71;margin-right:4px;animation:blink 1.2s infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.15}}
</style>
</head>
<body>

<!-- ══ TOP: tất cả thông số ══ -->
<h1>🫀 Giám Sát Nhịp Tim &amp; SpO2</h1>

<div class="cards">
  <div class="card">
    <div class="lbl">Nhịp Tim</div>
    <div class="val" id="hr-val">--</div>
    <div class="unit">bpm</div>
  </div>
  <div class="card">
    <div class="lbl">Oxy Máu</div>
    <div class="val" id="spo2-val">--</div>
    <div class="unit">% SpO2</div>
  </div>
</div>

<div class="status" id="sbox">⏳ Đang chờ dữ liệu...</div>

<div class="conf-row">
  <div class="ci"><div class="cl">🟢 Normal</div><div class="pct" id="pct-n">--%</div></div>
  <div class="ci"><div class="cl">🟡 Warning</div><div class="pct" id="pct-w">--%</div></div>
  <div class="ci"><div class="cl">🔴 Danger</div><div class="pct" id="pct-d">--%</div></div>
</div>

<div class="spo2-bar-wrap">
  <div class="bar-bg"><div class="bar-fill" id="spo2-bar"></div></div>
  <div class="bar-lbl"><span>SpO2</span><span id="spo2-pct-lbl">--%</span></div>
</div>

<div class="anom">Anomaly (K-means): <span id="anom">--</span></div>

<!-- ══ BOTTOM: biểu đồ HR ══ -->
<div class="chart-panel">
  <div class="chart-hdr">
    <span class="chart-title">📈 Biểu đồ nhịp tim — real-time</span>
    <div class="chart-meta">
      <span class="chart-spo2" id="meta-spo2">SpO2: --%</span>
      <span class="chart-bpm"  id="meta-bpm">-- bpm</span>
      <span class="chart-time" id="meta-time"></span>
    </div>
  </div>
  <canvas id="hr-chart"></canvas>
</div>

<div class="foot"><span class="dot"></span>Cập nhật 1s | ESP32-S3 N16R8</div>

<script>
// ── Canvas setup ─────────────────────────────────────────────
var canvas = document.getElementById('hr-chart');
var ctx    = canvas.getContext('2d');
var MAX_PTS = 10;  // Hiển thị khung thời gian 10s

var hrHistory   = [];
var timeHistory = [];

function resizeCanvas(){
  canvas.width  = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
}
resizeCanvas();
window.addEventListener('resize', function(){ resizeCanvas(); drawChart(); });

// ── Vẽ biểu đồ ───────────────────────────────────────────────
function drawChart(){
  var W = canvas.width, H = canvas.height;
  if(!W || !H) return;
  ctx.clearRect(0,0,W,H);

  // Nền mờ
  var bg = ctx.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,'rgba(255,107,107,.05)');
  bg.addColorStop(1,'rgba(255,107,107,.0)');
  ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);

  // Grid ngang
  ctx.strokeStyle='rgba(255,255,255,.06)';
  ctx.lineWidth=1;
  [.2,.4,.6,.8].forEach(function(f){
    var y=H*f;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();
  });

  // Nhãn thời gian (trục X) — mỗi 2 giây
  if(timeHistory.length > 1){
    ctx.fillStyle='rgba(255,255,255,.2)';
    ctx.font='10px Segoe UI';
    ctx.textAlign='center';
    var step = W/(MAX_PTS-1);
    for(var i=0;i<timeHistory.length;i+=2){
      var xi = i*step;
      if(xi<20||xi>W-20) continue;
      ctx.fillText(timeHistory[i], xi, H-3);
    }
    ctx.textAlign='left';
  }

  // Lọc điểm hợp lệ
  var vals = hrHistory.filter(function(v){return v>0;});
  if(vals.length < 2){
    // Hiển thị thông báo chờ
    ctx.fillStyle='rgba(255,255,255,.15)';
    ctx.font='14px Segoe UI';
    ctx.textAlign='center';
    ctx.fillText('Đặt ngón tay để xem biểu đồ...', W/2, H/2);
    ctx.textAlign='left';
    return;
  }

  // Scale Y: Bắt đầu từ 0, tối đa 200
  var mn = 0;
  var mx = 200;
  function toY(v){ return H - ((v-mn)/(mx-mn))*(H-18) - 12; }

  var step = W/(MAX_PTS-1);

  // Vùng fill dưới đường
  ctx.beginPath();
  var started = false;
  var firstX=0, lastX=0, firstY=H;
  for(var i=0;i<hrHistory.length;i++){
    var x=i*step;
    if(hrHistory[i]<=0){started=false;continue;}
    var y=toY(hrHistory[i]);
    if(!started){ctx.moveTo(x,H);ctx.lineTo(x,y);started=true;firstX=x;}
    else ctx.lineTo(x,y);
    lastX=x;
  }
  ctx.lineTo(lastX,H);
  ctx.closePath();
  var fill=ctx.createLinearGradient(0,0,0,H);
  fill.addColorStop(0,'rgba(255,107,107,.30)');
  fill.addColorStop(1,'rgba(255,107,107,.0)');
  ctx.fillStyle=fill; ctx.fill();

  // Đường HR
  ctx.beginPath();
  ctx.strokeStyle='#ff6b6b'; ctx.lineWidth=2.2;
  ctx.lineJoin='round'; ctx.lineCap='round';
  var penDown=false;
  for(var i=0;i<hrHistory.length;i++){
    var x=i*step;
    if(hrHistory[i]<=0){penDown=false;continue;}
    var y=toY(hrHistory[i]);
    if(!penDown){ctx.moveTo(x,y);penDown=true;}
    else ctx.lineTo(x,y);
  }
  ctx.stroke();

  // Điểm cuối glow
  var last=hrHistory[hrHistory.length-1];
  if(last>0){
    var lx=(hrHistory.length-1)*step, ly=toY(last);
    // Vòng glow
    var grd=ctx.createRadialGradient(lx,ly,0,lx,ly,14);
    grd.addColorStop(0,'rgba(255,107,107,.45)');
    grd.addColorStop(1,'rgba(255,107,107,0)');
    ctx.fillStyle=grd; ctx.beginPath();
    ctx.arc(lx,ly,14,0,Math.PI*2); ctx.fill();
    // Chấm trung tâm
    ctx.fillStyle='#ff6b6b'; ctx.beginPath();
    ctx.arc(lx,ly,4,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#fff'; ctx.lineWidth=1.5;
    ctx.stroke();
    // Nhãn giá trị tại điểm cuối
    ctx.fillStyle='#ff6b6b'; ctx.font='bold 12px Segoe UI';
    ctx.textAlign = lx > W-50 ? 'right' : 'left';
    ctx.fillText(Math.round(last)+' bpm', lx+(lx>W-50?-10:10), ly-8);
    ctx.textAlign='left';
  }

  // Nhãn trục Y
  ctx.fillStyle='rgba(255,255,255,.28)'; ctx.font='10px Segoe UI';
  ctx.fillText(Math.round(mx)+' bpm', 4, 18);
  ctx.fillText(Math.round(mn)+' bpm', 4, H-18);
}

// ── Fetch data (1 giây) ───────────────────────────────────────
function pad(n){return n<10?'0'+n:n;}
function nowStr(){var d=new Date();return pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds());}

function fetch_data(){
  fetch('/data').then(function(r){return r.json();}).then(function(d){
    var hr  = d.hr  > 0 ? Math.round(d.hr)  : 0;
    var spo = d.spo2> 0 ? d.spo2 : 0;

    // ── Cards ──
    document.getElementById('hr-val').textContent   = hr  > 0 ? hr   : '--';
    document.getElementById('spo2-val').textContent = spo > 0 ? spo.toFixed(1) : '--';

    // ── Status ──
    var b=document.getElementById('sbox');
    b.textContent=d.status;
    if(d.status.indexOf('NGUY')>=0)      b.style.background='rgba(231,76,60,.4)';
    else if(d.status.indexOf('CANH')>=0) b.style.background='rgba(241,196,15,.35)';
    else if(hr>0)                        b.style.background='rgba(46,204,113,.3)';
    else                                 b.style.background='rgba(255,255,255,.07)';

    // ── AI ──
    document.getElementById('pct-n').textContent=(d.normal *100).toFixed(1)+'%';
    document.getElementById('pct-w').textContent=(d.warning*100).toFixed(1)+'%';
    document.getElementById('pct-d').textContent=(d.danger *100).toFixed(1)+'%';
    document.getElementById('anom').textContent =d.anomaly.toFixed(4);

    // ── SpO2 bar ──
    document.getElementById('spo2-bar').style.width = (spo>0?Math.min(100,spo):0)+'%';
    document.getElementById('spo2-pct-lbl').textContent = spo>0?spo.toFixed(1)+'%':'--%';

    // ── Chart meta ──
    document.getElementById('meta-bpm').textContent  = hr>0  ? hr+' bpm'        : '-- bpm';
    document.getElementById('meta-spo2').textContent = spo>0 ? 'SpO2: '+spo.toFixed(1)+'%' : 'SpO2: --%';
    document.getElementById('meta-time').textContent = nowStr();

    // ── Lịch sử HR ──
    hrHistory.push(hr);
    timeHistory.push(nowStr());
    if(hrHistory.length > MAX_PTS) hrHistory.shift();
    if(timeHistory.length > MAX_PTS) timeHistory.shift();
    drawChart();

  }).catch(function(){});
}

fetch_data();
setInterval(fetch_data, 1000);   // cập nhật mỗi 1 giây
</script>
</body>
</html>
)rawliteral";
