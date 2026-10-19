# NYC Captions Admin

Admin area for [NYC Captions](https://hello-world-nextjs-pied.vercel.app), an AI photo-caption
rating app. It manages the same Supabase database as the public app.

## What it does

- **Overview**: totals, a 14-day activity chart, which caption voice (subway line) scores best,
  when New York votes, the most divisive caption, top creators and voters, and which Gemini
  model wrote what.
- **Media**: create (upload a photo and have Gemini caption it, or add a caption by hand),
  read, update (edit caption text), and delete photos and captions.
- **Users**: read every profile with email, activity and role.
- **Votes**: read every upvote and downvote, with search and filters.

## Security model

Every route requires a Google sign-in **and** `profiles.is_superadmin = true`. It is enforced
in four independent places, so no single mistake exposes the database:

1. `proxy.ts` redirects anonymous visitors to `/login` and non-admins to `/denied`.
2. Every page calls `requireAdmin()` (layouts are not re-run on client navigation).
3. Every server action calls `requireAdmin()` (actions are reachable by direct POST).
4. **The database itself** (`supabase/admin.sql`): Row Level Security policies and
   `SECURITY DEFINER` functions that refuse anyone who is not a superadmin. The app uses
   the signed-in user's own session. There is no service-role key anywhere.

`is_superadmin` is also protected from self-promotion: users may only update
`first_name`, `last_name`, `avatar_url` through column-level privileges, so nobody can flip
the flag on their own row from the browser.

### Won't I lock myself out?

Yes, by design, until you bootstrap the first admin. The flag can't be changed from the
outside, so you set it from the **Supabase SQL Editor**, which runs as the database owner
and bypasses RLS and column privileges:

```sql
update public.profiles
set is_superadmin = true
where id = (select id from auth.users where email = 'you@example.com');
```

Sign in once with Google first so your profile row exists. The `/denied` page also prints
this statement with your own user id filled in.

## Setup

1. Run `supabase/admin.sql` once in the Supabase SQL Editor.
2. Copy `.env.example` to `.env.local` and fill it in.
3. Add the app's URLs under Supabase **Authentication > URL Configuration > Redirect URLs**.
4. `npm install && npm run dev`
