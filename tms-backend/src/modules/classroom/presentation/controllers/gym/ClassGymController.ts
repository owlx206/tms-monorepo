import type { Controller } from '../../../../../shared/presentation/Controller.js';
import type { HttpRequest } from '../../../../../shared/presentation/HttpRequest.js';
import type { HttpResponse } from '../../../../../shared/presentation/HttpResponse.js';
import type { ParsedRequestContext } from '../../../../../infrastructure/http/request-context.js';
import type {
  AddGymProblemInput,
  BindClassGymInput,
  GymListQuery,
  UpsertGymStandingInput,
} from '../../../contracts/types.js';

type ClassGymControllerAction =
  | 'listAvailableClassGyms'
  | 'bindClassGym'
  | 'unbindClassGym'
  | 'addGymProblem'
  | 'upsertGymStanding';

type ClassGymControllerDependencies = {
  listAvailableClassGyms(teacherId: number, classId: number, filters: GymListQuery): Promise<unknown>;
  bindClassGym(teacherId: number, classId: number, input: BindClassGymInput): Promise<unknown>;
  unbindClassGym(teacherId: number, classId: number, gymId: number): Promise<unknown>;
  addGymProblem(teacherId: number, classId: number, gymId: number, input: AddGymProblemInput): Promise<unknown>;
  upsertGymStanding(
    teacherId: number,
    classId: number,
    gymId: number,
    input: UpsertGymStandingInput,
  ): Promise<unknown>;
};

type ClassGymHttpRequest = HttpRequest<
  AddGymProblemInput | BindClassGymInput | UpsertGymStandingInput,
  { classId: number; gymId: number },
  GymListQuery,
  unknown,
  ParsedRequestContext<
    AddGymProblemInput | BindClassGymInput | UpsertGymStandingInput,
    { classId: number; gymId: number },
    GymListQuery
  > & { teacherId: number }
>;

export class ClassGymController implements Controller {
  constructor(
    private readonly action: ClassGymControllerAction,
    private readonly dependencies: ClassGymControllerDependencies,
  ) {}

  async handle(request: ClassGymHttpRequest): Promise<HttpResponse> {
    switch (this.action) {
      case 'listAvailableClassGyms':
        return this.listAvailableClassGyms(request);
      case 'bindClassGym':
        return this.bindClassGym(request);
      case 'unbindClassGym':
        return this.unbindClassGym(request);
      case 'addGymProblem':
        return this.addGymProblem(request);
      case 'upsertGymStanding':
        return this.upsertGymStanding(request);
    }
  }

  private async listAvailableClassGyms(request: ClassGymHttpRequest): Promise<HttpResponse> {
    const gyms = await this.dependencies.listAvailableClassGyms(
      request.context.teacherId,
      request.context.params.classId,
      { ...((request.query ?? {}) as GymListQuery), class_id: null },
    );

    return { statusCode: 200, body: { gyms } };
  }

  private async bindClassGym(request: ClassGymHttpRequest): Promise<HttpResponse> {
    const gym = await this.dependencies.bindClassGym(
      request.context.teacherId,
      request.context.params.classId,
      request.body as BindClassGymInput,
    );

    return { statusCode: 201, body: { gym } };
  }

  private async unbindClassGym(request: ClassGymHttpRequest): Promise<HttpResponse> {
    const gym = await this.dependencies.unbindClassGym(
      request.context.teacherId,
      request.context.params.classId,
      request.context.params.gymId,
    );

    return { statusCode: 200, body: { gym } };
  }

  private async addGymProblem(request: ClassGymHttpRequest): Promise<HttpResponse> {
    const problem = await this.dependencies.addGymProblem(
      request.context.teacherId,
      request.context.params.classId,
      request.context.params.gymId,
      request.body as AddGymProblemInput,
    );

    return { statusCode: 201, body: { problem } };
  }

  private async upsertGymStanding(request: ClassGymHttpRequest): Promise<HttpResponse> {
    const standing = await this.dependencies.upsertGymStanding(
      request.context.teacherId,
      request.context.params.classId,
      request.context.params.gymId,
      request.body as UpsertGymStandingInput,
    );

    return { statusCode: 200, body: { standing } };
  }
}
