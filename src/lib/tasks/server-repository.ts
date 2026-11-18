import "server-only";

import { readActorPermissions } from "@/lib/invoices/repository";
import { postgresQuery } from "@/lib/invoices/server-repository";
import {
  getClassificationCatalogs,
  enqueueContinuation,
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
  enqueue: (actor: string, input: Parameters<typeof enqueueContinuation>[2]) =>
    enqueueContinuation(postgresQuery, actor, input),
  catalogs: async (actor: string) => {
    const permissions = await readActorPermissions(postgresQuery, actor);
    if (!permissions.some(row => row.permission === "classification.save" || row.permission === "classification.complete")) return null;
    return getClassificationCatalogs(postgresQuery);
  },
};
