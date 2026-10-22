"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { dataStore } from "@/lib/data-store";
import { PageHeading } from "@/components/page-heading";
import { DonationCard } from "@/components/donation-ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { ArrowLeft, Upload, Package, Users, MapPin } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

export default function NewDonationPage() {
  return (
    <>
      <PageHeading
        title="New intake"
        description="Register a package of unused medicines for inspection and verification."
        actions={
          <Link href="/donations">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" /> Back to donations
            </Button>
          </Link>
        }
      />
      <Suspense fallback={<NewDonationInner />}>
        <NewDonationWithParams />
      </Suspense>
    </>
  );
}

function NewDonationWithParams() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locationId = searchParams.get("location") ?? "";
  return <NewDonationInner initialLocationId={locationId || undefined} />;
}

function NewDonationInner({ initialLocationId }: { initialLocationId?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    code: "",
    description: "",
    form: "",
    strength: "",
    manufacturer: "",
    batchNumber: "",
    expiryDate: "",
    quantity: "",
    unit: "",
    donorName: "",
    donorContact: "",
    donorAddress: "",
    locationId: initialLocationId ?? "",
    intakeStaffUid: "",
    notes: "",
  });

  const locations = dataStore.listLocations();

  function bind<K extends keyof typeof form>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.code.trim()) {
      setError("Package code is required.");
      return;
    }
    if (!form.donorName.trim()) {
      setError("Donor name is required.");
      return;
    }
    if (!form.intakeStaffUid.trim()) {
      setError("Intake staff identifier is required.");
      return;
    }

    const quantity = form.quantity ? Number(form.quantity) : undefined;
    if (quantity !== undefined && (!Number.isFinite(quantity) || quantity <= 0)) {
      setError("Quantity must be a positive number.");
      return;
    }

    startTransition(() => {
      try {
      const donation = dataStore.createDonation({
        code: form.code.trim(),
        packageInfo: {
          description: form.description.trim() || undefined,
          form: form.form.trim() || undefined,
          strength: form.strength.trim() || undefined,
          manufacturer: form.manufacturer.trim() || undefined,
          batchNumber: form.batchNumber.trim() || undefined,
          expiryDate: form.expiryDate ? new Date(form.expiryDate) : undefined,
          quantity,
          unit: form.unit.trim() || undefined,
          notes: form.notes.trim() || undefined,
        },
        donorInfo: {
          name: form.donorName.trim(),
          contact: form.donorContact.trim() || undefined,
          address: form.donorAddress.trim() || undefined,
        },
        intakeLocationId: form.locationId || undefined,
        intakeStaffUid: form.intakeStaffUid.trim(),
      });
      router.push(`/donations/${donation.code}`);
      } catch (err) {
        // Duplicate package codes are rejected by the store; surface that
        // instead of silently navigating to the wrong record.
        setError((err as Error)?.message ?? "Could not register the package.");
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Register a new package</CardTitle>
        </CardHeader>
        <CardContent>
          <form id="new-donation-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Package details */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-slate-400" />
                  <h3 className="text-sm font-semibold text-slate-900">Package details</h3>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="code">Package code</Label>
                  <Input
                    id="code"
                    value={form.code}
                    onChange={bind("code")}
                    placeholder="e.g. MW-1234ABCD"
                    required
                    autoComplete="off"
                  />
                  <p className="text-xs text-slate-500">Unique identifier for this package.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={form.description}
                    onChange={bind("description")}
                    placeholder="e.g. Paracetamol 500mg tablets"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="form">Form</Label>
                    <Input id="form" value={form.form} onChange={bind("form")} placeholder="Tablet, Capsule…" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="strength">Strength</Label>
                    <Input id="strength" value={form.strength} onChange={bind("strength")} placeholder="500mg, 10mg…" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="manufacturer">Manufacturer</Label>
                    <Input id="manufacturer" value={form.manufacturer} onChange={bind("manufacturer")} placeholder="Fictional Pharma Co" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="batchNumber">Batch number</Label>
                    <Input id="batchNumber" value={form.batchNumber} onChange={bind("batchNumber")} placeholder="PMC2024-001" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="expiryDate">Expiry date</Label>
                    <Input id="expiryDate" type="date" value={form.expiryDate} onChange={bind("expiryDate")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input id="quantity" type="number" min="1" value={form.quantity} onChange={bind("quantity")} placeholder="50" />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label htmlFor="unit">Unit</Label>
                    <Input id="unit" value={form.unit} onChange={bind("unit")} placeholder="tablets, capsules, inhalers…" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="observations">Notes for intake (optional)</Label>
                  <Textarea id="observations" value={form.notes} onChange={bind("notes")} placeholder="Any conditions of the package on arrival…" rows={3} />
                </div>
              </div>

              {/* Donor + intake */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-400" />
                  <h3 className="text-sm font-semibold text-slate-900">Donor information</h3>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="donorName">Donor name</Label>
                  <Input id="donorName" value={form.donorName} onChange={bind("donorName")} placeholder="Community Donation Box" required />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="donorContact">Contact (optional)</Label>
                  <Input id="donorContact" value={form.donorContact} onChange={bind("donorContact")} placeholder="admin@example.org" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="donorAddress">Address (optional)</Label>
                  <Textarea id="donorAddress" value={form.donorAddress} onChange={bind("donorAddress")} placeholder="45 Market Street, Bradford" rows={2} />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  <h3 className="text-sm font-semibold text-slate-900">Intake details</h3>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="locationId">Intake location</Label>
                  <Select id="locationId" value={form.locationId} onChange={bind("locationId")}>
                    <option value="">Select a location…</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="intakeStaffUid">Intake staff identifier</Label>
                  <Input id="intakeStaffUid" value={form.intakeStaffUid} onChange={bind("intakeStaffUid")} placeholder="user-intake-1" required />
                  <p className="text-xs text-slate-500">Your staff or system identifier for audit.</p>
                </div>

                <div className="pt-2">
                  <Button type="button" variant="outline" className="gap-1.5" onClick={() => {
                    const d = new Date();
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, "0");
                    const day = String(d.getDate()).padStart(2, "0");
                    const h = String(d.getHours()).padStart(2, "0");
                    const min = String(d.getMinutes()).padStart(2, "0");
                    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
                    setForm((f) => ({ ...f, code: `MW-${y}${m}${day}${h}${min}-${rand}` }));
                  }}>
                    <Upload className="h-3.5 w-3.5" /> Suggest a code
                  </Button>
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </form>
        </CardContent>
        <CardFooter className="flex justify-end gap-3 border-t">
          <Link href="/donations">
            <Button variant="ghost" type="button">Cancel</Button>
          </Link>
          <Button type="submit" form="new-donation-form" disabled={pending}>
            {pending ? "Saving…" : "Register package"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
