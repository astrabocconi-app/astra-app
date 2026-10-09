/** Form primitives for the dashboard CMS — labelled inputs matching the UI kit. */
import type {
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  SelectHTMLAttributes,
  ReactNode,
} from "react";

const base =
  "w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-astra-accent disabled:opacity-50";

/**
 * Labelled field. A plain control is wrapped in a <label> so clicking the text
 * focuses it. Pass `composite` when the child holds several controls (the image
 * picker): a <label> would hand clicks on its text to the first control inside,
 * so a labelled group is used instead.
 */
export function Field({
  label,
  hint,
  required,
  composite = false,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  composite?: boolean;
  children: ReactNode;
}) {
  const title = (
    <span className="text-sm font-medium text-gray-700">
      {label}
      {required && <span className="text-red-500"> *</span>}
    </span>
  );
  const hintEl = hint && <span className="text-xs text-gray-500">{hint}</span>;
  if (composite) {
    return (
      <div role="group" aria-label={label} className="flex flex-col gap-1.5">
        {title}
        {children}
        {hintEl}
      </div>
    );
  }
  return (
    <label className="flex flex-col gap-1.5">
      {title}
      {children}
      {hintEl}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${base} ${props.className ?? ""}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${base} min-h-[110px] resize-y ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${base} bg-white ${props.className ?? ""}`} />;
}

/** "42 / 300" under a length-limited field; turns amber when nearly full. */
export function Counter({ value, max }: { value: string; max: number }) {
  const n = value.length;
  return (
    <span className={`text-right text-xs ${n >= max * 0.9 ? "text-amber-700" : "text-gray-500"}`}>
      {n} / {max}
    </span>
  );
}

export function Toggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 px-4 py-3 text-left transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span>
        <span className="block text-sm font-medium text-gray-800">{label}</span>
        {hint && <span className="block text-xs text-gray-500">{hint}</span>}
      </span>
      <span
        aria-hidden="true"
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-astra-primary" : "bg-gray-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}
