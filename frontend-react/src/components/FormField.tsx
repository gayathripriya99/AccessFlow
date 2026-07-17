import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  children?: ReactNode;
}

/** Label + input, wired for accessibility (label htmlFor, aria-invalid, aria-describedby error text). Pass `children` instead of relying on the built-in `<input>` to render a custom control (e.g. a `<select>` or checkbox group) while keeping the same label/error wiring. */
export function FormField({ label, error, id, children, className = '', ...rest }: FormFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = `${fieldId}-error`;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={fieldId} className="text-sm font-medium text-gray-900">
        {label}
      </label>
      {children ?? (
        <input
          id={fieldId}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={`rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 ${className}`}
          {...rest}
        />
      )}
      {error && (
        <p id={errorId} className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
