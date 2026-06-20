// web_ui.h — Web Dashboard HTML
// Được nhúng vào firmware qua PROGMEM, không cần LittleFS

#pragma once

const char INDEX_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SpO2 & HR Monitor</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',sans-serif;background:linear-gradient(135deg,#0f0c29,#302b63,#24243e);min-height:100vh;color:#fff;padding:20px}
h1{text-align:center;font-size:1.3em;margin-bottom:20px;text-shadow:0 0 20px #7c5cbf}
.cards{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin-bottom:18px}
.card{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:20px 28px;min-width:140px;text-align:center;backdrop-filter:blur(10px);transition:transform .2s}
.card:hover{transform:translateY(-4px)}
.card .lbl{font-size:.72em;color:#aaa;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px}
.card .val{font-size:2.5em;font-weight:700}
.card .unit{font-size:.75em;color:#bbb;margin-top:3px}
#hr-val{color:#ff6b6b}
#spo2-val{color:#74b9ff}
.status{text-align:center;padding:16px;border-radius:16px;font-size:1.2em;font-weight:700;margin-bottom:16px;border:1px solid rgba(255,255,255,.1);transition:background .5s}
.conf-row{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:14px}
.ci{background:rgba(255,255,255,.07);border-radius:12px;padding:10px 18px;min-width:108px;text-align:center}
.ci .cl{font-size:.72em;color:#bbb;margin-bottom:4px}
.ci .pct{font-size:1.4em;font-weight:700}
#pct-n{color:#2ecc71}#pct-w{color:#f1c40f}#pct-d{color:#e74c3c}
.anom{text-align:center;color:#888;font-size:.82em;margin-bottom:16px}
#anom{color:#e67e22;font-weight:600}
.foot{text-align:center;color:#555;font-size:.74em}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#2ecc71;margin-right:5px;animation:blink 1.4s infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}
</style>
</head>
<body>
<h1>🫀 Giám Sát Nhịp Tim & SpO2</h1>
<div class="cards">
  <div class="card"><div class="lbl">Nhịp Tim</div><div class="val" id="hr-val">--</div><div class="unit">bpm</div></div>
  <div class="card"><div class="lbl">Oxy Máu</div><div class="val" id="spo2-val">--</div><div class="unit">% SpO2</div></div>
</div>
<div class="status" id="sbox">⏳ Đang chờ dữ liệu...</div>
<div class="conf-row">
  <div class="ci"><div class="cl">🟢 Normal</div><div class="pct" id="pct-n">--%</div></div>
  <div class="ci"><div class="cl">🟡 Warning</div><div class="pct" id="pct-w">--%</div></div>
  <div class="ci"><div class="cl">🔴 Danger</div><div class="pct" id="pct-d">--%</div></div>
</div>
<div class="anom">Anomaly (K-means): <span id="anom">--</span></div>
<div class="foot"><span class="dot"></span>Cập nhật 3s | ESP32-S3 N16R8</div>
<script>
function fetch_data(){
  fetch('/data').then(r=>r.json()).then(d=>{
    document.getElementById('hr-val').textContent=d.hr>0?Math.round(d.hr):'--';
    document.getElementById('spo2-val').textContent=d.spo2>0?d.spo2.toFixed(1):'--';
    var b=document.getElementById('sbox');
    b.textContent=d.status;
    b.style.background=d.status.indexOf('NGUY')>=0?'rgba(231,76,60,.35)':d.status.indexOf('CNH')>=0?'rgba(241,196,15,.3)':'rgba(46,204,113,.28)';
    document.getElementById('pct-n').textContent=(d.normal*100).toFixed(1)+'%';
    document.getElementById('pct-w').textContent=(d.warning*100).toFixed(1)+'%';
    document.getElementById('pct-d').textContent=(d.danger*100).toFixed(1)+'%';
    document.getElementById('anom').textContent=d.anomaly.toFixed(4);
  }).catch(function(){});
}
fetch_data();
setInterval(fetch_data,3000);
</script>
</body>
</html>
)rawliteral";
