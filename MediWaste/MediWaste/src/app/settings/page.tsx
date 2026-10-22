"use client"
import { dataStore } from "@/lib/data-store";
import { useAuth, setUserRole, getUserRoleSaved } from "@/components/auth-context";
import { PageHeading } from "@/components/page-heading";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { Settings as SettingsIcon, Shield, MapPin, Radio, Database, ChevronRight, Info } from "lucide-react";
import { useState } from "react";
import { useDataStoreVersion } from "@/lib/use-data-store";

export default function SettingsPage() {
  useDataStoreVersion();
  const { user, role: currentRole } = useAuth();
  const [selectedRole, setSelectedRole] = useState<string>(currentRole ?? "viewer");
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);

  const locations = dataStore.listLocations();
  const stations = dataStore.listStations();
  const referenceProducts = dataStore.listReferenceProducts();

  function saveRole() {
    setUserRole(selectedRole);
    setSavedFeedback(`Role set to ${selectedRole} for this browser session.`);
    setTimeout(() => setSavedFeedback(null), 4000);
  }

  return (
    <>
      <PageHeading
        title="Settings"
        description="User access, locations, station configuration, and reference data."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* User access */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-medical-700" />
                  <CardTitle className="text-base">User access</CardTitle>
                </div>
                {user ? (
                  <Badge variant="secondary">Signed in as {user.email}</Badge>
                ) : (
                  <Badge variant="secondary">Signed out</Badge>
                )}
              </div>
              <CardDescription>
                For local emulator demonstration, choose the role you want to act as. In production,
                roles are assigned per user in Firebase and enforced by Cloud Functions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <Select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-48"
                >
                  <option value="admin">Admin</option>
                  <option value="reviewer">Reviewer</option>
                  <option value="intake">Intake</option>
                  <option value="viewer">Viewer</option>
                </Select>
                <Button size="sm" onClick={saveRole}>Save role (demo)</Button>
              </div>
              {savedFeedback && (
                <p className="text-xs text-green-600">{savedFeedback}</p>
              )}
              <p className="text-xs text-slate-500">
                Current effective role for this session: <span className="font-medium text-slate-700">{currentRole ?? "—"}</span>.
              </p>
            </CardContent>
          </Card>

          {/* Locations */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-medical-700" />
                  <CardTitle className="text-base">Locations</CardTitle>
                </div>
                <Badge variant="secondary">{locations.length}</Badge>
              </div>
              <CardDescription>Intake and operations locations.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {locations.length === 0 ? (
                <EmptyState icon={MapPin} title="No locations" description="No locations configured." />
              ) : (
                <Table className="border-0">
                  <TableHeader className="bg-transparent">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-left text-xs text-slate-500">Name</TableHead>
                      <TableHead className="text-left text-xs text-slate-500">Address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {locations.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium text-slate-900">{l.name}</TableCell>
                        <TableCell className="text-slate-500">{l.address ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Stations */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-medical-700" />
                  <CardTitle className="text-base">Stations</CardTitle>
                </div>
                <Badge variant="secondary">{stations.length}</Badge>
              </div>
              <CardDescription>Registered verification stations.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {stations.length === 0 ? (
                <EmptyState icon={Radio} title="No stations" description="No stations registered." />
              ) : (
                <Table className="border-0">
                  <TableHeader className="bg-transparent">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-left text-xs text-slate-500">Name</TableHead>
                      <TableHead className="text-left text-xs text-slate-500">Serial</TableHead>
                      <TableHead className="text-left text-xs text-slate-500">Location</TableHead>
                      <TableHead className="text-left text-xs text-slate-500">Status</TableHead>
                      <TableHead className="text-left text-xs text-slate-500">Gate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stations.map((s) => {
                      const loc = dataStore.getLocation(s.locationId);
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium text-slate-900">{s.name}</TableCell>
                          <TableCell className="text-slate-500">{s.serialNumber ?? "—"}</TableCell>
                          <TableCell className="text-slate-500">{loc?.name ?? "—"}</TableCell>
                          <TableCell>
                            <Badge variant={s.online ? "success" : "secondary"}>
                              {s.online ? "Online" : "Offline"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={s.gateState === "open" ? "success" : "secondary"}>
                              {s.gateState}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Reference data + notes */}
        <div className="space-y-6">
          {/* Reference data */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-medical-700" />
                  <CardTitle className="text-base">Reference data</CardTitle>
                </div>
                <Badge variant="warning">Demo</Badge>
              </div>
              <CardDescription>
                Seeded reference products used for verification checks within the demo.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {referenceProducts.length === 0 ? (
                <EmptyState
                  icon={Database}
                  title="No reference products"
                  description="No reference data seeded."
                />
              ) : (
                <Table className="border-0">
                  <TableHeader className="bg-transparent">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-left text-xs text-slate-500">Product</TableHead>
                      <TableHead className="text-left text-xs text-slate-500">Form / Strength</TableHead>
                      <TableHead className="text-left text-xs text-slate-500">Manufacturer</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referenceProducts.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium text-slate-900 text-sm">{p.name}</TableCell>
                        <TableCell className="text-slate-500 text-sm">
                          {[p.form, p.strength].filter(Boolean).join(" · ") || "—"}
                        </TableCell>
                        <TableCell className="text-slate-500 text-sm">{p.manufacturer ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Important note */}
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Info className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900 text-sm">Seeded data is fictional</p>
                  <p className="mt-1 text-sm text-amber-800">
                    Reference products and demo donations are clearly labelled as fictional. They are not an
                    official pharmaceutical database and must not be treated as authoritative source data.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Environment notes */}
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="p-4 text-sm text-slate-600">
              <p className="font-medium text-slate-900 mb-1">Environment</p>
              <p>
                This build runs against the Firebase Emulator Suite for local development. No real credentials
                are stored in the repository. See{" "}
                <code className="rounded bg-slate-200 px-1 py-0.5 text-xs font-mono text-slate-700">.env.example</code>{" "}
                for the variables you would configure for production.
              </p>
              <p className="mt-2">
                The hardware simulator and station console let you demonstrate the physical station workflow
                without the Arduino hardware.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
