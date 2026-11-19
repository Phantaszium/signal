-- Deleting a topic keeps its assessments (with no topic) instead of deleting
-- them. Deleting them would lose the user's history and saved items, and let
-- the same records come back later as "new" developments.
--
-- Run once, after 0002_monitoring.sql.

alter table public.evaluations
  drop constraint evaluations_topic_id_fkey,
  add constraint evaluations_topic_id_fkey
    foreign key (topic_id) references public.topics (id) on delete set null;
