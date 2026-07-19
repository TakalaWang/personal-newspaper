import { isAuthorizedAgentRequest } from "@/lib/agent";
import { loadAgentContextState } from "@/lib/agent-context";
import { getAutomationToken } from "@/db";

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorizedAgentRequest(request, getAutomationToken())) return unauthorized();

  try {
    return Response.json(await loadAgentContextState());
  } catch (error) {
    console.error("Unable to load agent context", error);
    return Response.json({ error: "Unable to load agent context" }, { status: 500 });
  }
}

function unauthorized(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
