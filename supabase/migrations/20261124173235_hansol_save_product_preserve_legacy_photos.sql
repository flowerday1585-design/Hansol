CREATE OR REPLACE FUNCTION public.hansol_save_product(p_revision bigint, p_item_id bigint, p_product jsonb, p_photo_changes jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  row_data public.hansol_catalog%rowtype;
  previous_item jsonb := '{}'::jsonb;
  photos jsonb;
  original_photos jsonb;
  item_record jsonb;
  item_index integer;
  saved_id bigint;
  photo_slot text;
  photo_value jsonb;
begin
  if public.hansol_is_catalog_admin() is distinct from true then raise insufficient_privilege; end if;
  if jsonb_typeof(p_product) is distinct from 'object' or jsonb_typeof(p_photo_changes) is distinct from 'object'
     or p_product - array['stock','category','categoryName','code','name','price','desc','soldOut','vatMode','vatInput'] <> '{}'::jsonb then
    raise exception 'Invalid product data' using errcode='22023';
  end if;
  select * into row_data from public.hansol_catalog where id=1 for update;
  if not found or row_data.revision is distinct from p_revision then return null; end if;
  saved_id := coalesce(p_item_id,row_data.next_id);
  if p_item_id is not null then
    select (entry.ordinality-1)::integer, entry.value into item_index, previous_item
      from jsonb_array_elements(row_data.items) with ordinality as entry(value, ordinality)
      where entry.value->>'id'=p_item_id::text;
    if not found then return null; end if;
  end if;
  photos := coalesce(previous_item->'imgs','[]'::jsonb);
  if jsonb_typeof(photos) is distinct from 'array' then photos := '[]'::jsonb; end if;
  original_photos := photos;
  while jsonb_array_length(photos)<3 loop photos := photos || '[""]'::jsonb; end loop;
  for photo_slot, photo_value in select key,value from jsonb_each(p_photo_changes) loop
    if photo_slot not in ('0','1','2') or jsonb_typeof(photo_value) is distinct from 'string'
       or (
         coalesce(photo_value #>> '{}','') !~* '^(|data:image/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+|https://bmrtppizatuahnpjuren[.]supabase[.]co/storage/v1/object/public/product-images/catalog/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](jpg|png|webp|gif))$'
         and not exists (
           select 1 from jsonb_array_elements(original_photos) as original_photo(value)
            where original_photo.value = photo_value
         )
       ) then
      raise exception 'Invalid photo' using errcode='22023';
    end if;
    photos := jsonb_set(photos,array[photo_slot],photo_value,false);
  end loop;
  if p_product ? 'vatMode' or p_product ? 'vatInput' then
    if jsonb_typeof(p_product->'vatMode') is distinct from 'string'
      or coalesce(p_product->>'vatMode','') not in ('included','excluded')
      or jsonb_typeof(p_product->'vatInput') is distinct from 'number'
      or coalesce(p_product->>'vatInput','') !~ '^(0|[1-9][0-9]{0,12})$' then
      raise exception 'Invalid VAT price' using errcode='22023';
    end if;
    declare
      amount numeric := (p_product->>'vatInput')::numeric;
      total numeric := amount;
    begin
      if p_product->>'vatMode'='excluded' then total := amount + round(amount/10); end if;
      if total>9999999999999 or p_product->'price' is distinct from to_jsonb(total::bigint) then
        raise exception 'Invalid VAT total' using errcode='22023';
      end if;
    end;
  elsif p_product ? 'price' and p_product->'price' is distinct from previous_item->'price' then
    previous_item := previous_item - 'vatMode' - 'vatInput';
  end if;
  item_record := previous_item || p_product || jsonb_build_object('id',saved_id,'imgs',photos);
  if p_item_id is null then row_data.items := row_data.items || jsonb_build_array(item_record);
  else row_data.items := jsonb_set(row_data.items,array[item_index::text],item_record,false); end if;
  update public.hansol_catalog set items=row_data.items, revision=row_data.revision+1,
    next_id=case when p_item_id is null then row_data.next_id+1 else row_data.next_id end
    where id=1 returning revision,next_id into row_data.revision,row_data.next_id;
  if not found then raise insufficient_privilege; end if;
  return jsonb_build_object('revision',row_data.revision,'next_id',row_data.next_id,'item_id',saved_id);
end;
$function$;