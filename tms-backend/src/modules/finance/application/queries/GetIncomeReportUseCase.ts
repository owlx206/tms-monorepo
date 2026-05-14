type IncomeReportReader = {
  findReportClasses(
    teacherId: number,
    classIds?: number[],
  ): Promise<Array<{ id: number; name: string; fee_per_session: string }>>;
  countActiveEnrollmentsByClass(teacherId: number, classIds: number[]): Promise<Map<number, number>>;
  getFinanceSummary(
    teacherId: number,
    filters: {
      from?: Date;
      to?: Date;
      class_ids?: number[];
      include_unpaid?: boolean;
    },
  ): Promise<{
    total_payments: string;
    total_refunds: string;
    total_active_fees: string;
    unpaid_total: string;
    net_revenue: string;
    projected_revenue: string;
  }>;
};

export class GetIncomeReportUseCase {
  constructor(private readonly reader: IncomeReportReader) {}

  async execute(
    teacherId: number,
    filters: {
      from?: Date;
      to?: Date;
      class_ids?: number[];
      include_unpaid?: boolean;
    },
  ) {
    const summary = await this.reader.getFinanceSummary(teacherId, filters);
    const activeClasses = await this.reader.findReportClasses(
      teacherId,
      filters.class_ids,
    );
    const studentCountsByClass = await this.reader.countActiveEnrollmentsByClass(
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
