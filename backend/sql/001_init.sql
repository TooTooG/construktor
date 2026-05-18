create table if not exists constructor_builds (
  id text primary key,
  status text not null,
  template_product_id bigint not null,
  front_product_id bigint not null,
  back_product_id bigint,
  quantity integer not null default 1,
  selection_json jsonb not null,
  build_signature text not null,
  generated_product_id bigint,
  generated_variant_id bigint,
  generated_product_handle text,
  preview_source_url text,
  error_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists constructor_builds_signature_idx
  on constructor_builds (build_signature);
