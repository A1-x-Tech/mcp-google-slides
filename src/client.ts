import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { basename, resolve as resolvePath } from "node:path";
import type {
  CommentAction,
  ExportFormat,
  GoogleSlidesConfig,
  ImageReplaceMethod,
  PredefinedLayout,
  ShapeType,
  TableAction,
  ThumbnailSize,
} from "./types.js";
import { GoogleSlidesError } from "./types.js";
import { CredentialsError } from "./config.js";

export type HttpMethod = "GET" | "POST" | "DELETE";

/** Google's OAuth2 token endpoint — refresh tokens are exchanged here. */
const TOKEN_URL = "https://oauth2.googleapis.com/token";

/** Slides rejects image URLs longer than 2 kB. */
const MAX_IMAGE_URL_LENGTH = 2000;

/** Slides rejects images larger than 50 MB. */
const MAX_IMAGE_BYTES = 50 * 1024 * 1024;

/** Maps a normalized shape type to the API's wire ShapeType. */
const SHAPE_TYPE_WIRE: Record<ShapeType, string> = {
  text_box: "TEXT_BOX",
  rectangle: "RECTANGLE",
  round_rectangle: "ROUND_RECTANGLE",
  ellipse: "ELLIPSE",
  diamond: "DIAMOND",
  triangle: "TRIANGLE",
  right_arrow: "RIGHT_ARROW",
  left_arrow: "LEFT_ARROW",
  up_arrow: "UP_ARROW",
  down_arrow: "DOWN_ARROW",
  star: "STAR_5",
  heart: "HEART",
  cloud: "CLOUD",
  callout: "WEDGE_RECTANGLE_CALLOUT",
};

/** Export formats → the Drive export MIME types for a Google Slides file. */
const EXPORT_MIME: Record<ExportFormat, string> = {
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odp: "application/vnd.oasis.opendocument.presentation",
  txt: "text/plain",
};

/**
 * A trimmed `fields` mask for slide summaries — a full presentation JSON runs
 * to hundreds of kilobytes; the consumer is an LLM, so only ids, structure and
 * text survive.
 */
const SUMMARY_FIELDS =
  "presentationId,title,revisionId,pageSize," +
  "slides(objectId,slideProperties(layoutObjectId,masterObjectId,notesPage(notesProperties(speakerNotesObjectId)))," +
  "pageElements(objectId,shape(shapeType,placeholder(type),text(textElements(textRun(content))))," +
  "table(rows,columns),image(sourceUrl),video(id),line(lineProperties),elementGroup(children(objectId))))";

/** `fields` mask for the layouts/masters catalog. */
const LAYOUTS_FIELDS =
  "layouts(objectId,layoutProperties(name,displayName,masterObjectId))," +
  "masters(objectId,masterProperties(displayName)),notesMaster(objectId)";

/**
 * Validates an image URL before it is handed to the Slides API: https-only, no
 * private/loopback hosts (the URL lands in the deck and is fetched by Google —
 * an internal hostname would leak into a shared document and never resolve),
 * and within the API's 2 kB limit. Pure validation — no request is made.
 */
export function validateImageUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("image_url must be an absolute URL.");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("image_url must use https — Google's servers fetch it and reject plain http.");
  }
  if (url.length > MAX_IMAGE_URL_LENGTH) {
    throw new Error(`image_url is too long (${url.length} chars) — the Slides API rejects URLs over 2 kB.`);
  }
  const host = parsed.hostname.toLowerCase();
  const privateHost =
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||
    host === "0.0.0.0" ||
    host === "[::1]" ||
    host.startsWith("[fc") ||
    host.startsWith("[fd") ||
    host.startsWith("[fe80");
  if (privateHost) {
    throw new Error(
      `image_url points at a private or local host (${host}) — Google's servers cannot fetch it. ` +
        "Use a public https URL, or pass image_path to upload a local file.",
    );
  }
}

/**
 * Identifies an image by magic bytes. The Slides API accepts only PNG, JPEG
 * and GIF; trusting the file extension would upload junk to Drive first and
 * fail late, so the real bytes are checked instead.
 */
export function sniffImageType(data: Uint8Array): { mimeType: string; format: string } | undefined {
  if (data.length >= 8 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) {
    return { mimeType: "image/png", format: "png" };
  }
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return { mimeType: "image/jpeg", format: "jpeg" };
  }
  if (data.length >= 6 && data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x38) {
    return { mimeType: "image/gif", format: "gif" };
  }
  return undefined;
}

/** A Dimension in points. */
function pt(magnitude: number): { magnitude: number; unit: "PT" } {
  return { magnitude, unit: "PT" };
}

