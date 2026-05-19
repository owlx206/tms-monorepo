import type { RequestHandler } from 'express';
import { In, type EntityManager } from 'typeorm';

import { Class } from '../../../classroom/infrastructure/persistence/typeorm/entities/class.entity.js';
import { Session } from '../../../classroom/infrastructure/persistence/typeorm/entities/session.entity.js';
import { Student } from '../../../enrollment/infrastructure/persistence/typeorm/entities/student.entity.js';
import { FeeRecord } from '../../../finance/infrastructure/persistence/typeorm/entities/fee-record.entity.js';
import { Transaction } from '../../../finance/infrastructure/persistence/typeorm/entities/transaction.entity.js';
import { Teacher } from '../../infrastructure/persistence/typeorm/entities/teacher.entity.js';
import { Topic } from '../../../topic/infrastructure/persistence/typeorm/entities/topic.entity.js';
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

      const ownedCount = await getManager(req).getRepository(Class).countBy({
        id: In(classIds),
        teacher_id: teacherId,
      });

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

function authorizeOwnedEntity(
  entity: typeof Class | typeof FeeRecord | typeof Session | typeof Student | typeof Topic | typeof Transaction,
  resourceName: string,
  scope: ValidatedScope,
  selector: OwnershipIdSelector,
): RequestHandler {
  return async (req, res, next) => {
    try {
      const teacherId = getTeacherId(req);
      const ids = normalizeIds(selector(getValidatedScope(res, scope)));

      if (ids.length === 0) {
        next();
        return;
      }

      const ownedCount = await getManager(req).getRepository(entity).countBy({
        id: In(ids),
        teacher_id: teacherId,
      });

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
  return authorizeOwnedEntity(Student, 'student', 'params', (params) => (params as Record<string, unknown> | undefined)?.[fieldName] as number | undefined);
}

export function authorizeOwnedStudentBody(fieldName: string): RequestHandler {
  return authorizeOwnedEntity(Student, 'student', 'body', (body) => (body as Record<string, unknown> | undefined)?.[fieldName] as number | number[] | undefined);
}

export function authorizeOwnedStudentQuery(fieldName = 'student_id'): RequestHandler {
  return authorizeOwnedEntity(Student, 'student', 'query', (query) => (query as Record<string, unknown> | undefined)?.[fieldName] as number | undefined);
}

export function authorizeOwnedSessionParam(fieldName = 'sessionId'): RequestHandler {
  return authorizeOwnedEntity(Session, 'session', 'params', (params) => (params as Record<string, unknown> | undefined)?.[fieldName] as number | undefined);
}

export function authorizeOwnedTopicParam(fieldName = 'topicId'): RequestHandler {
  return authorizeOwnedEntity(Topic, 'topic', 'params', (params) => (params as Record<string, unknown> | undefined)?.[fieldName] as number | undefined);
}

export function authorizeOwnedTransactionParam(fieldName = 'transactionId'): RequestHandler {
  return authorizeOwnedEntity(Transaction, 'transaction', 'params', (params) => (params as Record<string, unknown> | undefined)?.[fieldName] as number | undefined);
}

export function authorizeOwnedFeeRecordParam(fieldName = 'feeRecordId'): RequestHandler {
  return authorizeOwnedEntity(FeeRecord, 'fee record', 'params', (params) => (params as Record<string, unknown> | undefined)?.[fieldName] as number | undefined);
}
