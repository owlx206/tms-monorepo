import { DomainError } from '../../../../shared/domain/DomainError.js';
import { StudentServiceError } from '../../../../shared/errors/student.error.js';
import type { Controller } from '../../../../shared/presentation/Controller.js';
import type { HttpRequest } from '../../../../shared/presentation/HttpRequest.js';
import type { HttpResponse } from '../../../../shared/presentation/HttpResponse.js';
import type {
  ArchivePendingStudentInput,
  BulkTransferStudentsInput,
  BulkWithdrawStudentsInput,
  CreateStudentInput,
  ReinstateStudentInput,
  StudentListFilters,
  StudentSummary,
  TransferStudentInput,
  UpdateStudentInput,
  WithdrawStudentInput,
} from '../../application/dto/StudentDto.js';
import { GetStudentByIdUseCase } from '../../application/queries/GetStudentByIdUseCase.js';
import { ListStudentsUseCase } from '../../application/queries/ListStudentsUseCase.js';
import { getStudentId, getTeacherId } from './request-context.js';

type StudentControllerDependencies = {
  listStudents: ListStudentsUseCase;
  getStudentById: GetStudentByIdUseCase;
  createStudent: {
    execute(input: {
      teacherId: number;
      fullName: string;
      classId: number;
      codeforcesHandle: string;
      phone: string | null;
      note: string | null;
      enrolledAt: Date;
    }): Promise<StudentSummary>;
  };
  updateStudent: {
    execute(input: {
      teacherId: number;
      studentId: number;
      fullName?: string;
      codeforcesHandle?: string;
      phone?: string | null;
      note?: string | null;
    }): Promise<StudentSummary>;
  };
  inviteStudentToCurrentClass: {
    execute(input: {
      teacherId: number;
      studentId: number;
    }): Promise<{ sent: boolean; reason: string | null }>;
  };
  transferStudent: {
    execute(input: {
      teacherId: number;
      studentId: number;
      toClassId: number;
      transferredAt: Date;
    }): Promise<StudentSummary>;
  };
  bulkTransferStudents: {
    execute(input: {
      teacherId: number;
      studentIds: number[];
      toClassId: number;
      transferredAt: Date;
    }): Promise<StudentSummary[]>;
  };
  withdrawStudent: {
    execute(input: {
      teacherId: number;
      studentId: number;
      withdrawnAt: Date;
    }): Promise<StudentSummary>;
  };
  bulkWithdrawStudents: {
    execute(input: {
      teacherId: number;
      studentIds: number[];
      withdrawnAt: Date;
    }): Promise<StudentSummary[]>;
  };
  reinstateStudent: {
    execute(input: {
      teacherId: number;
      studentId: number;
      classId: number;
      enrolledAt: Date;
    }): Promise<StudentSummary>;
  };
  archivePendingStudent: {
    execute(input: {
      teacherId: number;
      studentId: number;
      archivedAt: Date;
      settleFinance: boolean;
    }): Promise<StudentSummary>;
  };
};

type StudentControllerAction =
  | 'listStudents'
  | 'getStudentById'
  | 'createStudent'
  | 'updateStudent'
  | 'inviteStudentToCurrentClass'
  | 'transferStudent'
  | 'bulkTransferStudents'
  | 'withdrawStudent'
  | 'bulkWithdrawStudents'
  | 'reinstateStudent'
  | 'archivePendingStudent';

type StudentHttpRequest = HttpRequest<
  | CreateStudentInput
  | UpdateStudentInput
  | TransferStudentInput
  | BulkTransferStudentsInput
  | WithdrawStudentInput
  | BulkWithdrawStudentsInput
  | ReinstateStudentInput
  | ArchivePendingStudentInput,
  { studentId?: number },
  StudentListFilters
>;

export class StudentController implements Controller {
  constructor(
    private readonly action: StudentControllerAction,
    private readonly dependencies: StudentControllerDependencies,
  ) {}

  async handle(request: StudentHttpRequest): Promise<HttpResponse> {
    return this.executeWithDomainErrorMapping(async () => {
      switch (this.action) {
        case 'listStudents':
          return this.listStudents(request);
        case 'getStudentById':
          return this.getStudentById(request);
        case 'createStudent':
          return this.createStudent(request);
        case 'updateStudent':
          return this.updateStudent(request);
        case 'inviteStudentToCurrentClass':
          return this.inviteStudentToCurrentClass(request);
        case 'transferStudent':
          return this.transferStudent(request);
        case 'bulkTransferStudents':
          return this.bulkTransferStudents(request);
        case 'withdrawStudent':
          return this.withdrawStudent(request);
        case 'bulkWithdrawStudents':
          return this.bulkWithdrawStudents(request);
        case 'reinstateStudent':
          return this.reinstateStudent(request);
        case 'archivePendingStudent':
          return this.archivePendingStudent(request);
      }
    });
  }

  private async listStudents(request: StudentHttpRequest): Promise<HttpResponse> {
    const students = await this.dependencies.listStudents.execute(
      getTeacherId(request),
      request.query ?? {},
    );

    return {
      statusCode: 200,
      body: { students },
    };
  }

  private async getStudentById(request: StudentHttpRequest): Promise<HttpResponse> {
    const student = await this.dependencies.getStudentById.execute(
      getTeacherId(request),
      getStudentId(request),
    );

    return {
      statusCode: 200,
      body: { student },
    };
  }

