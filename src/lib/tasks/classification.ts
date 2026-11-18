import type { InvoiceItem } from "@/types/invoice";
import type { ClassificationCatalogs } from "./repository";

export type Assignment = Pick<InvoiceItem, "costCenter" | "subCostCenter" | "accountingAccount">;
export type Field = keyof Assignment;
export const emptyAssignment: Assignment = { costCenter: null, subCostCenter: null, accountingAccount: null };
export const fieldLabels = {
  costCenter: "Centro de costo",
  subCostCenter: "Subcentro de costo",
  accountingAccount: "Cuenta contable",
};
export const fields = Object.keys(fieldLabels) as Field[];

export function sameAssignment(a: Assignment, b: Assignment) {
  return fields.every(field => a[field] === b[field]);
}

export function choices(catalog: ClassificationCatalogs, field: Field) {
  if (field === "costCenter") return catalog.costCenters;
  if (field === "accountingAccount") return catalog.accounts;
  return catalog.subCostCenters;
}

export function invalidField(value: Assignment, catalog: ClassificationCatalogs, complete: boolean) {
  return fields.find(field => {
    if (!value[field]) return complete && field !== "subCostCenter";
    return !choices(catalog, field).some(entry => entry.code === value[field]);
  });
}
