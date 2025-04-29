/* global luxon, Chart, flatpickr */
const { DateTime } = luxon;
const $ = q => document.querySelector(q);
let chart;

/* ---------- UI 初始 ---------- */
flatpickr('#dateRange', { mode:'range', dateFormat:'Y-m-d' });

document.querySelectorAll('input[name=mode]').forEach(r=>
  r.addEventListener('change',()=>{
    const m=$('input[name=mode]:checked').value;
    $('#singleBox').style.display = m==='single'?'block':'none';
    $('#compareBox').style.display = m==='compare'?'block':'none';
    $('#chart').style.display      = (m==='single')?'block':'none';
    $('#hmContainer').style.display= (m==='compare')?'grid':'none';
  })
);

/* ---------- 小工具 ---------- */
function clearChart(){ chart&&chart.destroy(); chart=null; }
function iso(v){ return v?new Date(v).toISOString():''; }

/* ---------- Heatmap 畫布 ---------- */
async function drawHM(canvas, heatArr, date){
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);

  /* 1. 畫 snapshot 底圖 ------------------------------------------------ */
  try {
    const ts = Date.parse(date+'T00:00:00Z');   // 任意時間；或用 dateHour
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = `/api/snapshot?ch=${$('#ch').value}`;  // 不帶 ts
    await img.decode();                         // wait load
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  } catch(e){ console.warn('snapshot load fail', e.message); }

  /* 2. 畫 Heatmap 半透明覆蓋 ----------------------------------------- */
  const C=64,R=36,cw=canvas.width/C,ch=canvas.height/R;
  const max=Math.max(...heatArr), min=Math.min(...heatArr);
  ctx.globalAlpha = 0.6;                        // 60% 透明
  for(let i=0;i<heatArr.length;i++){
    const t=(heatArr[i]-min)/(max-min||1);
    ctx.fillStyle=`hsl(${240-240*t},100%,50%)`;
    const x=i% C,y=(i/C)|0;
    ctx.fillRect(x*cw,y*ch,cw,ch);
  }
  ctx.globalAlpha = 1;                          // 還原
}

async function renderHMCompare(rows){
  const box = $('#hmContainer');
  box.innerHTML = '';

  if (!rows.length){
    box.innerHTML = '<p style="grid-column:1/-1;color:#666">(no data)</p>';
    return;
  }

  for (const r of rows) {
    const wrap = document.createElement('div');
    wrap.innerHTML =
      `<div style="text-align:center;font-weight:600">${r.date}</div>`;
    const cvs = document.createElement('canvas');
    cvs.width = 640; cvs.height = 360;

    await drawHM(cvs, r.heatmap, r.date);   // ← await 合法了
    wrap.appendChild(cvs);
    box.appendChild(wrap);
  }
}

/* ---------- Zone/People 線圖 ---------- */
function renderCmpLines(rows,dataset){
  const grp={};
  rows.forEach(r=>(grp[r.dateStr]??=[]).push(r));
  const labels=[...new Set(rows.map(r=>DateTime.fromISO(r.dateHour||r.datetime).setZone('Asia/Taipei').toFormat('HH:mm')))].sort();
  const datasets=Object.entries(grp).map(([d,arr])=>{
    const map={};
    arr.forEach(r=>{
      const hh=DateTime.fromISO(r.dateHour||r.datetime).setZone('Asia/Taipei').toFormat('HH:mm');
      map[hh]= dataset==='zone'
        ? r.zones.reduce((s,z)=>s+z.count,0)
        : r.zones.reduce((s,z)=>s+z.a+z.b,0);
    });
    return { label:d, data:labels.map(l=>map[l]??0), borderWidth:1 };
  });
  clearChart();
  chart=new Chart($('#chart').getContext('2d'),{
    type:'line', data:{labels,datasets},
    options:{responsive:true,interaction:{mode:'index',intersect:false}}
  });
}

/* ---------- 單筆 Zone ---------- */
function renderSingleZone(rows){
  const zoneSet=new Set(); rows.forEach(r=>r.zones.forEach(z=>zoneSet.add(z.zone_name)));
  const labels=rows.map(r=>DateTime.fromISO(r.dateHour||r.datetime).setZone('Asia/Taipei').toFormat('MM-dd HH:mm'));
  const datasets=[...zoneSet].map(zn=>({
    label:zn,
    data:rows.map(r=>{const m=r.zones.find(z=>z.zone_name===zn);return m?m.count:0;}),
    borderWidth:1
  }));
  clearChart();
  chart=new Chart($('#chart').getContext('2d'),{
    type:'line',data:{labels,datasets},
    options:{responsive:true,interaction:{mode:'index',intersect:false}}
  });
}

function renderSinglePeople(rows){
  if(!rows.length) return;

  const labels = rows.map(r =>
    DateTime.fromISO(r.dateHour || r.datetime)
            .setZone('Asia/Taipei')
            .toFormat('MM-dd HH:mm'));

  const aLine = { label:'A', data:[], borderWidth:1 };
  const bLine = { label:'B', data:[], borderWidth:1 };

  rows.forEach(r => {
    let a=0,b=0;
    r.zones.forEach(z=>{ a+=z.a; b+=z.b; });
    aLine.data.push(a);
    bLine.data.push(b);
  });

  clearChart();
  chart = new Chart($('#chart').getContext('2d'),{
    type:'line',
    data:{ labels, datasets:[aLine,bLine] },
    options:{ responsive:true, interaction:{mode:'index',intersect:false} }
  });
}

/* ---------- Query ---------- */
$('#queryBtn').addEventListener('click',async()=>{
  clearChart(); $('#result').textContent=''; $('#hmContainer').innerHTML='';
  const dataset=$('#dataset').value, ch=$('#ch').value, gran=$('#gran').value;
  const mode=$('input[name=mode]:checked').value;
  let url='';
  if(mode==='single'){
    const s=iso($('#start').value),e=iso($('#end').value);
    if(!s||!e) return alert('請選日期時間');
    url=`/api/${dataset}?start=${s}&end=${e}&ch=${ch}&gran=${gran}`;
  }else{
    const [d1,d2]=$('#dateRange').value.split(' to ');
    const f=$('#timeFrom').value,t=$('#timeTo').value;
    if(!d1||!d2) return alert('日期區間');
    url= dataset==='heatmap'
         ? `/api/compare_hm?startDate=${d1}&endDate=${d2}&from=${f}&to=${t}&ch=${ch}`
         : `/api/compare?dataset=${dataset}&startDate=${d1}&endDate=${d2}&from=${f}&to=${t}&ch=${ch}&gran=hourly`;
  }
  try{
    const resp=await fetch(url);
    if(!resp.ok) throw new Error(resp.statusText);
    const data=await resp.json();
    if (mode==='single'){
      if (dataset==='zone')   renderSingleZone(data.rows);
      else if (dataset==='people') renderSinglePeople(data.rows);
    }
    else if(mode==='compare'){
      if(dataset==='heatmap') renderHMCompare(data.rows);
      else renderCmpLines(data.rows,dataset);
    }
  }catch(err){ $('#result').textContent='❌ '+err.message; }
});
