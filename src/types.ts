/**
 * The server talks to the Google Slides API v1 (https://slides.googleapis.com,
 * REST over JSON). Comments, export and local-image upload need the Google
 * Drive API v3 (https://www.googleapis.com) as an internal dependency — those
 * endpoints are never exposed as generic Drive tools. Auth is Google OAuth
 * 2.0: a Bearer access token, minted on demand from a refresh token via
 * https://oauth2.googleapis.com/token (or a static short-lived access token,
 * mostly for testing).
 */

/**
 * Normalized shape types accepted by create_shape; the client maps them to the
 * API's wire ShapeType enum (TEXT_BOX, ROUND_RECTANGLE, STAR_5, ...). The API
 * knows ~140 shape types — anything beyond this everyday subset goes through
 * batch_update/raw_request with the wire enum.
 */
export type ShapeType =
  | "text_box"
  | "rectangle"
  | "round_rectangle"
  | "ellipse"
  | "diamond"
  | "triangle"
  | "right_arrow"
  | "left_arrow"
  | "up_arrow"
  | "down_arrow"
  | "star"
  | "heart"
  | "cloud"
  | "callout";

/**
 * Predefined slide layouts (API wire values, passed through). A concrete
 * presentation may support only a subset — its real layouts come from
 * list_layouts, addressable by layout_object_id.
 */
export type PredefinedLayout =
  | "BLANK"
  | "CAPTION_ONLY"
  | "TITLE"
  | "TITLE_AND_BODY"
  | "TITLE_AND_TWO_COLUMNS"
  | "TITLE_ONLY"
  | "SECTION_HEADER"
  | "SECTION_TITLE_AND_DESCRIPTION"
  | "ONE_COLUMN_TEXT"
  | "MAIN_POINT"
  | "BIG_NUMBER";

/** Thumbnail size, normalized; mapped to LARGE / MEDIUM / SMALL by the client. */
export type ThumbnailSize = "large" | "medium" | "small";

/** Export formats create_presentation files can be downloaded as (via Drive export). */
export type ExportFormat = "pdf" | "pptx" | "odp" | "txt";

/** How replace_image fits the new image into the old frame (wire values, passed through lowercased). */
export type ImageReplaceMethod = "center_inside" | "center_crop";

/** Table structure actions for edit_table. */
export type TableAction = "insert_rows" | "insert_columns" | "delete_row" | "delete_column";

/** Comment actions for manage_comments (Drive API v3, scoped to the presentation file). */
export type CommentAction = "list" | "get" | "create" | "reply" | "delete";

export interface GoogleSlidesConfig {
  /** OAuth2 client id (refresh flow). */
  clientId?: string;
  /** OAuth2 client secret (refresh flow). Treated as a secret. */
  clientSecret?: string;
  /** OAuth2 refresh token, exchanged for access tokens. Treated as a secret. */
  refreshToken?: string;
  /** Static access token (short-lived, ~1h). Used only when the refresh triple is absent. Treated as a secret. */
  accessToken?: string;
  /** Slides API root. Defaults to https://slides.googleapis.com. */
  apiBase: string;
  /** Drive API root (internal dependency: comments, export, image upload). Defaults to https://www.googleapis.com. */
  driveApiBase?: string;
  /** Per-request timeout in milliseconds. Defaults to 60_000. */
  timeoutMs?: number;
  /** Max retries for transient errors (429 always; 5xx/network for reads). Defaults to 3. */
  maxRetries?: number;
  /** Base backoff in milliseconds, doubled each retry. Defaults to 500. */
  retryBaseMs?: number;
}

/**
 * Google APIs report failures as a non-2xx HTTP status with a JSON envelope
 * ({ error: { code, message, status, details } }); the OAuth token endpoint
 * uses { error, error_description }. The parsed body is kept alongside the
 * status and a short readable message is derived.
 */
export class GoogleSlidesError extends Error {
  readonly status: number;
  readonly body?: unknown;

  constructor(status: number, body: unknown) {
    super(`HTTP ${status}: ${formatErrorBody(body)}`);
    this.name = "GoogleSlidesError";
    this.status = status;
    this.body = body;
  }
}

/** Turns a parsed Google API error body into a short, readable message. */
function formatErrorBody(body: unknown): string {
  if (body == null) return "(no body)";
  if (typeof body === "string") return body.slice(0, 500);
  if (typeof body !== "object") return String(body);
  const obj = body as Record<string, unknown>;

  // OAuth token endpoint style: { error: "invalid_grant", error_description: "..." }
  if (typeof obj.error === "string") {
    const description = typeof obj.error_description === "string" ? `: ${obj.error_description}` : "";
    return `${obj.error}${description}`.slice(0, 500);
  }

  // Google API envelope: { error: { code, message, status, details } }
  const err = (typeof obj.error === "object" && obj.error !== null ? obj.error : obj) as Record<string, unknown>;
  if (typeof err.message === "string") {
    const status = typeof err.status === "string" ? `[${err.status}] ` : "";
    return `${status}${err.message}`.slice(0, 500);
  }

  return JSON.stringify(obj).slice(0, 500);
}
