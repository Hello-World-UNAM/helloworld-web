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
for (const f of readdirSync('supabase/migrations').filter(f => /_(progressive_selection|selection_hardening|selection_reminder_window|selection_save_preserves_booking|selection_evaluation_metadata|restore_selection_mail_templates|selection_member_provisioning|selection_mail_notifications|selection_mail_preparation_guard|selection_rooms)\.sql$/.test(f)).sort()) sql(readFileSync(`supabase/migrations/${f}`, 'utf8'));
console.log(sql(readFileSync('supabase/tests/selection-workflow.sql', 'utf8')));
console.log(sql(readFileSync('supabase/tests/selection-edge-cases.sql', 'utf8')));
console.log(sql(readFileSync('supabase/tests/selection-lifecycle.sql', 'utf8')));
console.log(sql(readFileSync('supabase/tests/selection-member-provisioning.sql', 'utf8')));
console.log(sql(readFileSync('supabase/tests/selection-notifications.sql', 'utf8')));
console.log(sql(readFileSync('supabase/tests/selection-essential-mail.sql', 'utf8')));
console.log(sql(readFileSync('supabase/tests/selection-rooms.sql', 'utf8')));
// Verify the original migration contracts before retiring their admin controls.
sql(readFileSync('supabase/migrations/20261003211000_selection_room_workflow.sql', 'utf8'));
console.log(sql(readFileSync('supabase/tests/selection-room-workflow.sql', 'utf8')));
sql(readFileSync('supabase/migrations/20261004002000_selection_invitation_capacity.sql', 'utf8'));
console.log(sql(readFileSync('supabase/tests/selection-invitation-capacity.sql', 'utf8')));
sql(readFileSync('supabase/migrations/20261004010000_selection_room_deletion.sql', 'utf8'));
console.log(sql(readFileSync('supabase/tests/selection-room-deletion.sql', 'utf8')));
const setup = sql(`
update public.seleccion_config set applications_closed=false;
insert into public.interview_days(season,date,start_time,end_time,duration_minutes,meet_url)
values('2027-1',(now() at time zone 'America/Mexico_City')::date+20,'10:00','10:30',30,'https://meet.google.com/concurrency');
insert into private_selection.rooms(season,date,name,position,primary_email,backup_email,calendar_event_id,calendar_status,meet_url,published)
values('2027-1',(now() at time zone 'America/Mexico_City')::date+20,'Concurrency',1,'race-host@example.org','race-backup@example.org','clubroom123456789','ready','https://meet.google.com/aaa-bbbb-ccc',true);
update public.interview_days set room_id=(select id from private_selection.rooms where name='Concurrency') where date=(now() at time zone 'America/Mexico_City')::date+20;
do $$ declare a uuid; begin
for n in 91..92 loop a:=public.test_app(n); update public.solicitudes set status='accepted' where id=a;
insert into public.interview_booking_tokens(solicitud_id,token,invited_at,expires_at) values(a,'concurrency-'||n,now(),now()+interval '7 days'); end loop; end $$;
`);
async function concurrentBooking(token, dayOffset = 20) {
  return new Promise((resolve, reject) => {
    const p = spawn('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', db, '-tA', '-v', 'ON_ERROR_STOP=1'], { stdio: ['pipe','pipe','pipe'] });
    let out = '', err = ''; p.stdout.on('data',d => out += d); p.stderr.on('data',d => err += d);
    p.on('error', reject); p.on('close', code => code ? reject(new Error(err)) : resolve(JSON.parse(out.trim())));
    p.stdin.end(`select public.book_interview('${token}',(((now() at time zone 'America/Mexico_City')::date+${dayOffset})+time '10:00') at time zone 'America/Mexico_City');`);
  });
}
const raced = await Promise.all([concurrentBooking('concurrency-91'), concurrentBooking('concurrency-92')]);
if (raced.filter(r => r.ok).length !== 1 || raced.filter(r => r.error === 'SLOT_TAKEN').length !== 1) throw new Error('Concurrent last-slot test failed');
console.log('Concurrent last-slot booking passed.');
sql(`
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select set_config('request.jwt.claims','{"email":"admin@example.org"}',false);
select public.selection_admin('room',jsonb_build_object('operation','create','date',(now() at time zone 'America/Mexico_City')::date+21,'start_time','10:00','end_time','10:15','room_count',2,'request_id',gen_random_uuid()));
update private_selection.rooms set primary_email='host-'||position||'@example.org',backup_email='backup-'||position||'@example.org',
  calendar_status='ready',meet_url='https://meet.google.com/aaa-bbbb-ccc',host_verified_at=now(),published=true
  where date=(now() at time zone 'America/Mexico_City')::date+21;
do $$ declare a uuid; begin
for n in 93..95 loop a:=public.test_app(n); update public.solicitudes set status='accepted' where id=a;
insert into public.interview_booking_tokens(solicitud_id,token,invited_at,expires_at) values(a,'concurrency-'||n,now(),now()+interval '7 days'); end loop; end $$;
`);
const roomRace = await Promise.all([93, 94, 95].map(n => concurrentBooking(`concurrency-${n}`, 21)));
if (roomRace.filter(r => r.ok).length !== 2 || roomRace.filter(r => r.error === 'SLOT_TAKEN').length !== 1) throw new Error('Concurrent room capacity test failed');
const distinctRooms = sql(`select count(distinct room_id) from public.interviews where id in ('${roomRace.filter(r => r.ok).map(r => r.interview_id).join("','")}');`);
if (!distinctRooms.includes('2')) throw new Error('Concurrent room assignment duplicated a room');
console.log('Concurrent two-room booking passed: two seats, three applicants.');
// Two admins competing to invite different people to one available seat.
sql(`
update public.seleccion_config set is_open=true,applications_closed=false,active_season='2027-1';
do $$ declare a uuid; r uuid; day date:=(now() at time zone 'America/Mexico_City')::date+22; begin
 for n in 301..302 loop a:=public.test_app(n); update public.solicitudes set season='2096-1',status='accepted' where id=a; end loop;
 update public.seleccion_config set active_season='2096-1';
 insert into private_selection.rooms(season,date,name,position,primary_email,backup_email,calendar_event_id,calendar_status,meet_url,published)
 values('2096-1',day,'Invitation race',1,'invite-host@example.org','invite-backup@example.org','clubroomrace','ready','https://meet.google.com/aaa-bbbb-ccc',true) returning id into r;
 insert into public.interview_days(season,room_id,date,start_time,end_time,duration_minutes) values('2096-1',r,day,'10:00','10:15',15);
end $$;
create function public.test_capacity_confirm(n integer) returns jsonb language plpgsql as $$
declare a public.solicitudes; cfg integer; begin
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
 perform set_config('request.jwt.claims','{"email":"admin@example.org"}',true);
 select * into a from public.solicitudes where correo='test'||n||'@example.org';
 select selection_revision into cfg from public.seleccion_config where id;
 -- Keep both sessions' preflight reads ahead of the actual mutation.
 perform pg_sleep(0.2);
 return public.selection_admin('confirm',jsonb_build_object('kind','initial','items',jsonb_build_array(jsonb_build_object('id',a.id,'revision',a.selection_revision)),
 'config_revision',cfg,'request_id',gen_random_uuid()));
exception when raise_exception then return jsonb_build_object('error',sqlerrm); end $$;
`);
async function raceInvitation(n) {
 return new Promise((resolve,reject) => {
  const process = spawn('docker',['exec','-i',container,'psql','-U','postgres','-d',db,'-tA','-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});
  let output='',error='';process.stdout.on('data',chunk=>output+=chunk);process.stderr.on('data',chunk=>error+=chunk);
  process.on('error',reject);process.on('close',code=>code ? reject(new Error(error)) : resolve(JSON.parse(output.trim())));
  process.stdin.end(`select public.test_capacity_confirm(${n});`);
 });
}
const invitationRace = await Promise.all([raceInvitation(301),raceInvitation(302)]);
if(invitationRace.filter(result=>result.queued===1).length!==1 || invitationRace.filter(result=>['STALE_PREVIEW','INSUFFICIENT_CAPACITY'].includes(result.error)).length!==1) throw new Error('Invitation capacity race failed: '+JSON.stringify(invitationRace));
const invitationsEnqueued = sql(`select count(*) from private_selection.messages m join public.solicitudes s on s.id=m.solicitud_id where s.season='2096-1' and m.kind='initial';`);
if(!/\b1\b/.test(invitationsEnqueued)) throw new Error('Duplicate initial invitations exceeded capacity');
console.log('Concurrent initial invitations passed: one seat, two admins, one queued invitation.');
console.log('Selection database tests passed. Disposable database retained for inspection.');
