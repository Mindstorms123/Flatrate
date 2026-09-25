import { useEffect, useRef, useState } from "react";
import bwipjs from "bwip-js/browser";
import { base64ToBytes, bytesToBinaryText, type StoredTicket } from "@/lib/tickets";

const BARCODE_TYPE: Record<string, string> = {
  QR: "qrcode",
  Aztec: "azteccode",
  PDF417: "pdf417",
  Code128: "code128",
};

export function TicketBarcode({
  ticket,
  large = false,
}: {
  ticket: StoredTicket;
  large?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const message = ticket.barcodeMessage ?? "";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !message) return;
    const bcid = BARCODE_TYPE[ticket.barcodeFormat ?? ""] ?? "qrcode";
    const base = {
      bcid,
      scale: large ? 5 : 4,
      padding: large ? 18 : 12,
      backgroundcolor: "FFFFFF",
    } as const;

    if (!ticket.barcodeBytes) {
      setFailed(true);
      return;
    }

    try {
      bwipjs.toCanvas(canvas, {
        ...base,
        text: bytesToBinaryText(base64ToBytes(ticket.barcodeBytes)),
        binarytext: true,
      } as never);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [large, message, ticket.barcodeBytes, ticket.barcodeFormat]);

  if (!message) return null;
  if (failed) return <p className="text-sm text-destructive">Bitte importiere die Wallet-Datei erneut, damit der Originalcode angezeigt werden kann.</p>;

  return (
    <div>
      <canvas
        ref={canvasRef}
        aria-label="Ticket-Code"
        role="img"
        className={large ? "mx-auto max-h-[70vh] max-w-full bg-white" : "mx-auto max-h-80 max-w-full bg-white"}
      />
    </div>
  );
}
