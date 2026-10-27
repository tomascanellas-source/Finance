-- Gastos, reglas de categoría, tokens del Atajo e inversiones.
-- Cada fila pertenece a un usuario y solo él la ve (RLS).

create table public.gastos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  importe numeric(12,2) not null check (importe > 0),
  comercio text not null,
  categoria text not null default 'Otros',
  tarjeta text,
  fecha timestamptz not null default now(),
  origen text not null default 'manual' check (origen in ('applepay', 'manual')),
  nota text,
  creado timestamptz not null default now()
);
create index gastos_user_fecha on public.gastos (user_id, fecha desc);

-- Lo que el usuario corrige se recuerda: comercio normalizado -> categoría
create table public.reglas (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  comercio_norm text not null,
  categoria text not null,
  primary key (user_id, comercio_norm)
);

-- El Atajo del iPhone se identifica con un token; solo guardamos su hash
create table public.ingest_tokens (
  token_hash text primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  creado timestamptz not null default now()
);

create table public.activos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nombre text not null,
  tipo text not null default 'ETF',
  ticker text,                -- símbolo de Yahoo Finance, p. ej. EUNL.DE; null = sin precio de mercado
  valor_actual numeric(14,2), -- solo para activos sin ticker (cuenta remunerada, etc.)
  valor_fecha date,
  creado timestamptz not null default now()
);

create table public.aportaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  activo_id uuid not null references public.activos on delete cascade,
  importe numeric(14,2) not null check (importe <> 0), -- negativo = retirada
  fecha date not null default current_date,
  creado timestamptz not null default now()
);
create index aportaciones_user on public.aportaciones (user_id, fecha);

-- Precio de cierre diario en euros; lo escribe la tarea programada
create table public.precios (
  activo_id uuid not null references public.activos on delete cascade,
  fecha date not null,
  cierre_eur numeric(18,6) not null,
  primary key (activo_id, fecha)
);

alter table public.gastos enable row level security;
alter table public.reglas enable row level security;
alter table public.ingest_tokens enable row level security;
alter table public.activos enable row level security;
alter table public.aportaciones enable row level security;
alter table public.precios enable row level security;

create policy "propios" on public.gastos for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "propios" on public.reglas for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "propios" on public.ingest_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "propios" on public.activos for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "propios" on public.aportaciones for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "de mis activos" on public.precios for select
  using (exists (select 1 from public.activos a where a.id = activo_id and a.user_id = auth.uid()));

-- Para que los pagos del Atajo aparezcan al momento en la app abierta
alter publication supabase_realtime add table public.gastos;
