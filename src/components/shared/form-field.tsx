import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  id: string;
  label: string;
  hint?: ReactNode;
  errors?: string[];
  required?: boolean;
  className?: string;
  children: ReactElement<Record<string, unknown>>;
}

/** Label + control + hint + error, wired together with aria attributes. */
export function FormField({
  id,
  label,
  hint,
  errors,
  required,
  className,
  children,
}: FormFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = errors?.length ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        "aria-describedby": describedBy,
        "aria-invalid": errorId ? true : undefined,
        required,
      })
    : children;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {!required && <span className="ml-1 font-normal text-muted-foreground">(optional)</span>}
      </Label>
      {control}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {errorId && (
        <p id={errorId} className="text-xs font-medium text-danger">
          {errors?.[0]}
        </p>
      )}
    </div>
  );
}
