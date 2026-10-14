alter table public.promo_redemptions
  alter column promo_code_id drop not null;

alter table public.promo_redemptions
  drop constraint if exists promo_redemptions_promo_code_id_fkey;

alter table public.promo_redemptions
  add constraint promo_redemptions_promo_code_id_fkey
  foreign key (promo_code_id)
  references public.promo_codes(id)
  on delete set null;
