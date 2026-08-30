# Google Slides MCP capabilities

This catalog contains 26 public pages—one for every registered MCP tool in `mcp-google-slides`. Each page starts with the user's task, explains the result, and states whether the call changes real data.

Use this catalog to choose a ready-made capability. Full parameter schemas and API response details remain in the [technical reference](../TOOLS.md).

## Presentations

- [Raw batchUpdate](./batch-update.md) — Sends raw Slides API batchUpdate requests for anything the typed tools don't cover: updateShapeProperties (fill, outline, shadow), updatePageProperties (slide background), updateParagraphStyle, createParagraphBullets, updateTableCellProperties, mergeTableCells, createVideo, createLine, groupObjects, updateSlideProperties and the rest of the request union. requests is the API's requests[] array verbatim, e.g. [{"updateShapeProperties":{"objectId":"...","shapeProperties":{...},"fields":"shapeFill"}}]. **Impact:** destructive operation.
- [Create a presentation](./create-presentation.md) — Creates a new Google Slides presentation and returns it (presentationId, revisionId, pageSize, the initial title slide with its object ids, layouts and masters). **Impact:** changes data.
- [Get one page](./get-page.md) — Returns one page in full by its object id — works for slides, layouts, masters and notes pages alike. **Impact:** read-only.
- [Get a presentation](./get-presentation.md) — Returns the raw presentation JSON: slides[] with every page element (shapes, text runs, tables, images), layouts[], masters[], notesMaster, pageSize (EMU: 1 pt = 12700 EMU) and revisionId. **Impact:** read-only.
- [List slides (compact inventory)](./list-slides.md) — Compact inventory of the deck — the read to start from: presentationId, title, revisionId, pageSizePt, slideCount and per slide its 0-based index, objectId, layoutObjectId, speakerNotesObjectId and elements[] with each element's objectId, type (shape type / table RxC / image / video / line / group), placeholder role and visible text (truncated to 160 chars). **Impact:** read-only.

## Slides and layouts

- [Add a slide](./add-slide.md) — Adds a slide (batchUpdate createSlide) and returns the new slide's objectId in the reply. **Impact:** changes data.
- [Delete a slide or element](./delete-object.md) — Deletes a slide or a page element (shape, image, table, video, line, group) by object id — batchUpdate deleteObject. **Impact:** destructive operation.
- [Duplicate a slide](./duplicate-slide.md) — Duplicates a slide (batchUpdate duplicateObject) — the copy, with all its elements and speaker notes, lands immediately after the original and its new objectId comes back in the reply. **Impact:** changes data.
- [List layouts and masters](./list-layouts.md) — Lists the presentation's theme building blocks: layouts[] (objectId, name like TITLE_AND_BODY, displayName, masterObjectId), masters[] and the notesMasterObjectId. **Impact:** read-only.
- [Move slides](./move-slides.md) — Moves one or more slides to a new position (batchUpdate updateSlidesPosition). slide_object_ids must appear in their current deck order with no duplicates; insertion_index is the 0-based position BEFORE the move is applied (moving a slide down: index counts with the slide still in its old place). **Impact:** changes data.

## Text

- [Insert text](./insert-text.md) — Inserts text into a shape or a table cell (batchUpdate insertText) at a 0-based character index (default 0 = the beginning). **Impact:** changes data.
- [Find & replace text](./replace-text.md) — Finds and replaces every occurrence of a string across the whole deck — shapes and table cells on slides, and their speaker notes (batchUpdate replaceAllText). **Impact:** destructive operation.
- [Set (replace) text](./set-text.md) — Replaces the ENTIRE text of a shape or table cell: one atomic batch of deleteText(ALL) + insertText. **Impact:** destructive operation.
- [Style text](./update-text-style.md) — Styles the text of a shape or table cell (batchUpdate updateTextStyle): bold, italic, underline, strikethrough, font_family (e.g. **Impact:** destructive operation.

## Shapes and images

- [Insert an image](./create-image.md) — Inserts an image on a slide (batchUpdate createImage) from EITHER image_url — a public https URL Google's servers can fetch (validated: https-only, no private/local hosts, ≤2 kB; the image itself must be PNG/JPEG/GIF, ≤50 MB, ≤25 megapixels) — OR image_path, a local file that is checked by magic bytes, uploaded to Drive, shared by link for the fetch and DELETED from Drive right after (Slides stores its own copy, so the temp file is disposable; the result reports the cleanup). **Impact:** changes data.
- [Create a shape](./create-shape.md) — Creates a shape on a slide (batchUpdate createShape), optionally with its initial text in the same atomic batch. **Impact:** changes data.
- [Replace an image](./replace-image.md) — Swaps the bitmap of an existing image element while keeping its frame, position and effects (batchUpdate replaceImage). **Impact:** destructive operation.
- [Move / scale an element](./update-transform.md) — Moves and/or scales a page element (batchUpdate updatePageElementTransform). mode=absolute REPLACES the element's whole transform: translate_x_pt/translate_y_pt become the new top-left-ish origin and omitted scales default to 1 — NOT to the current values, so an absolute move of a scaled element also resets its scale unless you resend it. mode=relative multiplies onto the existing transform: translate shifts by the given points, scale 2 doubles the current size (scaling happens around the origin, which also shifts the element — for a simple move prefer relative translate only). **Impact:** destructive operation.

## Tables

- [Create a table](./create-table.md) — Creates an empty rows x columns table on a slide (batchUpdate createTable) and returns its objectId in the reply. **Impact:** changes data.
- [Edit table structure](./edit-table.md) — Restructures an existing table in one call. action=insert_rows needs row_index (+optional below, default true, and count 1-20); insert_columns needs column_index (+optional right, default true, and count); delete_row needs row_index and delete_column needs column_index — deletion permanently discards the cells' content, and the remaining rows/columns shift so indexes change between successive edits (re-check with list_slides). **Impact:** destructive operation.

## Speaker notes

- [Get speaker notes](./get-speaker-notes.md) — Returns a slide's speaker notes as plain text, plus the speakerNotesObjectId (the text shape on the slide's hidden notes page). **Impact:** read-only.
- [Set speaker notes](./set-speaker-notes.md) — Replaces a slide's speaker notes with the given text (empty string clears them). **Impact:** destructive operation.

## Comments

- [Manage comments](./manage-comments.md) — Comment threads on the presentation file (served by the Drive API internally — scoped to this one file, no generic Drive access). action=list returns comments with replies and resolved status (pageSize/page_token to paginate, include_deleted for tombstones); get needs comment_id; create needs content and starts a new unanchored thread (the API cannot anchor a new comment to a specific slide or shape); reply needs comment_id + content and/or resolve=true (resolve closes the thread); delete needs comment_id and permanently removes the thread with all replies. **Impact:** destructive operation.

## Thumbnails and export

- [Export the presentation](./export-presentation.md) — Downloads the whole presentation as pdf, pptx, odp or txt (txt = all text incl. speaker notes) and saves it to output_path, overwriting an existing file. **Impact:** read-only.
- [Get a slide thumbnail](./get-thumbnail.md) — Renders one page (slide, layout or master) as a PNG. **Impact:** read-only.

## Additional API methods

- [Raw Google Slides API call](./raw-request.md) — Escape hatch to call any Google Slides API v1 path directly, for requests even batch_update doesn't cover — e.g. **Impact:** destructive operation.

## For maintainers and publishers

- [MCP capability documentation contract](../CAPABILITY-DOCUMENTATION.md)
- [Technical tool reference](../TOOLS.md)
- [GitHub repository](https://github.com/A1-x-Tech/mcp-google-slides)
