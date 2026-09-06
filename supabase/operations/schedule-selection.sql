-- Install only after SELECTION_WORKER_SECRET is configured in Edge Functions
-- and the SAME value is stored under selection_worker_secret in Vault.
-- No secret values should be committed or printed. This operation is
-- idempotent: a previous job with this exact name is replaced.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create extension if not exists pg_cron;
create extension if not exists pg_net;
do $$ begin
 if not exists(select 1 from vault.secrets where name='selection_worker_secret')
 or not exists(select 1 from vault.secrets where name='selection_project_url') then
   raise exception 'Configure selection_worker_secret and selection_project_url in Vault first';
 end if;
 if not exists(
   select 1 from vault.decrypted_secrets
   where name='selection_worker_secret' and length(decrypted_secret)>=32
 ) then
   raise exception 'selection_worker_secret must be a long non-empty secret';
 end if;
 if not exists(
   select 1 from vault.decrypted_secrets
   where name='selection_project_url'
     and decrypted_secret='https://hzewxtimkbxljozyrafk.supabase.co'
 ) then
   raise exception 'selection_project_url does not match this project';
 end if;
end $$;
 do $$ begin
   if exists(select 1 from cron.job where jobname='selection-dispatch-minute') then
     perform cron.unschedule('selection-dispatch-minute');
   end if;
   perform cron.schedule('selection-dispatch-minute','* * * * *',$job$
     select net.http_post(
       url:=(select decrypted_secret from vault.decrypted_secrets where name='selection_project_url')||'/functions/v1/selection-dispatch',
       headers:=jsonb_build_object('Content-Type','application/json','X-Selection-Worker-Secret',
         (select decrypted_secret from vault.decrypted_secrets where name='selection_worker_secret')),
       body:='{}'::jsonb,timeout_milliseconds:=50000
     ) where exists(select 1 from public.seleccion_config where id and progressive_enabled and not dispatch_paused);
   $job$);
 end $$;
commit;

-- Metadata only. Never print Vault values.
select jobid,jobname,schedule,active
from cron.job
where jobname='selection-dispatch-minute';
