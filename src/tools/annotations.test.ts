import { test } from "node:test";
import assert from "node:assert/strict";
import { registerPresentationTools } from "./presentations.js";
import { registerSlideTools } from "./slides.js";
import { registerTextTools } from "./text.js";
import { registerElementTools } from "./elements.js";
import { registerTableTools } from "./tables.js";
import { registerNoteTools } from "./notes.js";
import { registerCommentTools } from "./comments.js";
import { registerExportTools } from "./export.js";
import { registerRawTool } from "./raw.js";
import { DESTRUCTIVE, READ_ONLY, UPDATE, WRITE } from "./util.js";

interface Annotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

/** Registers every tool against a fake server, capturing each tool's annotations. */
function collectAnnotations(): Record<string, Annotations | undefined> {
  const annotations: Record<string, Annotations | undefined> = {};
  const server = {
    registerTool: (name: string, cfg: { annotations?: Annotations }) => {
      annotations[name] = cfg.annotations;
    },
  };
  // Registration reads the client only inside handlers, so a stub is fine here.
  registerPresentationTools(server as never, {} as never);
  registerSlideTools(server as never, {} as never);
  registerTextTools(server as never, {} as never);
  registerElementTools(server as never, {} as never);
  registerTableTools(server as never, {} as never);
  registerNoteTools(server as never, {} as never);
  registerCommentTools(server as never, {} as never);
  registerExportTools(server as never, {} as never);
  registerRawTool(server as never, {} as never);
  return annotations;
}

const ANN = collectAnnotations();

/**
 * The Slides API mixes reads and writes, so instead of one blanket invariant the
 * expected hints are pinned per tool. Changing a tool's annotation must be a
 * conscious decision that updates this map.
 */
const EXPECTED: Record<string, Annotations> = {
  create_presentation: WRITE,
  get_presentation: READ_ONLY,
  list_slides: READ_ONLY,
  get_page: READ_ONLY,
  batch_update: DESTRUCTIVE,
  add_slide: WRITE,
  duplicate_slide: WRITE,
  move_slides: WRITE,
  delete_object: DESTRUCTIVE,
  list_layouts: READ_ONLY,
  insert_text: WRITE,
  set_text: UPDATE,
  replace_text: UPDATE,
  update_text_style: UPDATE,
  create_shape: WRITE,
  create_image: WRITE,
  replace_image: UPDATE,
  update_transform: UPDATE,
  create_table: WRITE,
  edit_table: DESTRUCTIVE,
  get_speaker_notes: READ_ONLY,
  set_speaker_notes: UPDATE,
  manage_comments: DESTRUCTIVE,
  get_thumbnail: READ_ONLY,
  export_presentation: READ_ONLY,
  raw_request: DESTRUCTIVE,
};

test("registers all twenty-six tools with annotations", () => {
  assert.deepEqual(Object.keys(ANN).sort(), Object.keys(EXPECTED).sort());
  for (const [name, a] of Object.entries(ANN)) {
    assert.ok(a, `${name} is missing annotations`);
  }
});

test("every tool carries exactly its pinned hints (all four set)", () => {
  for (const [name, expected] of Object.entries(EXPECTED)) {
    assert.deepEqual(ANN[name], expected, `${name} annotations drifted`);
  }
});

test("pure reads stay read-only — exports and thumbnails change nothing in the deck", () => {
  for (const name of [
    "get_presentation",
    "list_slides",
    "get_page",
    "list_layouts",
    "get_speaker_notes",
    "get_thumbnail",
    "export_presentation",
  ]) {
    assert.equal(ANN[name]?.readOnlyHint, true, `${name} must be read-only`);
  }
});
