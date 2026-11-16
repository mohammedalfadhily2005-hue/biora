-- BIORA — ترقية 8: الأرشفة وتنظيف المساحة (تُشغَّل مرة واحدة)
alter table biora.attachments add column if not exists archived_at timestamptz;
create table if not exists biora.purge_queue(path text primary key, until timestamptz not null);
alter table biora.purge_queue enable row level security;


create or replace function biora.stored(p text) returns boolean language plpgsql stable as $$
declare e boolean;
begin
  execute 'select exists(select 1 from storage.objects where bucket_id = ''biora-files'' and name = $1)' into e using p;
  return e;
exception when others then return false;
end $$;

create or replace function biora.orphans() returns jsonb language plpgsql stable as $$
declare r jsonb;
begin
  execute 'select jsonb_build_object(''count'', count(*), ''bytes'', coalesce(sum((o.metadata->>''size'')::bigint),0), ''paths'', coalesce(jsonb_agg(o.name),''[]''::jsonb))
           from storage.objects o where o.bucket_id = ''biora-files'' and o.created_at < now() - interval ''1 day''
             and not exists(select 1 from biora.attachments a where a.data = ''url:'' || o.name)' into r;
  return r;
exception when others then return jsonb_build_object('count', 0, 'bytes', 0, 'paths', '[]'::jsonb);
end $$;

create or replace function public.biora_can_purge(p text) returns boolean language sql stable security definer set search_path = biora as $$
  select exists(select 1 from biora.purge_queue q where q.path = p and q.until > now()) $$;

-- ───────── حالة النظام حسب المستخدم ─────────
create or replace function biora.usage() returns jsonb language plpgsql stable as $$
declare fb bigint; fc bigint; dbb bigint; m jsonb;
begin
  begin
    execute 'select coalesce(sum((metadata->>''size'')::bigint),0), count(*) from storage.objects where bucket_id = ''biora-files''' into fb, fc;
  exception when others then
    select coalesce(sum(size),0), count(*) into fb, fc from biora.attachments where data like 'url:%';
  end;
  begin dbb := pg_database_size(current_database()); exception when others then dbb := 0; end;
  select coalesce(jsonb_agg(jsonb_build_object('month', mm, 'files', n, 'bytes', b) order by mm),'[]'::jsonb) into m from (
    select to_char(at,'YYYY-MM') mm, count(*) n, coalesce(sum(size),0) b from biora.attachments
     where mime is distinct from 'text/uri-list' and at > now() - interval '12 months' group by 1) q;
  return jsonb_build_object('files_bytes', fb, 'files_count', fc, 'files_limit', 1073741824, 'db_bytes', dbb, 'db_limit', 524288000,
    'months', m, 'first_at', (select min(at) from biora.attachments where mime is distinct from 'text/uri-list'));
end $$;


