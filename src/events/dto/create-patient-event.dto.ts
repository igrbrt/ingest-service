import { IsISO8601, IsNotEmpty, IsObject, IsString } from 'class-validator';

export class CreatePatientEventDto {
  @IsString()
  @IsNotEmpty()
  patientId!: string;

  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsObject()
  data!: Record<string, unknown>;

  @IsISO8601()
  ts!: string;
}
