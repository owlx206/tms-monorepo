import type { ParsedRequestContext } from '../../../../infrastructure/http/request-context.js';
import type { Controller } from '../../../../shared/presentation/Controller.js';
import type { HttpRequest } from '../../../../shared/presentation/HttpRequest.js';
import type { HttpResponse } from '../../../../shared/presentation/HttpResponse.js';
import type {
  CreateTransactionInput,
  FeeRecordListFilters,
  FeeRecordStatus,
  IncomeReportFilters,
  StudentBalancesFilters,
  TransactionListFilters,
  TransactionType,
  UpdateFeeRecordStatusInput,
  UpdateTransactionInput,
} from '../../contracts/types.js';

type AuthenticatedRequest<Body = unknown, Params = unknown, Query = unknown> = HttpRequest<
  Body,
  Params,
  Query,
  unknown,
  ParsedRequestContext<Body, Params, Query> & { teacherId: number }
>;

type PaginatedResult = {
  items: unknown[];
  total: number;
  limit: number | null;
  offset: number;
};

export class ListTransactionsController implements Controller {
  constructor(
    private readonly transactionReader: {
      listTransactions(teacherId: number, filters: TransactionListFilters): Promise<PaginatedResult>;
    },
  ) {}

  async handle(request: AuthenticatedRequest<unknown, unknown, TransactionListFilters>): Promise<HttpResponse> {
    const result = await this.transactionReader.listTransactions(
      request.context.teacherId,
      request.query ?? {},
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
}

export class CreateTransactionController implements Controller {
  constructor(
    private readonly createTransaction: {
      execute(input: {
        teacherId: number;
        studentId: number;
        amount: string;
        type: TransactionType;
        notes?: string | null;
        recordedAt?: Date;
      }): Promise<unknown>;
    },
  ) {}

  async handle(request: AuthenticatedRequest<CreateTransactionInput>): Promise<HttpResponse> {
    const input = request.body;
    const transaction = await this.createTransaction.execute({
      teacherId: request.context.teacherId,
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
}

export class UpdateTransactionController implements Controller {
  constructor(
    private readonly updateTransaction: {
      execute(input: {
        teacherId: number;
        transactionId: number;
        studentId: number;
        amount: string;
        type: TransactionType;
        notes?: string | null;
        recordedAt?: Date;
      }): Promise<unknown>;
    },
  ) {}

  async handle(request: AuthenticatedRequest<UpdateTransactionInput, { id: number }>): Promise<HttpResponse> {
    const input = request.body;
    const transaction = await this.updateTransaction.execute({
      teacherId: request.context.teacherId,
      transactionId: request.context.params.id,
      studentId: input.student_id,
      amount: input.amount,
      type: input.type,
      notes: input.notes,
      recordedAt: input.recorded_at,
    });

    return {
      statusCode: 200,
      body: { transaction },
    };
  }
}

export class ListFeeRecordsController implements Controller {
  constructor(
    private readonly transactionReader: {
      listFeeRecords(teacherId: number, filters: FeeRecordListFilters): Promise<PaginatedResult>;
    },
  ) {}

  async handle(request: AuthenticatedRequest<unknown, unknown, FeeRecordListFilters>): Promise<HttpResponse> {
    const result = await this.transactionReader.listFeeRecords(
      request.context.teacherId,
      request.query ?? {},
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
}

export class UpdateFeeRecordStatusController implements Controller {
  constructor(
    private readonly updateFeeRecordStatus: {
      execute(input: {
        teacherId: number;
        feeRecordId: number;
        status: FeeRecordStatus;
      }): Promise<unknown>;
    },
  ) {}

  async handle(request: AuthenticatedRequest<UpdateFeeRecordStatusInput, { id: number }>): Promise<HttpResponse> {
    const feeRecord = await this.updateFeeRecordStatus.execute({
      teacherId: request.context.teacherId,
      feeRecordId: request.context.params.id,
      status: request.body.status,
    });

    return {
      statusCode: 200,
      body: { fee_record: feeRecord },
    };
  }
}

export class ListStudentBalancesController implements Controller {
  constructor(
    private readonly transactionReader: {
      listStudentBalances(teacherId: number, filters: StudentBalancesFilters): Promise<unknown[]>;
    },
  ) {}

  async handle(request: AuthenticatedRequest<unknown, unknown, StudentBalancesFilters>): Promise<HttpResponse> {
    const balances = await this.transactionReader.listStudentBalances(
      request.context.teacherId,
      request.query ?? {},
    );

    return {
      statusCode: 200,
      body: { balances },
    };
  }
}

export class GetFinanceSummaryController implements Controller {
  constructor(
    private readonly transactionReader: {
      getFinanceSummary(teacherId: number, filters: IncomeReportFilters): Promise<unknown>;
    },
  ) {}

  async handle(request: AuthenticatedRequest<unknown, unknown, IncomeReportFilters>): Promise<HttpResponse> {
    const summary = await this.transactionReader.getFinanceSummary(
      request.context.teacherId,
      request.query ?? {},
    );

    return {
      statusCode: 200,
      body: { summary },
    };
  }
}
