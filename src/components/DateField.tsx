"use client";

type Props = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  required?: boolean;
  className?: string;
  placeholder?: string;
  "aria-label"?: string;
};

function calendarValue(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : "";
}

export function DateField({
  value,
  onChange,
  id,
  required,
  className,
  placeholder = "RRRR-MM-DD",
  "aria-label": ariaLabel,
}: Props) {
  return (
    <span className="date-field">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        required={required}
        className={className}
        placeholder={placeholder}
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
      />
      <input
        type="date"
        className="date-field__picker"
        value={calendarValue(value)}
        aria-label="Wybierz z kalendarza"
        title="Kalendarz"
        onChange={(e) => onChange(e.target.value)}
      />
    </span>
  );
}
