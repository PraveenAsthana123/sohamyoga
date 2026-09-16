import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const platforms = sp.get('platforms')?.split(',').filter(Boolean) ?? [];
    const statuses = sp.get('status')?.split(',').filter(Boolean) ?? [];
    const search = sp.get('search') ?? '';

    const conditions: string[] = ["status != 'deleted'"];
    const params: unknown[] = [];
    let p = 1;

    if (platforms.length > 0) { conditions.push(`platform = ANY($${p++})`); params.push(platforms); }
    if (statuses.length > 0) { conditions.push(`status = ANY($${p++})`); params.push(statuses); }
    if (search) { conditions.push(`(caption ILIKE $${p} OR headline ILIKE $${p})`); params.push(`%${search}%`); p++; }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const res = await query(
      `SELECT id, item_type, platform, content_type, status, approval_status,
              caption, headline, scheduled_at, published_at, impressions, reach,
              clicks, likes, comments, shares, saves, spend, revenue, roas, ctr,
              cpc, engagement_rate, created_at
       FROM unified_content_item ${where} ORDER BY created_at DESC LIMIT 10000`,
      params
    );

    const headers = [
      'id','item_type','platform','content_type','status','approval_status',
      'caption','headline','scheduled_at','published_at','impressions','reach',
      'clicks','likes','comments','shares','saves','spend','revenue','roas','ctr',
      'cpc','engagement_rate','created_at',
    ];
    const csvLines = [headers.join(',')];
    for (const row of res.rows) {
      const r = row as Record<string, unknown>;
      const line = headers.map(h => {
        const val = r[h];
        if (val === null || val === undefined) return '';
        const s = String(val).replace(/"/g, '""');
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
      }).join(',');
      csvLines.push(line);
    }

    return new NextResponse(csvLines.join('\n'), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="command-center-export-${Date.now()}.csv"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
