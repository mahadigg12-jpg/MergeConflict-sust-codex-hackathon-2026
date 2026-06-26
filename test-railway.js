const cases = require('./SUST_Preli_Sample_Cases_Extra15.json');

async function testAll() {
  const url = 'https://mergeconflict-sust-codex-hackathon-2026-production.up.railway.app/analyze-ticket';
  let pass = 0;
  let fail = 0;

  for (const c of cases.cases) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(c.input),
      });
      const r = await res.json();
      const e = c.expected_output;

      const checks = {
        relevant_transaction_id: r.relevant_transaction_id === e.relevant_transaction_id,
        evidence_verdict: r.evidence_verdict === e.evidence_verdict,
        case_type: r.case_type === e.case_type,
        severity: r.severity === e.severity,
        department: r.department === e.department,
        human_review_required: r.human_review_required === e.human_review_required,
      };

      const allPass = Object.values(checks).every(Boolean);
      if (allPass) { pass++; } else { fail++; }

      const failures = Object.entries(checks).filter(function(p) { return !p[1]; }).map(function(p) { return p[0]; });
      const status = allPass ? 'PASS' : 'FAIL';
      console.log(status + ' ' + c.id + ': ' + c.label);
      if (failures.length > 0) {
        console.log('  MISMATCH: ' + failures.join(', '));
        for (var f of failures) {
          console.log('    ' + f + ': got=' + JSON.stringify(r[f]) + ' expected=' + JSON.stringify(e[f]));
        }
      }
    } catch (err) {
      fail++;
      console.log('ERROR ' + c.id + ': ' + err.message);
    }
  }
  console.log('\nTotal: ' + pass + ' passed, ' + fail + ' failed out of ' + cases.cases.length);
}

testAll();
