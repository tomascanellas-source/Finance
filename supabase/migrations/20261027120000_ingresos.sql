-- Ingresos (Bizum, nómina, devoluciones) en la misma tabla que los gastos, y un origen para el Atajo manual
alter table public.gastos
  add column tipo text not null default 'gasto' check (tipo in ('gasto', 'ingreso'));

alter table public.gastos drop constraint gastos_origen_check;
alter table public.gastos add constraint gastos_origen_check check (origen in ('applepay', 'manual', 'atajo'));
