import type { RequestHandler } from 'express';
import { type EntityManager } from 'typeorm';

import { TypeOrmClassReader } from '../../../classroom/infrastructure/persistence/typeorm/Reader.js';
import { TypeOrmStudentReader } from '../../../student/infrastructure/persistence/typeorm/Reader.js';
import { TypeOrmTransactionReader } from '../../../finance/infrastructure/persistence/typeorm/Reader.js';
import { Teacher } from '../../../../infrastructure/database/entities/teacher.entity.js';
import { HttpError } from '../../../../shared/errors/HttpError.js';

type ValidatedScope = 'body' | 'params' | 'query';
type ValidatedRequestData = Partial<Record<ValidatedScope, unknown>>;
type OwnershipIdSelector = (value: unknown) => number | number[] | null | undefined;

function getTeacherId(req: Parameters<RequestHandler>[0]): number {
  const teacher = req.user as Teacher | undefined;
  if (!teacher) {
    throw new HttpError('unauthorized', 401);
  }

  return teacher.id;
}

function getValidatedScope(res: Parameters<RequestHandler>[1], scope: ValidatedScope): unknown {
  const validated = res.locals.validated as ValidatedRequestData | undefined;
  return validated?.[scope];
}

function getManager(req: Parameters<RequestHandler>[0]): EntityManager {
  return req.context.db.manager;
}

function normalizeIds(value: number | number[] | null | undefined): number[] {
  if (value === null || value === undefined) {
    return [];
  }

  const values = Array.isArray(value) ? value : [value];
  return Array.from(new Set(values.filter((item) => Number.isInteger(item) && item > 0)));
}

export function authorizeOwnedClasses(
  scope: ValidatedScope,
  selector: OwnershipIdSelector,
): RequestHandler {
  return async (req, res, next) => {
    try {
      const teacherId = getTeacherId(req);
      const classIds = normalizeIds(selector(getValidatedScope(res, scope)));

      if (classIds.length === 0) {
        next();
        return;
      }

      const ownedCount = await new TypeOrmClassReader(getManager(req)).countOwnedClasses(teacherId, classIds);

      if (ownedCount !== classIds.length) {
        throw new HttpError('class not found', 404);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function authorizeOwnedClassParam(fieldName = 'classId'): RequestHandler {
  return authorizeOwnedClasses('params', (params) => (params as Record<string, unknown> | undefined)?.[fieldName] as number | undefined);
}

export function authorizeOwnedClassBody(fieldName: string): RequestHandler {
  return authorizeOwnedClasses('body', (body) => (body as Record<string, unknown> | undefined)?.[fieldName] as number | undefined);
}

export function authorizeOwnedClassQuery(fieldName = 'class_id'): RequestHandler {
  return authorizeOwnedClasses('query', (query) => (query as Record<string, unknown> | undefined)?.[fieldName] as number | undefined);
}

function authorizeOwnedResource(
  resourceName: string,
  scope: ValidatedScope,
  selector: OwnershipIdSelector,
  counter: (manager: EntityManager, teacherId: number, ids: number[]) => Promise<number>,
): RequestHandler {
  return async (req, res, next) => {
    try {
      const teacherId = getTeacherId(req);
      const ids = normalizeIds(selector(getValidatedScope(res, scope)));

      if (ids.length === 0) {
        next();
        return;
      }

      const ownedCount = await counter(getManager(req), teacherId, ids);

      if (ownedCount !== ids.length) {
        throw new HttpError(`${resourceName} not found`, 404);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function authorizeOwnedStudentParam(fieldName = 'studentId'): RequestHandler {
  return authorizeOwnedResource(
    'student',
    'params',
    (params) => (params as Record<string, unknown> | undefined)?.[fieldName] as number | undefined,
    (manager, teacherId, ids) => new TypeOrmStudentReader(manager).countOwnedStudents(teacherId, ids),
  );
}

export function authorizeOwnedStudentBody(fieldName: string): RequestHandler {
  return authorizeOwnedResource(
    'student',
    'body',
    (body) => (body as Record<string, unknown> | undefined)?.[fieldName] as number | number[] | undefined,
    (manager, teacherId, ids) => new TypeOrmStudentReader(manager).countOwnedStudents(teacherId, ids),
  );
}

export function authorizeOwnedStudentQuery(fieldName = 'student_id'): RequestHandler {
  return authorizeOwnedResource(
    'student',
    'query',
    (query) => (query as Record<string, unknown> | undefined)?.[fieldName] as number | undefined,
    (manager, teacherId, ids) => new TypeOrmStudentReader(manager).countOwnedStudents(teacherId, ids),
  );
}

export function authorizeOwnedSessionParam(fieldName = 'sessionId'): RequestHandler {
  return authorizeOwnedResource(
    'session',
    'params',
    (params) => (params as Record<string, unknown> | undefined)?.[fieldName] as number | undefined,
    (manager, teacherId, ids) => new TypeOrmClassReader(manager).countOwnedSessions(teacherId, ids),
  );
}

export function authorizeOwnedTopicParam(fieldName = 'topicId'): RequestHandler {
  return authorizeOwnedResource(
    'topic',
    'params',
    (params) => (params as Record<string, unknown> | undefined)?.[fieldName] as number | undefined,
    (manager, teacherId, ids) => new TypeOrmClassReader(manager).countOwnedGyms(teacherId, ids),
  );
}

export function authorizeOwnedGymParam(fieldName = 'gymId'): RequestHandler {
  return authorizeOwnedResource(
    'gym',
    'params',
    (params) => (params as Record<string, unknown> | undefined)?.[fieldName] as number | undefined,
    (manager, teacherId, ids) => new TypeOrmClassReader(manager).countOwnedGyms(teacherId, ids),
  );
}

export function authorizeOwnedTransactionParam(fieldName = 'transactionId'): RequestHandler {
  return authorizeOwnedResource(
    'transaction',
    'params',
    (params) => (params as Record<string, unknown> | undefined)?.[fieldName] as number | undefined,
    (manager, teacherId, ids) => new TypeOrmTransactionReader(manager).countOwnedTransactions(teacherId, ids),
  );
}

export function authorizeOwnedFeeRecordParam(fieldName = 'feeRecordId'): RequestHandler {
  return authorizeOwnedResource(
    'fee record',
    'params',
    (params) => (params as Record<string, unknown> | undefined)?.[fieldName] as number | undefined,
    (manager, teacherId, ids) => new TypeOrmTransactionReader(manager).countOwnedFeeRecords(teacherId, ids),
  );
}
