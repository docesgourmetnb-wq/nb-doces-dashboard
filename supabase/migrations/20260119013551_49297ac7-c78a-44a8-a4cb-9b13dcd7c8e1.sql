-- Corrige search_path para segurança
create or replace function public.set_producao_custo_total()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_custo_unitario numeric;
begin
  if new.brigadeiro_id is null then
    return new;
  end if;

  select b.custo_unitario
    into v_custo_unitario
  from public.brigadeiros b
  where b.id = new.brigadeiro_id;

  if v_custo_unitario is null then
    return new;
  end if;

  new.custo_total := coalesce(new.quantidade, 0) * v_custo_unitario;

  return new;
end;
$$;