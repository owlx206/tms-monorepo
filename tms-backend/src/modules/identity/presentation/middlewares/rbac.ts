import type { RequestHandler } from 'express';

import { TeacherRole } from '../../contracts/types.js';
import { roleForTeacher } from '../../application/mappers/AuthMapper.js';
import { Teacher } from '../../../../infrastructure/database/entities/teacher.entity.js';

export function requireRoles(allowedRoles: TeacherRole[]): RequestHandler {
  return (req, res, next) => {
    const teacher = req.user as Teacher | undefined;

    if (!teacher) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    if (!teacher.is_active) {
      res.status(403).json({ error: 'account is inactive' });
      return;
    }

    if (!allowedRoles.includes(roleForTeacher(teacher))) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    next();
  };
}
