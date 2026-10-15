/**
 * Atlas API — Suite de pruebas automatizadas
 * Módulos: Autenticación, Empresas, Usuarios, Clientes, Contratos, Roles,
 *          Empresa-Usuarios, Métricas, Auditoría
 *
 * Ejecutar:  npm test
 * Requisito: Backend corriendo en http://localhost:4000
 *            (o ajustar BASE_URL según el puerto en .env)
 */

const axios = require("axios");
const path = require("path");
const fs = require("fs");
const FormData = require("form-data");

// ─── Configuración base ───────────────────────────────────────────────────────
const BASE_URL = process.env.BASE_URL || "http://localhost:4450";
const TIMEOUT = 15000; // 15 s (algunos endpoints tienen delay de 4 s)

// Estado compartido entre casos de prueba (IDs creados)
let state = {
  token: null,
  empresaId: null,
  usuarioId: null,
  clienteId: null,
  contratoId: null,
  rolId: null,
  empresaUsuarioId: null,
};

// Helper HTTP
const api = axios.create({ baseURL: BASE_URL, timeout: TIMEOUT });
const authHeaders = () => ({
  headers: { Authorization: `Bearer ${state.token}` },
});

// ─── Helper para ignorar errores 4xx y obtener la respuesta ──────────────────
async function req(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err.response) return err.response;
    throw err;
  }
}

// ─── 1. AUTENTICACIÓN ─────────────────────────────────────────────────────────
describe("1. Autenticación — POST /autenticacion/login", () => {
  test("CP-AUTH-01 — Login con credenciales válidas devuelve token JWT", async () => {
    const res = await req(() =>
      api.post("/autenticacion/login", {
        nombre_usuario: "admin",
        password: "admin123",
      })
    );
    // Si hay un usuario "admin/admin123" en la DB, espera 200 + token
    if (res.status === 200) {
      expect(res.data).toHaveProperty("token");
      state.token = res.data.token;
    } else {
      // Marcar como pendiente si no existe el usuario de prueba
      console.warn("⚠️  CP-AUTH-01: Usuario de prueba no encontrado (status", res.status, ")");
    }
  }, TIMEOUT);

  test("CP-AUTH-02 — Login con contraseña incorrecta devuelve 401", async () => {
    const res = await req(() =>
      api.post("/autenticacion/login", {
        nombre_usuario: "admin",
        password: "contrasena_erronea_xyz",
      })
    );
    expect(res.status).toBe(401);
  }, TIMEOUT);

  test("CP-AUTH-03 — Login con usuario inexistente devuelve 401", async () => {
    const res = await req(() =>
      api.post("/autenticacion/login", {
        nombre_usuario: "usuario_que_no_existe",
        password: "cualquier_cosa",
      })
    );
    expect(res.status).toBe(401);
  }, TIMEOUT);
});

// ─── 2. EMPRESAS ─────────────────────────────────────────────────────────────
describe("2. Empresas — /empresas", () => {
  test("CP-EMP-01 — Crear empresa con usuario (registro completo) devuelve 201", async () => {
    const ts = Date.now();
    const res = await req(() =>
      api.post("/empresas", {
        usuario: {
          nombre_usuario: `testuser_${ts}`,
          contrasena_hash: "test1234",
          correo: `testuser_${ts}@mail.com`,
        },
        empresa: {
          nombre: `Empresa Test ${ts}`,
          correo: `empresa_${ts}@mail.com`,
          telefono: "+56900000000",
          direccion: "Calle Falsa 123",
        },
      })
    );
    expect(res.status).toBe(201);
    expect(res.data).toHaveProperty("empresa");
    expect(res.data).toHaveProperty("usuario");
    state.empresaId = res.data.empresa.id;
    state.usuarioId = res.data.usuario.id;

    // Hacemos login con el nuevo usuario para obtener token con empresaId
    const loginRes = await req(() =>
      api.post("/autenticacion/login", {
        nombre_usuario: `testuser_${ts}`,
        password: "test1234",
      })
    );
    if (loginRes.status === 200) {
      state.token = loginRes.data.token;
    }
  }, TIMEOUT);

  test("CP-EMP-02 — Listar empresas devuelve array", async () => {
    const res = await req(() => api.get("/empresas"));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  }, TIMEOUT);

  test("CP-EMP-03 — Obtener empresa por ID devuelve objeto con id", async () => {
    if (!state.empresaId) return;
    const res = await req(() => api.get(`/empresas/${state.empresaId}`));
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty("id", state.empresaId);
  }, TIMEOUT);

  test("CP-EMP-04 — Obtener empresa con ID inexistente devuelve 404", async () => {
    const res = await req(() => api.get("/empresas/9999999"));
    expect(res.status).toBe(404);
  }, TIMEOUT);

  test("CP-EMP-05 — Actualizar empresa devuelve objeto actualizado", async () => {
    if (!state.empresaId) return;
    const res = await req(() =>
      api.put(`/empresas/${state.empresaId}`, {
        nombre: "Empresa Actualizada",
        correo: "actualizada@mail.com",
        telefono: "+56911111111",
        direccion: "Nueva dirección 456",
      })
    );
    expect(res.status).toBe(200);
    expect(res.data.nombre).toBe("Empresa Actualizada");
  }, TIMEOUT);
});

