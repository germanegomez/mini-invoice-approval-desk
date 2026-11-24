import "server-only";
import { client } from "@/db";

export async function canReadWeeklyReport(actorId: string): Promise<boolean> {
  // Keep the ordinary desk usable during a rolling schema upgrade.
  const [schema] = await client`SELECT to_regprocedure('portal.can_read_weekly_report(bigint)') IS NOT NULL AS installed`;
  if (!schema.installed) return false;
  const [access] = await client`SELECT portal.can_read_weekly_report(${actorId}::bigint) AS allowed`;
  return access.allowed;
}

interface Group {
  category: "queue" | "intervention";
  section: string;
  owner: string;
  count: number;
  oldest_days: number | null;
  ids: number[];
}
interface Diagnostic {
  stage: string;
  events: number;
  p50: number | null;
  p95: number | null;
  retries: number;
  rate_limits: number;
  input_tokens: number | null;
  output_tokens: number | null;
  cost: number | null;
}
export interface WeeklyReport {
  start: string;
  cutoff: string;
  movement: Record<"initial" | "received" | "posted" | "reopened" | "rejected" | "duplicates" | "other" | "final", number>;
  timing: { sample: number; median: number | null; previous_sample: number; previous: number | null };
  groups: Group[];
  diagnostics: Diagnostic[];
  missing_posting: number;
}

export async function readWeeklyReport(actorId: string, week: string): Promise<WeeklyReport> {
  const [row] = await client`SELECT portal.weekly_supplier_report(${actorId}::bigint,${week}::date) AS report`;
  return row.report;
}
