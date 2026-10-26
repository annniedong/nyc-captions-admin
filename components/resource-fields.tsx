import type { Field, Row } from "@/lib/resources";
import type { FkOptions } from "@/lib/resource-form";

const input =
  "mt-1.5 w-full rounded-2xl border-2 border-border bg-background px-4 font-semibold placeholder:text-muted focus-visible:border-blue";

export function ResourceFields({
  fields,
  row,
  options,
}: {
  fields: Field[];
  row?: Row;
  options: FkOptions;
}) {
  return (
    <div className="grid gap-5">
      {fields.map((field) => {
        const id = `f-${field.name}`;
        const current = row ? row[field.name] : field.defaultValue;

        if (field.type === "boolean") {
          return (
            <label key={field.name} htmlFor={id} className="flex items-start gap-3">
              <input
                id={id}
                type="checkbox"
                name={field.name}
                defaultChecked={Boolean(current)}
                className="mt-1 h-5 w-5 accent-[var(--primary)]"
              />
              <span>
                <span className="block text-sm font-black uppercase tracking-wide">{field.label}</span>
                {field.help && <span className="block text-sm font-semibold text-muted">{field.help}</span>}
              </span>
            </label>
          );
        }

        return (
          <div key={field.name}>
            <label htmlFor={id} className="text-sm font-black uppercase tracking-wide">
              {field.label}
              {field.required && <span className="text-danger"> *</span>}
            </label>
            {field.type === "textarea" ? (
              <textarea
                id={id}
                name={field.name}
                rows={4}
                maxLength={field.maxLength}
                required={field.required}
                placeholder={field.placeholder}
                defaultValue={current == null ? "" : String(current)}
                className={`${input} resize-y py-3`}
              />
            ) : field.type === "fk" ? (
              <select
                id={id}
                name={field.name}
                required={field.required}
                defaultValue={current == null ? "" : String(current)}
                className={`${input} h-12`}
              >
                {!field.required && <option value="">{field.ref?.nullLabel ?? "None"}</option>}
                {field.required && !current && <option value="">Choose one…</option>}
                {(options[field.name] ?? []).map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : (
              <input
                id={id}
                name={field.name}
                type={field.type === "number" ? "number" : field.type === "email" ? "email" : "text"}
                inputMode={field.type === "number" ? "numeric" : undefined}
                min={field.min}
                max={field.max}
                maxLength={field.maxLength}
                required={field.required}
                placeholder={field.placeholder}
                defaultValue={current == null ? "" : String(current)}
                autoComplete="off"
                className={`${input} h-12`}
              />
            )}
            {field.help && <p className="mt-1.5 text-sm font-semibold text-muted">{field.help}</p>}
          </div>
        );
      })}
    </div>
  );
}
