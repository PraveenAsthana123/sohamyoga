// DripSequenceJob — hourly
// Thin re-export of the domain-level DripSequenceProcessorJob so it can be
// registered by the cron scheduler under the canonical job name used in the
// module registry. All real advancement logic lives in the domain file.
export { run } from '@/domain/campaign/DripSequenceProcessorJob';
