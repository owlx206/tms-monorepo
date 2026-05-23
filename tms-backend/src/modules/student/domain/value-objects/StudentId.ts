import { ValueObject } from '../../../../shared/domain/ValueObject.js';

type StudentIdProps = {
  value: number;
};

export class StudentId extends ValueObject<StudentIdProps> {
  private constructor(props: StudentIdProps) {
    super(props);
  }

  static from(value: number): StudentId {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error('invalid_student_id');
    }

    return new StudentId({ value });
  }

  get value(): number {
    return this.props.value;
  }
}