  private async createStudent(request: StudentHttpRequest): Promise<HttpResponse> {
    const input = request.body as CreateStudentInput;
    const student = await this.dependencies.createStudent.execute({
      teacherId: getTeacherId(request),
      fullName: input.full_name,
      classId: input.class_id,
      codeforcesHandle: input.codeforces_handle,
      phone: input.phone,
      note: input.note,
      enrolledAt: input.enrolled_at,
    });

    return {
      statusCode: 201,
      body: { student },
    };
  }

  private async updateStudent(request: StudentHttpRequest): Promise<HttpResponse> {
    const input = request.body as UpdateStudentInput;
    const student = await this.dependencies.updateStudent.execute({
      teacherId: getTeacherId(request),
      studentId: getStudentId(request),
      fullName: input.full_name,
      codeforcesHandle: input.codeforces_handle,
      phone: input.phone,
      note: input.note,
    });

    return {
      statusCode: 200,
      body: { student },
    };
  }

  private async inviteStudentToCurrentClass(request: StudentHttpRequest): Promise<HttpResponse> {
    const result = await this.dependencies.inviteStudentToCurrentClass.execute({
      teacherId: getTeacherId(request),
      studentId: getStudentId(request),
    });

    return {
      statusCode: 200,
      body: result,
    };
  }

  private async transferStudent(request: StudentHttpRequest): Promise<HttpResponse> {
    const input = request.body as TransferStudentInput;
    const teacherId = getTeacherId(request);
    const studentId = getStudentId(request);
    const student = await this.dependencies.transferStudent.execute({
      teacherId,
      studentId,
      toClassId: input.to_class_id,
      transferredAt: input.transferred_at,
    });

    return {
      statusCode: 200,
      body: { student },
    };
  }

  private async bulkTransferStudents(request: StudentHttpRequest): Promise<HttpResponse> {
    const input = request.body as BulkTransferStudentsInput;
    const students = await this.dependencies.bulkTransferStudents.execute({
      teacherId: getTeacherId(request),
      studentIds: input.student_ids,
      toClassId: input.to_class_id,
      transferredAt: input.transferred_at,
    });

    return {
      statusCode: 200,
      body: { students },
    };
  }

  private async withdrawStudent(request: StudentHttpRequest): Promise<HttpResponse> {
    const input = request.body as WithdrawStudentInput;
    const teacherId = getTeacherId(request);
    const studentId = getStudentId(request);
    const student = await this.dependencies.withdrawStudent.execute({
      teacherId,
      studentId,
      withdrawnAt: input.withdrawn_at,
    });

    return {
      statusCode: 200,
      body: { student },
    };
  }

  private async bulkWithdrawStudents(request: StudentHttpRequest): Promise<HttpResponse> {
    const input = request.body as BulkWithdrawStudentsInput;
    const students = await this.dependencies.bulkWithdrawStudents.execute({
      teacherId: getTeacherId(request),
      studentIds: input.student_ids,
      withdrawnAt: input.withdrawn_at,
    });

    return {
      statusCode: 200,
      body: { students },
    };
  }

  private async reinstateStudent(request: StudentHttpRequest): Promise<HttpResponse> {
    const input = request.body as ReinstateStudentInput;
    const student = await this.dependencies.reinstateStudent.execute({
      teacherId: getTeacherId(request),
      studentId: getStudentId(request),
      classId: input.class_id,
      enrolledAt: input.enrolled_at,
    });

    return {
      statusCode: 200,
      body: { student },
    };
  }

  private async archivePendingStudent(request: StudentHttpRequest): Promise<HttpResponse> {
    const input = request.body as ArchivePendingStudentInput;
    const student = await this.dependencies.archivePendingStudent.execute({
      teacherId: getTeacherId(request),
      studentId: getStudentId(request),
      archivedAt: input.archived_at,
      settleFinance: input.settle_finance,
    });

    return {
      statusCode: 200,
      body: { student },
    };
  }

  private async executeWithDomainErrorMapping<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof DomainError) {
        throw new StudentServiceError(error.message, mapDomainErrorStatus(error.code));
      }

      throw error;
    }
  }
}

function mapDomainErrorStatus(code: string): number {
  switch (code) {
    case 'codeforces_handle_already_exists':
      return 409;
    case 'student_full_name_required':
    case 'codeforces_handle_required':
    case 'codeforces_handle_too_long':
    case 'invalid_class_id':
    case 'transferred_at_must_be_later_than_current_enrollment_start_time':
    case 'withdrawn_at_must_be_later_than_current_enrollment_start_time':
    case 'enrolled_at_must_be_later_than_archived_at':
    case 'archived_at_must_be_later_than_current_enrollment_start_time':
    case 'unenrolled_at_must_be_later_than_enrolled_at':
      return 400;
    case 'student_not_found':
      return 404;
    case 'student_already_enrolled_in_class':
    case 'student_already_has_active_enrollment':
    case 'student_balance_must_be_zero_before_archive':
    case 'student_has_no_active_enrollment':
    case 'student_is_not_active':
    case 'student_is_not_archived':
    case 'student_is_not_pending_archive':
      return 409;
    default:
      return 400;
  }
}
