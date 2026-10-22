import { Donation, DonationStatus } from "@/types";
import { dataStore } from "@/lib/data-store";
import { Badge } from "@/components/ui/badge";
import { formatDateShort } from "@/lib/utils";

interface DonationCardProps {
  donation: Donation;
}

export function StatusBadge({ status }: { status: DonationStatus }) {
  return (
    <Badge variant={dataStore.getStatusVariant(status)}>
      {dataStore.getStatusLabel(status)}
    </Badge>
  );
}

export function DonationCard({ donation }: DonationCardProps) {
  const pi = donation.packageInfo;
  return (
    <article className="group rounded-xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-medical-900">{donation.code}</span>
            <StatusBadge status={donation.status} />
          </div>
          {pi?.description && (
            <p className="mt-1 truncate text-sm text-slate-600">{pi.description}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
            {pi?.form && <span>{pi.form}</span>}
            {pi?.strength && <span>{pi.strength}</span>}
            {pi?.batchNumber && <span>Batch {pi.batchNumber}</span>}
            {pi?.quantity && <span>{pi.quantity} {pi.unit}</span>}
          </div>
        </div>
        <div className="text-right text-xs text-slate-400">
          {donation.intakeAt ? (
            <span className="block">Intaked {formatDateShort(donation.intakeAt as Date | string)}</span>
          ) : null}
        </div>
      </div>
      {donation.discrepancies && donation.discrepancies.some((d) => d.status === "open") && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          {donation.discrepancies.filter((d) => d.status === "open").length} open discrepancy{donation.discrepancies.filter((d) => d.status === "open").length === 1 ? "" : "s"}
        </div>
      )}
      {donation.review?.decision === "approved" && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-green-700">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Reviewed and approved
        </div>
      )}
    </article>
  );
}

export function DonationDetailPage({ donation }: { donation: Donation }) {
  // This is used inline within the [code] page; not a separate export.
  throw new Error("Use DonationCard and inline detail instead");
}
