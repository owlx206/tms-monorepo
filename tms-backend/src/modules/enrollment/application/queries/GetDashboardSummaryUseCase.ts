import { parseAmountToBigInt } from '../../../finance/domain/Money.js';
import { EnrollmentStudentStatus } from '../../contracts/types.js';
import type { DashboardReader } from '../../contracts/types.js';
import type { TypeOrmFinanceReportReader } from '../../infrastructure/persistence/typeorm/Reader.js';

export class GetDashboardSummaryUseCase {
  constructor(
    private readonly reports: DashboardReader,
    private readonly finance: TypeOrmFinanceReportReader,
  ) {}

  async execute(teacherId: number) {
    const [activeStudents, activeClasses] = await Promise.all([
      this.reports.countActiveStudents(teacherId),
      this.reports.countActiveClasses(teacherId),
    ]);

    const balances = await this.finance.listStudentBalances({
      teacherId,
      status: EnrollmentStudentStatus.Active,
      includePendingArchive: false,
    });

    const totalDebt = balances.reduce((sum, balance) => {
      const amount = parseAmountToBigInt(balance.balance);
      if (amount < 0n) {
        return sum + amount * -1n;
      }

      return sum;
    }, 0n);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const financeSummary = await this.finance.getFinanceSummary({
      teacherId,
      from: monthStart,
      to: new Date(),
      includeUnpaid: false,
    });

    return {
      active_students: activeStudents,
      active_classes: activeClasses,
      total_debt: totalDebt.toString(),
      monthly_revenue: financeSummary.net_revenue,
    };
  }
}
