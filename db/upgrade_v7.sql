-- BIORA — ترقية 7: عدّاد مساحة التخزين لرئاسة القسم (تُشغَّل مرة واحدة)
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
    'v', 7,
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
        'files',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'mime',a.mime,'size',a.size) order by a.at),'[]'::jsonb)
                  from biora.attachments a where a.request_id=r.id)
      ) order by r.created_at desc),'[]'::jsonb) from biora.requests r where biora.can_see(u, r)),
    'letters', (select coalesce(jsonb_agg(jsonb_build_object(
        'id',l.id,'ref',l.ref,'kind',l.kind,'from_id',l.from_id,'subject',l.subject,'body',l.body,
        'parent_id',l.parent_id,'to_label',l.to_label,'created_at',l.created_at,'meta',l.meta,'edited_at',l.edited_at,
        'rcpt',(select coalesce(jsonb_agg(jsonb_build_object('user_id',c.user_id,'read_at',c.read_at)),'[]'::jsonb)
                from biora.letter_rcpt c where c.letter_id=l.id and (l.from_id=u.id or c.user_id=u.id)),
        'files',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'mime',a.mime,'size',a.size) order by a.at),'[]'::jsonb)
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


notify pgrst, 'reload schema';
select 'تمت الترقية 7 بنجاح' as result;
