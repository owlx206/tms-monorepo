import type { EntityManager } from 'typeorm';

import { Transaction } from '../../../../../entities/transaction.entity.js';
import { TransactionType } from '../../../../../entities/enums.js';
import { parseAmountToBigInt } from '../../../../../shared/helpers/money.js';
import type { StudentBalanceSnapshot } from '../../../application/dto/StudentDto.js';
import { loadBalanceSnapshotForStudent } from './EnrollmentDataAccess.js';

export class TypeOrmArchiveFinanceService {
  constructor(private readonly manager: EntityManager) {}

  async settleForArchive(input: {
    teacherId: number;
    studentId: number;
    archivedAt: Date;
  }): Promise<StudentBalanceSnapshot> {
    const balanceSnapshot = await loadBalanceSnapshotForStudent(
      this.manager,
      input.teacherId,
      input.studentId,
    );
    const balanceAmount = parseAmountToBigInt(balanceSnapshot.balance);

    if (balanceAmount === 0n) {
      return balanceSnapshot;
    }

    const transaction = this.manager.getRepository(Transaction).create({
      teacher_id: input.teacherId,
      student_id: input.studentId,
      amount: (balanceAmount * -1n).toString(),
      type: balanceAmount < 0n ? TransactionType.Payment : TransactionType.Refund,
      notes: balanceAmount < 0n
        ? 'Tu dong ghi nhan khi da thu no va archive hoc sinh'
        : 'Tu dong ghi nhan khi da hoan tra va archive hoc sinh',
      recorded_at: input.archivedAt,
    });
    await this.manager.getRepository(Transaction).save(transaction);

    return loadBalanceSnapshotForStudent(this.manager, input.teacherId, input.studentId);
  }
}
