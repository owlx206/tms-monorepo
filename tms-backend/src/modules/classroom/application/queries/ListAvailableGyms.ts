import type { GymListQuery, ListGymsReader } from '../../contracts/types.js';

export class ListAvailableGyms {
  constructor(private readonly gyms: ListGymsReader) {}

  async execute(teacherId: number, filters: GymListQuery) {
    const gyms = await this.gyms.listGymsForTeacher(teacherId, filters);

    return gyms
      .map((gym) => ({
        ...gym,
        status: 'active' as const,
      }))
      .filter((gym) => !filters.status || gym.status === filters.status);
  }
}
