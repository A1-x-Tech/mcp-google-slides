import { ConfigError, CredentialsError, loadConfig } from "./config.js";
import { GoogleSlidesClient } from "./client.js";

/**
 * Live smoke check (opt-in, refresh-flow credentials required).
 *
 * Default mode is READ-ONLY: with a presentation id (argv or
 * GOOGLE_SLIDES_SMOKE_PRESENTATION_ID) it fetches the slide inventory;
 * otherwise it just mints an access token from the refresh token — either way
 * the credentials are exercised for real and nothing is written.
 *
 * GOOGLE_SLIDES_SMOKE_WRITE=1 additionally runs the full write path on a
 * DISPOSABLE presentation: create → add slide → set text → read back →
 * delete the Drive file. Cleanup runs on success and on error alike; if the
 * deletion itself fails the presentation id is printed so it can be removed
 * by hand. Requires the https://www.googleapis.com/auth/drive.file (or drive)
 * scope on top of presentations.
 */
async function main(): Promise<void> {
  const client = new GoogleSlidesClient(loadConfig());

  if ((process.env.GOOGLE_SLIDES_SMOKE_WRITE ?? "") === "1") {
    await writeSmoke(client);
    return;
  }

  const presentationId = process.argv[2] ?? process.env.GOOGLE_SLIDES_SMOKE_PRESENTATION_ID;
  if (presentationId) {
    console.log(JSON.stringify(await client.listSlides(presentationId), null, 2));
    return;
  }
  console.log(JSON.stringify(await client.authCheck(), null, 2));
}

async function writeSmoke(client: GoogleSlidesClient): Promise<void> {
  const title = `mcp-google-slides smoke ${new Date().toISOString()}`;
  const created = (await client.createPresentation(title)) as { presentationId?: string };
  const id = created.presentationId;
  if (!id) throw new Error("create returned no presentationId");
  console.log(`created disposable presentation ${id}`);

  try {
    const added = (await client.addSlide({ presentationId: id, predefinedLayout: "BLANK" })) as {
      replies?: Array<{ createSlide?: { objectId?: string } }>;
    };
    const slideId = added.replies?.[0]?.createSlide?.objectId;
    if (!slideId) throw new Error("addSlide returned no objectId");

    await client.createShape({
      presentationId: id,
      pageObjectId: slideId,
      shapeType: "text_box",
      text: "smoke ok",
    });
    const summary = (await client.listSlides(id)) as { slideCount?: number };
    if ((summary.slideCount ?? 0) < 2) throw new Error("expected the added slide in the summary");
    console.log(JSON.stringify({ ok: true, presentationId: id, slides: summary.slideCount }, null, 2));
  } finally {
    // Cleanup after success AND failure — the deck is disposable by contract.
    try {
      await client.deleteDriveFile(id);
      console.log(`deleted disposable presentation ${id}`);
    } catch (err) {
      console.error(
        `cleanup failed — delete presentation ${id} manually:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
}

main().catch((err) => {
  // Missing or malformed credentials are a user error, not a bug: no stack.
  const userError = err instanceof ConfigError || err instanceof CredentialsError;
  console.error("smoke failed:", userError ? err.message : err);
  process.exit(1);
});
