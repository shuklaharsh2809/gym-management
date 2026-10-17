import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "./session";

/** Platform admin gate. Non-admins get a 404 so the area's existence isn't revealed. */
export async function requirePlatformAdminUser() {
  const user = await requireUser();
  if (user.platformRole !== "ADMIN") notFound();
  return user;
}
