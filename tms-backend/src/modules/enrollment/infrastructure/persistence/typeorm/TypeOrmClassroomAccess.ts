import type { EntityManager } from 'typeorm';

import { Class } from '../../../../../entities/class.entity.js';
import { ClassSchedule } from '../../../../../entities/class-schedule.entity.js';
import { DiscordServer } from '../../../../../entities/discord-server.entity.js';
import { ClassStatus } from '../../../../../entities/enums.js';
import { StudentServiceError } from '../../../../../shared/errors/student.error.js';

export class TypeOrmClassroomAccess {
  constructor(private readonly manager: EntityManager) {}

  async ensureActiveClass(teacherId: number, classId: number): Promise<void> {
    const classEntity = await this.manager.getRepository(Class).findOneBy({
      id: classId,
      teacher_id: teacherId,
    });

    if (!classEntity) {
      throw new StudentServiceError('class not found', 404);
    }

    if (classEntity.status !== ClassStatus.Active) {
      throw new StudentServiceError('class is archived', 409);
    }

    const scheduleCount = await this.manager.getRepository(ClassSchedule).countBy({
      teacher_id: teacherId,
      class_id: classId,
    });
    if (scheduleCount === 0) {
      throw new StudentServiceError('class must have at least one schedule', 409);
    }

    const serverCount = await this.manager.getRepository(DiscordServer).countBy({
      teacher_id: teacherId,
      class_id: classId,
    });
    if (serverCount === 0) {
      throw new StudentServiceError('class must be bound to a Discord server', 409);
    }
  }
}
