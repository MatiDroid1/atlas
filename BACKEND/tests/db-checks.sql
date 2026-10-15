-- ============================================================
-- Atlas DB — Script de Verificación de Seguridad en Base de Datos
-- CP-28: Verificar que las contraseñas NO están en texto plano
-- CP-29: Verificar que datos sensibles no están en texto plano
-- CP-32: Verificar que la auditoría registra operaciones críticas
-- ============================================================
-- Ejecutar con:
-- docker exec -i atlas-postgres psql -U postgres -d atlas -f /tmp/db-checks.sql
-- ============================================================

\echo ''
\echo '============================================================'
\echo 'ATLAS DB — VERIFICACIÓN DE SEGURIDAD'
\echo '============================================================'

-- ────────────────────────────────────────────────────────────
-- CP-28a: Verificar formato de contraseñas (deben ser bcrypt: $2b$...)
-- ────────────────────────────────────────────────────────────
\echo ''
\echo '─────────────────────────────────────────────────────────'
\echo 'CP-28 Hashing de contraseñas (deben comenzar con $2b$ para bcrypt)'
\echo '─────────────────────────────────────────────────────────'

SELECT
  nombre_usuario,
  CASE
    WHEN contrasena_hash LIKE '$2b$%' OR contrasena_hash LIKE '$2a$%' THEN '✅ bcrypt'
    WHEN contrasena_hash LIKE '$argon2%'                               THEN '✅ argon2'
    WHEN length(contrasena_hash) = 64                                  THEN '⚠️  posible SHA-256 (sin salt)'
    WHEN length(contrasena_hash) = 32                                  THEN '❌ posible MD5'
    ELSE                                                                    '❌ TEXTO PLANO o formato desconocido'
  END AS estado_hash,
  left(contrasena_hash, 7) AS prefijo_hash
FROM usuarios
ORDER BY id
LIMIT 20;

-- ────────────────────────────────────────────────────────────
-- CP-28b: Contar contraseñas que NO son bcrypt
-- ────────────────────────────────────────────────────────────
\echo ''
\echo 'CP-28b: Contraseñas que NO son bcrypt:'
SELECT COUNT(*) AS contrasenas_texto_plano
FROM usuarios
WHERE contrasena_hash NOT LIKE '$2b$%'
  AND contrasena_hash NOT LIKE '$2a$%'
  AND contrasena_hash NOT LIKE '$argon2%';

-- ────────────────────────────────────────────────────────────
-- CP-29: Datos sensibles — RUT y número de cuenta
-- ────────────────────────────────────────────────────────────
\echo ''
\echo '─────────────────────────────────────────────────────────'
\echo 'CP-29: Almacenamiento de datos sensibles (RUT y cuenta bancaria)'
\echo '─────────────────────────────────────────────────────────'

SELECT
  id,
  nombre,
  CASE
    WHEN rut IS NULL THEN '(sin RUT)'
    WHEN rut ~ '^\d{1,8}-[\dkK]$' THEN '⚠️  RUT en TEXTO PLANO'
    ELSE '? RUT cifrado o formato no estándar'
  END AS estado_rut,
  CASE
    WHEN numero_cuenta IS NULL THEN '(sin cuenta)'
    WHEN numero_cuenta ~ '^\d+$' THEN '⚠️  N° cuenta en TEXTO PLANO'
    ELSE '? Cuenta cifrada o formato no estándar'
  END AS estado_cuenta
FROM clientes
WHERE rut IS NOT NULL OR numero_cuenta IS NOT NULL
ORDER BY id
LIMIT 20;

-- ────────────────────────────────────────────────────────────
-- CP-32: Verificar que la auditoría registra operaciones
-- ────────────────────────────────────────────────────────────
\echo ''
\echo '─────────────────────────────────────────────────────────'
\echo 'CP-32: Auditoría — últimas 20 entradas'
\echo '─────────────────────────────────────────────────────────'

SELECT
  id,
  usuario_id,
  accion,
  created_at
FROM auditoria
ORDER BY id DESC
LIMIT 20;

\echo ''
\echo 'CP-32b: Total de registros en auditoría:'
SELECT COUNT(*) AS total_auditoria FROM auditoria;

-- ────────────────────────────────────────────────────────────
-- Información general de la base
-- ────────────────────────────────────────────────────────────
\echo ''
\echo '─────────────────────────────────────────────────────────'
\echo 'RESUMEN DE DATOS EN LA BASE'
\echo '─────────────────────────────────────────────────────────'

SELECT
  (SELECT COUNT(*) FROM usuarios)       AS total_usuarios,
  (SELECT COUNT(*) FROM empresas)       AS total_empresas,
  (SELECT COUNT(*) FROM clientes)       AS total_clientes,
  (SELECT COUNT(*) FROM contratos)      AS total_contratos,
  (SELECT COUNT(*) FROM auditoria)      AS total_auditoria,
  (SELECT COUNT(*) FROM roles)          AS total_roles;

\echo ''
\echo '============================================================'
\echo 'FIN DE VERIFICACIÓN'
\echo '============================================================'
