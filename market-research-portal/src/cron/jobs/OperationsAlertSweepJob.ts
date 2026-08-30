// Scheduled wrapper around the same sweep the /operations-alerts admin page
// runs synchronously on every load — this is the "even if nobody has the
// page open" half of the mandatory tracking policy.
import { runOperationsAlertSweep } from '../../domain/pipeline/OperationsAlertSweep';

export async function run(): Promise<{ findings: number }> {
  return runOperationsAlertSweep();
}
