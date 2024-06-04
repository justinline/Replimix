import { db, replicacheServerId } from "db";

import { type ActionFunctionArgs, json } from "@remix-run/node";
import { replicache_client } from "db/schema";
import { eq, sql } from "drizzle-orm";
import type { MutationV1, PushRequestV1 } from "replicache";
import { type MessageWithID, ereplog, replog } from "~/utils/replicache";
import { sendPoke } from "./api.replicache.poke";

export type Transaction = Parameters<typeof db.transaction>[0];
export type TransactionExecutor = Parameters<Transaction>[0];

export async function action({ request }: ActionFunctionArgs) {
  await push(request);

  return null;
}

async function push(req: ActionFunctionArgs["request"]) {
  const push: PushRequestV1 = await req.json();
  replog("Processing push", JSON.stringify(push));

  const t0 = Date.now();
  try {
    // Iterate each mutation in the push.
    for (const mutation of push.mutations) {
      const t1 = Date.now();

      try {
        await tx((t) => processMutation(t, push.clientGroupID, mutation));
      } catch (e) {
        ereplog("Caught error from mutation", mutation, e);

        // Handle errors inside mutations by skipping and moving on. This is
        // convenient in development but you may want to reconsider as your app
        // gets close to production:
        // https://doc.replicache.dev/reference/server-push#error-handling
        await tx((t) =>
          processMutation(t, push.clientGroupID, mutation, e as string),
        );
      }

      replog("Processed mutation in", Date.now() - t1);
    }

    queueMicrotask(() => sendPoke());

    return json({});
  } catch (e) {
    ereplog(e);
    return json({ error: e }, { status: 500 });
  } finally {
    replog("Processed push in", Date.now() - t0);
  }
}

async function processMutation(
  t: TransactionExecutor,
  clientGroupID: string,
  mutation: MutationV1,
  error?: string | undefined,
) {
  const { clientID } = mutation;

  // Get the previous version and calculate the next one.
  const [{ version: prevVersion }] = await t.execute<{ version: number }>(
    sql`select version from replicache_server where id = ${replicacheServerId} for update`,
  );
  const nextVersion = prevVersion + 1;

  const lastMutationID = await getLastMutationID(t, clientID);
  const nextMutationID = lastMutationID + 1;

  replog("nextVersion", nextVersion, "nextMutationID", nextMutationID);

  // It's common due to connectivity issues for clients to send a
  // mutation which has already been processed. Skip these.
  if (mutation.id < nextMutationID) {
    replog(`Mutation ${mutation.id} has already been processed - skipping`);
    return;
  }

  // If the Replicache client is working correctly, this can never
  // happen. If it does there is nothing to do but return an error to
  // client and report a bug to Replicache.
  if (mutation.id > nextMutationID) {
    throw new Error(
      `Mutation ${mutation.id} is from the future - aborting. This can happen in development if the server restarts. In that case, clear appliation data in browser and refresh.`,
    );
  }

  if (error === undefined) {
    replog("Processing mutation:", JSON.stringify(mutation));

    // For each possible mutation, run the server-side logic to apply the
    // mutation.
    switch (mutation.name) {
      case "createMessage":
        await createMessage(t, mutation.args as MessageWithID, nextVersion);
        break;
      default:
        throw new Error(`Unknown mutation: ${mutation.name}`);
    }
  } else {
    // TODO: You can store state here in the database to return to clients to
    // provide additional info about errors.
    ereplog("Handling error from mutation", JSON.stringify(mutation), error);
  }

  replog("setting", clientID, "last_mutation_id to", nextMutationID);
  // Update lastMutationID for requesting client.
  await setLastMutationID(
    t,
    clientID,
    clientGroupID,
    nextMutationID,
    nextVersion,
  );

  // Update global version.
  await t.execute(
    sql`update replicache_server set version = ${nextVersion} where id = ${replicacheServerId}`,
  );
}

export async function getLastMutationID(
  t: TransactionExecutor,
  clientID: string,
) {
  const [clientRow] = await t.execute<{ last_mutation_id: string }>(
    sql`select last_mutation_id from replicache_client where id = ${clientID}`,
  );
  if (!clientRow) {
    return 0;
  }
  return Number.parseInt(clientRow.last_mutation_id);
}

async function setLastMutationID(
  t: TransactionExecutor,
  clientID: string,
  clientGroupID: string,
  mutationID: number,
  version: number,
) {
  const result = await t
    .update(replicache_client)
    .set({
      client_group_id: clientGroupID,
      last_mutation_id: mutationID,
      version,
    })
    .where(eq(replicache_client.id, clientID))
    .returning();

  if (result.length === 0) {
    await t.execute(
      sql`insert into replicache_client (
        id,
        client_group_id,
        last_mutation_id,
        version
      ) values (${clientID}, ${clientGroupID}, ${mutationID}, ${version})`,
    );
  }
}

async function createMessage(
  t: TransactionExecutor,
  { id, from, content, order }: MessageWithID,
  version: number,
) {
  await t.execute(
    sql`insert into messages (
    id, sender, content, ord, deleted, version) values
    (${id}, ${from}, ${content}, ${order}, false, ${version})`,
  );
}

// In Postgres, snapshot isolation is known as "repeatable read".
export async function tx(t: Transaction) {
  return await db.transaction(t, {
    isolationLevel: "repeatable read",
    accessMode: "read write",
    deferrable: true,
  });
}
