import config from '../../../../config.js';
import { BcryptPasswordHasher } from '../../../../infrastructure/security/auth.js';
import { TypeOrmTeacherWriter } from '../persistence/typeorm/Writer.js';

const teacherWriter = new TypeOrmTeacherWriter();
const passwordHasher = new BcryptPasswordHasher();

export async function ensureAdminAccount(): Promise<void> {
  const adminUsername = config.auth.sysAdminUsername;
  const adminPassword = config.auth.sysAdminPassword ?? 'gaheocho123';

  let admin = await teacherWriter.findByUsername(adminUsername);
  const passwordHash = await passwordHasher.hash(adminPassword);

  if (!admin) {
    admin = teacherWriter.create({
      username: adminUsername,
      password_hash: passwordHash,
      is_active: true,
    });

    await teacherWriter.save(admin);
    return;
  }

  let hasChanges = false;

  if (!admin.is_active) {
    admin.is_active = true;
    hasChanges = true;
  }

  const passwordMatches = await passwordHasher.compare(adminPassword, admin.password_hash);
  if (!passwordMatches) {
    admin.password_hash = passwordHash;
    hasChanges = true;
  }

  if (hasChanges) {
    await teacherWriter.save(admin);
  }
}
