/**
 * Generador de reporte HTML de evidencias de pruebas
 * Ejecutar después de: npm run test:report
 * Lee: tests/results/report.json
 * Genera: tests/results/reporte_evidencias.html
 */

const fs = require("fs");
const path = require("path");

const reportPath = path.join(__dirname, "results", "report.json");
const outputPath = path.join(__dirname, "results", "reporte_evidencias.html");

if (!fs.existsSync(reportPath)) {
  console.error("❌ No se encontró tests/results/report.json");
  console.error("   Ejecuta primero: npm run test:report");
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const fecha = new Date().toLocaleString("es-CL", { timeZone: "America/Santiago" });

const totalTests = report.numTotalTests || 0;
const passed = report.numPassedTests || 0;
const failed = report.numFailedTests || 0;
const pending = report.numPendingTests || 0;
const duration = ((report.testResults || []).reduce((acc, s) => acc + (s.perfStats?.runtime || 0), 0) / 1000).toFixed(2);

function statusBadge(status) {
  if (status === "passed") return `<span class="badge pass">✅ PASÓ</span>`;
  if (status === "failed") return `<span class="badge fail">❌ FALLÓ</span>`;
  return `<span class="badge skip">⏭️ OMITIDO</span>`;
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

let suiteRows = "";
let suiteIndex = 1;

for (const suite of (report.testResults || [])) {
  const tests = suite.assertionResults || suite.testResults || [];

  for (const test of tests) {
    const ancestorTitle = (test.ancestorTitles || []).join(" > ");
    const testName = test.title || test.fullName || "";
    const status = test.status;
    const dur = ((test.duration || 0) / 1000).toFixed(3);
    const errMsg = test.failureMessages && test.failureMessages.length > 0
      ? `<pre class="error">${escapeHtml(test.failureMessages.join("\n"))}</pre>`
      : "";

    suiteRows += `
      <tr class="row-${status}">
        <td class="num">${suiteIndex++}</td>
        <td>${escapeHtml(ancestorTitle)}</td>
        <td>${escapeHtml(testName)}</td>
        <td>${statusBadge(status)}</td>
        <td class="num">${dur} s</td>
        <td>${errMsg}</td>
      </tr>`;
  }
}

const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Evidencias de Pruebas — Atlas API</title>
<style>
  :root {
    --green: #16a34a; --red: #dc2626; --yellow: #ca8a04;
    --bg: #f8fafc; --card: #fff; --border: #e2e8f0;
    --text: #1e293b; --muted: #64748b;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); }
  header {
    background: linear-gradient(135deg, #1e3a5f 0%, #0f6cbd 100%);
    color: #fff; padding: 2rem 2.5rem;
  }
  header h1 { font-size: 1.75rem; margin-bottom: .25rem; }
  header p { opacity: .8; font-size: .9rem; }
  .summary {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 1rem; padding: 1.5rem 2.5rem;
  }
  .card {
    background: var(--card); border: 1px solid var(--border);
    border-radius: 10px; padding: 1rem 1.25rem; text-align: center;
    box-shadow: 0 1px 3px rgba(0,0,0,.06);
  }
  .card .value { font-size: 2rem; font-weight: 700; }
  .card .label { font-size: .8rem; color: var(--muted); margin-top: .25rem; }
  .card.green .value { color: var(--green); }
  .card.red .value { color: var(--red); }
  .card.yellow .value { color: var(--yellow); }
  .card.blue .value { color: #0f6cbd; }
  section { padding: 0 2.5rem 2.5rem; }
  section h2 { font-size: 1.1rem; margin-bottom: 1rem; color: var(--muted); }
  table { width: 100%; border-collapse: collapse; background: var(--card);
    border-radius: 10px; overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,.06); border: 1px solid var(--border); }
  th { background: #1e3a5f; color: #fff; padding: .75rem 1rem; text-align: left; font-size: .85rem; }
  td { padding: .65rem 1rem; font-size: .85rem; border-bottom: 1px solid var(--border); vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .row-passed { background: #f0fdf4; }
  .row-failed { background: #fef2f2; }
  .row-pending { background: #fefce8; }
  .num { text-align: center; color: var(--muted); }
  .badge { display: inline-flex; align-items: center; gap: .3rem;
    padding: .2rem .6rem; border-radius: 9999px; font-size: .78rem; font-weight: 600;
    white-space: nowrap; }
  .badge.pass { background: #dcfce7; color: var(--green); }
  .badge.fail { background: #fee2e2; color: var(--red); }
  .badge.skip { background: #fef9c3; color: var(--yellow); }
  pre.error { background: #1e1e1e; color: #f87171; padding: .75rem; border-radius: 6px;
    font-size: .75rem; white-space: pre-wrap; word-break: break-all; max-width: 500px; }
  footer { text-align: center; padding: 1.5rem; color: var(--muted); font-size: .8rem; }
</style>
</head>
<body>
<header>
  <h1>🔬 Evidencias de Pruebas — Atlas API</h1>
  <p>Generado el ${fecha} &nbsp;|&nbsp; Duración total: ${duration} s</p>
</header>

<div class="summary">
  <div class="card blue">
    <div class="value">${totalTests}</div>
    <div class="label">Total de Pruebas</div>
  </div>
  <div class="card green">
    <div class="value">${passed}</div>
    <div class="label">✅ Pasaron</div>
  </div>
  <div class="card red">
    <div class="value">${failed}</div>
    <div class="label">❌ Fallaron</div>
  </div>
  <div class="card yellow">
    <div class="value">${pending}</div>
    <div class="label">⏭️ Omitidas</div>
  </div>
  <div class="card ${failed === 0 ? 'green' : 'red'}">
    <div class="value">${totalTests > 0 ? Math.round((passed / totalTests) * 100) : 0}%</div>
    <div class="label">Tasa de Éxito</div>
  </div>
</div>

<section>
  <h2>📋 Detalle de Casos de Prueba</h2>
  <table>
    <thead>
      <tr>
        <th style="width:50px">#</th>
        <th>Módulo</th>
        <th>Caso de Prueba</th>
        <th style="width:120px">Resultado</th>
        <th style="width:80px">Tiempo</th>
        <th>Detalle Error</th>
      </tr>
    </thead>
    <tbody>
      ${suiteRows || '<tr><td colspan="6" style="text-align:center;padding:2rem;color:#64748b">Sin resultados</td></tr>'}
    </tbody>
  </table>
</section>

<footer>
  Atlas API — Informe de Pruebas Automatizadas &nbsp;|&nbsp; Jest + Axios
</footer>
</body>
</html>`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, html, "utf8");
console.log(`\n✅ Reporte generado en: ${outputPath}\n`);
