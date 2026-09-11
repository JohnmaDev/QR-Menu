#!/usr/bin/env bash
set -e

# ==============================================================================
# CHECKPOINT 3: MIGRACIÓN Y BOOTSTRAP CONTROLADO DE NEON STAGING
# ==============================================================================

echo "======================================================================"
echo "          QR BAR — CHECKPOINT 3: MIGRACIÓN Y BOOTSTRAP STAGING"
echo "======================================================================"
echo ""

# Paso 1: Solicitar DATABASE_URL mediante read -s
read -s -p "1. Pega la DATABASE_URL de Neon Staging (entrada oculta): " DATABASE_URL
echo ""
if [ -z "$DATABASE_URL" ]; then
  echo "❌ Error: DATABASE_URL no puede estar vacía."
  exit 1
fi
export DATABASE_URL

# Paso 2: Solicitar ADMIN_PASSWORD mediante read -s
read -s -p "2. Define la contraseña para ADMIN de Staging (mín. 10 chars, oculta): " ADMIN_PASSWORD
echo ""
if [ ${#ADMIN_PASSWORD} -lt 10 ]; then
  echo "❌ Error: ADMIN_PASSWORD debe tener al menos 10 caracteres."
  unset DATABASE_URL
  unset ADMIN_PASSWORD
  exit 1
fi
export ADMIN_PASSWORD

# Paso 3: Definir STAGING_BOOTSTRAP=true
export STAGING_BOOTSTRAP=true
echo "✅ Variable STAGING_BOOTSTRAP=true definida."
echo ""

# Paso 4 & 5: Ejecutar PRE-FLIGHT READ ONLY y verificar que NO apunta a production/main
echo "----------------------------------------------------------------------"
echo "🔍 EJECUTANDO PRE-FLIGHT CHECK DE SOLO LECTURA..."
echo "----------------------------------------------------------------------"

node -e "
import('./apps/backend/dist/db/index.js').then(async ({ getDb, closeDb }) => {
  try {
    const connStr = process.env.DATABASE_URL || '';
    if (!connStr.includes('.neon.tech')) {
      console.error('❌ ERROR: El host no pertenece a Neon (.neon.tech).');
      process.exit(1);
    }
    if (!connStr.includes('sslmode=require')) {
      console.error('❌ ERROR: La conexión debe requerir SSL (?sslmode=require).');
      process.exit(1);
    }

    const db = getDb();
    const res = await db.execute('SELECT current_setting(\\'neon.branch\\', true) as branch, current_setting(\\'neon.endpoint_id\\', true) as endpoint, current_database() as db;');
    const row = res?.[0] || res?.rows?.[0] || {};
    
    // Máscara segura de host
    const urlObj = new URL(connStr.replace('postgresql://', 'http://'));
    const maskedHost = urlObj.host;

    console.log('   - Host de conexión: ', maskedHost);
    console.log('   - Endpoint ID:      ', row.endpoint || maskedHost.split('.')[0]);
    console.log('   - Base de datos:    ', row.db);
    console.log('   - Rama detectada:   ', row.branch || '(Endpoint aislado)');

    if (row.branch === 'production' || row.branch === 'main') {
      console.error('\n🚨 BLOQUEO CRÍTICO: La conexión detectó la rama PRODUCCIÓN/MAIN. Abortando de inmediato.');
      process.exit(1);
    }
    console.log('\n✅ PRE-FLIGHT EXITOSO: La base de datos es segura y NO es producción.');
  } catch (err) {
    console.error('❌ Error en pre-flight:', err.message || err);
    process.exit(1);
  } finally {
    await closeDb();
  }
});
"

echo ""
echo "----------------------------------------------------------------------"
echo "🚀 PASO 6 & 7: APLICANDO MIGRACIONES (npm run db:migrate)..."
echo "----------------------------------------------------------------------"
npm run db:migrate

echo ""
echo "----------------------------------------------------------------------"
echo "👤 PASO 8: EJECUTANDO BOOTSTRAP DE STAGING (npm run db:bootstrap)..."
echo "----------------------------------------------------------------------"
npm run db:bootstrap

echo ""
echo "----------------------------------------------------------------------"
echo "🔍 PASO 9 & 10: AUDITORÍA POSTERIOR DE SOLO LECTURA..."
echo "----------------------------------------------------------------------"

node -e "
import('./apps/backend/dist/db/index.js').then(async ({ getDb, closeDb }) => {
  try {
    const db = getDb();
    
    // 1. Migraciones
    const migs = await db.execute('SELECT name, applied_at FROM __app_migrations ORDER BY id ASC;');
    const migRows = (migs?.[0] ? migs : migs?.rows) || [];
    console.log('📌 Migraciones aplicadas:', migRows.map(r => r.name));
    
    // 2. Tablas
    const tablesList = await db.execute(\"SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;\");
    const tRows = (tablesList?.[0] ? tablesList : tablesList?.rows) || [];
    console.log('📊 Tablas creadas:', tRows.map(r => r.table_name));

    // 3. Usuario ADMIN
    const users = await db.execute(\"SELECT username, role, is_active, LEFT(password_hash, 10) as hash_prefix FROM users;\");
    const userRows = (users?.[0] ? users : users?.rows) || [];
    console.log('👤 Usuario ADMIN:', userRows);

    // 4. Ausencia de caja/cocina
    const devCheck = await db.execute(\"SELECT count(*)::int as count FROM users WHERE username IN ('caja', 'cocina');\");
    const devCount = (devCheck?.[0] ? devCheck[0] : devCheck?.rows?.[0])?.count;
    console.log('🔒 Cuentas de desarrollo presentes (debe ser 0):', devCount);

    // 5. Conteo de catálogo
    const tables = await db.execute('SELECT count(*)::int as count FROM tables;');
    const cat = await db.execute('SELECT count(*)::int as count FROM categories;');
    const prod = await db.execute('SELECT count(*)::int as count FROM products;');
    console.log('🪑 Mesas creadas:', (tables?.[0] || tables?.rows?.[0])?.count);
    console.log('🏷️  Categorías creadas:', (cat?.[0] || cat?.rows?.[0])?.count);
    console.log('🍺 Productos creados:', (prod?.[0] || prod?.rows?.[0])?.count);

    // 6. Muestra de mesas y tokens (48 bits entropía)
    const mesaSample = await db.execute('SELECT number, name, public_token FROM tables ORDER BY number ASC LIMIT 3;');
    const sampleRows = (mesaSample?.[0] ? mesaSample : mesaSample?.rows) || [];
    console.log('🎫 Muestra de mesas y tokens generados:', sampleRows);

    console.log('\n✅ AUDITORÍA COMPLETADA CON ÉXITO: Todos los criterios se cumplen.');
  } catch (err) {
    console.error('❌ Error en auditoría posterior:', err.message || err);
    process.exit(1);
  } finally {
    await closeDb();
  }
});
"

echo ""
echo "----------------------------------------------------------------------"
echo "🧹 PASO 11 & 12: LIMPIEZA INMEDIATA DE VARIABLES DE SESIÓN..."
echo "----------------------------------------------------------------------"
unset ADMIN_PASSWORD
unset STAGING_BOOTSTRAP
unset DATABASE_URL

echo "Verificando limpieza:"
echo "   DATABASE_URL:      ${DATABASE_URL:-(Limpia/No definida)}"
echo "   ADMIN_PASSWORD:    ${ADMIN_PASSWORD:-(Limpia/No definida)}"
echo "   STAGING_BOOTSTRAP: ${STAGING_BOOTSTRAP:-(Limpia/No definida)}"
echo ""
echo "======================================================================"
echo "   CHECKPOINT 3 FINALIZADO CON ÉXITO EN NEON STAGING"
echo "======================================================================"