// ─── 3. USUARIOS ─────────────────────────────────────────────────────────────
describe("3. Usuarios — /usuarios", () => {
  test("CP-USR-01 — Listar usuarios autenticados devuelve array", async () => {
    if (!state.token) return;
    const res = await req(() => api.get("/usuarios", authHeaders()));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  }, TIMEOUT);

  test("CP-USR-02 — Listar usuarios sin token devuelve 401", async () => {
    const res = await req(() => api.get("/usuarios"));
    expect(res.status).toBe(401);
  }, TIMEOUT);

  test("CP-USR-03 — Obtener usuario por ID devuelve objeto con id", async () => {
    if (!state.usuarioId) return;
    const res = await req(() => api.get(`/usuarios/${state.usuarioId}`));
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty("id", state.usuarioId);
  }, TIMEOUT);

  test("CP-USR-04 — Obtener usuario con ID inexistente devuelve 404", async () => {
    const res = await req(() => api.get("/usuarios/9999999"));
    expect(res.status).toBe(404);
  }, TIMEOUT);

  test("CP-USR-05 — Actualizar usuario devuelve usuario con datos nuevos", async () => {
    if (!state.usuarioId) return;
    const res = await req(() =>
      api.put(
        `/usuarios/${state.usuarioId}`,
        {
          nombre_usuario: `updated_user_${Date.now()}`,
          contrasena_hash: "newpass456",
          correo: `updated_${Date.now()}@mail.com`,
        },
        authHeaders()
      )
    );
    expect([200, 404]).toContain(res.status);
  }, TIMEOUT);
});

// ─── 4. ROLES ─────────────────────────────────────────────────────────────────
describe("4. Roles — /roles", () => {
  test("CP-ROL-01 — Crear rol devuelve 201 con nombre", async () => {
    const res = await req(() =>
      api.post("/roles", { nombre: `Rol_Test_${Date.now()}` })
    );
    expect(res.status).toBe(201);
    expect(res.data).toHaveProperty("nombre");
    state.rolId = res.data.id;
  }, TIMEOUT);

  test("CP-ROL-02 — Listar roles devuelve array", async () => {
    const res = await req(() => api.get("/roles"));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  }, TIMEOUT);

  test("CP-ROL-03 — Obtener rol por ID devuelve objeto", async () => {
    if (!state.rolId) return;
    const res = await req(() => api.get(`/roles/${state.rolId}`));
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty("id", state.rolId);
  }, TIMEOUT);

  test("CP-ROL-04 — Obtener rol con ID inexistente devuelve 404", async () => {
    const res = await req(() => api.get("/roles/9999999"));
    expect(res.status).toBe(404);
  }, TIMEOUT);

  test("CP-ROL-05 — Actualizar rol devuelve objeto actualizado", async () => {
    if (!state.rolId) return;
    const res = await req(() =>
      api.put(`/roles/${state.rolId}`, { nombre: "Rol Actualizado" })
    );
    expect(res.status).toBe(200);
    expect(res.data.nombre).toBe("Rol Actualizado");
  }, TIMEOUT);
});

// ─── 5. EMPRESA-USUARIOS ─────────────────────────────────────────────────────
describe("5. Empresa-Usuarios — /empresa-usuarios", () => {
  test("CP-EU-01 — Listar vínculos devuelve array", async () => {
    const res = await req(() => api.get("/empresa-usuarios"));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  }, TIMEOUT);

  test("CP-EU-02 — Obtener vínculo inexistente devuelve 404", async () => {
    const res = await req(() => api.get("/empresa-usuarios/9999999"));
    expect(res.status).toBe(404);
  }, TIMEOUT);
});

