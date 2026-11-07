import "server-only";

import { postgresQuery } from "@/lib/invoices/server-repository";
import {
  getClassificationCatalogs,
  linkReplacement,
  performTaskAction,
  saveTaskClassification,
  startHumanCircuit,
} from "./repository";

export const taskServerRepository = {
  perform: (actor: string, taskId: number, input: Parameters<typeof performTaskAction>[3]) =>
    performTaskAction(postgresQuery, actor, taskId, input),
  classify: (actor: string, taskId: number, input: Parameters<typeof saveTaskClassification>[3]) =>
    saveTaskClassification(postgresQuery, actor, taskId, input),
  start: (actor: string, input: Parameters<typeof startHumanCircuit>[2]) =>
    startHumanCircuit(postgresQuery, actor, input),
  link: (actor: string, input: Parameters<typeof linkReplacement>[2]) =>
    linkReplacement(postgresQuery, actor, input),
  catalogs: () => getClassificationCatalogs(postgresQuery),
};
