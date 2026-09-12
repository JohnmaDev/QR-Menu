import dotenv from 'dotenv';
import { getDb, closeDb } from './index.js';
import { users } from './schema.js';
import { hashPassword } from '../services/auth.service.js';
import { UserRole } from '@qr-menu/shared';
import { eq } from 'drizzle-orm';

dotenv.config();

/**
 * Script seguro para inicializar o actualizar el usuario Administrador en Producción.
 * Uso:
 *   ADMIN_USERNAME=admin ADMIN_PASSWORD=TuClaveSegura123! npm run db:create-admin
 * O pasando argumentos:
 *   npm run db:create-admin -- admin TuClaveSegura123!
 */
async function main() {
  const args = process.argv.slice(2);
  const username = (args[0] || process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
  const password = (args[1] || process.env.ADMIN_PASSWORD || '').trim();

  if (!password) {
    console.error('\n❌ ERROR: Debes proporcionar una contraseña segura para el administrador.');
    console.error('Uso:');
    console.error('  ADMIN_USERNAME=admin ADMIN_PASSWORD="MiClaveSegura123!" npm run db:create-admin');
    console.error('  O: npm run db:create-admin -- admin "MiClaveSegura123!"\n');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('\n❌ ERROR: La contraseña del administrador debe tener al menos 8 caracteres.\n');
    process.exit(1);
  }

  const db = getDb();

  try {
    console.log(`\n🔒 Generando hash Argon2id para el usuario administrador '${username}'...`);
    const passwordHash = await hashPassword(password);

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(users)
        .set({
          passwordHash,
          role: UserRole.ADMIN,
          isActive: true,
        })
        .where(eq(users.username, username));
      console.log(`✅ Usuario administrador '${username}' actualizado exitosamente con nueva contraseña.\n`);
    } else {
      await db.insert(users).values({
        username,
        passwordHash,
        role: UserRole.ADMIN,
        isActive: true,
      });
      console.log(`✅ Usuario administrador '${username}' creado exitosamente en la base de datos.\n`);
    }
  } catch (error) {
    console.error('❌ Error al inicializar administrador:', error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

main();
