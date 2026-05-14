import { ServiceError } from '../../../../shared/errors/service.error.js';

type FinanceSummaryFilters = {
  from?: Date;
  to?: Date;
  class_ids?: number[];
  include_unpaid?: boolean;
};

type FinanceSummary = {
  total_payments: string;
  total_refunds: string;
  total_active_fees: string;
  unpaid_total: string;
  net_revenue: string;
  projected_revenue: string;
};

type FinanceReader = {
  getFinanceSummary(teacherId: number, filters: FinanceSummaryFilters): Promise<FinanceSummary>;
};

export class GetFinanceSummaryUseCase {
  constructor(private readonly finance: FinanceReader) {}

  execute(teacherId: number, filters: FinanceSummaryFilters): Promise<FinanceSummary> {
    if (filters.from && filters.to && filters.from > filters.to) {
      throw new ServiceError('from must be earlier than or equal to to', 400);
    }

    return this.finance.getFinanceSummary(teacherId, filters);
  }
}