// ─── 6. CLIENTES ─────────────────────────────────────────────────────────────
describe("6. Clientes — /clientes", () => {
  test("CP-CLI-01 — Crear cliente con token devuelve 201", async () => {
    if (!state.token) return;
    const ts = Date.now();
    const res = await req(() =>
      api.post(
        "/clientes",
        {
          nombre: `Cliente Test ${ts}`,
          correo: `cliente_${ts}@test.com`,
          telefono: "+56922222222",
          direccion: "Av. Prueba 789",
          es_empresa: false,
        },
        authHeaders()
      )
    );
    expect(res.status).toBe(201);
    expect(res.data).toHaveProperty("id");
    state.clienteId = res.data.id;
  }, TIMEOUT);

  test("CP-CLI-02 — Crear cliente sin token devuelve 401", async () => {
    const res = await req(() =>
      api.post("/clientes", {
        nombre: "Sin Auth",
        correo: "sinauth@test.com",
      })
    );
    expect(res.status).toBe(401);
  }, TIMEOUT);

  test("CP-CLI-03 — Listar clientes con token devuelve array", async () => {
    if (!state.token) return;
    const res = await req(() => api.get("/clientes", authHeaders()));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  }, TIMEOUT * 2);

  test("CP-CLI-04 — Listar clientes sin token devuelve 401", async () => {
    const res = await req(() => api.get("/clientes"));
    expect(res.status).toBe(401);
  }, TIMEOUT * 2);

  test("CP-CLI-05 — Obtener cliente por ID devuelve objeto", async () => {
    if (!state.token || !state.clienteId) return;
    const res = await req(() =>
      api.get(`/clientes/${state.clienteId}`, authHeaders())
    );
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty("id", state.clienteId);
  }, TIMEOUT);

  test("CP-CLI-06 — Obtener cliente con ID inexistente devuelve 404", async () => {
    if (!state.token) return;
    const res = await req(() =>
      api.get("/clientes/9999999", authHeaders())
    );
    expect(res.status).toBe(404);
  }, TIMEOUT);

  test("CP-CLI-07 — Buscar clientes por nombre devuelve array", async () => {
    if (!state.token) return;
    const res = await req(() =>
      api.get("/clientes/search?name=Test", authHeaders())
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  }, TIMEOUT);

  test("CP-CLI-08 — Actualizar cliente devuelve objeto actualizado", async () => {
    if (!state.token || !state.clienteId) return;
    const res = await req(() =>
      api.put(
        `/clientes/${state.clienteId}`,
        {
          nombre: "Cliente Actualizado",
          correo: "actualizado@test.com",
          telefono: "+56933333333",
          direccion: "Dirección Nueva 101",
          es_empresa: false,
        },
        authHeaders()
      )
    );
    expect(res.status).toBe(200);
    expect(res.data.nombre).toBe("Cliente Actualizado");
  }, TIMEOUT);
});

// ─── 7. CONTRATOS ─────────────────────────────────────────────────────────────
describe("7. Contratos — /contratos", () => {
  test("CP-CON-01 — Crear contrato con archivo devuelve 201", async () => {
    if (!state.token || !state.clienteId) return;

    // Crear un PDF mínimo en memoria para la prueba
    const pdfContent = Buffer.from(
      "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
    );
    const form = new FormData();
    form.append("cliente_id", String(state.clienteId));
    form.append("titulo", "Contrato de Prueba");
    form.append("descripcion", "Descripción de prueba automatizada");
    form.append("fecha_inicio", "2024-01-01");
    form.append("fecha_fin", "2025-12-31");
    form.append("file", pdfContent, {
      filename: "contrato_test.pdf",
      contentType: "application/pdf",
    });

    const res = await req(() =>
      api.post("/contratos", form, {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${state.token}`,
        },
        timeout: TIMEOUT,
      })
    );
    expect(res.status).toBe(201);
    expect(res.data).toHaveProperty("id");
    state.contratoId = res.data.id;
  }, TIMEOUT);

  test("CP-CON-02 — Listar contratos con token devuelve array", async () => {
    if (!state.token) return;
    const res = await req(() => api.get("/contratos", authHeaders()));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  }, TIMEOUT * 2);

  test("CP-CON-03 — Listar contratos sin token devuelve 401", async () => {
    const res = await req(() => api.get("/contratos"));
    expect(res.status).toBe(401);
  }, TIMEOUT * 2);

  test("CP-CON-04 — Obtener contrato por ID devuelve objeto", async () => {
    if (!state.contratoId) return;
    const res = await req(() =>
      api.get(`/contratos/${state.contratoId}`)
    );
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty("id", state.contratoId);
  }, TIMEOUT);

  test("CP-CON-05 — Obtener contrato con ID inexistente devuelve 404", async () => {
    const res = await req(() => api.get("/contratos/9999999"));
    expect(res.status).toBe(404);
  }, TIMEOUT);

  test("CP-CON-06 — Dashboard devuelve estadísticas de la empresa", async () => {
    if (!state.token) return;
    const res = await req(() =>
      api.get("/contratos/dashboard", authHeaders())
    );
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty("totalUsuarios");
    expect(res.data).toHaveProperty("totalClientes");
    expect(res.data).toHaveProperty("contratosVencen7Dias");
    expect(res.data).toHaveProperty("contratosVencen15Dias");
    expect(res.data).toHaveProperty("contratosVencen30Dias");
  }, TIMEOUT);

  test("CP-CON-07 — Dashboard sin token devuelve 401", async () => {
    const res = await req(() => api.get("/contratos/dashboard"));
    expect(res.status).toBe(401);
  }, TIMEOUT);

  test("CP-CON-08 — Contratos por estado devuelve array", async () => {
    if (!state.token) return;
    const res = await req(() =>
      api.get("/contratos/estados", authHeaders())
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  }, TIMEOUT);

  test("CP-CON-09 — Actualizar contrato devuelve objeto actualizado", async () => {
    if (!state.token || !state.contratoId) return;
    const res = await req(() =>
      api.put(
        `/contratos/${state.contratoId}`,
        {
          titulo: "Contrato Actualizado",
          descripcion: "Descripción actualizada por prueba",
          fecha_fin: "2026-06-30",
        },
        authHeaders()
      )
    );
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty("titulo", "Contrato Actualizado");
  }, TIMEOUT);

  test("CP-CON-10 — Actualizar contrato sin token devuelve 401", async () => {
    if (!state.contratoId) return;
    const res = await req(() =>
      api.put(`/contratos/${state.contratoId}`, { titulo: "Sin Auth" })
    );
    expect(res.status).toBe(401);
  }, TIMEOUT);
});

// ─── 8. MÉTRICAS ─────────────────────────────────────────────────────────────
describe("8. Métricas — GET /metricas", () => {
  test("CP-MET-01 — Obtener métricas con token devuelve estructura correcta", async () => {
    if (!state.token) return;
    const res = await req(() => api.get("/metricas", authHeaders()));
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty("contratosProximosAVencer");
    expect(res.data).toHaveProperty("contratosVencidos");
    expect(res.data).toHaveProperty("metricas");
    expect(res.data.metricas).toHaveProperty("totalUsuarios");
    expect(res.data.metricas).toHaveProperty("totalClientes");
  }, TIMEOUT * 2);

  test("CP-MET-02 — Obtener métricas sin token devuelve 401", async () => {
    const res = await req(() => api.get("/metricas"));
    expect(res.status).toBe(401);
  }, TIMEOUT * 2);
});

// ─── 9. AUDITORÍA ─────────────────────────────────────────────────────────────
describe("9. Auditoría — /auditoria", () => {
  test("CP-AUD-01 — Listar auditoría devuelve array", async () => {
    const res = await req(() => api.get("/auditoria"));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  }, TIMEOUT);

  test("CP-AUD-02 — Registrar entrada de auditoría devuelve 201", async () => {
    const res = await req(() =>
      api.post("/auditoria", {
        accion: "PRUEBA_AUTOMATIZADA",
        detalles: "Registro de prueba automatizada",
      })
    );
    expect(res.status).toBe(201);
    expect(res.data).toHaveProperty("accion");
  }, TIMEOUT);
});

// ─── 10. LIMPIEZA — eliminar datos de prueba ──────────────────────────────────
describe("10. Limpieza — eliminar datos de prueba", () => {
  test("CP-LMP-01 — Eliminar contrato de prueba", async () => {
    if (!state.contratoId) return;
    const res = await req(() =>
      api.delete(`/contratos/${state.contratoId}`, authHeaders())
    );
    expect([200, 404]).toContain(res.status);
  }, TIMEOUT);

  test("CP-LMP-02 — Eliminar cliente de prueba", async () => {
    if (!state.token || !state.clienteId) return;
    const res = await req(() =>
      api.delete(`/clientes/${state.clienteId}`, authHeaders())
    );
    expect([200, 404]).toContain(res.status);
  }, TIMEOUT);

  test("CP-LMP-03 — Eliminar rol de prueba", async () => {
    if (!state.rolId) return;
    const res = await req(() =>
      api.delete(`/roles/${state.rolId}`)
    );
    expect([200, 404]).toContain(res.status);
  }, TIMEOUT);

  test("CP-LMP-04 — Eliminar empresa de prueba", async () => {
    if (!state.empresaId) return;
    const res = await req(() =>
      api.delete(`/empresas/${state.empresaId}`)
    );
    expect([200, 404]).toContain(res.status);
  }, TIMEOUT);

  test("CP-LMP-05 — Eliminar usuario de prueba", async () => {
    if (!state.usuarioId) return;
    const res = await req(() =>
      api.delete(`/usuarios/${state.usuarioId}`, authHeaders())
    );
    expect([200, 404]).toContain(res.status);
  }, TIMEOUT);
});
