import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { DatabaseClient } from './databaseClient';
import { appConfig } from '../config/appConfig';

const ADMIN_USERNAME = process.env.SEED_ADMIN_USERNAME || 'admin';

function generateSecurePassword(length = 16): string {
  // base64url has no characters that need escaping when pasted into a shell or a login form
  return crypto.randomBytes(length).toString('base64url').slice(0, length);
}

/** Idempotent: creates the first admin account only if it does not exist yet. */
async function seed(): Promise<void> {
  const prisma = DatabaseClient.getInstance();

  const existing = await prisma.user.findUnique({ where: { username: ADMIN_USERNAME } });
  if (existing) {
    console.log(`seed skipped --> user "${ADMIN_USERNAME}" already exists`);
    return;
  }

  const rawPassword = process.env.SEED_ADMIN_PASSWORD || generateSecurePassword();
  const hashed = await bcrypt.hash(rawPassword, appConfig.SALT_ROUNDS);
  await prisma.user.create({
    data: { name: 'Administrator', username: ADMIN_USERNAME, password: hashed },
  });

  console.log(`seed success --> user "${ADMIN_USERNAME}" with password ${rawPassword}`);
}

seed()
  .then(() => DatabaseClient.disconnect())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
