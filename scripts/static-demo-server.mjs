import http from "node:http";

const PORT = Number(process.env.PORT ?? 3000);

const ordersSeed = [
  {
    lp: 1,
    tankIndex: "TANK-AX-100",
    referenceNumber: "T23/01/2026",
    quantity: 5,
    issued: false,
    approvedShortages: false,
    items: [
      { partIndex: "BRK-220-L", description: "Left mounting bracket", location: "A-01-02", required: 10, picked: 8 },
      { partIndex: "SEAL-90", description: "Rubber seal", location: "B-03-01", required: 5, picked: 5 },
      { partIndex: "PIPE-SUPPORT", description: "Pipe support", location: "C-02-04", required: 20, picked: 16 }
    ]
  },
  {
    lp: 2,
    tankIndex: "TANK-BX-210",
    referenceNumber: "T23/02/2026",
    quantity: 3,
    issued: false,
    approvedShortages: false,
    items: [
      { partIndex: "BRK-220-L", description: "Left mounting bracket", location: "A-01-02", required: 6, picked: 6 },
      { partIndex: "SEAL-90", description: "Rubber seal", location: "B-03-01", required: 3, picked: 3 },
      { partIndex: "PIPE-SUPPORT", description: "Pipe support", location: "C-02-04", required: 12, picked: 9 }
    ]
  },
  {
    lp: 3,
    tankIndex: "TANK-CX-310",
    referenceNumber: "T23/03/2026",
    quantity: 2,
    issued: false,
    approvedShortages: false,
    items: [
      { partIndex: "BRK-220-L", description: "Left mounting bracket", location: "A-01-02", required: 4, picked: 4 },
      { partIndex: "SEAL-90", description: "Rubber seal", location: "B-03-01", required: 2, picked: 2 },
      { partIndex: "PIPE-SUPPORT", description: "Pipe support", location: "C-02-04", required: 8, picked: 8 }
    ]
  }
];

const productionRecords = [
  { tank_index: "TANK-AX-100", production_week: 23, production_date: "01-06", quantity: 2 },
  { tank_index: "TANK-AX-100", production_week: 23, production_date: "02-06", quantity: 0 },
  { tank_index: "TANK-AX-100", production_week: 23, production_date: "03-06", quantity: 3 },
  { tank_index: "TANK-BX-210", production_week: 23, production_date: "02-06", quantity: 1 },
  { tank_index: "TANK-BX-210", production_week: 23, production_date: "04-06", quantity: 2 },
  { tank_index: "TANK-CX-310", production_week: 23, production_date: "03-06", quantity: 2 }
];

