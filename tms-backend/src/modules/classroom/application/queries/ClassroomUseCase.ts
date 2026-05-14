import { ClassServiceError } from '../../../../shared/errors/class.error.js';
import type { ClassDetails, ClassListFilters, ClassSummary } from '../dto/ClassDto.js';

type ClassReader = {
  listClasses(teacherId: number, filters: ClassListFilters): Promise<ClassSummary[]>;
  getClassById(teacherId: number, classId: number): Promise<ClassSummary | null>;
  getClassDetails(teacherId: number, classId: number): Promise<ClassDetails | null>;
};

export class ClassroomUseCase {
  constructor(private readonly classes: ClassReader) {}

  list(teacherId: number, filters: ClassListFilters): Promise<ClassSummary[]> {
    return this.classes.listClasses(teacherId, filters);
  }

  async getById(teacherId: number, classId: number): Promise<ClassSummary> {
    const classEntity = await this.classes.getClassById(teacherId, classId);

    if (!classEntity) {
      throw new ClassServiceError('class not found', 404);
    }

    return classEntity;
  }

  async getDetails(teacherId: number, classId: number): Promise<ClassDetails> {
    const details = await this.classes.getClassDetails(teacherId, classId);

    if (!details) {
      throw new ClassServiceError('class not found', 404);
    }

    return details;
  }
}
