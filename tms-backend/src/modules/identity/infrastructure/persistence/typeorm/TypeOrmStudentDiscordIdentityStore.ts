import { AppDataSource } from '../../../../../infrastructure/database/data-source.js';
import { DiscordServer } from '../../../../../entities/discord-server.entity.js';
import { Enrollment } from '../../../../../entities/enrollment.entity.js';
import { Student } from '../../../../../entities/student.entity.js';

export type StudentActiveDiscordServer = {
  student_id: number;
  active_class_id: number;
  discord_server_id: string;
};

export class TypeOrmStudentDiscordIdentityStore {
  async studentExists(teacherId: number, studentId: number): Promise<boolean> {
    return AppDataSource.getRepository(Student).existsBy({
      teacher_id: teacherId,
      id: studentId,
    });
  }

  async updateStudentDiscordAuthorization(input: {
    teacherId: number;
    studentId: number;
    discordUserId: string;
    discordUsername: string;
    accessToken: string;
    refreshToken: string;
    tokenExpiresAt: Date;
    authorizedAt: Date;
  }): Promise<void> {
    await AppDataSource.getRepository(Student).update(
      {
        teacher_id: input.teacherId,
        id: input.studentId,
      },
      {
        discord_user_id: input.discordUserId,
        discord_username: input.discordUsername,
        discord_access_token: input.accessToken,
        discord_refresh_token: input.refreshToken,
        discord_token_expires_at: input.tokenExpiresAt,
        discord_authorized_at: input.authorizedAt,
      },
    );
  }

  async getActiveDiscordServer(
    teacherId: number,
    studentId: number,
  ): Promise<StudentActiveDiscordServer | null> {
    const row = await AppDataSource.getRepository(Student)
      .createQueryBuilder('student')
      .innerJoin(
        Enrollment,
        'enrollment',
        'enrollment.teacher_id = student.teacher_id AND enrollment.student_id = student.id AND enrollment.unenrolled_at IS NULL',
      )
      .innerJoin(
        DiscordServer,
        'discord_server',
        'discord_server.teacher_id = student.teacher_id AND discord_server.class_id = enrollment.class_id',
      )
      .select('student.id', 'student_id')
      .addSelect('enrollment.class_id', 'active_class_id')
      .addSelect('discord_server.discord_server_id', 'discord_server_id')
      .where('student.teacher_id = :teacherId', { teacherId })
      .andWhere('student.id = :studentId', { studentId })
      .getRawOne<{
        student_id: number | string;
        active_class_id: number | string;
        discord_server_id: string;
      }>();

    if (!row) {
      return null;
    }

    return {
      student_id: Number(row.student_id),
      active_class_id: Number(row.active_class_id),
      discord_server_id: row.discord_server_id,
    };
  }
}