const html = String.raw`<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Warehouse Planning Demo</title>
  <style>
    :root{--bg:#f4f7fb;--fg:#142033;--muted:#667085;--panel:#fff;--line:#d9e2ef;--primary:#1f6feb;--ok:#e9f9ee;--warn:#fff7db;--danger:#ffe8e8}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top left,#e7f0ff,transparent 32rem),var(--bg);color:var(--fg);font-family:Arial,sans-serif}.shell{width:min(1180px,calc(100% - 24px));margin:auto;padding:28px 0}.hero,.columns{display:grid;grid-template-columns:1fr 340px;gap:16px}.panel,.card,.stat{background:rgba(255,255,255,.9);border:1px solid var(--line);border-radius:18px;box-shadow:0 12px 30px rgba(21,32,51,.08);padding:18px;margin-bottom:16px}h1{font-size:clamp(2rem,4vw,4rem);line-height:1;margin:0 0 12px}.muted{color:var(--muted);line-height:1.5}.eyebrow{color:var(--primary);font-size:.78rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.tabs,.row,.toolbar{display:flex;flex-wrap:wrap;gap:10px}.tabs{margin:16px 0}.tab,.btn,button{border:0;border-radius:999px;font-weight:800;padding:10px 14px;cursor:pointer}.tab{background:#fff;border:1px solid var(--line)}.tab.active,.btn.primary{background:var(--primary);color:#fff}.btn.secondary{background:#eaf2ff;color:#174ea6}.btn.danger{background:var(--danger);color:#9b1c1c}.message{background:#10233f;color:#fff;border-radius:14px;padding:12px 16px;font-weight:700}.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}.stat span{display:block;color:var(--muted);font-size:.8rem;text-transform:uppercase;font-weight:800}.stat strong{font-size:2rem}input,select{width:100%;border:1px solid var(--line);border-radius:12px;padding:10px;margin-top:6px}label{font-weight:800;color:var(--muted);font-size:.86rem}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid var(--line);padding:12px 10px;text-align:left;vertical-align:top}th{font-size:.78rem;text-transform:uppercase;color:var(--muted)}.status{display:inline-block;border-radius:999px;padding:5px 9px;font-weight:800;font-size:.8rem}.ok{background:var(--ok);color:#177245}.warn{background:var(--warn);color:#8a5a00}.selected{background:#f2f7ff}.part{display:grid;grid-template-columns:1fr 110px auto;gap:12px;align-items:center;border:1px solid var(--line);border-radius:14px;padding:12px;margin-bottom:10px;background:#fbfdff}.json{background:#0d1b2f;color:#d8e7ff;border-radius:14px;padding:16px;overflow:auto;max-height:70vh}.hidden{display:none!important}.checkbox{display:inline-flex;align-items:center;gap:8px;color:var(--fg)}.checkbox input{width:auto;margin:0}@media(max-width:800px){.hero,.columns,.stats{grid-template-columns:1fr}.part{grid-template-columns:1fr}.tab,.btn{width:100%}}
  </style>
</head>
<body>
  <main class="shell">
    <section class="hero">
      <div><p class="eyebrow">MVP uruchamialne bez npm install</p><h1>Planowanie magazynu</h1><p class="muted">Tryb testowy do przeklikania ról, zakładek, planu produkcyjnego, braków, logów i bazy JSON.</p></div>
      <div class="card"><p class="eyebrow">Logowanie demo</p><strong id="loginState">Niezalogowany</strong><label>Rola<select id="role"><option value="warehouse">Magazynier</option><option value="planner">Planista</option><option value="manager">Kierownik</option></select></label><div class="row" style="margin-top:12px"><button class="btn primary" id="loginBtn">Zaloguj</button><button class="btn secondary" id="logoutBtn">Wyloguj</button></div></div>
    </section>
    <nav class="tabs" id="tabs"></nav><p class="message" id="message">Uruchomiono demo. Zaloguj się i przejdź po zakładkach.</p>
    <section id="dashboard" class="view"></section><section id="productionPlan" class="view"></section><section id="shortages" class="view"></section><section id="managerLogs" class="view hidden"></section><section id="database" class="view"></section>
  </main>
<script>
const roleLabels={warehouse:'Magazynier',planner:'Planista',manager:'Kierownik'};
const tabLabels={dashboard:'Dashboard',productionPlan:'Plan produkcyjny',shortages:'Lista braków',managerLogs:'Logi kierownika',database:'Baza JSON'};
let user=null,activeTab='dashboard',orders=JSON.parse('__ORDERS__'),logs=[],arrived={},showArrived=true,selectedRef=orders[0].referenceNumber,selectedShortage='';
const productionRecords=JSON.parse('__PRODUCTION__');
function shortage(item){return Math.max(item.required-item.picked,0)}
function orderShortages(order){return order.items.filter(i=>shortage(i)>0)}
function status(order){if(order.issued)return 'issued'; if(order.approvedShortages&&orderShortages(order).length)return 'approved_with_shortages'; if(orderShortages(order).length)return 'shortage'; return 'completed'}
function msg(t){document.getElementById('message').textContent=t}
function log(action,entity,prev,next){logs.unshift({time:new Date().toLocaleString('pl-PL'),user:user?roleLabels[user]:'Niezalogowany',role:user||'none',action,entity,prev,next}); render()}
function tabsFor(){const base=['dashboard','productionPlan','shortages','database']; if(user==='manager')base.splice(3,0,'managerLogs'); return base}
function openTab(tab){if(tab==='managerLogs'&&user!=='manager'){msg('Zakładka logów jest dostępna tylko dla Kierownika.'); return} activeTab=tab; msg('Otworzono zakładkę: '+tabLabels[tab]); render()}
function renderTabs(){document.getElementById('tabs').innerHTML=tabsFor().map(t=>'<button class="tab '+(activeTab===t?'active':'')+'" data-tab="'+t+'">'+tabLabels[t]+'</button>').join(''); document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>openTab(b.dataset.tab))}
function renderDashboard(){const shortageParts=new Set(orders.flatMap(o=>orderShortages(o).map(i=>i.partIndex))).size;document.getElementById('dashboard').innerHTML='<div class="stats"><div class="stat"><span>Zlecenia</span><strong>'+orders.length+'</strong></div><div class="stat"><span>Suma zbiorników</span><strong>'+orders.reduce((s,o)=>s+o.quantity,0)+'</strong></div><div class="stat"><span>Części z brakami</span><strong>'+shortageParts+'</strong></div><div class="stat"><span>Wydane</span><strong>'+orders.filter(o=>o.issued).length+'</strong></div><div class="stat"><span>Blokady</span><strong>'+orders.filter(o=>orderShortages(o).length&&!o.approvedShortages).length+'</strong></div></div><div class="panel"><p class="eyebrow">Import Excel</p><h2>Mapowanie planu wysyłek</h2><p class="muted">Kolumna B = tank_index, wiersz 2 = tydzień, wiersz 3 = data, dane od wiersza 4.</p><button class="btn primary" id="approveImport">Zatwierdź import</button></div>'; document.getElementById('approveImport').onclick=()=>{if(!user)return msg('Najpierw zaloguj się.'); if(user==='warehouse')return msg('Magazynier nie może zatwierdzać importu.'); log('Zatwierdzenie importu','Tydzień 23/2026','draft','approved'); msg('Import zatwierdzony.')}}
function renderPlan(){document.getElementById('productionPlan').innerHTML='<div class="panel"><div class="toolbar"><input id="orderFilter" placeholder="Filtr planu..."><button class="btn primary" onclick="window.print()">Drukuj / PDF A4</button></div><div class="table-wrap"><table><thead><tr><th>LP</th><th>Index zbiornika</th><th>Numer ref.</th><th>Ilość</th><th>Braki</th><th>Wydanie</th></tr></thead><tbody id="orderRows"></tbody></table></div><div id="cart"></div></div>'; document.getElementById('orderFilter').oninput=e=>drawRows(e.target.value); drawRows('')}
function drawRows(filter){const q=(filter||'').toLowerCase();const rows=orders.filter(o=>[o.tankIndex,o.referenceNumber,status(o)].join(' ').toLowerCase().includes(q));document.getElementById('orderRows').innerHTML=rows.map(o=>'<tr class="'+(selectedRef===o.referenceNumber?'selected':'')+'"><td>'+o.lp+'</td><td>'+o.tankIndex+'</td><td><button class="btn secondary" data-ref="'+o.referenceNumber+'">'+o.referenceNumber+'</button></td><td>'+o.quantity+'</td><td>'+(orderShortages(o).map(i=>i.partIndex+' - '+shortage(i)).join('; ')||'Brak')+'</td><td><label class="checkbox"><input type="checkbox" '+(o.issued?'checked':'')+' data-issue="'+o.referenceNumber+'"> '+(o.issued?'Wydane':orderShortages(o).length?'Blokada braków':'Do wydania')+'</label>'+(orderShortages(o).length&&!o.approvedShortages?' <button class="btn secondary" data-approve="'+o.referenceNumber+'">Zatwierdź braki</button>':'')+'</td></tr>').join('');document.querySelectorAll('[data-ref]').forEach(b=>b.onclick=()=>{selectedRef=b.dataset.ref;renderPlan()});document.querySelectorAll('[data-approve]').forEach(b=>b.onclick=()=>{if(user!=='manager')return msg('Tylko Kierownik zatwierdza braki.');const o=orders.find(x=>x.referenceNumber===b.dataset.approve);o.approvedShortages=true;log('Zatwierdzenie braków',o.referenceNumber,'blocked','approved');});document.querySelectorAll('[data-issue]').forEach(c=>c.onchange=()=>issue(c.dataset.issue,c.checked));drawCart()}
function issue(ref,checked){if(!user)return msg('Najpierw zaloguj się.');const o=orders.find(x=>x.referenceNumber===ref);if(!checked){if(user!=='manager'){o.issued=true;renderPlan();return msg('Tylko Kierownik może cofnąć wydanie.')}o.issued=false;log('Cofnięcie wydania',ref,'issued','not issued');return} if(orderShortages(o).length&&!o.approvedShortages){renderPlan();return msg('Nie można wydać: są braki i brak zatwierdzenia Kierownika.')}o.issued=true;log('Wydanie na produkcję',ref,'not issued','issued')}
function drawCart(){const o=orders.find(x=>x.referenceNumber===selectedRef);document.getElementById('cart').innerHTML='<h3>Cartrouting '+o.referenceNumber+'</h3>'+o.items.map(i=>'<div class="part"><div><strong>'+i.partIndex+'</strong><br><span class="muted">'+i.description+' · '+i.location+' · required '+i.required+'</span></div><label>Picked<input type="number" min="0" value="'+i.picked+'" data-pick="'+i.partIndex+'"></label><span class="status '+(shortage(i)>0?'warn':'ok')+'">Brak: '+shortage(i)+'</span></div>').join('');document.querySelectorAll('[data-pick]').forEach(inp=>inp.onchange=()=>{const item=o.items.find(i=>i.partIndex===inp.dataset.pick);const prev=item.picked;item.picked=Number(inp.value);log('Zmiana ilości pobranej',o.referenceNumber+' / '+item.partIndex,prev,item.picked)})}
function shortageRows(){return orders.flatMap(o=>orderShortages(o).map(i=>({key:i.partIndex+'::'+o.referenceNumber,partIndex:i.partIndex,tankIndex:o.tankIndex,ref:o.referenceNumber,qty:shortage(i),date:'01.06.2026',arrived:!!arrived[i.partIndex+'::'+o.referenceNumber]}))).filter(r=>showArrived||!r.arrived)}
function renderShortages(){document.getElementById('shortages').innerHTML='<div class="panel"><div class="toolbar"><input id="shortFilter" placeholder="Filtr braków..."><label class="checkbox"><input id="showArrived" type="checkbox" '+(showArrived?'checked':'')+'> Pokaż dojechane</label></div><div class="table-wrap"><table><thead><tr><th>Index braku</th><th>Indeks zbiornika</th><th>Numer ref.</th><th>Ilość</th><th>Data dodania</th><th>Czy dojechało</th></tr></thead><tbody id="shortRows"></tbody></table></div><div id="shortDetails"></div></div>';document.getElementById('showArrived').onchange=e=>{showArrived=e.target.checked;renderShortages()};document.getElementById('shortFilter').oninput=e=>drawShortRows(e.target.value);drawShortRows('')}
function drawShortRows(filter){const q=(filter||'').toLowerCase();const rows=shortageRows().filter(r=>[r.partIndex,r.tankIndex,r.ref].join(' ').toLowerCase().includes(q));document.getElementById('shortRows').innerHTML=rows.map(r=>'<tr><td><button class="btn secondary" data-short="'+r.partIndex+'">'+r.partIndex+'</button></td><td>'+r.tankIndex+'</td><td>'+r.ref+'</td><td>'+r.qty+'</td><td>'+r.date+'</td><td><label class="checkbox"><input type="checkbox" '+(r.arrived?'checked':'')+' data-arrived="'+r.key+'"> '+(r.arrived?'Dojechało':'Czeka')+'</label></td></tr>').join('');document.querySelectorAll('[data-arrived]').forEach(c=>c.onchange=()=>{arrived[c.dataset.arrived]=c.checked;log('Zmiana statusu braku',c.dataset.arrived,!c.checked,c.checked);renderShortages()});document.querySelectorAll('[data-short]').forEach(b=>b.onclick=()=>{selectedShortage=b.dataset.short;drawShortRows(filter)});const details=selectedShortage?shortageRows().filter(r=>r.partIndex===selectedShortage):[];document.getElementById('shortDetails').innerHTML='<h3>Szczegóły '+(selectedShortage||'')+'</h3>'+(details.map(r=>'<p>'+r.ref+' · '+r.tankIndex+' · ilość '+r.qty+'</p>').join('')||'<p class="muted">Kliknij index braku.</p>')}
function renderLogs(){document.getElementById('managerLogs').innerHTML='<div class="panel"><h2>Logi Kierownika</h2><div class="table-wrap"><table><thead><tr><th>Czas</th><th>Użytkownik</th><th>Akcja</th><th>Obiekt</th><th>Poprzednia</th><th>Nowa</th></tr></thead><tbody>'+logs.map(l=>'<tr><td>'+l.time+'</td><td>'+l.user+'</td><td>'+l.action+'</td><td>'+l.entity+'</td><td>'+l.prev+'</td><td>'+l.next+'</td></tr>').join('')+'</tbody></table></div></div>'}
function renderDb(){document.getElementById('database').innerHTML='<div class="panel"><h2>Baza JSON</h2><pre class="json">'+JSON.stringify({latestProductionRecords:productionRecords,orders,uniqueParts:[...new Map(orders.flatMap(o=>o.items).map(i=>[i.partIndex,i])).values()]},null,2)+'</pre></div>'}
function render(){document.getElementById('loginState').textContent=user?'Zalogowano: '+roleLabels[user]:'Niezalogowany';renderTabs();document.querySelectorAll('.view').forEach(v=>v.classList.add('hidden'));document.getElementById(activeTab).classList.remove('hidden');renderDashboard();renderPlan();renderShortages();renderLogs();renderDb()}
document.getElementById('loginBtn').onclick=()=>{user=document.getElementById('role').value;log('Logowanie demo',roleLabels[user],'logged out','logged in');msg('Zalogowano jako '+roleLabels[user])};document.getElementById('logoutBtn').onclick=()=>{log('Wylogowanie demo',user?roleLabels[user]:'brak','logged in','logged out');user=null;if(activeTab==='managerLogs')activeTab='dashboard';msg('Wylogowano.')};render();
</script>
</body>
</html>`
  .replace("'__ORDERS__'", JSON.stringify(JSON.stringify(ordersSeed)))
  .replace("'__PRODUCTION__'", JSON.stringify(JSON.stringify(productionRecords)));

const server = http.createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, app: "warehouse-planning-demo" }));
    return;
  }

  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(html);
});

server.listen(PORT, () => {
  console.log(`Warehouse planning demo running at http://localhost:${PORT}`);
});
