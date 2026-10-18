import { PDFParse } from 'pdf-parse';
import type { RawContactRow } from './csv.js';

const PHONE_RE =
  /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,5}\)?[\s-]?)?\d{3,5}[\s-]?\d{4,10}|\+\d{10,15}|\b\d{10}\b/g;

/**
 * PDFs are treated primarily as script/context sources.
 * Contacts are extracted only when phone-like tokens are identifiable.
 */
export async function parsePdfDocument(buffer: Buffer): Promise<{
  scriptText: string;
  rows: RawContactRow[];
}> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const scriptText = (result.text ?? '').trim();
    const rows: RawContactRow[] = [];
    const seen = new Set<string>();

    const lines = scriptText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]!;
      const phones = line.match(PHONE_RE) ?? [];
      for (const phone of phones) {
        const key = phone.replace(/\s+/g, '');
        if (seen.has(key)) continue;
        seen.add(key);

        const withoutPhone = line
          .replace(phone, ' ')
          .replace(/[|,;]+/g, ' ')
          .trim();
        const emailMatch = withoutPhone.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
        const nameGuess =
          withoutPhone
            .replace(emailMatch?.[0] ?? '', '')
            .replace(/\s{2,}/g, ' ')
            .trim()
            .slice(0, 80) || `Contact from PDF line ${i + 1}`;

        rows.push({
          rowIndex: i + 1,
          name: nameGuess,
          phone,
          email: emailMatch?.[0],
          notes: 'Extracted from PDF — please verify before saving',
        });
      }
    }

    return { scriptText, rows };
  } finally {
    await parser.destroy();
  }
}
