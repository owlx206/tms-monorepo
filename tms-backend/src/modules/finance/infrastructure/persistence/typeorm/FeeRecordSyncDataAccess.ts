import { In, type EntityManager } from 'typeorm';

import { FeeRecordStatus } from '../../../../../entities/enums.js';
import { FeeRecord } from '../../../../../entities/fee-record.entity.js';

export function findFeeRecordForAttendance(
  manager: EntityManager,
  teacherId: number,
  sessionId: number,
  studentId: number,
): Promise<FeeRecord | null> {
  return manager.getRepository(FeeRecord).findOneBy({
    teacher_id: teacherId,
    session_id: sessionId,
    student_id: studentId,
  });
}

export function createFeeRecord(
  manager: EntityManager,
  input: {
    teacher_id: number;
    student_id: number;
    session_id: number;
    enrollment_id: number;
    amount: string;
  },
): FeeRecord {
  const feeRecord = manager.getRepository(FeeRecord).create({
    teacher_id: input.teacher_id,
    student_id: input.student_id,
    session_id: input.session_id,
  });
  feeRecord.activate({
    enrollment_id: input.enrollment_id,
    amount: input.amount,
  });

  return feeRecord;
}

export function saveFeeRecord(
  manager: EntityManager,
  feeRecord: FeeRecord,
): Promise<FeeRecord> {
  return manager.getRepository(FeeRecord).save(feeRecord);
}

export function findActiveFeeRecordsBySessionIds(
  manager: EntityManager,
  teacherId: number,
  sessionIds: number[],
): Promise<FeeRecord[]> {
  if (sessionIds.length === 0) {
    return Promise.resolve([]);
  }

  return manager.getRepository(FeeRecord).find({
    where: {
      teacher_id: teacherId,
      session_id: In(sessionIds),
      status: FeeRecordStatus.Active,
    },
  });
}

export function saveFeeRecords(
  manager: EntityManager,
  feeRecords: FeeRecord[],
): Promise<FeeRecord[]> {
  return manager.getRepository(FeeRecord).save(feeRecords);
}
