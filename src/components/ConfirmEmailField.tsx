"use client";

type Props = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
};

export function ConfirmEmailField({
  value,
  onChange,
  id = "confirm-email",
}: Props) {
  return (
    <div className="confirm-email">
      <label htmlFor={id}>
        E-mail na potwierdzenie{" "}
        <span className="confirm-email__opt">(opcjonalnie)</span>
        <input
          id={id}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="np. jan@poczta.pl"
        />
      </label>
      <p className="confirm-email__hint">
        <strong>Tylko potwierdzenie tej wysyłki</strong> — kopia zmian, żeby nic
        nie zaginęło. Adresu nie zapisujemy na drzewie, nie dajemy dalej i nie
        używamy do niczego innego.
      </p>
    </div>
  );
}
