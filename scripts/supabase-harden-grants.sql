-- ============================================================
-- Ahvantir Website — table privileges for the API roles
-- Run once in Supabase Dashboard > SQL Editor, after the schema files.
--
-- Row level security decides WHICH ROWS a request may touch. It does not decide
-- which COLUMNS, and TRUNCATE escapes it entirely. Both gaps were open here, and
-- the first one was a live privilege escalation.
-- ============================================================

-- ------------------------------------------------------------
-- 1. profiles: a player must not be able to make themselves DM
--
-- is_dm is an ordinary column on the player's own row, and the only policy on
-- profiles is
--
--     "own profile"  FOR ALL  USING (auth.uid() = id)  WITH CHECK (auth.uid() = id)
--
-- which happily permits a player to write their own row. RLS is doing its job —
-- the row IS theirs. Nothing there says they may not set is_dm on it.
--
-- Narrowing UPDATE to display_name closes the obvious route. It does NOT close
-- the table, because DELETE plus INSERT reaches the same place:
--
--     delete from profiles where id = auth.uid();
--     insert into profiles (id, display_name, is_dm)
--     values (auth.uid(), 'x', true);
--
-- Both statements satisfy the policy. Verified against this database in a
-- rolled-back transaction: is_dm() returned true afterwards. The only obstacle
-- was the messages foreign key, which blocks the delete for a player who has
-- sent or received one — referential integrity, not a security control, and
-- absent for every new account. The other six foreign keys cascade, so the
-- attempt would also have destroyed that player's characters, notes, images and
-- map pins on the way.
--
-- profiles rows are created by handle_new_user(), a SECURITY DEFINER trigger on
-- auth.users, so authenticated never needs INSERT of its own. Nothing in the
-- site deletes a profile; every client call site is a select.
revoke insert, delete on public.profiles from authenticated;
grant  update (display_name) on public.profiles to authenticated;

-- anon held UPDATE on all four columns, id and is_dm included. Inert, because
-- auth.uid() is NULL for anon so the policy matched no rows — but it left the
-- whole guard resting on one policy expression.
revoke insert, update, delete on public.profiles from anon;

-- ------------------------------------------------------------
-- 2. TRUNCATE, everywhere
--
-- Supabase's default grant hands anon and authenticated the full privilege set
-- on every table in public. Most of it is harmless here: every write policy is
-- gated on auth.uid(), so for anon it filters to nothing.
--
-- TRUNCATE is the exception. It is not subject to row level security at all, so
-- it would empty a table whatever the policies say. No web client truncates.
revoke truncate on all tables in schema public from anon, authenticated;
alter default privileges in schema public
  revoke truncate on tables from anon, authenticated;

-- ============================================================
-- Checking it
--
-- As a player, all three routes must be refused and the rename must still work:
--
--   begin;
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<a player uuid>","role":"authenticated"}';
--   update profiles set is_dm = true where id = auth.uid();   -- permission denied
--   delete from profiles where id = auth.uid();               -- permission denied
--   insert into profiles (id, is_dm) values (auth.uid(), true);  -- permission denied
--   update profiles set display_name = 'x' where id = auth.uid();  -- allowed
--   rollback;
--
-- And nothing should hold TRUNCATE:
--
--   select count(*) from information_schema.table_privileges
--   where table_schema = 'public' and privilege_type = 'TRUNCATE'
--     and grantee in ('anon','authenticated');   -- must be 0
--
-- Still outstanding: anon keeps DELETE/INSERT/UPDATE on the other tables. They
-- are inert for the auth.uid() reason above, but they ought to be narrowed, and
-- that wants its own pass rather than a blanket revoke here.
-- ============================================================
