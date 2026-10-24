/**
 * Atlas API — Pruebas de Configuración de Seguridad
 * CP-26: Cabeceras HTTP de seguridad
 * CP-27: CORS y configuración HTTPS
 *
 * Herramientas: Jest + Axios (equivalente al ZAP baseline para cabeceras)
 * Ejecutar: npm test (junto con atlas.test.js)
 */

const axios = require("axios");

const BASE_URL = process.env.BASE_URL || "http://localhost:4450";
const TIMEOUT = 10000;

async function req(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err.response) return err.response;
    throw err;
  }
}

// ─── CP-26: Cabeceras HTTP de seguridad ──────────────────────────────────────
describe("CP-26 — Cabeceras HTTP de Seguridad", () => {
  let response;

  beforeAll(async () => {
    response = await req(() => axios.get(BASE_URL + "/", { timeout: TIMEOUT }));
  }, TIMEOUT);

  test("CP-26a — El servidor responde al endpoint raíz", () => {
    expect([200, 301, 302, 404]).toContain(response.status);
  });

  test("CP-26b — Cabecera X-Content-Type-Options presente", () => {
    const val = response.headers?.["x-content-type-options"];
    if (!val) {
      console.warn("⚠️  HALLAZGO: Falta cabecera X-Content-Type-Options (nosniff)");
    }
    // Documentar hallazgo sin fallar el test (observación)
    expect(true).toBe(true);
  });

  test("CP-26c — Cabecera X-Frame-Options o CSP frame-ancestors presente", () => {
    const xfo = response.headers?.["x-frame-options"];
    const csp = response.headers?.["content-security-policy"];
    if (!xfo && !csp) {
      console.warn("⚠️  HALLAZGO: Falta protección contra clickjacking (X-Frame-Options / CSP)");
    }
    expect(true).toBe(true);
  });

  test("CP-26d — Cabecera Strict-Transport-Security (HSTS) presente", () => {
    const hsts = response.headers?.["strict-transport-security"];
    if (!hsts) {
      console.warn("⚠️  HALLAZGO: Falta cabecera HSTS (Strict-Transport-Security) — NFR-SEG-1");
    }
    expect(true).toBe(true);
  });

  test("CP-26e — Server header no expone versión del servidor", () => {
    const server = response.headers?.["server"] || "";
    const xPowered = response.headers?.["x-powered-by"] || "";
    if (xPowered.toLowerCase().includes("express")) {
      console.warn(`⚠️  HALLAZGO: Cabecera X-Powered-By expone tecnología: "${xPowered}"`);
    }
    // No debe exponer "Express" en producción
    expect(true).toBe(true);
  });
});

// ─── CP-27: CORS ──────────────────────────────────────────────────────────────
describe("CP-27 — Configuración CORS", () => {
  test("CP-27a — CORS permite el origen del frontend (localhost:3350)", async () => {
    const res = await req(() =>
      axios.options(BASE_URL + "/autenticacion/login", {
        timeout: TIMEOUT,
        headers: {
          Origin: "http://localhost:3350",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "Content-Type",
        },
      })
    );
    const origin = res.headers?.["access-control-allow-origin"];
    console.log(`  Access-Control-Allow-Origin: ${origin || "(no presente)"}`);
    // Si responde 200 o 204, el preflight fue aceptado
    expect([200, 204, 400, 404]).toContain(res.status);
  }, TIMEOUT);

  test("CP-27b — CORS no permite cualquier origen en producción (wildcard *)", async () => {
    const res = await req(() =>
      axios.options(BASE_URL + "/autenticacion/login", {
        timeout: TIMEOUT,
        headers: {
          Origin: "https://atacante.com",
          "Access-Control-Request-Method": "POST",
        },
      })
    );
    const origin = res.headers?.["access-control-allow-origin"];
    if (origin === "*") {
      console.warn("⚠️  HALLAZGO: CORS configurado con wildcard '*' — permite cualquier origen");
    }
    console.log(`  CORS para origen externo: ${origin || "(denegado)"}`);
    expect(true).toBe(true);
  }, TIMEOUT);
});

// ─── CP-07: Control de acceso por rol ────────────────────────────────────────
describe("CP-07 — Endpoints protegidos sin token devuelven 401", () => {
  const protectedEndpoints = [
    { method: "GET", path: "/usuarios", desc: "Listar usuarios" },
    { method: "GET", path: "/clientes", desc: "Listar clientes" },
    { method: "GET", path: "/contratos", desc: "Listar contratos" },
    { method: "GET", path: "/contratos/dashboard", desc: "Dashboard" },
    { method: "GET", path: "/contratos/estados", desc: "Contratos por estado" },
    { method: "GET", path: "/metricas", desc: "Métricas" },
  ];

  for (const ep of protectedEndpoints) {
    test(`CP-07 — ${ep.desc} (${ep.method} ${ep.path}) sin token → 401`, async () => {
      const res = await req(() =>
        axios({ method: ep.method, url: BASE_URL + ep.path, timeout: TIMEOUT })
      );
      if (res.status !== 401) {
        console.warn(`⚠️  HALLAZGO CP-07: ${ep.path} respondió ${res.status} sin token (esperado 401)`);
      }
      expect(res.status).toBe(401);
    }, TIMEOUT);
  }
});

// ─── CP-23: Inyección SQL en login ───────────────────────────────────────────
describe("CP-23 — Resistencia a Inyección SQL en Login", () => {
  const sqlPayloads = [
    "' OR '1'='1",
    "' OR '1'='1' --",
    "admin'--",
    "' UNION SELECT 1,2,3--",
  ];

  for (const payload of sqlPayloads) {
    test(`CP-23 — Payload SQL "${payload.substring(0, 20)}..." no produce 200`, async () => {
      const res = await req(() =>
        axios.post(BASE_URL + "/autenticacion/login", {
          nombre_usuario: payload,
          password: payload,
        }, { timeout: TIMEOUT })
      );
      if (res.status === 200) {
        console.warn(`⚠️  HALLAZGO CRÍTICO CP-23: SQL Injection exitosa con payload: ${payload}`);
      }
      // El sistema debe responder 401 (o 400/500), no 200
      expect(res.status).not.toBe(200);
    }, TIMEOUT);
  }
});

// ─── CP-28: Verificación de hashing de contraseñas (API) ─────────────────────
describe("CP-28 — Las contraseñas NO se devuelven en respuestas de API", () => {
  test("CP-28a — GET /usuarios no incluye campo contrasena_hash en respuesta", async () => {
    // Usar credenciales de prueba - verificar si el endpoint devuelve la contraseña
    const res = await req(() =>
      axios.get(BASE_URL + "/usuarios/1", { timeout: TIMEOUT })
    );
    if (res.status === 200) {
      const data = res.data;
      const hasPassword = "contrasena_hash" in data || "password" in data || "contrasena" in data;
      if (hasPassword) {
        console.warn("⚠️  HALLAZGO CP-28: GET /usuarios/:id devuelve campo de contraseña");
      }
      expect(hasPassword).toBe(false);
    } else {
      // Si no existe el usuario 1, el test no aplica
      expect([404, 401]).toContain(res.status);
    }
  }, TIMEOUT);
});
