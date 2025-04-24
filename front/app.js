const $ = id => document.getElementById(id);

function toISO(dtInput) {
  const v = dtInput.value;
  if (!v) return '';
  return new Date(v).toISOString();
}

$('queryBtn').addEventListener('click', async () => {
  const dataset = $('dataset').value;
  const ch      = $('ch').value;
  const startISO = toISO($('start'));
  const endISO   = toISO($('end'));
  const gran     = $('gran').value;

  if (!startISO || !endISO) {
    alert('請填寫起迄時間');
    return;
  }

  const qs = new URLSearchParams({ start: startISO, end: endISO, ch, gran });

  try {
    const resp = await fetch(`/api/${dataset}?` + qs.toString());
    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json();
    $('result').textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    $('result').textContent = '❌ ' + err.message;
  }
});