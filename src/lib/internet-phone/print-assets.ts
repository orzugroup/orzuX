import "server-only";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

/** A5 in points (148mm × 210mm). */
const A5_WIDTH = 419.53;
const A5_HEIGHT = 595.28;

export async function buildInternetPhoneQrDataUrl(
  publicUrl: string,
): Promise<string> {
  return QRCode.toDataURL(publicUrl, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 640,
    color: { dark: "#0B1220", light: "#FFFFFF" },
  });
}

export async function buildInternetPhonePdf(input: {
  publicUrl: string;
  businessName: string;
  displayName: string;
}): Promise<Uint8Array> {
  const qrDataUrl = await buildInternetPhoneQrDataUrl(input.publicUrl);
  const pngBytes = Buffer.from(qrDataUrl.split(",")[1] ?? "", "base64");

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([A5_WIDTH, A5_HEIGHT]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const qrImage = await pdf.embedPng(pngBytes);

  const title = input.displayName.trim() || input.businessName.trim() || "Internet Phone";
  const subtitle = "Scan to call in your browser — no app required";

  page.drawText("OrzuX Internet Phone", {
    x: 36,
    y: A5_HEIGHT - 48,
    size: 11,
    font,
    color: rgb(0.25, 0.3, 0.35),
  });

  page.drawText(title.slice(0, 48), {
    x: 36,
    y: A5_HEIGHT - 86,
    size: 22,
    font: fontBold,
    color: rgb(0.06, 0.09, 0.14),
  });

  page.drawText(subtitle, {
    x: 36,
    y: A5_HEIGHT - 112,
    size: 11,
    font,
    color: rgb(0.3, 0.35, 0.4),
  });

  const qrSize = 240;
  const qrX = (A5_WIDTH - qrSize) / 2;
  const qrY = (A5_HEIGHT - qrSize) / 2 - 20;
  page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });

  page.drawText(input.publicUrl.slice(0, 72), {
    x: 36,
    y: 56,
    size: 9,
    font,
    color: rgb(0.25, 0.3, 0.35),
  });

  page.drawText("Print and place on your desk, counter, or storefront.", {
    x: 36,
    y: 36,
    size: 9,
    font,
    color: rgb(0.4, 0.45, 0.5),
  });

  return pdf.save();
}
