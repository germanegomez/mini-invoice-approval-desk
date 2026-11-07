import { handleTaskAction } from "@/lib/tasks/controller";
import { taskControllerDependencies } from "@/lib/tasks/controller-dependencies";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface RouteParams { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: RouteParams) {
  return handleTaskAction(request, (await params).id, taskControllerDependencies);
}
