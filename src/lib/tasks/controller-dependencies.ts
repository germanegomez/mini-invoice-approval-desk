import "server-only";

import { requireAuthenticatedUser } from "@/lib/auth/guard";
import type { TaskControllerDependencies } from "./controller";
import { taskServerRepository } from "./server-repository";

export const taskControllerDependencies: TaskControllerDependencies = {
  authenticate: requireAuthenticatedUser,
  ...taskServerRepository,
};
