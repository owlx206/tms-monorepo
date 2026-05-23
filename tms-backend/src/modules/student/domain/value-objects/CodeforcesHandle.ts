import { DomainError } from '../../../../shared/domain/DomainError.js';
import { ValueObject } from '../../../../shared/domain/ValueObject.js';

type CodeforcesHandleProps = {
  value: string;
};

export class CodeforcesHandle extends ValueObject<CodeforcesHandleProps> {
  private constructor(props: CodeforcesHandleProps) {
    super(props);
  }

  static fromNullable(value: string | null | undefined): CodeforcesHandle | null {
    if (!value) {
      return null;
    }

    const normalized = value.trim();
    if (normalized.length === 0) {
      return null;
    }

    if (normalized.length > 100) {
      throw new DomainError('codeforces_handle_too_long');
    }

    return new CodeforcesHandle({ value: normalized });
  }

  get value(): string {
    return this.props.value;
  }
}
