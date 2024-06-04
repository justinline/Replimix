# Welcome to Replimix!

A small boilerplate app to get prototyping building local-first/multiplayer apps with Replicache and Remix.

- [Remix docs](https://remix.run/docs)
- [Remix Vite docs](https://remix.run/docs/en/main/guides/vite)
- [Replicache docs](https://doc.replicache.dev/)
- [Drizzle ORM docs](https://orm.drizzle.team/docs/overview)
- [Tailwind CSS docs](https://tailwindcss.com/docs)

## Postgres db

- You'll need docker installed on your system
- Pull the docker postgres image `docker pull postgres`
- Run the postgres db in a container `docker run --name replimix-db -e POSTGRES_USER=docker -e POSTGRES_PASSWORD=docker -e POSTGRES_DB=postgres -p 5432:5432 -d postgres`
- Update your .env DATABASE_URL to point to your running db, see the example.
- Apply the db migrations to your postgres db `npx drizzle-kit migrate`

## Development

After your db is set up, you can run the Vite dev server:

```shellscript
npm run dev
```

## Party!

You can access your `localhost:5173` instance in multiple browsers/tabs/computers and watch changes get push/pulled in realtime 🥳