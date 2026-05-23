import bcrypt from 'bcrypt';
import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';

import config from '../../../config.js';

export class BcryptPasswordHasher {
  hash(value: string): Promise<string> {
    return bcrypt.hash(value, config.auth.bcryptSaltRounds);
  }

  compare(value: string, hash: string): Promise<boolean> {
    return bcrypt.compare(value, hash);
  }
}

export class JwtAccessTokenSigner {
  sign(input: { sub: number; username: string }): string {
    const signOptions: SignOptions = {
      expiresIn: config.auth.jwtExpiresIn as SignOptions['expiresIn'],
      issuer: config.auth.jwtIssuer,
      audience: config.auth.jwtAudience,
    };

    return jwt.sign(input, config.auth.jwtSecret as Secret, signOptions);
  }
}
