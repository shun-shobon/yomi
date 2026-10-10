export type TranslateErrorKind =
  | "signed_out"
  | "no_model"
  | "usage_limit"
  | "not_eligible"
  | "extension_reloaded"
  | "unavailable"
  | "other";

/** runtime messaging を通すため plain object */
export interface SerializedFailure {
  kind: TranslateErrorKind;
  message: string;
}

export class TranslateFailure extends Error {
  constructor(
    readonly kind: TranslateErrorKind,
    message: string,
  ) {
    super(message);
  }

  serialize(): SerializedFailure {
    return { kind: this.kind, message: this.message };
  }

  static from(failure: SerializedFailure): TranslateFailure {
    return new TranslateFailure(failure.kind, failure.message);
  }
}

export type FailureRemedy = "sign_in" | "open_options" | "open_usage";

interface FailurePolicy {
  fatal: boolean;
  remedy: FailureRemedy | null;
}

export const FAILURE_POLICY: Record<TranslateErrorKind, FailurePolicy> = {
  signed_out: { fatal: true, remedy: "sign_in" },
  no_model: { fatal: true, remedy: "open_options" },
  usage_limit: { fatal: true, remedy: "open_usage" },
  not_eligible: { fatal: true, remedy: null },
  extension_reloaded: { fatal: true, remedy: null },
  unavailable: { fatal: false, remedy: null },
  other: { fatal: false, remedy: null },
};
