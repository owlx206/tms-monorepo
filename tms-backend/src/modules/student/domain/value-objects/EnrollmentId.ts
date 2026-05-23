import { ValueObject } from '../../../../shared/domain/ValueObject.js';

type EnrollmentIdProps = {
  value: number;
};

export class EnrollmentId extends ValueObject<EnrollmentIdProps> {
  private constructor(props: EnrollmentIdProps) {
    super(props);
  }

  static from(value: number): EnrollmentId {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error('invalid_enrollment_id');
    }

    return new EnrollmentId({ value });
  }

  get value(): number {
    return this.props.value;
  }
}