create or replace function biora.state(u biora.users) returns jsonb language plpgsql stable as $$
declare res jsonb;
begin
  select jsonb_build_object(
    'v', 8,
    'usage', case when u.role = 'head' then biora.usage() end,
    'me', biora.user_json(u, true),
    'now', now(),
    'settings', (select val from biora.settings where key='org'),
    'users', (select coalesce(jsonb_agg(biora.user_json(x, u.role='head') order by x.rank_order, x.seq nulls last, x.name),'[]'::jsonb)
              from biora.users x where u.role='head' or x.active),
    'requests', (select coalesce(jsonb_agg(jsonb_build_object(
        'id',r.id,'ref',r.ref,'type',r.type,'user_id',r.user_id,'data',r.data,'status',r.status,
        'assigned_to',r.assigned_to,'seen_at',r.seen_at,'seen_by',r.seen_by,'created_at',r.created_at,'updated_at',r.updated_at,'closed_at',r.closed_at,
        'events',(select coalesce(jsonb_agg(jsonb_build_object('action',e.action,'note',e.note,'at',e.at,
                  'actor_id',e.actor_id,'actor_name',e.actor_name,'actor_label',e.actor_label) order by e.id),'[]'::jsonb)
                  from biora.events e where e.request_id=r.id),
        'files',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'mime',a.mime,'size',a.size,'arch',a.archived_at is not null) order by a.at),'[]'::jsonb)
                  from biora.attachments a where a.request_id=r.id)
      ) order by r.created_at desc),'[]'::jsonb) from biora.requests r where biora.can_see(u, r)),
    'letters', (select coalesce(jsonb_agg(jsonb_build_object(
        'id',l.id,'ref',l.ref,'kind',l.kind,'from_id',l.from_id,'subject',l.subject,'body',l.body,
        'parent_id',l.parent_id,'to_label',l.to_label,'created_at',l.created_at,'meta',l.meta,'edited_at',l.edited_at,
        'rcpt',(select coalesce(jsonb_agg(jsonb_build_object('user_id',c.user_id,'read_at',c.read_at)),'[]'::jsonb)
                from biora.letter_rcpt c where c.letter_id=l.id and (l.from_id=u.id or c.user_id=u.id)),
        'files',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'mime',a.mime,'size',a.size,'arch',a.archived_at is not null) order by a.at),'[]'::jsonb)
                  from biora.attachments a where a.letter_id=l.id)
      ) order by l.created_at desc),'[]'::jsonb) from biora.letters l
      where l.from_id=u.id or exists(select 1 from biora.letter_rcpt c where c.letter_id=l.id and c.user_id=u.id)),
    'absences', (select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'user_id',a.user_id,'day',a.day,'kind',a.kind,
        'excused',a.excused,'note',a.note) order by a.day desc),'[]'::jsonb) from biora.absences a
        where u.role='head' or a.user_id=u.id),
    'notifs', (select coalesce(jsonb_agg(to_jsonb(n) order by n.id desc),'[]'::jsonb) from
        (select id, body, kind, ref_id, read, at from biora.notifs where user_id=u.id order by id desc limit 60) n)
  ) into res;
  return res;
end $$;

