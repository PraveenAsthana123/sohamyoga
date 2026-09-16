import { NextRequest} from 'next/server';
import { query } from '@/lib/postgres';
import { ensurePlatformApiCatalogSchema } from '@/lib/platform-api-catalog-schema';

import { requireAdmin } from '@/lib/admin-auth';
interface MatrixRow {
  platform: string;
  category: string;
  implementation_status: string;
  count: string;
}

export async function GET(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensurePlatformApiCatalogSchema();

  const result = await query<MatrixRow>(
    `SELECT platform, category, implementation_status, COUNT(*) as count
     FROM platform_api_offering
     GROUP BY platform, category, implementation_status
     ORDER BY platform, category`,
    [],
  );

  // Build matrix: { platform -> { category -> { status -> count } } }
  const matrix: Record<string, Record<string, Record<string, number>>> = {};
  const categories = new Set<string>();
  const platforms = new Set<string>();

  for (const row of result.rows) {
    platforms.add(row.platform);
    categories.add(row.category);
    if (!matrix[row.platform]) matrix[row.platform] = {};
    if (!matrix[row.platform][row.category]) matrix[row.platform][row.category] = {};
    matrix[row.platform][row.category][row.implementation_status] = parseInt(row.count, 10);
  }

  // Compute a single "best status" per platform+category for the matrix cell
  const cellStatus: Record<string, Record<string, string>> = {};
  for (const [plat, cats] of Object.entries(matrix)) {
    cellStatus[plat] = {};
    for (const [cat, statuses] of Object.entries(cats)) {
      if (statuses['verified']) cellStatus[plat][cat] = 'verified';
      else if (statuses['built']) cellStatus[plat][cat] = 'built';
      else if (statuses['partial']) cellStatus[plat][cat] = 'partial';
      else if (statuses['stub']) cellStatus[plat][cat] = 'stub';
      else if (statuses['deprecated']) cellStatus[plat][cat] = 'deprecated';
      else cellStatus[plat][cat] = 'not_built';
    }
  }

  // Overall counts
  const countsResult = await query(
    `SELECT implementation_status, COUNT(*) as count FROM platform_api_offering GROUP BY implementation_status`,
    [],
  );
  const counts: Record<string, number> = {};
  for (const row of countsResult.rows as { implementation_status: string; count: string }[]) {
    counts[row.implementation_status] = parseInt(row.count, 10);
  }

  return Response.json({
    matrix: cellStatus,
    platforms: Array.from(platforms).sort(),
    categories: Array.from(categories).sort(),
    counts,
  });
}
