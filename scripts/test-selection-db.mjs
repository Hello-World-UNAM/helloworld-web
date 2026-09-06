import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

// Requires an explicitly named disposable Postgres container; never connects to production.
const container = process.env.SELECTION_TEST_CONTAINER || 'hw-selection-test-20260905';
if (!/^hw-selection-test-[a-z0-9-]+$/.test(container)) throw new Error('Use an isolated hw-selection-test-* container');
const db = `selection_test_${randomBytes(5).toString('hex')}`;
function docker(args, input) {
  const r = spawnSync('docker', ['exec', '-i', container, ...args], { input, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || r.error?.message);
  return r.stdout;
}
docker(['createdb', '-U', 'postgres', db]);
const sql = (input) => docker(['psql', '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1'], input);
console.log(`Isolated database: ${db}`);
sql(readFileSync('supabase/tests/selection-baseline.sql', 'utf8'));
for (const f of readdirSync('supabase/migrations').filter(f => /_(progressive_selection|selection_hardening|selection_reminder_window|selection_save_preserves_booking|selection_evaluation_metadata)\.sql$/.test(f)).sort()) sql(readFileSync(`supabase/migrations/${f}`, 'utf8'));
console.log(sql(readFileSync('supabase/tests/selection-workflow.sql', 'utf8')));
console.log(sql(readFileSync('supabase/tests/selection-edge-cases.sql', 'utf8')));
console.log(sql(readFileSync('supabase/tests/selection-lifecycle.sql', 'utf8')));
const setup = sql(`
update public.seleccion_config set applications_closed=false;
insert into public.interview_days(season,date,start_time,end_time,duration_minutes,meet_url)
values('2027-1',(now() at time zone 'America/Mexico_City')::date+20,'10:00','10:30',30,'https://meet.google.com/concurrency');
do $$ declare a uuid; begin
for n in 91..92 loop a:=public.test_app(n); update public.solicitudes set status='accepted' where id=a;
insert into public.interview_booking_tokens(solicitud_id,token,invited_at,expires_at) values(a,'concurrency-'||n,now(),now()+interval '7 days'); end loop; end $$;
`);
async function concurrentBooking(token) {
  return new Promise((resolve, reject) => {
    const p = spawn('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', db, '-tA', '-v', 'ON_ERROR_STOP=1'], { stdio: ['pipe','pipe','pipe'] });
    let out = '', err = ''; p.stdout.on('data',d => out += d); p.stderr.on('data',d => err += d);
    p.on('error', reject); p.on('close', code => code ? reject(new Error(err)) : resolve(JSON.parse(out.trim())));
    p.stdin.end(`select public.book_interview('${token}',(((now() at time zone 'America/Mexico_City')::date+20)+time '10:00') at time zone 'America/Mexico_City');`);
  });
}
const raced = await Promise.all([concurrentBooking('concurrency-91'), concurrentBooking('concurrency-92')]);
if (raced.filter(r => r.ok).length !== 1 || raced.filter(r => r.error === 'SLOT_TAKEN').length !== 1) throw new Error('Concurrent last-slot test failed');
console.log('Concurrent last-slot booking passed.');
console.log('Selection database tests passed. Disposable database retained for inspection.');
