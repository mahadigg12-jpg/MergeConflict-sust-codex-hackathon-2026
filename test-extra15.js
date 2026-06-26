const https = require('https');
const http = require('http');
const fs = require('fs');

const HOST = 'sust-hackathon-preli-xtradrill.vercel.app';
const PORT = 443;
const USE_HTTPS = true;
const STRUCTURAL_FIELDS = ['relevant_transaction_id', 'evidence_verdict', 'case_type', 'severity', 'department', 'human_review_required'];

const suite = JSON.parse(fs.readFileSync('./SUST_Preli_Sample_Cases_Extra15.json', 'utf-8'));
const cases = suite.cases;

function sendRequest(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const transport = USE_HTTPS ? https : http;
    const req = transport.request({
      hostname: HOST, port: PORT, path: '/analyze-ticket', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: 60000,
    }, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(responseData) }); }
        catch (e) { resolve({ status: res.statusCode, body: responseData, parseError: true }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(data);
    req.end();
  });
}

function compare(expected, actual, fields) {
  const mismatches = [];
  for (const f of fields) {
    const exp = expected[f];
    const act = actual[f];
    const normalized = (exp === null || exp === undefined) && (act === null || act === undefined);
    if (!normalized && exp !== act) {
      mismatches.push({ field: f, expected: exp, got: act });
    }
  }
  return mismatches;
}

(async () => {
  const rows = [];
  let passed = 0, failed = 0;

  for (const tc of cases) {
    const input = tc.input;
    const expected = tc.expected_output;

    try {
      const result = await sendRequest(input);
      const actual = result.body;

      const mismatches = compare(expected, actual, STRUCTURAL_FIELDS);

      rows.push({
        id: tc.id,
        label: tc.label,
        input,
        expected,
        actual,
        mismatches,
        pass: mismatches.length === 0 && result.status === 200,
        statusCode: result.status,
      });

      if (rows[rows.length - 1].pass) {
        console.log(`PASS ${tc.id} - ${tc.label}`);
        passed++;
      } else {
        console.log(`FAIL ${tc.id} - ${tc.label}`);
        if (result.status !== 200) console.log(`  Status: ${result.status}`);
        for (const m of mismatches) {
          console.log(`  ${m.field}: expected=${JSON.stringify(m.expected)}, got=${JSON.stringify(m.got)}`);
        }
        failed++;
      }
    } catch (err) {
      rows.push({ id: tc.id, label: tc.label, input, expected, actual: { error: err.message }, mismatches: [{ field: 'error', expected: '200 OK', got: err.message }], pass: false, statusCode: 0 });
      console.log(`ERROR ${tc.id} - ${tc.label}: ${err.message}`);
      failed++;
    }
  }

  // Generate markdown
  let md = `# Test Report: SUST Preli Sample Cases Extra15 (takitajwar17 Vercel Deployment)

**Generated:** ${new Date().toISOString()}
**Endpoint:** \`POST https://${HOST}/analyze-ticket\`
**LLM Provider:** OpenRouter (auto-select via key rotation)
**Total Cases:** ${cases.length} | **Passed:** ${passed} | **Failed:** ${failed}

---

`;

  for (const row of rows) {
    md += `## ${row.id}: ${row.label}\n\n`;
    md += `**Status:** ${row.pass ? '✅ PASS' : '❌ FAIL'}\n\n`;

    md += `### Request\n\`\`\`json\n${JSON.stringify(row.input, null, 2)}\n\`\`\`\n\n`;

    md += `### Expected Output\n\`\`\`json\n${JSON.stringify(row.expected, null, 2)}\n\`\`\`\n\n`;

    md += `### Actual Response\n\`\`\`json\n${JSON.stringify(row.actual, null, 2)}\n\`\`\`\n\n`;

    if (row.mismatches.length > 0) {
      md += `### Mismatches\n\n| Field | Expected | Got |\n|-------|----------|-----|\n`;
      for (const m of row.mismatches) {
        md += `| ${m.field} | \`${JSON.stringify(m.expected)}\` | \`${JSON.stringify(m.got)}\` |\n`;
      }
      md += '\n';
    } else {
      md += `**No structural mismatches — all 6 score-bearing fields match expected.**\n\n`;
    }

    md += `**Rationale:** ${row.expected.rationale || 'N/A'}\n\n---\n\n`;
  }

  // Summary
  md += `## Summary\n\n| Metric | Value |\n|--------|-------|\n`;
  md += `| Total Cases | ${cases.length} |\n`;
  md += `| Passed | ${passed} |\n`;
  md += `| Failed | ${failed} |\n`;
  md += `| Pass Rate | ${(passed / cases.length * 100).toFixed(0)}% |\n`;

  fs.writeFileSync('./testcase2.md', md, 'utf-8');
  console.log(`\nReport written to testcase2.md`);
  console.log(`Results: ${passed}/${cases.length} passed, ${failed} failed`);
})();