/** Parses "#RRGGBB" (leading # optional) into the API's rgbColor (floats 0..1). */
export function hexToRgbColor(hex: string): { red: number; green: number; blue: number } {
  const clean = hex.replace(/^#/, "");
  const n = parseInt(clean, 16);
  return {
    red: Math.round((((n >> 16) & 0xff) / 255) * 10000) / 10000,
    green: Math.round((((n >> 8) & 0xff) / 255) * 10000) / 10000,
    blue: Math.round(((n & 0xff) / 255) * 10000) / 10000,
  };
}

/** A fresh valid object id (5-50 chars of [a-zA-Z0-9_-:], leading alnum/underscore). */
function generateObjectId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

/** Position/size in points for a new page element. */
export interface PlacementParams {
  xPt?: number;
  yPt?: number;
  widthPt?: number;
  heightPt?: number;
}

/**
 * Builds elementProperties from a page id and optional placement. Size needs
 * both width+height and position both x+y — half a pair is a caller mistake,
 * not something to guess.
 */
function elementProperties(pageObjectId: string, p: PlacementParams): Record<string, unknown> {
  if ((p.widthPt === undefined) !== (p.heightPt === undefined)) {
    throw new Error("width_pt and height_pt must be provided together.");
  }
  if ((p.xPt === undefined) !== (p.yPt === undefined)) {
    throw new Error("x_pt and y_pt must be provided together.");
  }
  return compact({
    pageObjectId,
    size: p.widthPt !== undefined ? { width: pt(p.widthPt), height: pt(p.heightPt as number) } : undefined,
    transform:
      p.xPt !== undefined
        ? { scaleX: 1, scaleY: 1, translateX: p.xPt, translateY: p.yPt as number, unit: "PT" }
        : undefined,
  });
}

/** Table cell location: rowIndex and columnIndex travel together or not at all. */
function cellLocation(rowIndex?: number, columnIndex?: number): Record<string, number> | undefined {
  if ((rowIndex === undefined) !== (columnIndex === undefined)) {
    throw new Error("row_index and column_index must be provided together (they address one table cell).");
  }
  if (rowIndex === undefined) return undefined;
  return { rowIndex, columnIndex: columnIndex as number };
}

/** Concatenates the text runs of a Slides `text` payload into plain text. */
export function extractText(text: unknown): string {
  const elements = (text as { textElements?: unknown[] } | undefined)?.textElements;
  if (!Array.isArray(elements)) return "";
  let out = "";
  for (const el of elements) {
    const content = (el as { textRun?: { content?: unknown } }).textRun?.content;
    if (typeof content === "string") out += content;
  }
  return out.replace(/\n$/, "");
}

// ---- Normalized parameter shapes (tools speak these; wire enums stay here) ----

export interface AddSlideParams {
  presentationId: string;
  /** 0-based position for the new slide; appended at the end when omitted. */
  insertionIndex?: number;
  predefinedLayout?: PredefinedLayout;
  layoutObjectId?: string;
  objectId?: string;
}

export interface InsertTextParams {
  presentationId: string;
  objectId: string;
  text: string;
  insertionIndex?: number;
  rowIndex?: number;
  columnIndex?: number;
}

export interface SetTextParams {
  presentationId: string;
  objectId: string;
  text: string;
  rowIndex?: number;
  columnIndex?: number;
}

export interface ReplaceTextParams {
  presentationId: string;
  find: string;
  replace: string;
  matchCase?: boolean;
  pageObjectIds?: string[];
}

export interface UpdateTextStyleParams {
  presentationId: string;
  objectId: string;
  rowIndex?: number;
  columnIndex?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  fontFamily?: string;
  fontSizePt?: number;
  foregroundColor?: string;
  linkUrl?: string;
  startIndex?: number;
  endIndex?: number;
}

export interface CreateShapeParams extends PlacementParams {
  presentationId: string;
  pageObjectId: string;
  shapeType: ShapeType;
  objectId?: string;
  /** Initial text, inserted into the new shape in the same atomic batch. */
  text?: string;
}

export interface ImageSource {
  imageUrl?: string;
  imagePath?: string;
}

export interface CreateImageParams extends PlacementParams, ImageSource {
  presentationId: string;
  pageObjectId: string;
  objectId?: string;
}

export interface ReplaceImageParams extends ImageSource {
  presentationId: string;
  imageObjectId: string;
  replaceMethod?: ImageReplaceMethod;
}

export interface UpdateTransformParams {
  presentationId: string;
  objectId: string;
  mode: "absolute" | "relative";
  translateXPt?: number;
  translateYPt?: number;
  scaleX?: number;
  scaleY?: number;
}

export interface CreateTableParams extends PlacementParams {
  presentationId: string;
  pageObjectId: string;
  rows: number;
  columns: number;
  objectId?: string;
}

export interface EditTableParams {
  presentationId: string;
  tableObjectId: string;
  action: TableAction;
  rowIndex?: number;
  columnIndex?: number;
  count?: number;
  /** insert_rows: insert below the reference row (default true = below). */
  below?: boolean;
  /** insert_columns: insert to the right of the reference column (default true = right). */
  right?: boolean;
}

export interface ManageCommentsParams {
  presentationId: string;
  action: CommentAction;
  commentId?: string;
  content?: string;
  resolve?: boolean;
  pageSize?: number;
  pageToken?: string;
  includeDeleted?: boolean;
}

export interface ThumbnailParams {
  presentationId: string;
  pageObjectId: string;
  size?: ThumbnailSize;
  outputPath?: string;
}

export class GoogleSlidesClient {
  private readonly base: string;
  private readonly driveBase: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;
  /** Cached access token from the refresh flow, with its expiry. */
  private cachedToken?: { value: string; expiresAt: number };
  /** In-flight refresh, deduping concurrent token requests. */
  private refreshInFlight?: Promise<string>;

  constructor(private readonly config: GoogleSlidesConfig) {
    this.base = config.apiBase.endsWith("/") ? config.apiBase : config.apiBase + "/";
    const drive = config.driveApiBase ?? "https://www.googleapis.com";
    this.driveBase = drive.endsWith("/") ? drive : drive + "/";
    this.timeoutMs = config.timeoutMs ?? 60_000;
    this.maxRetries = config.maxRetries ?? 3;
    this.retryBaseMs = config.retryBaseMs ?? 500;
  }

  private canRefresh(): boolean {
    return Boolean(this.config.refreshToken && this.config.clientId && this.config.clientSecret);
  }

  /**
   * Returns a valid Bearer token. With the refresh triple configured, mints an
   * access token from the refresh token and caches it until shortly before it
   * expires (concurrent callers share one in-flight refresh); otherwise the
   * static GOOGLE_SLIDES_ACCESS_TOKEN is used as-is. With neither configured,
   * throws {@link CredentialsError} BEFORE any fetch — a missing setup must
   * never enter the retry/backoff loop or trigger the 401 re-mint, because no
   * amount of retrying mints credentials.
   */
  private async accessToken(forceRefresh = false): Promise<string> {
    if (!this.canRefresh()) {
      if (!this.config.accessToken) throw new CredentialsError();
      return this.config.accessToken;
    }
    if (!forceRefresh && this.cachedToken && Date.now() < this.cachedToken.expiresAt) {
      return this.cachedToken.value;
    }
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.refreshAccessToken().finally(() => {
        this.refreshInFlight = undefined;
      });
    }
    return this.refreshInFlight;
  }

  /** Exchanges the refresh token for a fresh access token at Google's token endpoint. */
  private async refreshAccessToken(): Promise<string> {
    const body = new URLSearchParams({
      client_id: this.config.clientId as string,
      client_secret: this.config.clientSecret as string,
      refresh_token: this.config.refreshToken as string,
      grant_type: "refresh_token",
    }).toString();

    const { res, text } = await this.fetchWithTimeout(
      TOKEN_URL,
      { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body },
      "oauth2 token refresh",
    );

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    if (!res.ok) throw new GoogleSlidesError(res.status, data);

    const token = (data as { access_token?: unknown }).access_token;
    if (typeof token !== "string" || !token) {
      throw new Error("OAuth2 token endpoint returned no access_token.");
    }
    const expiresIn = Number((data as { expires_in?: unknown }).expires_in);
    const ttl = Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600;
    // Refresh 60s ahead of the real expiry so requests never race a dying token.
    this.cachedToken = { value: token, expiresAt: Date.now() + Math.max(ttl - 60, 30) * 1000 };
    return token;
  }

  /** Verifies the OAuth credentials by minting a fresh access token (refresh flow only). */
  async authCheck(): Promise<unknown> {
    if (!this.canRefresh()) {
      throw new Error(
        "authCheck needs the refresh flow (GOOGLE_SLIDES_CLIENT_ID / _CLIENT_SECRET / _REFRESH_TOKEN); with a static GOOGLE_SLIDES_ACCESS_TOKEN fetch a presentation instead.",
      );
    }
    await this.accessToken(true);
    return { ok: true, auth: "refresh_token" };
  }

  /** Backoff before a retry: honors Retry-After when present, else exponential (capped at 30s). */
  private backoffMs(attempt: number, res?: Response): number {
    const retryAfter = res ? Number(res.headers.get("Retry-After")) : NaN;
    if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter, 30) * 1000;
    return Math.min(this.retryBaseMs * 2 ** attempt, 30_000);
  }

  /**
   * fetch with an AbortController timeout. Reads the response body inside the
   * guarded zone so the timeout also covers a slow or drip-feeding body, not
   * just the initial headers, and returns the text alongside the response.
   */
  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    label: string,
  ): Promise<{ res: Response; text: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      const text = await res.text();
      return { res, text };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`Request to "${label}" timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Like fetchWithTimeout, but keeps the body as bytes (thumbnails, exports). */
  private async fetchBytesWithTimeout(
    url: string,
    init: RequestInit,
    label: string,
  ): Promise<{ res: Response; bytes: Uint8Array }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      const bytes = new Uint8Array(await res.arrayBuffer());
      return { res, bytes };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`Request to "${label}" timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Low-level request to the Slides API (paths like "v1/presentations/abc").
   * Auth is a Bearer token (refreshed transparently; a 401 forces one re-mint +
   * retry). 429 is always retried with backoff; 5xx and network errors/timeouts
   * are retried only for GET — batchUpdate is a real write, and replaying it
   * after the write committed would duplicate slides/elements. Any other
   * non-2xx throws a {@link GoogleSlidesError}.
   */
  async request<T = unknown>(
    method: HttpMethod,
    path: string,
    body?: Record<string, unknown>,
    query?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    return this.requestAgainst(this.base, method, path, body, query);
  }

  /**
   * Internal Drive API v3 calls (comments, export metadata, image upload
   * cleanup). Same auth/retry/SSRF rules as {@link request}, resolved against
   * the Drive base — never exposed as a generic Drive tool.
   */
  private async driveRequest<T = unknown>(
    method: HttpMethod,
    path: string,
    body?: Record<string, unknown>,
    query?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    return this.requestAgainst(this.driveBase, method, path, body, query);
  }

  private async requestAgainst<T>(
    base: string,
    method: HttpMethod,
    path: string,
    body?: Record<string, unknown>,
    query?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    // Guard method !== "GET" keeps undici from crashing on a GET-with-body.
    const hasBody = body !== undefined && method !== "GET";

    // Resolve the path against the API base, then reject anything that escaped
    // to a foreign origin (an absolute "https://evil/x" or a "\\evil/x" slipped
    // through raw_request) so the Bearer token can never leak to another host.
    const url = new URL(path.replace(/^\//, ""), base);
    if (url.origin !== new URL(base).origin) {
      throw new Error(`raw_request path must be a relative API path (resolved to foreign origin ${url.origin})`);
    }
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }
    const target = url.toString();

    // Writes must not be replayed on ambiguous failures (see the retry gate below).
    const idempotent = method === "GET";
    let refreshedOn401 = false;

    for (let attempt = 0; ; attempt++) {
      const token = await this.accessToken();
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (hasBody) headers["Content-Type"] = "application/json";

      let res: Response;
      let text: string;
      try {
        ({ res, text } = await this.fetchWithTimeout(
          target,
          { method, headers, body: hasBody ? JSON.stringify(body) : undefined },
          path,
        ));
      } catch (err) {
        // Network error or timeout: the request may or may not have reached the
        // API, so only reads are retried; writes rethrow immediately.
        if (idempotent && attempt < this.maxRetries) {
          await delay(this.backoffMs(attempt));
          continue;
        }
        throw err;
      }

      // An expired/revoked access token: re-mint once and replay. The request
      // never executed, so this is safe for writes too. The replay must not
      // eat into the transient-retry budget (attempt-- cancels the loop's
      // attempt++), so a 429/5xx after the re-mint still gets maxRetries
      // tries; refreshedOn401 guarantees this runs at most once.
      if (res.status === 401 && this.canRefresh() && !refreshedOn401) {
        refreshedOn401 = true;
        await this.accessToken(true);
        attempt--;
        continue;
      }

      // 429 means the request was rejected before executing — safe to retry for
      // any method. 5xx is ambiguous (the write may have committed), so it is
      // gated to idempotent requests.
      const transient = res.status === 429 || (idempotent && res.status >= 500 && res.status < 600);
      if (transient && attempt < this.maxRetries) {
        await delay(this.backoffMs(attempt, res));
        continue;
      }

      let data: unknown = undefined;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }

      if (!res.ok) throw new GoogleSlidesError(res.status, data);
      return data as T;
    }
  }

  /**
   * Authenticated binary download (Drive export). GET-only; one forced token
   * re-mint on 401, no other retries — an export that dies halfway is safer
   * re-requested by the caller than silently re-streamed.
   */
  private async downloadWithAuth(url: string, label: string): Promise<Uint8Array> {
    for (let attempt = 0; ; attempt++) {
      const token = await this.accessToken(attempt > 0);
      const { res, bytes } = await this.fetchBytesWithTimeout(
        url,
        { method: "GET", headers: { Authorization: `Bearer ${token}` } },
        label,
      );
      if (res.status === 401 && this.canRefresh() && attempt === 0) continue;
      if (!res.ok) {
        let parsed: unknown;
        const text = new TextDecoder().decode(bytes);
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = text;
        }
        throw new GoogleSlidesError(res.status, parsed);
      }
      return bytes;
    }
  }

  // ---- Presentations ----

  /**
   * Creates a presentation. presentations.create honors only the title —
   * everything else (slides, text, elements) is added via batchUpdate
   * afterwards. The new deck starts with one title slide.
   */
  async createPresentation(title: string): Promise<unknown> {
    return this.request("POST", "v1/presentations", { title });
  }

  /** Full presentation structure, optionally trimmed by a `fields` mask. */
  async getPresentation(presentationId: string, fields?: string): Promise<unknown> {
    return this.request(
      "GET",
      `v1/presentations/${encodeURIComponent(presentationId)}`,
      undefined,
      compact({ fields }),
    );
  }

  /** One page (slide, layout, master or notes page) by its object id. */
  async getPage(presentationId: string, pageObjectId: string): Promise<unknown> {
    return this.request(
      "GET",
      `v1/presentations/${encodeURIComponent(presentationId)}/pages/${encodeURIComponent(pageObjectId)}`,
    );
  }

  /**
   * Compact per-slide inventory: object ids, layout, speaker-notes shape id and
   * every page element with its type and visible text. A full presentation
   * JSON is enormous; this is the read the model should start from.
   */
  async listSlides(presentationId: string): Promise<unknown> {
    const data = (await this.getPresentation(presentationId, SUMMARY_FIELDS)) as Record<string, unknown>;
    return summarizePresentation(data);
  }

  /** The presentation's layouts and masters — what add_slide can instantiate. */
  async listLayouts(presentationId: string): Promise<unknown> {
    const data = (await this.getPresentation(presentationId, LAYOUTS_FIELDS)) as {
      layouts?: Array<Record<string, unknown>>;
      masters?: Array<Record<string, unknown>>;
      notesMaster?: { objectId?: string };
    };
    return {
      layouts: (data.layouts ?? []).map((l) => {
        const props = (l.layoutProperties ?? {}) as Record<string, unknown>;
        return compact({
          objectId: l.objectId,
          name: props.name,
          displayName: props.displayName,
          masterObjectId: props.masterObjectId,
        });
      }),
      masters: (data.masters ?? []).map((m) =>
        compact({
          objectId: m.objectId,
          displayName: ((m.masterProperties ?? {}) as Record<string, unknown>).displayName,
        }),
      ),
      notesMasterObjectId: data.notesMaster?.objectId,
    };
  }

  /**
   * A rendered thumbnail of one page. Returns contentUrl (short-lived, ~30
   * minutes) + dimensions; with outputPath the PNG is downloaded and saved.
   * The download goes only to *.googleusercontent.com — where Google serves
   * thumbnails — and carries no auth header.
   */
  async getThumbnail(p: ThumbnailParams): Promise<unknown> {
    const data = await this.request<{ contentUrl?: string; width?: number; height?: number }>(
      "GET",
      `v1/presentations/${encodeURIComponent(p.presentationId)}/pages/${encodeURIComponent(p.pageObjectId)}/thumbnail`,
      undefined,
      compact({
        "thumbnailProperties.mimeType": "PNG",
        "thumbnailProperties.thumbnailSize": p.size ? p.size.toUpperCase() : undefined,
      }),
    );
    if (!p.outputPath) return data;
    if (!data.contentUrl) throw new Error("The API returned no contentUrl for this page's thumbnail.");
    const parsed = new URL(data.contentUrl);
    const host = parsed.hostname.toLowerCase();
    if (parsed.protocol !== "https:" || !(host === "googleusercontent.com" || host.endsWith(".googleusercontent.com"))) {
      throw new Error(`Unexpected thumbnail host ${parsed.hostname} — refusing to download.`);
    }
    const { res, bytes } = await this.fetchBytesWithTimeout(data.contentUrl, { method: "GET" }, "thumbnail download");
    if (!res.ok) throw new GoogleSlidesError(res.status, new TextDecoder().decode(bytes));
    await writeFile(p.outputPath, bytes);
    return { width: data.width, height: data.height, saved_to: resolvePath(p.outputPath), bytes: bytes.byteLength };
  }

  /**
   * Low-level batchUpdate — the write channel for everything except create.
   * Atomic: if any request in the batch is invalid, nothing is applied.
   */
  async batchUpdate(presentationId: string, requests: unknown[]): Promise<unknown> {
    return this.request("POST", `v1/presentations/${encodeURIComponent(presentationId)}:batchUpdate`, {
      requests,
    });
  }

  // ---- Slides ----

  /** Adds a slide (createSlide), from a predefined layout or a concrete layout object id. */
  async addSlide(p: AddSlideParams): Promise<unknown> {
    if (p.predefinedLayout && p.layoutObjectId) {
      throw new Error("Provide either predefined_layout or layout_object_id, not both.");
    }
    const slideLayoutReference = p.predefinedLayout
      ? { predefinedLayout: p.predefinedLayout }
      : p.layoutObjectId
        ? { layoutId: p.layoutObjectId }
        : undefined;
    return this.batchUpdate(p.presentationId, [
      {
        createSlide: compact({
          objectId: p.objectId,
          insertionIndex: p.insertionIndex,
          slideLayoutReference,
        }),
      },
    ]);
  }

  /** Duplicates a slide (or any page element); the copy lands right after the original. */
  async duplicateSlide(presentationId: string, objectId: string): Promise<unknown> {
    return this.batchUpdate(presentationId, [{ duplicateObject: { objectId } }]);
  }

  /** Moves slides to a new 0-based position (updateSlidesPosition). */
  async moveSlides(presentationId: string, slideObjectIds: string[], insertionIndex: number): Promise<unknown> {
    return this.batchUpdate(presentationId, [{ updateSlidesPosition: { slideObjectIds, insertionIndex } }]);
  }

  /** Deletes a slide or a page element by object id (deleteObject). */
  async deleteObject(presentationId: string, objectId: string): Promise<unknown> {
    return this.batchUpdate(presentationId, [{ deleteObject: { objectId } }]);
  }

  // ---- Text ----

  /** Inserts text into a shape or table cell at a character index. */
  async insertText(p: InsertTextParams): Promise<unknown> {
    return this.batchUpdate(p.presentationId, [
      {
        insertText: compact({
          objectId: p.objectId,
          cellLocation: cellLocation(p.rowIndex, p.columnIndex),
          text: p.text,
          insertionIndex: p.insertionIndex ?? 0,
        }),
      },
    ]);
  }

  /**
   * Replaces the entire text of a shape or table cell: one atomic batch of
   * deleteText(ALL) + insertText. An empty target makes deleteText fail with a
   * 400 saying the object "has no text" — batchUpdate is atomic, so that
   * rejection applied nothing and the insert is safely re-sent alone. Only
   * that specific rejection triggers the fallback: other deleteText 400s
   * (object not found, object cannot hold text) are rethrown untouched, so
   * the root cause is never masked by a doomed insert-only resend. An empty
   * `text` just clears the object.
   */
  async setText(p: SetTextParams): Promise<unknown> {
    const cell = cellLocation(p.rowIndex, p.columnIndex);
    const del = { deleteText: compact({ objectId: p.objectId, cellLocation: cell, textRange: { type: "ALL" } }) };
    const ins = p.text
      ? { insertText: compact({ objectId: p.objectId, cellLocation: cell, text: p.text, insertionIndex: 0 }) }
      : undefined;
    try {
      return await this.batchUpdate(p.presentationId, ins ? [del, ins] : [del]);
    } catch (err) {
      const noText =
        err instanceof GoogleSlidesError &&
        err.status === 400 &&
        /deleteText/i.test(err.message) &&
        /no text/i.test(err.message);
      if (!noText) throw err;
      if (ins) return this.batchUpdate(p.presentationId, [ins]);
      return { cleared: false, note: "The object had no text to delete." };
    }
  }

  /** replaceAllText across the deck (or only the given pages). Returns occurrencesChanged. */
  async replaceText(p: ReplaceTextParams): Promise<unknown> {
    return this.batchUpdate(p.presentationId, [
      {
        replaceAllText: compact({
          containsText: { text: p.find, matchCase: p.matchCase ?? true },
          replaceText: p.replace,
          pageObjectIds: p.pageObjectIds,
        }),
      },
    ]);
  }

  /** updateTextStyle on ALL text or a fixed character range, with a computed field mask. */
  async updateTextStyle(p: UpdateTextStyleParams): Promise<unknown> {
    const style: Record<string, unknown> = {};
    const fields: string[] = [];
    if (p.bold !== undefined) {
      style.bold = p.bold;
      fields.push("bold");
    }
    if (p.italic !== undefined) {
      style.italic = p.italic;
      fields.push("italic");
    }
    if (p.underline !== undefined) {
      style.underline = p.underline;
      fields.push("underline");
    }
    if (p.strikethrough !== undefined) {
      style.strikethrough = p.strikethrough;
      fields.push("strikethrough");
    }
    if (p.fontFamily !== undefined) {
      style.fontFamily = p.fontFamily;
      fields.push("fontFamily");
    }
    if (p.fontSizePt !== undefined) {
      style.fontSize = pt(p.fontSizePt);
      fields.push("fontSize");
    }
    if (p.foregroundColor !== undefined) {
      style.foregroundColor = { opaqueColor: { rgbColor: hexToRgbColor(p.foregroundColor) } };
      fields.push("foregroundColor");
    }
    if (p.linkUrl !== undefined) {
      style.link = { url: p.linkUrl };
      fields.push("link");
    }
    if (fields.length === 0) {
      throw new Error("At least one style field (bold, italic, font_family, font_size_pt, ...) is required.");
    }
    if ((p.startIndex === undefined) !== (p.endIndex === undefined)) {
      throw new Error("start_index and end_index must be provided together.");
    }
    const textRange =
      p.startIndex !== undefined
        ? { type: "FIXED_RANGE", startIndex: p.startIndex, endIndex: p.endIndex }
        : { type: "ALL" };
    return this.batchUpdate(p.presentationId, [
      {
        updateTextStyle: compact({
          objectId: p.objectId,
          cellLocation: cellLocation(p.rowIndex, p.columnIndex),
          style,
          textRange,
          fields: fields.join(","),
        }),
      },
    ]);
  }

  // ---- Shapes, images, transforms ----

  /** createShape, optionally chaining the initial text into the same atomic batch. */
  async createShape(p: CreateShapeParams): Promise<unknown> {
    const objectId = p.objectId ?? generateObjectId("shape");
    const requests: unknown[] = [
      {
        createShape: {
          objectId,
          shapeType: SHAPE_TYPE_WIRE[p.shapeType],
          elementProperties: elementProperties(p.pageObjectId, {
            // A shape without explicit geometry gets a sane visible default
            // instead of the API's zero-size speck.
            widthPt: p.widthPt ?? 300,
            heightPt: p.heightPt ?? 80,
            xPt: p.xPt ?? 50,
            yPt: p.yPt ?? 50,
          }),
        },
      },
    ];
    if (p.text) {
      requests.push({ insertText: { objectId, text: p.text, insertionIndex: 0 } });
    }
    return this.batchUpdate(p.presentationId, requests);
  }

  /**
   * Runs `run` with a usable image URL: a public URL is validated in place; a
   * local path is sniffed (PNG/JPEG/GIF magic bytes, ≤50 MB), uploaded to
   * Drive, shared read-only by link, used, and the temp file deleted
   * best-effort afterwards — success and failure alike (Slides copies the
   * image bytes at insert time, so the Drive original is disposable).
   */
  private async withImageUrl(
    source: ImageSource,
    run: (url: string) => Promise<unknown>,
  ): Promise<unknown> {
    const provided = [source.imageUrl, source.imagePath].filter(Boolean).length;
    if (provided !== 1) throw new Error("Provide exactly one of image_url or image_path.");
    if (source.imageUrl) {
      validateImageUrl(source.imageUrl);
      return run(source.imageUrl);
    }
    const uploaded = await this.uploadLocalImage(source.imagePath as string);
    let result: unknown;
    try {
      result = await run(uploaded.url);
    } catch (err) {
      await this.tryDeleteDriveFile(uploaded.fileId);
      throw err;
    }
    const cleaned = await this.tryDeleteDriveFile(uploaded.fileId);
    return {
      ...(result as Record<string, unknown>),
      uploaded_image: {
        drive_file_id: uploaded.fileId,
        temp_file: cleaned ? "deleted" : "cleanup failed — delete the file from Drive manually",
      },
    };
  }

  /** Inserts an image from a public URL or a local file (see withImageUrl). */
  async createImage(p: CreateImageParams): Promise<unknown> {
    return this.withImageUrl(p, (url) =>
      this.batchUpdate(p.presentationId, [
        {
          createImage: compact({
            objectId: p.objectId,
            url,
            elementProperties: elementProperties(p.pageObjectId, p),
          }),
        },
      ]),
    );
  }

  /** Swaps the bitmap of an existing image element, keeping its frame. */
  async replaceImage(p: ReplaceImageParams): Promise<unknown> {
    return this.withImageUrl(p, (url) =>
      this.batchUpdate(p.presentationId, [
        {
          replaceImage: {
            imageObjectId: p.imageObjectId,
            url,
            imageReplaceMethod: (p.replaceMethod ?? "center_inside").toUpperCase(),
          },
        },
      ]),
    );
  }

  /**
   * updatePageElementTransform. ABSOLUTE replaces the whole matrix — omitted
   * scales default to 1 (not to the current value!) and omitted translates to
   * 0. RELATIVE multiplies onto the existing transform.
   */
  async updateTransform(p: UpdateTransformParams): Promise<unknown> {
    return this.batchUpdate(p.presentationId, [
      {
        updatePageElementTransform: {
          objectId: p.objectId,
          applyMode: p.mode.toUpperCase(),
          transform: {
            scaleX: p.scaleX ?? 1,
            scaleY: p.scaleY ?? 1,
            translateX: p.translateXPt ?? 0,
            translateY: p.translateYPt ?? 0,
            unit: "PT",
          },
        },
      },
    ]);
  }

  // ---- Tables ----

  /** createTable with rows x columns. */
  async createTable(p: CreateTableParams): Promise<unknown> {
    return this.batchUpdate(p.presentationId, [
      {
        createTable: compact({
          objectId: p.objectId,
          elementProperties: elementProperties(p.pageObjectId, p),
          rows: p.rows,
          columns: p.columns,
        }),
      },
    ]);
  }

  /** Structural table edits: insert/delete rows and columns. */
  async editTable(p: EditTableParams): Promise<unknown> {
    const need = (field: "rowIndex" | "columnIndex"): number => {
      const value = p[field];
      if (value === undefined) {
        throw new Error(`action "${p.action}" requires ${field === "rowIndex" ? "row_index" : "column_index"}.`);
      }
      return value;
    };
    let request: Record<string, unknown>;
    switch (p.action) {
      case "insert_rows":
        request = {
          insertTableRows: {
            tableObjectId: p.tableObjectId,
            cellLocation: { rowIndex: need("rowIndex") },
            insertBelow: p.below ?? true,
            number: p.count ?? 1,
          },
        };
        break;
      case "insert_columns":
        request = {
          insertTableColumns: {
            tableObjectId: p.tableObjectId,
            cellLocation: { columnIndex: need("columnIndex") },
            insertRight: p.right ?? true,
            number: p.count ?? 1,
          },
        };
        break;
      case "delete_row":
        request = {
          deleteTableRow: { tableObjectId: p.tableObjectId, cellLocation: { rowIndex: need("rowIndex") } },
        };
        break;
      case "delete_column":
        request = {
          deleteTableColumn: {
            tableObjectId: p.tableObjectId,
            cellLocation: { columnIndex: need("columnIndex") },
          },
        };
        break;
    }
    return this.batchUpdate(p.presentationId, [request]);
  }

  // ---- Speaker notes ----

  /** Finds the slide's speaker-notes shape id (every slide has a notes page). */
  private async speakerNotes(
    presentationId: string,
    slideObjectId: string,
  ): Promise<{ notesId: string; notesPage: Record<string, unknown> }> {
    const page = (await this.getPage(presentationId, slideObjectId)) as {
      slideProperties?: { notesPage?: Record<string, unknown> };
    };
    const notesPage = page.slideProperties?.notesPage;
    const notesId = (
      (notesPage?.notesProperties ?? {}) as { speakerNotesObjectId?: unknown }
    ).speakerNotesObjectId;
    if (typeof notesId !== "string" || !notesId) {
      throw new Error(
        "No speaker-notes shape found — the object id must be a slide (layouts and masters have no notes).",
      );
    }
    return { notesId, notesPage: notesPage as Record<string, unknown> };
  }

  /** The slide's speaker notes as plain text. */
  async getSpeakerNotes(presentationId: string, slideObjectId: string): Promise<unknown> {
    const { notesId, notesPage } = await this.speakerNotes(presentationId, slideObjectId);
    const elements = (notesPage.pageElements ?? []) as Array<Record<string, unknown>>;
    const shape = elements.find((el) => el.objectId === notesId);
    const text = extractText(((shape?.shape ?? {}) as { text?: unknown }).text);
    return { slideObjectId, speakerNotesObjectId: notesId, text };
  }

  /** Replaces the slide's speaker notes (empty text clears them). */
  async setSpeakerNotes(presentationId: string, slideObjectId: string, text: string): Promise<unknown> {
    const { notesId } = await this.speakerNotes(presentationId, slideObjectId);
    const result = await this.setText({ presentationId, objectId: notesId, text });
    return { speakerNotesObjectId: notesId, result };
  }

  // ---- Comments (Drive API v3, scoped to this one file) ----

  /** Comment threads on the presentation file. Drive requires an explicit fields mask. */
  async manageComments(p: ManageCommentsParams): Promise<unknown> {
    const filePath = `drive/v3/files/${encodeURIComponent(p.presentationId)}/comments`;
    const needComment = (): string => {
      if (!p.commentId) throw new Error(`action "${p.action}" requires comment_id.`);
      return encodeURIComponent(p.commentId);
    };
    switch (p.action) {
      case "list":
        return this.driveRequest(
          "GET",
          filePath,
          undefined,
          compact({
            fields: "comments(id,content,author(displayName),createdTime,modifiedTime,resolved,quotedFileContent(value),replies(id,content,author(displayName),createdTime,action)),nextPageToken",
            pageSize: p.pageSize,
            pageToken: p.pageToken,
            includeDeleted: p.includeDeleted,
          }),
        );
      case "get":
        return this.driveRequest("GET", `${filePath}/${needComment()}`, undefined, { fields: "*" });
      case "create":
        if (!p.content) throw new Error('action "create" requires content.');
        return this.driveRequest("POST", filePath, { content: p.content }, { fields: "*" });
      case "reply": {
        if (!p.content && !p.resolve) {
          throw new Error('action "reply" requires content (and/or resolve=true).');
        }
        return this.driveRequest(
          "POST",
          `${filePath}/${needComment()}/replies`,
          compact({ content: p.content, action: p.resolve ? "resolve" : undefined }),
          { fields: "*" },
        );
      }
      case "delete":
        return (await this.driveRequest("DELETE", `${filePath}/${needComment()}`)) ?? { deleted: true };
    }
  }

  // ---- Export ----

  /**
   * Downloads the presentation via Drive export (pdf/pptx/odp/txt) and writes
   * it to outputPath. Drive's export endpoint caps files at 10 MB.
   */
  async exportPresentation(presentationId: string, format: ExportFormat, outputPath: string): Promise<unknown> {
    const mime = EXPORT_MIME[format];
    const url = new URL(`drive/v3/files/${encodeURIComponent(presentationId)}/export`, this.driveBase);
    url.searchParams.set("mimeType", mime);
    const bytes = await this.downloadWithAuth(url.toString(), `export ${format}`);
    await writeFile(outputPath, bytes);
    return { saved_to: resolvePath(outputPath), bytes: bytes.byteLength, mime_type: mime };
  }

  // ---- Drive helpers (image upload / disposable-resource cleanup) ----

  /**
   * Uploads a local image to Drive (multipart) and shares it read-only by
   * link so the Slides API can fetch it. The caller is expected to delete the
   * file afterwards — {@link withImageUrl} does exactly that.
   */
  private async uploadLocalImage(filePath: string): Promise<{ fileId: string; url: string }> {
    const data = await readFile(filePath);
    if (data.byteLength > MAX_IMAGE_BYTES) {
      throw new Error(`Image is too large (${data.byteLength} bytes) — the Slides API caps images at 50 MB.`);
    }
    const sniffed = sniffImageType(data);
    if (!sniffed) {
      throw new Error("Unsupported image content — only PNG, JPEG and GIF are accepted (checked by magic bytes).");
    }

    const boundary = `mcp_slides_${randomUUID().replaceAll("-", "")}`;
    const metadata = JSON.stringify({
      name: `mcp-google-slides-upload-${basename(filePath)}`,
      mimeType: sniffed.mimeType,
    });
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
          `--${boundary}\r\nContent-Type: ${sniffed.mimeType}\r\n\r\n`,
      ),
      data,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const uploadUrl = new URL("upload/drive/v3/files", this.driveBase);
    uploadUrl.searchParams.set("uploadType", "multipart");
    uploadUrl.searchParams.set("fields", "id");

    // Single-shot write with one forced re-mint on 401 — an upload is a write
    // and must never be replayed after an ambiguous failure.
    let uploadedId: string | undefined;
    for (let attempt = 0; ; attempt++) {
      const token = await this.accessToken(attempt > 0);
      const { res, text } = await this.fetchWithTimeout(
        uploadUrl.toString(),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body,
        },
        "drive image upload",
      );
      if (res.status === 401 && this.canRefresh() && attempt === 0) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
      if (!res.ok) throw new GoogleSlidesError(res.status, parsed);
      uploadedId = (parsed as { id?: string }).id;
      break;
    }
    if (!uploadedId) throw new Error("Drive upload returned no file id.");

    // Anyone-with-the-link reader — the Slides fetcher is not the user.
    await this.driveRequest("POST", `drive/v3/files/${encodeURIComponent(uploadedId)}/permissions`, {
      role: "reader",
      type: "anyone",
    });
    return { fileId: uploadedId, url: `https://drive.google.com/uc?id=${uploadedId}` };
  }

  /** Deletes a Drive file this server created (temp images, smoke decks). */
  async deleteDriveFile(fileId: string): Promise<void> {
    await this.driveRequest("DELETE", `drive/v3/files/${encodeURIComponent(fileId)}`);
  }

  private async tryDeleteDriveFile(fileId: string): Promise<boolean> {
    try {
      await this.deleteDriveFile(fileId);
      return true;
    } catch {
      return false;
    }
  }
}

