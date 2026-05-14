import bcrypt from 'bcrypt';

import config from '../../../../config.js';

export class BcryptPasswordHasher {
  hash(value: string): Promise<string> {
    return bcrypt.hash(value, config.auth.bcryptSaltRounds);
  }

  compare(value: string, hash: string): Promise<boolean> {
    return bcrypt.compare(value, hash);
  }
}
