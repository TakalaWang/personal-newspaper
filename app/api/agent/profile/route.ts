import { isAuthorizedAgentRequest, parseProfileUpdate } from "@/lib/agent";
import { getAutomationToken, getDb } from "@/db";
import { profiles } from "@/db/schema";

export async function PUT(request: Request): Promise<Response> {
  if (!isAuthorizedAgentRequest(request, getAutomationToken())) return unauthorized();

  let profile;
  try {
    profile = parseProfileUpdate(await request.json());
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 400 });
  }

  try {
    const updatedAt = new Date();
    await getDb()
      .insert(profiles)
      .values({ id: 1, ...profile, preferences: JSON.stringify(profile.preferences), updatedAt })
      .onConflictDoUpdate({
        target: profiles.id,
        set: {
          ...profile,
          preferences: JSON.stringify(profile.preferences),
          updatedAt,
        },
      });
    return Response.json({ profile });
  } catch (error) {
    console.error("Unable to save agent profile", error);
    return Response.json({ error: "Unable to save agent profile" }, { status: 500 });
  }
}

function unauthorized(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Invalid profile";
}
