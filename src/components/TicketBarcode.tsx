import { useEffect, useRef, useState } from "react";
import bwipjs from "bwip-js/browser";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { base64ToBytes, bytesToBinaryText, messageToBytes, type StoredTicket } from "@/lib/tickets";

const BARCODE_TYPE: Record<string, string> = {
  QR: "qrcode",
  Aztec: "azteccode",
  PDF417: "pdf417",
  Code128: "code128",
};

type Variant = { label: string; hint: string };

const VARIANTS: Variant[] = [
  { label: "Original (Wallet)", hint: "Exakt die Bytes aus der Wallet-Datei." },
  { label: "Variante 2", hint: "Text als UTF-8 kodiert." },
  { label: "Variante 3", hint: "Text ohne Byte-Modus (Standardkodierung)." },
];

export function TicketBarcode({
  ticket,
  large = false,
  showSwitch = true,
}: {
  ticket: StoredTicket;
  large?: boolean;
  showSwitch?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [variant, setVariant] = useState(0);
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

    const exactBytes = ticket.barcodeBytes
      ? base64ToBytes(ticket.barcodeBytes)
      : messageToBytes(message, ticket.barcodeEncoding);

    const attempts = [
      { ...base, text: bytesToBinaryText(exactBytes), binarytext: true },
      { ...base, text: bytesToBinaryText(new TextEncoder().encode(message)), binarytext: true },
      { ...base, text: message },
    ];
    const order = [attempts[variant]!, ...attempts.filter((_, i) => i !== variant)];

    for (const options of order) {
      try {
        bwipjs.toCanvas(canvas, options as never);
        setFailed(false);
        return;
      } catch {
        // try the next encoding
      }
    }
    setFailed(true);
  }, [large, message, ticket.barcodeBytes, ticket.barcodeEncoding, ticket.barcodeFormat, variant]);

  if (!message) return null;
  if (failed) return <p className="text-sm text-destructive">Dieser Ticketcode konnte nicht angezeigt werden.</p>;

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        aria-label="Ticket-Code"
        role="img"
        className={large ? "mx-auto max-h-[70vh] max-w-full bg-white" : "mx-auto max-h-80 max-w-full bg-white"}
      />
      {showSwitch && (
        <div className="flex flex-wrap items-center justify-center gap-2 text-center">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setVariant((v) => (v + 1) % VARIANTS.length)}
          >
            <RefreshCw size={14} /> Code lässt sich nicht scannen?
          </Button>
          <span className="text-[0.7rem] opacity-70">
            {VARIANTS[variant]!.label} · {VARIANTS[variant]!.hint}
          </span>
        </div>
      )}
    </div>
  );
}
