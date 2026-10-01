import { Injectable } from '@nestjs/common';
import { Prisma, type PatientEvent } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class PatientEventRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(args: Prisma.PatientEventCreateArgs): Promise<PatientEvent> {
    return this.prisma.patientEvent.create(args);
  }

  async findUnique(
    args: Prisma.PatientEventFindUniqueArgs,
  ): Promise<PatientEvent | null> {
    return this.prisma.patientEvent.findUnique(args);
  }

  async findFirst(
    args: Prisma.PatientEventFindFirstArgs,
  ): Promise<PatientEvent | null> {
    return this.prisma.patientEvent.findFirst(args);
  }

  async findMany(args: Prisma.PatientEventFindManyArgs): Promise<PatientEvent[]> {
    return this.prisma.patientEvent.findMany(args);
  }

  async update(args: Prisma.PatientEventUpdateArgs): Promise<PatientEvent> {
    return this.prisma.patientEvent.update(args);
  }

  async updateMany(args: Prisma.PatientEventUpdateManyArgs): Promise<number> {
    const result = await this.prisma.patientEvent.updateMany(args);
    return result.count;
  }

  async ping(): Promise<void> {
    await this.prisma.$runCommandRaw({ ping: 1 });
  }
}
