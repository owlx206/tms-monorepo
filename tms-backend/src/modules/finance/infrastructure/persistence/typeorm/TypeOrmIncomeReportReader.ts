import { In, type EntityManager } from 'typeorm';

import { AppDataSource } from '../../../../../infrastructure/database/data-source.js';
import { Enrollment } from '../../../../../entities/enrollment.entity.js';
import { Class } from '../../../../../entities/class.entity.js';
import { TypeOrmTransactionReader } from './TypeOrmTransactionReader.js';

export class TypeOrmIncomeReportReader {
  private readonly financeReader: TypeOrmTransactionReader;

  constructor(private readonly manager: EntityManager = AppDataSource.manager) {
    this.financeReader = new TypeOrmTransactionReader(manager);
  }

  private findReportClasses(teacherId: number, classIds?: number[]) {
    return this.manager.getRepository(Class).find({
      where: {
        teacher_id: teacherId,
        ...(classIds && classIds.length > 0 ? { id: In(classIds) } : {}),
      },
    });
  }

  private async countActiveEnrollmentsByClass(teacherId: number, classIds: number[]) {
    const rows = await this.manager.getRepository(Enrollment)
      .createQueryBuilder('enrollment')
      .select('enrollment.class_id', 'class_id')
      .addSelect('COUNT(*)', 'student_count')
      .where('enrollment.teacher_id = :teacherId', { teacherId })
      .andWhere('enrollment.unenrolled_at IS NULL')
      .andWhere(classIds.length > 0 ? 'enrollment.class_id IN (:...classIds)' : '1=1', { classIds })
      .groupBy('enrollment.class_id')
      .getRawMany<{ class_id: string; student_count: string }>();

    return new Map(rows.map((row) => [Number(row.class_id), Number(row.student_count)]));
  }

  async getIncomeReport(
    teacherId: number,
    filters: {
      from?: Date;
      to?: Date;
      class_ids?: number[];
      include_unpaid?: boolean;
    },
  ) {
    const summary = await this.financeReader.getFinanceSummary(teacherId, filters);
    const activeClasses = await this.findReportClasses(teacherId, filters.class_ids);
    const studentCountsByClass = await this.countActiveEnrollmentsByClass(
      teacherId,
      activeClasses.map((classItem) => classItem.id),
    );

    return {
      summary,
      class_stats: activeClasses.map((classItem) => ({
        class_id: classItem.id,
        class_name: classItem.name,
        student_count: studentCountsByClass.get(classItem.id) ?? 0,
        fee_per_session: classItem.fee_per_session,
      })),
    };
  }
}