// ---- Summaries (pure, exported for tests) ----

/** EMU → points (1 pt = 12700 EMU). */
function emuToPt(value: unknown): number | undefined {
  const magnitude = (value as { magnitude?: unknown } | undefined)?.magnitude;
  const unit = (value as { unit?: unknown } | undefined)?.unit;
  if (typeof magnitude !== "number") return undefined;
  return unit === "EMU" ? Math.round((magnitude / 12700) * 100) / 100 : magnitude;
}

/** One page element, compacted to id + type + visible text. */
function summarizeElement(el: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { objectId: el.objectId };
  if (el.shape) {
    const shape = el.shape as {
      shapeType?: string;
      placeholder?: { type?: string };
      text?: unknown;
    };
    out.type = (shape.shapeType ?? "SHAPE").toLowerCase();
    if (shape.placeholder?.type) out.placeholder = shape.placeholder.type.toLowerCase();
    const text = extractText(shape.text);
    if (text) out.text = text.length > 160 ? `${text.slice(0, 160)}…` : text;
  } else if (el.table) {
    const table = el.table as { rows?: number; columns?: number };
    out.type = "table";
    out.rows = table.rows;
    out.columns = table.columns;
  } else if (el.image) {
    out.type = "image";
  } else if (el.video) {
    out.type = "video";
  } else if (el.line) {
    out.type = "line";
  } else if (el.elementGroup) {
    out.type = "group";
    out.children = ((el.elementGroup as { children?: unknown[] }).children ?? []).length;
  } else {
    out.type = "unknown";
  }
  return out;
}

/** Compacts a fields-masked presentation into the list_slides result. */
export function summarizePresentation(data: Record<string, unknown>): Record<string, unknown> {
  const slides = (data.slides ?? []) as Array<Record<string, unknown>>;
  const pageSize = data.pageSize as { width?: unknown; height?: unknown } | undefined;
  return compact({
    presentationId: data.presentationId,
    title: data.title,
    revisionId: data.revisionId,
    pageSizePt: pageSize
      ? { width: emuToPt(pageSize.width), height: emuToPt(pageSize.height) }
      : undefined,
    slideCount: slides.length,
    slides: slides.map((slide, index) => {
      const props = (slide.slideProperties ?? {}) as {
        layoutObjectId?: string;
        notesPage?: { notesProperties?: { speakerNotesObjectId?: string } };
      };
      return compact({
        index,
        objectId: slide.objectId,
        layoutObjectId: props.layoutObjectId,
        speakerNotesObjectId: props.notesPage?.notesProperties?.speakerNotesObjectId,
        elements: ((slide.pageElements ?? []) as Array<Record<string, unknown>>).map(summarizeElement),
      });
    }),
  });
}

/** Drops keys whose value is `undefined` so they are not sent to the API. */
function compact<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
