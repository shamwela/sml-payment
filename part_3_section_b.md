# Part 3, Section B — Stretch Challenge: Supabase RLS

## 1. What this policy does

This policy says: **when a logged-in user tries to look at the `orders` table, they are only allowed to see rows where the `user_id` column matches their own user ID.**

It acts like a filter that the database applies automatically before any `SELECT` query results are returned to the user. If a row belongs to someone else, the database behaves as if that row does not exist for that user. The user cannot see it, and they do not get an error — they simply get an empty result set for that row.

## 2. Investigating the bug: users can still read other users' orders

Given only the policy shown, the first thing I would investigate is **whether there are other policies on the `orders` table** that are more permissive.

In Supabase, multiple policies on the same table are combined with an OR logic for a given role. That means this restrictive policy can be silently overridden by another policy that says something like `USING (true)` or `USING (user_id IS NOT NULL)`. I would run `\d orders` or query the `pg_policies` catalog to list every policy on the table and look for any that grant broader `SELECT` access.

I would also check two related setup issues:
- **Is Row Level Security actually enabled on the `orders` table?** A policy alone does nothing if the table has `ROW LEVEL SECURITY` disabled. Anyone can then read all rows.
- **Is the application accidentally using the `service_role` key?** Requests made with the service role secret bypass RLS entirely, so even the best policy would be ignored.

## 3. Policy that prevents reading draft orders

```sql
CREATE POLICY "users can read own non-draft orders"
ON orders
FOR SELECT
USING (
  user_id = auth.uid()
  AND (status IS NULL OR status <> 'draft')
);
```
This keeps the original rule (users can only see their own rows) and adds a second condition: rows with `status = 'draft'` are hidden. The `status IS NULL` guard ensures orders with no status set are still visible — in SQL, `NULL <> 'draft'` does not evaluate to `TRUE`, so without it those rows would be unintentionally hidden as well.
