import "server-only";

import ExcelJS from "exceljs";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export type ExtractDocumentResult =
  | { success: true; text: string }
  | { success: false; message: string };

function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : "";
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n\n") : text;
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value == null) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") {
      return value.text;
    }

    if ("result" in value && value.result != null) {
      return String(value.result);
    }

    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("");
    }
  }

  return String(value);
}

async function extractSpreadsheetText(buffer: Buffer): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  // exceljs typings expect a browser Buffer; Node Buffer is compatible at runtime.
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const parts: string[] = [];

  workbook.eachSheet((sheet) => {
    const rows: string[] = [];

    sheet.eachRow((row) => {
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      const cells = values.map((value) => cellToString(value as ExcelJS.CellValue));

      if (cells.some((cell) => cell.trim().length > 0)) {
        rows.push(cells.join(","));
      }
    });

    if (rows.length > 0) {
      parts.push(`Sheet: ${sheet.name}\n${rows.join("\n")}`);
    }
  });

  return parts.join("\n\n");
}

export async function extractTextFromDocument(
  buffer: Buffer,
  fileName: string,
): Promise<ExtractDocumentResult> {
  if (buffer.byteLength > MAX_FILE_BYTES) {
    return {
      success: false,
      message: "File is too large. Maximum size is 5 MB.",
    };
  }

  const ext = getExtension(fileName);

  try {
    let text = "";

    if (ext === ".pdf") {
      text = await extractPdfText(buffer);
    } else if (ext === ".docx") {
      text = await extractDocxText(buffer);
    } else if (ext === ".xlsx") {
      text = await extractSpreadsheetText(buffer);
    } else if (
      ext === ".txt" ||
      ext === ".md" ||
      ext === ".csv" ||
      ext === ".rtf"
    ) {
      text = buffer.toString("utf8");
    } else {
      return {
        success: false,
        message: `Unsupported file type (${ext || "unknown"}). Use PDF, DOCX, XLSX, TXT, MD, or CSV.`,
      };
    }

    const normalized = text.replace(/\u0000/g, "").replace(/\r\n/g, "\n").trim();

    if (normalized.length < 20) {
      return {
        success: false,
        message: "Could not extract enough text from this file (minimum 20 characters).",
      };
    }

    return { success: true, text: normalized.slice(0, 120_000) };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to read file contents.";
    return { success: false, message };
  }
}
