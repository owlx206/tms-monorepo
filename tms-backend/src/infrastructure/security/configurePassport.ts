import passport from 'passport';
import { ExtractJwt, Strategy as JwtStrategy } from 'passport-jwt';

import config from '../../config.js';
import type { AuthTokenPayload } from '../../modules/account/contracts/types.js';
import { TypeOrmTeacherWriter } from '../../modules/account/infrastructure/persistence/typeorm/Writer.js';

const teacherWriter = new TypeOrmTeacherWriter();

export function configurePassport(): typeof passport {
  passport.use(
    new JwtStrategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: config.auth.jwtSecret,
        issuer: config.auth.jwtIssuer,
        audience: config.auth.jwtAudience,
      },
      async (payload: AuthTokenPayload, done) => {
        try {
          const teacher = await teacherWriter.findById(payload.sub);

          if (!teacher || !teacher.is_active) {
            return done(null, false);
          }

          return done(null, teacher);
        } catch (error) {
          return done(error, false);
        }
      },
    ),
  );

  return passport;
}
