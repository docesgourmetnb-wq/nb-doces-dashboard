-- 1) Função: calcula custo_total na producao_diaria
create or replace function public.set_producao_custo_total()
returns trigger
language plpgsql
as $$
declare
  v_custo_unitario numeric;
begin
  -- Se não tem brigadeiro_id, não mexe (fallback para registros manuais)
  if new.brigadeiro_id is null then
    return new;
  end if;

  -- Busca custo_unitario do brigadeiro
  select b.custo_unitario
    into v_custo_unitario
  from public.brigadeiros b
  where b.id = new.brigadeiro_id;

  -- Se não achou, mantém o custo_total atual (não quebra o insert)
  if v_custo_unitario is null then
    return new;
  end if;

  -- Calcula custo_total
  new.custo_total := coalesce(new.quantidade, 0) * v_custo_unitario;

  return new;
end;
$$;

-- 2) Trigger: aplica no insert/update
drop trigger if exists trg_set_producao_custo_total on public.producao_diaria;

create trigger trg_set_producao_custo_total
before insert or update of brigadeiro_id, quantidade
on public.producao_diaria
for each row
execute function public.set_producao_custo_total();