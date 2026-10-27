-- Posiciones que ya existían antes de usar la app: se guardan como un movimiento de tipo 'inicial'.
-- Si se conocen las participaciones (las que muestra el bróker), se usan tal cual en vez de calcularlas.

alter table public.aportaciones
  add column tipo text not null default 'aportacion' check (tipo in ('aportacion', 'inicial')),
  add column participaciones numeric(20,8) check (participaciones is null or participaciones > 0);
