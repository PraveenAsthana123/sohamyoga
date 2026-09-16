import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = params;
  if (!id || isNaN(Number(id))) return Response.json({ error: 'Valid id required.' }, { status: 400 });

  const client = await pool.connect();
  try {
    const row = await client.query(`SELECT * FROM receipt WHERE id = $1`, [id]);
    if (!row.rowCount) return Response.json({ error: 'Receipt not found.' }, { status: 404 });

    const receipt = row.rows[0] as {
      id: number; vendor_name: string; ocr_raw_text: string;
      total_amount: number; receipt_date: string; category: string;
    };
    const ocrText = receipt.ocr_raw_text ?? `Vendor: ${receipt.vendor_name}\nTotal: $${receipt.total_amount}`;

    // Call local Ollama via internal AI generate endpoint
    let extractedData: Record<string, unknown> = {};
    try {
      const prompt = `Extract structured receipt data from this OCR text. Return ONLY valid JSON with keys: vendor_name, receipt_date, total_amount, subtotal, tax_amount, currency, line_items (array of {description, quantity, unit_price, total}), category (one of: general, advertising, software, travel, meals, equipment, subscription).\n\nOCR TEXT:\n${ocrText}`;

      const aiRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/ai/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model: 'llama3.2', stream: false }),
        signal: AbortSignal.timeout(30_000),
      });

      if (aiRes.ok) {
        const aiData = await aiRes.json() as { response?: string; text?: string };
        const raw = aiData.response ?? aiData.text ?? '';
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          extractedData = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
        }
      }
    } catch {
      // Fallback to simulated extraction if AI unavailable
      extractedData = {
        vendor_name: receipt.vendor_name,
        total_amount: receipt.total_amount,
        receipt_date: receipt.receipt_date,
        category: receipt.category,
        line_items: [],
        ai_note: 'AI extraction unavailable — manual review required',
      };
    }

    const updated = await client.query(
      `UPDATE receipt SET extracted_data = $1, status = 'processing' WHERE id = $2 RETURNING *`,
      [JSON.stringify(extractedData), id]
    );
    return Response.json({ receipt: updated.rows[0], extracted_data: extractedData });
  } finally {
    client.release();
  }
}
