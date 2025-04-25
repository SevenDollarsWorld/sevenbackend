// front/app.js —— 最上面先丟一行
console.log('[app] script loaded');

document.addEventListener('DOMContentLoaded', () => {
  console.log('[app] DOM ready');


// front/app.js
const { DateTime } = luxon;        // 從全域 luxon 取 DateTime
const $ = sel => document.querySelector(sel);
let chart;

function toISO(dtInput) {
  return dtInput.value ? new Date(dtInput.value).toISOString() : '';
}

function renderChartZone(rows) {
  if (!rows.length) return;

  const zoneSet = new Set();
  rows.forEach(r => r.zones.forEach(z => zoneSet.add(z.zone_name)));
  const zoneList = [...zoneSet];

  const labels = rows.map(r => {
    const iso = r.dateHour || r.date || r.weekStart || r.datetime;
    return DateTime.fromISO(iso).setZone('Asia/Taipei').toFormat('MM-dd HH:mm');
  });

  const datasets = zoneList.map(zn => ({
    label: zn,
    data : rows.map(r => {
      const m = r.zones.find(z => z.zone_name === zn);
      return m ? m.count : 0;
    }),
    borderWidth: 1
  }));

  if (chart) chart.destroy();
  chart = new Chart($('#chart').getContext('2d'), {
    type: 'line',
    data: { labels, datasets },
    options: { responsive:true, interaction:{ mode:'index', intersect:false } }
  });
}

$('#queryBtn').addEventListener('click', async () => {
  console.log('[app] queryBtn clicked');
  $('#result').textContent = '';
  if (chart) { chart.destroy(); chart = null; }

  const dataset  = $('#dataset').value;
  const ch       = $('#ch').value;
  const startISO = toISO($('#start'));
  const endISO   = toISO($('#end'));
  const gran     = $('#gran').value;

  if (!startISO || !endISO) return alert('請填寫起迄時間');

  const qs = new URLSearchParams({ start:startISO, end:endISO, ch, gran });

  try {
    const resp = await fetch(`/api/${dataset}?` + qs);
    if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
    const data = await resp.json();
    $('#result').textContent = JSON.stringify(data, null, 2);

    if (dataset === 'zone') renderChartZone(data.rows);
  } catch (err) {
    $('#result').textContent = '❌ ' + err.message;
  }
});
});
