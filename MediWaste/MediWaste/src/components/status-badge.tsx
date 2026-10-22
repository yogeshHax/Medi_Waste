import { Badge } from "@/components/ui/badge";
import { dataStore } from "@/lib/data-store";

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={dataStore.getStatusVariant(status as any)}>{dataStore.getStatusLabel(status as any)}</Badge>;
}
