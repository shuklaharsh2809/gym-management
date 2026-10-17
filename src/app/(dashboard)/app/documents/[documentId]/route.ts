import { isAppError } from "@/lib/errors";
import { getDocumentForDownload } from "@/modules/documents/service";
import { getOrganizationContext } from "@/server/auth/session";
import { db } from "@/server/database/client";

/** Authorized, audited download of a member document. Never cached. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const ctx = await getOrganizationContext().catch(() => null);
  if (!ctx) return new Response("Unauthorized", { status: 401 });
  try {
    const doc = await getDocumentForDownload(db, ctx, (await params).documentId);
    return new Response(new Uint8Array(doc.content), {
      headers: {
        "content-type": doc.contentType,
        "content-length": String(doc.sizeBytes),
        "content-disposition": `attachment; filename="${doc.fileName.replaceAll('"', "")}"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    if (isAppError(error))
      return new Response(error.code === "FORBIDDEN" ? "Forbidden" : "Not found", {
        status: error.code === "FORBIDDEN" ? 403 : 404,
      });
    throw error;
  }
}
