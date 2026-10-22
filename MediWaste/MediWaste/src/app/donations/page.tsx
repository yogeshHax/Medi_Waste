"use client"
import { dataStore } from "@/lib/data-store";
import { PageHeading } from "@/components/page-heading";
import { DonationCard } from "@/components/donation-ui";
import { EmptyState } from "@/components/empty-state";
import { Package, Plus, Search, Filter } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useDataStoreVersion } from "@/lib/use-data-store";

function DonationsList({ search, status }: { search: string; status: string }) {
  useDataStoreVersion();
  const donations = dataStore.listDonations({ search, status });
  return (
    <div className="mt-6 space-y-3">
      {donations.length === 0 ? (
        <EmptyState
          icon={Package}
          title={search || status ? "No matching donations" : "No donations yet"}
          description={
            search || status
              ? "Try adjusting your search or filters."
              : "Register the first package to see it here."
          }
          action={
            !search && !status ? (
              <Link href="/donations/new">
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Register a package
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        donations.map((d) => (
          <Link key={d.id} href={`/donations/${d.code}`}>
            <DonationCard donation={d} />
          </Link>
        ))
      )}
    </div>
  );
}

function FiltersBar({ search, status, onSearch, onStatusChange }: {
  search: string;
  status: string;
  onSearch: (v: string) => void;
  onStatusChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search by code, product, donor, batch…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-slate-400" />
        <Select
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          className="w-44"
        >
          <option value="">All statuses</option>
          <option value="registered">Registered</option>
          <option value="awaiting_inspection">Awaiting Inspection</option>
          <option value="inspection_in_progress">Inspection In Progress</option>
          <option value="pending_verification">Pending Verification</option>
          <option value="discrepancy_detected">Discrepancy Detected</option>
          <option value="quarantined_for_review">Quarantined for Review</option>
          <option value="awaiting_authorised_decision">Awaiting Authorised Decision</option>
          <option value="approved_for_next_stage">Approved for Next Stage</option>
          <option value="rejected">Rejected</option>
          <option value="disposition_recorded">Disposition Recorded</option>
        </Select>
      </div>
    </div>
  );
}

export default function DonationsPage() {
  return (
    <>
      <PageHeading
        title="Donations"
        description="Search, filter, and manage the donation register."
        actions={
          <Link href="/donations/new">
            <Button className="gap-1.5">
              <Plus className="h-4 w-4" /> New intake
            </Button>
          </Link>
        }
      />
      <Suspense fallback={<FiltersBar search="" status="" onSearch={() => {}} onStatusChange={() => {}} />}>
        <DonationsPageInner />
      </Suspense>
    </>
  );
}

function DonationsPageInner() {
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("q") ?? "";
  const initialStatus = searchParams.get("status") ?? "";

  return (
    <DonationsListWithState initialSearch={initialSearch} initialStatus={initialStatus} />
  );
}

function DonationsListWithState({ initialSearch, initialStatus }: { initialSearch: string; initialStatus: string }) {
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState(initialStatus);

  return (
    <div>
      <FiltersBar
        search={search}
        status={status}
        onSearch={setSearch}
        onStatusChange={setStatus}
      />
      <DonationsList search={search} status={status} />
    </div>
  );
}
