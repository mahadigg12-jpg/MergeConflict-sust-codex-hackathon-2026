const cases = require('./SUST_Preli_Sample_Cases_Extra15.json');

async function testSample(id) {
  const url = 'https://mergeconflict-sust-codex-hackathon-2026-production.up.railway.app/analyze-ticket';
  const c = cases.cases.find(function(c) { return c.id === id; });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(c.input),
  });
  const r = await res.json();
  console.log('GOT:', JSON.stringify(r, null, 2));
  console.log('EXPECTED:', JSON.stringify(c.expected_output, null, 2));
}

testSample('SAMPLE-15');
