import { z } from "zod";
import { NextResponse } from "next/server";
import type { AuthenticatedPortalUser } from "@/lib/auth/guard";
import {
  classificationSchema,
  continuationSchema,
  replacementSchema,
  startCircuitSchema,
  taskActionSchema,
  type ClassificationInput,
  type ContinuationInput,
  type ReplacementInput,
  type StartCircuitInput,
  type TaskActionInput,
} from "./contracts";
import type { ClassificationCatalogs, TaskOperationResult } from "./repository";

export interface TaskControllerDependencies {
  authenticate(): Promise<AuthenticatedPortalUser>;
  perform(actor: string, taskId: number, input: TaskActionInput): Promise<TaskOperationResult>;
  classify(actor: string, taskId: number, input: ClassificationInput): Promise<TaskOperationResult>;
  start(actor: string, input: StartCircuitInput): Promise<TaskOperationResult>;
  link(actor: string, input: ReplacementInput): Promise<TaskOperationResult>;
  enqueue(actor: string, input: ContinuationInput): Promise<TaskOperationResult>;
  catalogs(): Promise<ClassificationCatalogs>;
}

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };

function privateJson(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  for (const [name, value] of Object.entries(PRIVATE_HEADERS)) headers.set(name, value);
  return NextResponse.json(body, { ...init, headers });
}

async function json(request: Request): Promise<unknown> {
  try { return await request.json(); } catch { throw new z.ZodError([]); }
}

function taskId(value: string): number {
  if (!/^[1-9][0-9]*$/.test(value)) throw new z.ZodError([]);
  return Number(value);
}

function errorResponse(error: unknown) {
  if (error instanceof z.ZodError) return privateJson({ success: false, error: "Invalid request" }, { status: 400 });
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = Number(error.status);
    if (status === 401 || status === 403 || status === 503) {
      return privateJson({ success: false, error: "Access denied" }, { status });
    }
  }
  return privateJson({ success: false, error: "Task operation is unavailable" }, { status: 503 });
}

function operationResponse(result: TaskOperationResult) {
  return privateJson({ success: result.ok, ...result }, { status: result.status });
}

export async function handleTaskAction(request: Request, id: string, dependencies: TaskControllerDependencies) {
  try {
    const user = await dependencies.authenticate();
    return operationResponse(await dependencies.perform(user.id, taskId(id), taskActionSchema.parse(await json(request))));
  } catch (error) { return errorResponse(error); }
}

export async function handleClassification(request: Request, id: string, dependencies: TaskControllerDependencies) {
  try {
    const user = await dependencies.authenticate();
    return operationResponse(await dependencies.classify(user.id, taskId(id), classificationSchema.parse(await json(request))));
  } catch (error) { return errorResponse(error); }
}

export async function handleStartCircuit(request: Request, dependencies: TaskControllerDependencies) {
  try {
    const user = await dependencies.authenticate();
    return operationResponse(await dependencies.start(user.id, startCircuitSchema.parse(await json(request))));
  } catch (error) { return errorResponse(error); }
}

export async function handleReplacement(request: Request, dependencies: TaskControllerDependencies) {
  try {
    const user = await dependencies.authenticate();
    return operationResponse(await dependencies.link(user.id, replacementSchema.parse(await json(request))));
  } catch (error) { return errorResponse(error); }
}

export async function handleContinuation(request: Request, dependencies: TaskControllerDependencies) {
  try {
    const user = await dependencies.authenticate();
    return operationResponse(await dependencies.enqueue(user.id, continuationSchema.parse(await json(request))));
  } catch (error) { return errorResponse(error); }
}

export async function handleCatalogs(dependencies: TaskControllerDependencies) {
  try {
    await dependencies.authenticate();
    return privateJson({ success: true, data: await dependencies.catalogs() });
  } catch (error) { return errorResponse(error); }
}