-- ───────── نقطة الدخول الوحيدة ─────────
create or replace function public.api(action text, token text default null, payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = biora, public, extensions as $$
declare
  u biora.users; r biora.requests; l biora.letters; t biora.users;
  v_id uuid; v_note text; v_act text; v_tmp text; v_to text; v_ids uuid[]; v_label text; v_status text;
  v_n int;
  types text[] := array['leave','continuity','commence','noobjection','jobcert','event','mission','swap','nolectures','other'];
begin
  payload := coalesce(payload, '{}'::jsonb);

  if action = 'login' then
    select * into u from biora.users where lower(username) = lower(btrim(coalesce(payload->>'username','')));
    if not found or not u.active then
      return jsonb_build_object('error','اسم المستخدم أو كلمة المرور غير صحيحة');
    end if;
    if u.locked_until is not null and u.locked_until > now() then
      return jsonb_build_object('error','تم إيقاف المحاولات مؤقتاً. حاول بعد 10 دقائق');
    end if;
    if u.pass_hash <> crypt(coalesce(payload->>'password',''), u.pass_hash) then
      update biora.users set fails = fails + 1,
        locked_until = case when fails + 1 >= 8 then now() + interval '10 minutes' else null end where id = u.id;
      return jsonb_build_object('error','اسم المستخدم أو كلمة المرور غير صحيحة');
    end if;
    update biora.users set fails = 0, locked_until = null where id = u.id;
    delete from biora.sessions where last_seen < now() - interval '45 days';
    v_tmp := encode(gen_random_bytes(24),'hex');
    insert into biora.sessions(token_hash, user_id) values (encode(digest(v_tmp,'sha256'),'hex'), u.id);
    return jsonb_build_object('token', v_tmp, 'state', biora.state(u));
  end if;

  select us.* into u from biora.sessions s join biora.users us on us.id = s.user_id
   where s.token_hash = encode(digest(coalesce(token,''),'sha256'),'hex') and us.active;
  if not found then raise exception 'AUTH'; end if;
  update biora.sessions set last_seen = now()
   where token_hash = encode(digest(token,'sha256'),'hex') and last_seen < now() - interval '5 minutes';

  if action = 'state' then
    return jsonb_build_object('state', biora.state(u));

  elsif action = 'logout' then
    delete from biora.sessions where token_hash = encode(digest(token,'sha256'),'hex');
    return '{"ok":true}'::jsonb;

  elsif action = 'change_password' then
    if u.pass_hash <> crypt(coalesce(payload->>'old',''), u.pass_hash) then raise exception 'كلمة المرور الحالية غير صحيحة'; end if;
    if length(coalesce(payload->>'new','')) < 6 then raise exception 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل'; end if;
    if payload->>'new' = payload->>'old' then raise exception 'اختر كلمة مرور مختلفة عن الحالية'; end if;
    update biora.users set pass_hash = crypt(payload->>'new', gen_salt('bf')), must_change = false where id = u.id;
    delete from biora.sessions where user_id = u.id and token_hash <> encode(digest(token,'sha256'),'hex');

  elsif action = 'update_me' then
    update biora.users set phone = nullif(btrim(payload->>'phone'),''), email = nullif(btrim(payload->>'email'),'') where id = u.id;

  elsif action = 'read_notifs' then
    update biora.notifs set read = true where user_id = u.id and not read;

  elsif action = 'submit_request' then
    if u.role not in ('faculty','head') then raise exception 'تقديم الطلبات متاح للتدريسيين فقط'; end if;
    if not (payload->>'type' = any(types)) then raise exception 'نوع الطلب غير معروف'; end if;
    v_status := case when u.role = 'head' then 'at_dean' else 'submitted' end;
    insert into biora.requests(ref, type, user_id, data, status, reached_dean)
    values (biora.next_ref('ط'), payload->>'type', u.id, coalesce(payload->'data','{}'::jsonb), v_status, u.role = 'head')
    returning * into r;
    insert into biora.events(request_id, actor_id, actor_name, actor_label, action) values (r.id, u.id, u.name, biora.role_label(u), 'submit');
    perform biora.add_files(payload->'files', r.id, null, u.id);
    if u.role = 'head' then
      perform biora.notify_roles(array['dean','dean_asst'], u.id, 'طلب جديد من رئاسة القسم — ' || r.ref, 'request', r.id);
    else
      perform biora.notify_roles(array['head'], u.id, 'طلب جديد من ' || u.name || ' — ' || r.ref, 'request', r.id);
    end if;

  elsif action = 'resubmit' then
    select * into r from biora.requests where id = (payload->>'id')::uuid for update;
    if not found or r.user_id <> u.id or r.status <> 'returned' then raise exception 'لا يمكن تعديل هذا الطلب'; end if;
    v_status := case when u.role = 'head' then 'at_dean' else 'submitted' end;
    update biora.requests set data = coalesce(payload->'data', data), status = v_status, updated_at = now(), seen_at = null, seen_by = null,
      reached_dean = reached_dean or u.role = 'head', assigned_to = null where id = r.id;
    insert into biora.events(request_id, actor_id, actor_name, actor_label, action, note)
      values (r.id, u.id, u.name, biora.role_label(u), 'resubmit', nullif(btrim(payload->>'note'),''));
    perform biora.add_files(payload->'files', r.id, null, u.id);
    if u.role = 'head' then perform biora.notify_roles(array['dean','dean_asst'], u.id, 'أُعيد تقديم الطلب ' || r.ref, 'request', r.id);
    else perform biora.notify_roles(array['head'], u.id, 'أعاد ' || u.name || ' تقديم الطلب ' || r.ref, 'request', r.id); end if;

  elsif action = 'withdraw' then
    select * into r from biora.requests where id = (payload->>'id')::uuid for update;
    if not found or r.user_id <> u.id or r.status not in ('submitted','returned') then raise exception 'لا يمكن سحب هذا الطلب في حالته الحالية'; end if;
    update biora.requests set status = 'withdrawn', updated_at = now(), closed_at = now() where id = r.id;
    insert into biora.events(request_id, actor_id, actor_name, actor_label, action) values (r.id, u.id, u.name, biora.role_label(u), 'withdraw');

  elsif action = 'seen_request' then
    select * into r from biora.requests where id = (payload->>'id')::uuid for update;
    if found and r.seen_at is null and r.user_id <> u.id and (
         (u.role = 'head' and r.status in ('submitted','returned_dept'))
      or (u.role in ('dean','dean_asst') and r.status = 'at_dean')
      or (u.role = 'unit' and r.status = 'at_unit' and r.assigned_to = u.id)) then
      update biora.requests set seen_at = now(), seen_by = u.id where id = r.id;
    end if;

  elsif action in ('edit_request','delete_request') then
    select * into r from biora.requests where id = (payload->>'id')::uuid for update;
    if not found or r.user_id <> u.id then raise exception 'الطلب غير موجود'; end if;
    if r.seen_at is not null or not (r.status = 'submitted' or (u.role = 'head' and r.status = 'at_dean' and r.assigned_to is null)) then
      raise exception 'تم الاطلاع على الطلب أو البتّ به، لذلك لا يمكن تعديله أو حذفه';
    end if;
    if action = 'delete_request' then
      if exists(select 1 from biora.events e where e.request_id = r.id and e.action not in ('submit','edit')) then
        raise exception 'لهذا الطلب مسار سابق، يمكنك سحبه بدل حذفه';
      end if;
      delete from biora.notifs where ref_id = r.id;
      delete from biora.requests where id = r.id;
    else
      update biora.requests set data = coalesce(payload->'data', data), updated_at = now() where id = r.id;
      delete from biora.attachments a where a.request_id = r.id
        and a.id in (select (jsonb_array_elements_text(coalesce(payload->'remove_files','[]'::jsonb)))::uuid);
      perform biora.add_files(payload->'files', r.id, null, u.id);
      if (select count(*) from biora.attachments a where a.request_id = r.id) > 8 then raise exception 'الحد الأقصى 8 مرفقات'; end if;
      insert into biora.events(request_id, actor_id, actor_name, actor_label, action) values (r.id, u.id, u.name, biora.role_label(u), 'edit');
    end if;

  elsif action = 'recall' then
    select * into r from biora.requests where id = (payload->>'id')::uuid for update;
    if not found or u.role <> 'head' or r.user_id = u.id or r.status <> 'at_dean' or r.seen_at is not null or r.assigned_to is not null then
      raise exception 'اطّلعت العمادة على الطلب، لذلك لا يمكن سحب التحويل';
    end if;
    update biora.requests set status = 'submitted', updated_at = now(), seen_at = now(), seen_by = u.id,
      reached_dean = exists(select 1 from biora.events e join biora.users x on x.id = e.actor_id
                            where e.request_id = r.id and x.role in ('dean','dean_asst','unit')) where id = r.id;
    delete from biora.notifs n using biora.users x where n.ref_id = r.id and x.id = n.user_id and x.role in ('dean','dean_asst') and not n.read;
    insert into biora.events(request_id, actor_id, actor_name, actor_label, action, note)
      values (r.id, u.id, u.name, biora.role_label(u), 'recall', nullif(btrim(payload->>'note'),''));

  elsif action in ('edit_letter','delete_letter') then
    select * into l from biora.letters where id = (payload->>'id')::uuid for update;
    if not found or l.from_id <> u.id then raise exception 'الكتاب غير موجود'; end if;
    if exists(select 1 from biora.letter_rcpt c where c.letter_id = l.id and c.read_at is not null) then
      raise exception 'تم الاطلاع على الكتاب، لذلك لا يمكن تعديله أو حذفه';
    end if;
    if action = 'delete_letter' then
      if exists(select 1 from biora.letters x where x.parent_id = l.id) then raise exception 'على هذا الكتاب ردود، لذلك لا يمكن حذفه'; end if;
      delete from biora.notifs where ref_id = l.id;
      delete from biora.letters where id = l.id;
    else
      if nullif(btrim(payload->>'subject'),'') is null then raise exception 'اكتب موضوع الكتاب'; end if;
      update biora.letters set subject = btrim(payload->>'subject'), body = coalesce(payload->>'body',''), edited_at = now(),
        meta = jsonb_build_object('priority', case when payload->'meta'->>'priority' in ('urgent','very_urgent') then payload->'meta'->>'priority' else 'normal' end,
          'paper_no', left(coalesce(payload->'meta'->>'paper_no',''),60), 'paper_date', left(coalesce(payload->'meta'->>'paper_date',''),10)) where id = l.id;
      delete from biora.attachments a where a.letter_id = l.id
        and a.id in (select (jsonb_array_elements_text(coalesce(payload->'remove_files','[]'::jsonb)))::uuid);
      perform biora.add_files(payload->'files', null, l.id, u.id);
      if (select count(*) from biora.attachments a where a.letter_id = l.id) > 8 then raise exception 'الحد الأقصى 8 مرفقات'; end if;
      update biora.notifs set body = 'كتاب وارد: ' || btrim(payload->>'subject') where ref_id = l.id and kind = 'letter';
    end if;

  elsif action = 'comment' then
    select * into r from biora.requests where id = (payload->>'id')::uuid;
    if not found or not biora.can_see(u, r) then raise exception 'الطلب غير موجود'; end if;
    v_note := nullif(btrim(payload->>'note'),'');
    if v_note is null then raise exception 'اكتب الملاحظة أولاً'; end if;
    insert into biora.events(request_id, actor_id, actor_name, actor_label, action, note) values (r.id, u.id, u.name, biora.role_label(u), 'note', v_note);
    if r.user_id <> u.id then perform biora.notify(r.user_id, 'ملاحظة جديدة على طلبك ' || r.ref, 'request', r.id); end if;
    if u.role <> 'head' then perform biora.notify_roles(array['head'], r.user_id, 'ملاحظة جديدة على الطلب ' || r.ref, 'request', r.id); end if;

  elsif action = 'act' then
    select * into r from biora.requests where id = (payload->>'id')::uuid for update;
    if not found or not biora.can_see(u, r) then raise exception 'الطلب غير موجود'; end if;
    v_act := payload->>'action';
    v_note := nullif(btrim(payload->>'note'),'');
    if v_act in ('reject','return','back') and v_note is null then raise exception 'اكتب السبب أولاً'; end if;
    v_label := biora.role_label(u);

    if u.role = 'head' and r.user_id <> u.id and r.status in ('submitted','returned_dept') then
      if v_act = 'approve' then v_status := 'done';
      elsif v_act = 'reject' then v_status := 'rejected';
      elsif v_act = 'return' then v_status := 'returned';
      elsif v_act = 'forward' then v_status := 'at_dean';
      else raise exception 'إجراء غير متاح'; end if;
      update biora.requests set status = v_status, updated_at = now(), assigned_to = null, seen_at = null, seen_by = null,
        reached_dean = reached_dean or v_status = 'at_dean',
        closed_at = case when v_status in ('done','rejected') then now() end where id = r.id;
      if v_status = 'at_dean' then
        perform biora.notify_roles(array['dean','dean_asst'], null, 'طلب محوَّل من قسم علوم الحياة — ' || r.ref, 'request', r.id);
      end if;
      perform biora.notify(r.user_id, case v_status when 'done' then 'تمت الموافقة على طلبك ' when 'rejected' then 'رُفض طلبك '
        when 'returned' then 'أُعيد إليك طلبك للتعديل ' else 'حُوِّل طلبك إلى العمادة ' end || r.ref, 'request', r.id);

    elsif u.role in ('dean','dean_asst') and r.status in ('at_dean','at_unit') then
      if v_act = 'approve' then v_status := 'done';
      elsif v_act = 'reject' then v_status := 'rejected';
      elsif v_act = 'return' then
        select role into v_tmp from biora.users where id = r.user_id;
        v_status := case when v_tmp = 'head' then 'returned' else 'returned_dept' end;
      elsif v_act = 'assign' then
        select * into t from biora.users where id = (payload->>'to')::uuid and active and role in ('unit','dean_asst','dean');
        if not found then raise exception 'اختر الجهة المحوَّل إليها'; end if;
        v_status := 'at_unit';
      else raise exception 'إجراء غير متاح'; end if;
      update biora.requests set status = v_status, updated_at = now(), seen_at = null, seen_by = null,
        assigned_to = case when v_act = 'assign' then t.id else null end,
        unit_ids = case when v_act = 'assign' and not (t.id = any(unit_ids)) then unit_ids || t.id else unit_ids end,
        closed_at = case when v_status in ('done','rejected') then now() end where id = r.id;
      if v_act = 'assign' then
        v_note := coalesce(v_note || ' — ', '') || 'إلى: ' || coalesce(nullif(t.position,''), t.name);
        perform biora.notify(t.id, 'طلب محوَّل إليكم — ' || r.ref, 'request', r.id);
      else
        perform biora.notify_roles(array['head'], null, case v_status when 'done' then 'أنجزت العمادة الطلب ' when 'rejected' then 'رفضت العمادة الطلب '
          else 'أعادت العمادة الطلب ' end || r.ref, 'request', r.id);
        select role into v_tmp from biora.users where id = r.user_id;
        if v_tmp <> 'head' and v_status in ('done','rejected') then
          perform biora.notify(r.user_id, case v_status when 'done' then 'أُنجز طلبك ' else 'رُفض طلبك ' end || r.ref, 'request', r.id);
        end if;
      end if;

    elsif u.role = 'unit' and r.status = 'at_unit' and r.assigned_to = u.id then
      if v_act = 'complete' then v_status := 'done';
      elsif v_act = 'back' then v_status := 'at_dean';
      else raise exception 'إجراء غير متاح'; end if;
      update biora.requests set status = v_status, updated_at = now(), assigned_to = null, seen_at = null, seen_by = null,
        closed_at = case when v_status = 'done' then now() end where id = r.id;
      perform biora.notify_roles(array['dean','dean_asst'], null, case v_status when 'done' then 'أنجزت الشعبة الطلب ' else 'أعادت الشعبة الطلب ' end || r.ref, 'request', r.id);
      if v_status = 'done' then
        perform biora.notify_roles(array['head'], null, 'أُنجز الطلب ' || r.ref, 'request', r.id);
        perform biora.notify(r.user_id, 'أُنجز طلبك ' || r.ref, 'request', r.id);
      end if;
    else
      raise exception 'لا تملك صلاحية هذا الإجراء على الطلب في حالته الحالية';
    end if;
    insert into biora.events(request_id, actor_id, actor_name, actor_label, action, note) values (r.id, u.id, u.name, v_label, v_act, v_note);

  elsif action = 'send_letter' then
    v_to := payload->>'to';
    if nullif(btrim(payload->>'subject'),'') is null then raise exception 'اكتب موضوع الكتاب'; end if;
    if v_to = 'deanery' and u.role in ('head','unit') then
      select array_agg(id) into v_ids from biora.users where role in ('dean','dean_asst') and active; v_label := 'عمادة الكلية';
    elsif v_to = 'staff' and u.role = 'head' then
      select array_agg(id) into v_ids from biora.users where role = 'faculty' and active; v_label := 'تعميم على الكادر التدريسي';
    elsif v_to = 'head' and u.role in ('dean','dean_asst','faculty') then
      select array_agg(id) into v_ids from biora.users where role = 'head' and active; v_label := 'رئاسة قسم علوم الحياة';
    elsif v_to = 'units' and u.role in ('dean','dean_asst') then
      select array_agg(id) into v_ids from biora.users where role = 'unit' and active; v_label := 'شعب العمادة';
    elsif v_to = 'ids' and u.role <> 'faculty' then
      select array_agg(x.id), string_agg(coalesce(nullif(x.position,''), x.name), '، ') into v_ids, v_label from biora.users x
       where x.active and x.id <> u.id and x.id in (select (jsonb_array_elements_text(payload->'ids'))::uuid)
         and (u.role = 'head' or (u.role in ('dean','dean_asst') and x.role in ('dean','dean_asst','unit','head'))
              or (u.role = 'unit' and x.role in ('dean','dean_asst')));
      if length(v_label) > 90 then v_label := left(v_label, 88) || '…'; end if;
    else raise exception 'لا تملك صلاحية الإرسال إلى هذه الجهة'; end if;
    if v_ids is null or array_length(v_ids,1) is null then raise exception 'لا يوجد مستلمون'; end if;
    insert into biora.letters(ref, kind, from_id, subject, body, parent_id, to_label, meta)
    values (biora.next_ref('ك'), case when v_to = 'staff' then 'circular' else 'letter' end, u.id,
      btrim(payload->>'subject'), coalesce(payload->>'body',''), nullif(payload->>'parent_id','')::uuid, v_label,
      jsonb_build_object('priority', case when payload->'meta'->>'priority' in ('urgent','very_urgent') then payload->'meta'->>'priority' else 'normal' end,
        'paper_no', left(coalesce(payload->'meta'->>'paper_no',''),60), 'paper_date', left(coalesce(payload->'meta'->>'paper_date',''),10)))
    returning * into l;
    insert into biora.letter_rcpt(letter_id, user_id) select l.id, x from unnest(v_ids) x where x <> u.id on conflict do nothing;
    perform biora.add_files(payload->'files', null, l.id, u.id);
    insert into biora.notifs(user_id, body, kind, ref_id)
      select x, 'كتاب وارد: ' || l.subject, 'letter', l.id from unnest(v_ids) x where x <> u.id;

  elsif action = 'read_letter' then
    update biora.letter_rcpt set read_at = now() where letter_id = (payload->>'id')::uuid and user_id = u.id and read_at is null;

  elsif action = 'get_file' then
    select a.name, a.mime, a.data into v_tmp, v_to, v_note from biora.attachments a where a.id = (payload->>'id')::uuid
      and ((a.request_id is not null and exists(select 1 from biora.requests q where q.id = a.request_id and biora.can_see(u, q)))
        or (a.letter_id is not null and exists(select 1 from biora.letters q where q.id = a.letter_id and
             (q.from_id = u.id or exists(select 1 from biora.letter_rcpt c where c.letter_id = q.id and c.user_id = u.id)))));
    if not found then raise exception 'المرفق غير متاح'; end if;
    if v_note = 'archived:' then raise exception 'هذا المرفق مؤرشف خارج النظام. تجده في ملف الأرشيف المحفوظ لدى رئاسة القسم'; end if;
    return jsonb_build_object('name', v_tmp, 'mime', v_to, 'data', v_note);

  elsif action in ('set_absence','delete_absence','save_user','reset_password','delete_user','save_settings','archive_list','archive_begin','archive_finish') then
    if u.role <> 'head' then raise exception 'هذا الإجراء من صلاحية رئاسة القسم فقط'; end if;

    if action = 'set_absence' then
      if not exists(select 1 from biora.users where id = (payload->>'user_id')::uuid) then raise exception 'التدريسي غير موجود'; end if;
      insert into biora.absences(user_id, day, kind, excused, note, by_id)
      values ((payload->>'user_id')::uuid, (payload->>'day')::date, coalesce(payload->>'kind','absent'),
        coalesce((payload->>'excused')::boolean,false), nullif(btrim(payload->>'note'),''), u.id)
      on conflict (user_id, day) do update set kind = excluded.kind, excused = excluded.excused, note = excluded.note, by_id = excluded.by_id, at = now();

    elsif action = 'delete_absence' then
      delete from biora.absences where id = (payload->>'id')::uuid;

    elsif action = 'save_user' then
      if nullif(btrim(payload->>'name'),'') is null then raise exception 'اكتب الاسم'; end if;
      if payload->>'id' is null then
        if not (payload->>'role' in ('faculty','dean','dean_asst','unit')) then raise exception 'نوع الحساب غير صحيح'; end if;
        if nullif(btrim(payload->>'username'),'') is null then raise exception 'اكتب اسم المستخدم'; end if;
        if exists(select 1 from biora.users where lower(username) = lower(btrim(payload->>'username'))) then raise exception 'اسم المستخدم مستعمل من قبل'; end if;
        v_tmp := biora.temp_pass();
        insert into biora.users(username, pass_hash, role, name, rank, rank_order, rank_date, seq, position, phone, email, specialty, notes)
        values (lower(btrim(payload->>'username')), crypt(v_tmp, gen_salt('bf')), payload->>'role', btrim(payload->>'name'),
          nullif(payload->>'rank',''), biora.rank_ord(payload->>'rank'), nullif(payload->>'rank_date','')::date,
          (select coalesce(max(seq),0)+1 from biora.users), nullif(btrim(payload->>'position'),''),
          nullif(btrim(payload->>'phone'),''), nullif(btrim(payload->>'email'),''), nullif(btrim(payload->>'specialty'),''), nullif(btrim(payload->>'notes'),''))
        returning id into v_id;
        return jsonb_build_object('id', v_id, 'temp_password', v_tmp, 'state', biora.state(u));
      else
        v_id := (payload->>'id')::uuid;
        if v_id = u.id and coalesce((payload->>'active')::boolean, true) = false then raise exception 'لا يمكن تعطيل حسابك'; end if;
        update biora.users set name = btrim(payload->>'name'), rank = nullif(payload->>'rank',''),
          rank_order = biora.rank_ord(payload->>'rank'), rank_date = nullif(payload->>'rank_date','')::date,
          position = nullif(btrim(payload->>'position'),''), phone = nullif(btrim(payload->>'phone'),''),
          email = nullif(btrim(payload->>'email'),''), specialty = nullif(btrim(payload->>'specialty'),''),
          notes = nullif(btrim(payload->>'notes'),''), active = coalesce((payload->>'active')::boolean, active)
        where id = v_id;
        if coalesce((payload->>'active')::boolean, true) = false then delete from biora.sessions where user_id = v_id; end if;
      end if;

    elsif action = 'reset_password' then
      v_tmp := biora.temp_pass();
      update biora.users set pass_hash = crypt(v_tmp, gen_salt('bf')), must_change = true, fails = 0, locked_until = null
       where id = (payload->>'id')::uuid and id <> u.id;
      if not found then raise exception 'الحساب غير موجود'; end if;
      delete from biora.sessions where user_id = (payload->>'id')::uuid;
      return jsonb_build_object('temp_password', v_tmp, 'state', biora.state(u));

    elsif action = 'delete_user' then
      v_id := (payload->>'id')::uuid;
      if v_id = u.id then raise exception 'لا يمكن حذف حسابك'; end if;
      if exists(select 1 from biora.requests where user_id = v_id) or exists(select 1 from biora.letters where from_id = v_id)
         or exists(select 1 from biora.requests where assigned_to = v_id) then
        raise exception 'لهذا الحساب سجلات محفوظة، لذلك لا يُحذف. يمكنك تعطيله بدل الحذف';
      end if;
      delete from biora.users where id = v_id;

    elsif action = 'archive_list' then
      return jsonb_build_object(
        'items', (select coalesce(jsonb_agg(jsonb_build_object('id',af.id,'name',af.name,'mime',af.mime,'size',af.size,'at',af.at,
            'path', case when af.data like 'url:%' then substr(af.data,5) end,
            'ref', coalesce(aq.ref, al.ref), 'subject', coalesce(al.subject, aq.type), 'owner', ax.name) order by af.at),'[]'::jsonb)
          from biora.attachments af left join biora.requests aq on aq.id = af.request_id left join biora.letters al on al.id = af.letter_id
          left join biora.users ax on ax.id = coalesce(aq.user_id, al.from_id)
          where af.archived_at is null and af.mime is distinct from 'text/uri-list' and af.data not like 'link:%' and af.at < (payload->>'before')::date),
        'orphans', biora.orphans());

    elsif action = 'archive_begin' then
      delete from biora.purge_queue where until < now();
      insert into biora.purge_queue(path, until)
        select substr(a.data,5), now() + interval '20 minutes' from biora.attachments a
         where a.data like 'url:%' and a.archived_at is null and a.id in (select (jsonb_array_elements_text(coalesce(payload->'ids','[]'::jsonb)))::uuid)
        on conflict (path) do update set until = excluded.until;
      insert into biora.purge_queue(path, until)
        select p, now() + interval '20 minutes' from jsonb_array_elements_text(biora.orphans()->'paths') p
        on conflict (path) do update set until = excluded.until;
      return jsonb_build_object('paths', (select coalesce(jsonb_agg(path),'[]'::jsonb) from biora.purge_queue where until > now()));

    elsif action = 'archive_finish' then
      update biora.attachments a set data = 'archived:', archived_at = now()
       where a.archived_at is null and a.mime is distinct from 'text/uri-list' and a.data not like 'link:%'
         and a.id in (select (jsonb_array_elements_text(coalesce(payload->'ids','[]'::jsonb)))::uuid)
         and (a.data not like 'url:%' or not biora.stored(substr(a.data,5)));
      get diagnostics v_n = row_count;
      delete from biora.purge_queue;
      select * into u from biora.users where id = u.id;
      return jsonb_build_object('archived', v_n, 'state', biora.state(u));

    elsif action = 'save_settings' then
      update biora.settings set val = val || payload where key = 'org';
    end if;
  else
    raise exception 'إجراء غير معروف';
  end if;

  select * into u from biora.users where id = u.id;
  return jsonb_build_object('state', biora.state(u));
end $$;


revoke all on function public.biora_can_purge(text) from public;
grant execute on function public.biora_can_purge(text) to anon, authenticated;
drop policy if exists "biora purge select" on storage.objects;
create policy "biora purge select" on storage.objects for select to anon, authenticated
  using (bucket_id = 'biora-files' and public.biora_can_purge(name));
drop policy if exists "biora purge delete" on storage.objects;
create policy "biora purge delete" on storage.objects for delete to anon, authenticated
  using (bucket_id = 'biora-files' and public.biora_can_purge(name));

notify pgrst, 'reload schema';
select 'تمت الترقية 8 بنجاح' as result;
