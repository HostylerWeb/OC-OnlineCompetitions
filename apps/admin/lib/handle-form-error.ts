import { ApiResponseError } from "@oc/api-admin";
import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";

interface FieldErrors {
  fieldErrors?: Record<string, string[]>;
  formErrors?: string[];
}

export function handleFormError<T extends FieldValues>(
  form: UseFormReturn<T>,
  err: unknown
): string | null {
  if (err instanceof ApiResponseError) {
    const body = err.data as { error?: { details?: FieldErrors; message?: string } } | undefined;
    const details = body?.error?.details;
    const message = body?.error?.message ?? err.message;

    if (details?.fieldErrors) {
      let hasFieldErrors = false;
      for (const [field, messages] of Object.entries(details.fieldErrors)) {
        if (messages.length > 0) {
          form.setError(field as FieldPath<T>, { message: messages[0] });
          hasFieldErrors = true;
        }
      }

      if (details.formErrors?.length) {
        return details.formErrors[0];
      }

      if (hasFieldErrors) {
        return null;
      }
    }

    return message;
  }

  if (err instanceof Error) {
    return err.message;
  }

  return "An unexpected error occurred";
}
