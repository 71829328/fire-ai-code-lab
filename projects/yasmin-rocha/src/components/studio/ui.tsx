import type { ReactNode } from "react";
export const inputCls = "w-full rounded-md border hairline bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none";
export function Panel({ title, kicker, children, actions }: { title: string; kicker?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-lg border hairline bg-card p-5 md:p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>{kicker && <p className="eyebrow text-muted-foreground">{kicker}</p>}<h2 className="display mt-1 text-3xl">{title}</h2></div>
        {actions}
      </div>
      {children}
    </section>
  );
}
export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="photo-slot rounded-md border border-dashed hairline px-6 py-10 text-center">
      <p className="display text-2xl">{title}</p><p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
export function Btn({ children, variant = "solid", ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "solid" | "ghost" | "danger" }) {
  const v = variant === "solid" ? "bg-foreground text-background hover:bg-primary" : variant === "danger" ? "text-destructive hover:bg-destructive/10" : "border hairline hover:border-foreground";
  return <button {...p} className={`rounded-full px-4 py-2 text-sm font-medium transition disabled:opacity-40 ${v} ${p.className ?? ""}`}>{children}</button>;
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-xs font-medium text-muted-foreground">{label}<div className="mt-1">{children}</div></label>;
}