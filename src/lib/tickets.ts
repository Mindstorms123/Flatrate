import { unzipSync, strFromU8 } from "fflate";

export type TicketKind = "dticket" | "semester" | "other";

export type StoredTicket = {
  id: string;
  kind: TicketKind;
  title: string;
  holder?: string;
  provider?: string;
  validFrom?: string;
  validUntil?: string;
  barcodeMessage?: string;
  barcodeFormat?: string;
  /** Exact bytes of the barcode payload, base64 encoded. */
  barcodeBytes?: string;
  /** messageEncoding from pass.json, e.g. "iso-8859-1" or "utf-8". */
  barcodeEncoding?: string;
  imageDataUrl?: string;
  source: "pkpass" | "photo";
  addedAt: string;
  /** Download link of the .pkpass for automatic renewal. */
  renewUrl?: string;
  /** Portal/login page of the provider, opened when the download needs a session. */
  loginUrl?: string;
  autoRenew?: boolean;
  lastRenewAt?: string;
  lastRenewError?: string;
};

const KEY = "dticket.tickets.v1";
export const TICKETS_CHANGED_EVENT = "flatrate:tickets-changed";

export function loadTickets(): StoredTicket[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredTicket[]) : [];
  } catch {
    return [];
  }
}

export function saveTickets(tickets: StoredTicket[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(tickets));
  window.dispatchEvent(new Event(TICKETS_CHANGED_EVENT));
}

export function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) out += String.fromCharCode(bytes[i]!);
  return btoa(out);
}

export function base64ToBytes(base64: string): Uint8Array {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Reproduces the byte payload the wallet encodes into the barcode. */
export function messageToBytes(message: string, encoding?: string): Uint8Array {
  const enc = (encoding ?? "").toLowerCase();
  const isLatin = enc.includes("8859") || enc.includes("latin") || enc.includes("ascii");
  const fitsLatin = /^[\u0000-\u00ff]*$/.test(message);
  if (isLatin || (fitsLatin && !enc.includes("utf"))) {
    const bytes = new Uint8Array(message.length);
    for (let i = 0; i < message.length; i += 1) bytes[i] = message.charCodeAt(i) & 0xff;
    return bytes;
  }
  return new TextEncoder().encode(message);
}

/** bwip-js binarytext string: one char per byte. */
export function bytesToBinaryText(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) out += String.fromCharCode(bytes[i]!);
  return out;
}

function guessKind(text: string): TicketKind {
  const t = text.toLowerCase();
  if (t.includes("semester")) return "semester";
  if (t.includes("deutschlandticket") || t.includes("d-ticket") || t.includes("49")) return "dticket";
  return "other";
}

type PassField = { key?: string; label?: string; value?: unknown };
type PassBarcode = { message?: string; format?: string; messageEncoding?: string };
type PassJson = {
  description?: string;
  organizationName?: string;
  expirationDate?: string;
  relevantDate?: string;
  barcode?: PassBarcode;
  barcodes?: PassBarcode[];
  generic?: Record<string, PassField[]>;
  eventTicket?: Record<string, PassField[]>;
  boardingPass?: Record<string, PassField[]>;
  coupon?: Record<string, PassField[]>;
  storeCard?: Record<string, PassField[]>;
};

/** Reads an Apple/Google Wallet .pkpass file (a ZIP) from raw bytes. */
export function parsePkpassBytes(buf: Uint8Array, fileName: string): StoredTicket {
  const zip = unzipSync(buf);
  const entry = zip["pass.json"];
  if (!entry) throw new Error("In dieser Datei steckt kein Wallet-Ticket (pass.json fehlt).");
  const pass = JSON.parse(strFromU8(entry)) as PassJson;

  const style = pass.generic ?? pass.eventTicket ?? pass.boardingPass ?? pass.coupon ?? pass.storeCard ?? {};
  const fields: PassField[] = Object.values(style).flat();
  const textValue = (value: unknown): string | undefined => {
    if (typeof value === "string") return value.trim() || undefined;
    if (typeof value === "number") return String(value);
    return undefined;
  };
  const findField = (names: string[]) => {
    const normalizedNames = names.map((name) => name.toLowerCase());
    return textValue(
      fields.find((field) => {
        const key = field.key?.toLowerCase().trim();
        const label = field.label?.toLowerCase().trim();
        return normalizedNames.includes(key ?? "") || normalizedNames.includes(label ?? "");
      })?.value,
    );
  };

  const barcode = pass.barcodes?.[0] ?? pass.barcode;
  const title = pass.description || pass.organizationName || fileName.replace(/\.pkpass$/i, "");
  const fullName = findField([
    "passengername",
    "passenger name",
    "travelername",
    "travellername",
    "ticket holder",
    "ticketinhaber",
    "fahrgast",
    "inhaber",
    "name",
  ]);
  const firstName = findField(["firstname", "first name", "vorname"]);
  const lastName = findField(["lastname", "last name", "surname", "nachname"]);
  const holder = fullName ?? ([firstName, lastName].filter(Boolean).join(" ") || undefined);
  const validUntil = pass.expirationDate ?? findField(["validuntil", "valid until", "gültig bis"]);
  const bytes = barcode?.message ? messageToBytes(barcode.message, barcode.messageEncoding) : undefined;

  return {
    id: crypto.randomUUID(),
    kind: guessKind(`${title} ${pass.organizationName ?? ""} ${String(holder ?? "")}`),
    title,
    ...(pass.organizationName ? { provider: pass.organizationName } : {}),
    ...(holder ? { holder } : {}),
    ...(pass.relevantDate ? { validFrom: String(pass.relevantDate) } : {}),
    ...(validUntil ? { validUntil: String(validUntil) } : {}),
    ...(barcode?.message ? { barcodeMessage: barcode.message } : {}),
    ...(bytes ? { barcodeBytes: bytesToBase64(bytes) } : {}),
    ...(barcode?.messageEncoding ? { barcodeEncoding: barcode.messageEncoding } : {}),
    ...(barcode?.format ? { barcodeFormat: barcode.format.replace("PKBarcodeFormat", "") } : {}),
    source: "pkpass",
    addedAt: new Date().toISOString(),
  };
}

export async function parsePkpass(file: File): Promise<StoredTicket> {
  return parsePkpassBytes(new Uint8Array(await file.arrayBuffer()), file.name);
}

export async function ticketFromPhoto(file: File, title: string, kind: TicketKind): Promise<StoredTicket> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Bild konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });
  return {
    id: crypto.randomUUID(),
    kind,
    title: title || file.name,
    imageDataUrl: dataUrl,
    source: "photo",
    addedAt: new Date().toISOString(),
  };
}

export function ticketExpiresInDays(ticket: StoredTicket, now = new Date()): number | undefined {
  if (!ticket.validUntil) return undefined;
  const end = new Date(ticket.validUntil).getTime();
  if (Number.isNaN(end)) return undefined;
  return Math.floor((end - now.getTime()) / 86400000);
}

/** True when the ticket is expired or expires within two days. */
export function needsRenewal(ticket: StoredTicket, now = new Date()): boolean {
  if (!ticket.autoRenew || !ticket.renewUrl) return false;
  const days = ticketExpiresInDays(ticket, now);
  if (days === undefined) return false;
  return days <= 2;
}

export const KIND_LABEL: Record<TicketKind, string> = {
  dticket: "Deutschlandticket",
  semester: "Semesterticket",
  other: "Ticket",
};
