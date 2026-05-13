-- Remove any prior schedule with the same name (safe to re-run)
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'purge-hub-audit-log-monthly';

-- Schedule monthly purge: minute 0, hour 3, day 1, every month, every weekday
SELECT cron.schedule(
  'purge-hub-audit-log-monthly',
  '0 3 1 * *',
  $$ SELECT public.purge_old_hub_audit_log(); $$
);