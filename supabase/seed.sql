-- Produits génériques, valeurs par portion, sans marque réelle.
-- L'interface rappelle de vérifier l'étiquette.

insert into public.products (
  id, name, brand, product_type, flavor, carbs_g, sodium_mg, caffeine_mg, volume_ml, scope, owner_id
) values
  ('00000000-0000-4000-8000-000000000001', 'Gel énergétique classique', null, 'gel', 'agrume', 22, 40, 0, 40, 'catalog', null),
  ('00000000-0000-4000-8000-000000000002', 'Gel isotonique', null, 'gel', 'citron', 24, 140, 0, 60, 'catalog', null),
  ('00000000-0000-4000-8000-000000000003', 'Gel caféiné', null, 'gel', 'cola', 22, 45, 75, 40, 'catalog', null),
  ('00000000-0000-4000-8000-000000000004', 'Gel double source', null, 'gel', 'fruits', 40, 60, 0, 60, 'catalog', null),
  ('00000000-0000-4000-8000-000000000005', 'Gel neutre', null, 'gel', 'neutre', 21, 30, 0, 32, 'catalog', null),
  ('00000000-0000-4000-8000-000000000006', 'Boisson d''effort', null, 'boisson', 'citron', 40, 320, 0, 500, 'catalog', null),
  ('00000000-0000-4000-8000-000000000007', 'Boisson d''effort pêche', null, 'boisson', 'pêche', 36, 280, 0, 500, 'catalog', null),
  ('00000000-0000-4000-8000-000000000008', 'Boisson isotonique', null, 'boisson', 'orange', 30, 420, 0, 500, 'catalog', null),
  ('00000000-0000-4000-8000-000000000009', 'Boisson cola légère en caféine', null, 'boisson', 'cola', 44, 260, 30, 500, 'catalog', null),
  ('00000000-0000-4000-8000-000000000010', 'Compote de pomme', null, 'compote', 'pomme', 20, 8, 0, 90, 'catalog', null),
  ('00000000-0000-4000-8000-000000000011', 'Compote salée', null, 'compote', 'neutre', 18, 190, 0, 90, 'catalog', null),
  ('00000000-0000-4000-8000-000000000012', 'Barre céréales', null, 'barre', 'chocolat', 32, 90, 0, null, 'catalog', null),
  ('00000000-0000-4000-8000-000000000013', 'Barre fruitée', null, 'barre', 'fruits rouges', 28, 15, 0, null, 'catalog', null),
  ('00000000-0000-4000-8000-000000000014', 'Pâte de fruits', null, 'pate_de_fruit', 'abricot', 22, 5, 0, null, 'catalog', null),
  ('00000000-0000-4000-8000-000000000015', 'Banane', null, 'autre', 'banane', 23, 1, 0, null, 'catalog', null),
  ('00000000-0000-4000-8000-000000000016', 'Dattes', null, 'autre', 'fruits', 18, 2, 0, null, 'catalog', null),
  ('00000000-0000-4000-8000-000000000017', 'Purée de pomme de terre', null, 'autre', 'neutre', 25, 180, 0, 90, 'catalog', null),
  ('00000000-0000-4000-8000-000000000018', 'Bonbons gélifiés', null, 'autre', 'fruits', 15, 5, 0, null, 'catalog', null),
  ('00000000-0000-4000-8000-000000000019', 'Capsule de sel', null, 'capsule_sel', 'neutre', 0, 250, 0, null, 'catalog', null),
  ('00000000-0000-4000-8000-000000000020', 'Capsule de sel forte', null, 'capsule_sel', 'neutre', 0, 400, 0, null, 'catalog', null),
  ('00000000-0000-4000-8000-000000000021', 'Eau 500 ml', null, 'eau', 'neutre', 0, 0, 0, 500, 'catalog', null),
  ('00000000-0000-4000-8000-000000000022', 'Eau 250 ml', null, 'eau', 'neutre', 0, 5, 0, 250, 'catalog', null)
on conflict (id) do nothing;

insert into public.badges (id, name, description, icon) values
  ('premiere-sortie', 'Première feuille de route', 'Vous avez enregistré votre premier plan.', 'box'),
  ('premier-debrief', 'Retour de séance', 'Vous avez débriefé une sortie.', 'note'),
  ('soixante-grammes', 'Palier 60', 'Une sortie de plus de 2 h visait au moins 60 g/h.', 'bolt'),
  ('estomac-solide', 'Estomac solide', 'Trois débriefs avec un estomac confortable.', 'gut'),
  ('triathlon', 'Trois disciplines', 'Vous avez planifié un triathlon.', 'tri'),
  ('box-equipee', 'Box équipée', 'Au moins cinq produits en stock dans la Box.', 'crate'),
  ('objectif', 'Jour J', 'Un plan d’objectif principal est enregistré.', 'flag'),
  ('sortie-longue', 'Longue distance', 'Une sortie d’au moins 3 h est au programme.', 'road')
on conflict (id) do nothing;
