import { handleCatalogs } from "@/lib/tasks/controller";
import { taskControllerDependencies } from "@/lib/tasks/controller-dependencies";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  return handleCatalogs(taskControllerDependencies);
}
