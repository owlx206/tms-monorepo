import { ServiceError } from '../../../../shared/errors/service.error.js';
import type { Controller } from '../../../../shared/presentation/Controller.js';
import type { HttpRequest } from '../../../../shared/presentation/HttpRequest.js';
import type { HttpResponse } from '../../../../shared/presentation/HttpResponse.js';
import type {
  CreateTransactionInput,
  FeeRecordListFilters,
  StudentBalancesFilters,
  TransactionListFilters,
  UpdateFeeRecordStatusInput,
  UpdateTransactionInput,
  IncomeReportFilters,
} from '../../application/dto/FinanceDto.js';
import { getIdParam, getTeacherId } from './request-context.js';

type FinanceControllerAction =
  | 'listTransactions'
  | 'createTransaction'
  | 'updateTransaction'
  | 'listTransactionAuditLogs'
  | 'listFeeRecords'
  | 'updateFeeRecordStatus'
  | 'listStudentBalances'
  | 'getFinanceSummary';

type FinanceControllerDependencies = {
  financeReader: {
    listTransactions(teacherId: number, filters: TransactionListFilters): Promise<{
      items: unknown[];
      total: number;
      limit: number | null;
      offset: number;
    }>;
    listTransactionAuditLogs(teacherId: number, transactionId: number): Promise<unknown[]>;
    listFeeRecords(teacherId: number, filters: FeeRecordListFilters): Promise<{
      items: unknown[];
      total: number;
      limit: number | null;
      offset: number;
    }>;
    listStudentBalances(teacherId: number, filters: StudentBalancesFilters): Promise<unknown[]>;
    getFinanceSummary(teacherId: number, filters: IncomeReportFilters): Promise<unknown>;
  };
  createTransaction: {
    execute(input: {
      teacherId: number;
      studentId: number;
      amount: string;
      type: import('../../../../entities/enums.js').TransactionType;
      notes?: string | null;
      recordedAt?: Date;
    }): Promise<unknown>;
  };
  updateTransaction: {
    execute(input: {
      teacherId: number;
      transactionId: number;
      studentId: number;
      amount: string;
      type: import('../../../../entities/enums.js').TransactionType;
      notes?: string | null;
      recordedAt?: Date;
      updateReason?: string | null;
    }): Promise<unknown>;
  };
  updateFeeRecordStatus: {
    execute(input: {
      teacherId: number;
      feeRecordId: number;
      status: import('../../../../entities/enums.js').FeeRecordStatus;
    }): Promise<unknown>;
  };
};

type FinanceHttpRequest = HttpRequest<
  CreateTransactionInput | UpdateTransactionInput | UpdateFeeRecordStatusInput,
  { id?: number },
  TransactionListFilters | FeeRecordListFilters | StudentBalancesFilters | IncomeReportFilters
>;

export class FinanceController implements Controller {
  constructor(
    private readonly action: FinanceControllerAction,
    private readonly dependencies: FinanceControllerDependencies,
  ) {}

  async handle(request: FinanceHttpRequest): Promise<HttpResponse> {
    try {
      switch (this.action) {
        case 'listTransactions':
          return this.listTransactions(request);
        case 'createTransaction':
          return this.createTransaction(request);
        case 'updateTransaction':
          return this.updateTransaction(request);
        case 'listTransactionAuditLogs':
          return this.listTransactionAuditLogs(request);
        case 'listFeeRecords':
          return this.listFeeRecords(request);
        case 'updateFeeRecordStatus':
          return this.updateFeeRecordStatus(request);
        case 'listStudentBalances':
          return this.listStudentBalances(request);
        case 'getFinanceSummary':
          return this.getFinanceSummary(request);
      }
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }

      throw error;
    }
  }

  private async listTransactions(request: FinanceHttpRequest): Promise<HttpResponse> {
    const result = await this.dependencies.financeReader.listTransactions(
      getTeacherId(request),
      (request.query ?? {}) as TransactionListFilters,
    );

    return {
      statusCode: 200,
      body: {
        transactions: result.items,
        pagination: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
        },
      },
    };
  }

  private async createTransaction(request: FinanceHttpRequest): Promise<HttpResponse> {
    const input = request.body as CreateTransactionInput;
    const transaction = await this.dependencies.createTransaction.execute({
      teacherId: getTeacherId(request),
      studentId: input.student_id,
      amount: input.amount,
      type: input.type,
      notes: input.notes,
      recordedAt: input.recorded_at,
    });

    return {
      statusCode: 201,
      body: { transaction },
    };
  }

  private async updateTransaction(request: FinanceHttpRequest): Promise<HttpResponse> {
    const input = request.body as UpdateTransactionInput;
    const transaction = await this.dependencies.updateTransaction.execute({
      teacherId: getTeacherId(request),
      transactionId: getIdParam(request),
      studentId: input.student_id,
      amount: input.amount,
      type: input.type,
      notes: input.notes,
      recordedAt: input.recorded_at,
      updateReason: input.update_reason,
    });

    return {
      statusCode: 200,
      body: { transaction },
    };
  }

  private async listTransactionAuditLogs(request: FinanceHttpRequest): Promise<HttpResponse> {
    const auditLogs = await this.dependencies.financeReader.listTransactionAuditLogs(
      getTeacherId(request),
      getIdParam(request),
    );

    return {
      statusCode: 200,
      body: { audit_logs: auditLogs },
    };
  }

  private async listFeeRecords(request: FinanceHttpRequest): Promise<HttpResponse> {
    const result = await this.dependencies.financeReader.listFeeRecords(
      getTeacherId(request),
      (request.query ?? {}) as FeeRecordListFilters,
    );

    return {
      statusCode: 200,
      body: {
        fee_records: result.items,
        pagination: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
        },
      },
    };
  }

  private async updateFeeRecordStatus(request: FinanceHttpRequest): Promise<HttpResponse> {
    const input = request.body as UpdateFeeRecordStatusInput;
    const feeRecord = await this.dependencies.updateFeeRecordStatus.execute({
      teacherId: getTeacherId(request),
      feeRecordId: getIdParam(request),
      status: input.status,
    });

    return {
      statusCode: 200,
      body: { fee_record: feeRecord },
    };
  }

  private async listStudentBalances(request: FinanceHttpRequest): Promise<HttpResponse> {
    const balances = await this.dependencies.financeReader.listStudentBalances(
      getTeacherId(request),
      (request.query ?? {}) as StudentBalancesFilters,
    );

    return {
      statusCode: 200,
      body: { balances },
    };
  }

  private async getFinanceSummary(request: FinanceHttpRequest): Promise<HttpResponse> {
    const summary = await this.dependencies.financeReader.getFinanceSummary(
      getTeacherId(request),
      (request.query ?? {}) as IncomeReportFilters,
    );

    return {
      statusCode: 200,
      body: { summary },
    };
  }
}
