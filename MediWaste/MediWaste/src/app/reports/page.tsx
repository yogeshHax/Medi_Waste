"use client"
import { dataStore } from "@/lib/data-store";
import { PageHeading } from "@/components/page-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { FileSpreadsheet, Download, TrendingUp, Package, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useDataStoreVersion } from "@/lib/use-data-store";

/** Neutralise spreadsheet formula execution in exported CSV cells. */
function csvCell(value: unknown): string {
  const text = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export default function ReportsPage() {
  useDataStoreVersion();
  const donations = dataStore.listDonations();
  const [exporting, setExporting] = useState(false);

  const statusCounts = donations.reduce<Record<string, number>>((acc, d) => {
    acc[d.status] = (acc[d.status] ?? 0) + 1;
    return acc;
  }, {});

  const totalQuantity = donations.reduce((acc, d) => acc + (d.packageInfo?.quantity ?? 0), 0);
  const openDiscrepancyCount = donations.reduce(
    (acc, d) => acc + (d.discrepancies?.filter((d) => d.status === "open").length ?? 0),
    0
  );
  const approvedCount = donations.filter((d) => d.review?.decision === "approved").length;
  const rejectedCount = donations.filter((d) => d.review?.decision === "rejected").length;
  const withDisposition = donations.filter((d) => d.disposition).length;

  const summaryCards = [
    { label: "Total donations", value: donations.length, icon: Package, color: "bg-medical-50 text-medical-700" },
    { label: "Total items (approx.)", value: totalQuantity, icon: TrendingUp, color: "bg-slate-50 text-slate-700" },
    { label: "Approved", value: approvedCount, icon: CheckCircle2, color: "bg-green-50 text-green-700" },
    { label: "Rejected", value: rejectedCount, icon: AlertTriangle, color: "bg-red-50 text-red-700" },
    { label: "Open discrepancies", value: openDiscrepancyCount, icon: AlertTriangle, color: "bg-amber-50 text-amber-700" },
    { label: "Dispositions recorded", value: withDisposition, icon: Clock, color: "bg-slate-50 text-slate-700" },
  ];

  function exportCsv() {
    setExporting(true);
    try {
      const headers = [
        "Code",
        "Status",
        "Description",
        "Form",
        "Strength",
        "Manufacturer",
        "Batch number",
        "Expiry date",
        "Quantity",
        "Unit",
        "Donor name",
        "Donor contact",
        "Intake location",
        "Intake staff UID",
        "Inspection outcome",
        "Verification outcome",
        "Review decision",
        "Disposition type",
        "Created at",
        "Updated at",
      ];
      const rows = donations.map((d) => [
        d.code,
        d.status,
        d.packageInfo?.description ?? "",
        d.packageInfo?.form ?? "",
        d.packageInfo?.strength ?? "",
        d.packageInfo?.manufacturer ?? "",
        d.packageInfo?.batchNumber ?? "",
        d.packageInfo?.expiryDate ? new Date(d.packageInfo.expiryDate as any).toISOString().slice(0, 10) : "",
        d.packageInfo?.quantity ?? "",
        d.packageInfo?.unit ?? "",
        d.donorInfo?.name ?? "",
        d.donorInfo?.contact ?? "",
        d.intakeLocationId ? (dataStore.getLocation(d.intakeLocationId)?.name ?? d.intakeLocationId) : "",
        d.intakeStaffUid ?? "",
        d.inspection?.observations?.length ? d.inspection.observations.join("; ") : "",
        d.inspection?.verificationOutcome ?? "",
        d.review?.decision ?? "",
        d.disposition?.type ?? "",
        d.createdAt ? new Date(d.createdAt as any).toISOString() : "",
        d.updatedAt ? new Date(d.updatedAt as any).toISOString() : "",
      ]);
      const csv = [headers.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\n");
      const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `medwaste-donations-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoke on the next task so Safari/Firefox have started the download.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error("CSV export failed", err);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <PageHeading
        title="Reports"
        description="Operational summaries and exportable records."
        actions={
          <Button className="gap-1.5" onClick={exportCsv} disabled={exporting || donations.length === 0}>
            <Download className="h-4 w-4" /> {exporting ? "Exporting…" : "Export CSV"}
          </Button>
        }
      />

      <p className="mb-6 text-sm text-slate-500">
        These reports are generated from locally stored data. Any seeded records are clearly fictional and
        intended only for demonstration and development.
      </p>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {summaryCards.map((s) => (
          <div key={s.label} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${s.color}`}>
              <s.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900">{s.value}</p>
              <p className="text-sm text-slate-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Status breakdown table */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-medical-700" />
            Donations by status
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {donations.length === 0 ? (
            <EmptyState icon={Package} title="No donations" description="No data to report yet." />
          ) : (
            <Table className="border-0">
              <TableHeader className="bg-transparent">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-left text-xs text-slate-500">Status</TableHead>
                  <TableHead className="text-right text-xs text-slate-500">Count</TableHead>
                  <TableHead className="text-right text-xs text-slate-500">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(statusCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([status, count]) => (
                    <TableRow key={status}>
                      <TableCell className="font-medium text-slate-900 text-sm">
                        <Badge variant={dataStore.getStatusVariant(status as any)} className="mr-2">
                          {dataStore.getStatusLabel(status as any)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-slate-900">{count}</TableCell>
                      <TableCell className="text-right text-slate-500">
                        {donations.length ? `${Math.round((count / donations.length) * 100)}%` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                <TableRow>
                  <TableCell className="font-medium text-slate-900 text-sm">Total</TableCell>
                  <TableCell className="text-right text-slate-900">{donations.length}</TableCell>
                  <TableCell className="text-right text-slate-500">100%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Data note */}
      <Card className="mt-6 bg-slate-50 border-slate-200">
        <CardContent className="flex items-start gap-3 text-sm text-slate-600">
          <FileSpreadsheet className="h-4 w-4 shrink-0 text-slate-400" />
          <div>
            <p className="font-medium text-slate-900">About this data</p>
            <p className="mt-1">
              Reports reflect the current state of the local in-memory store and any seeded demo records.
              They are not production metrics. In production, reports would be generated from Cloud Firestore
              with appropriate access controls and auditability.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              CSV export includes every donation in the current local dataset. Review before using for any
              operational or regulatory purpose.
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
