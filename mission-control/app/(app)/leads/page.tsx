import { Users } from "lucide-react";

export default function LeadsPage() {
  return (
    <div className="flex flex-col gap-6 pt-2">
      <h1 className="t-title">Leads</h1>
      <div className="flex min-h-[40dvh] flex-col items-center justify-center gap-3 text-center">
        <Users size={28} strokeWidth={1.5} aria-hidden />
        <p className="t-card">Komt in sprint 3</p>
        <p className="max-w-xs text-muted">Hunter importeert dan je 846 leads en zet elke werkdag 10 persoonlijke benaderingen klaar.</p>
      </div>
    </div>
  );
}
