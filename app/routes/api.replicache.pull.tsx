import { type ActionFunctionArgs, json } from "@remix-run/node";
import { replicacheServerId } from "db";
import { sql } from "drizzle-orm";
import type { PatchOperation, PullResponse } from "replicache";
import { ereplog, replog } from "~/utils/replicache";
import { type TransactionExecutor, tx } from "./api.replicache.push";

export async function action({ request }: ActionFunctionArgs) {
  const resp = await pull(request);
  return json(resp ?? "{}");
}

async function pull(req: Request) {
  const pull = await req.json();
  replog("Processing pull", JSON.stringify(pull));
  const { clientGroupID } = pull;
  const fromVersion = pull.cookie ?? 0;
  const t0 = Date.now();

  try {
    // Read all data in a single transaction so it's consistent.
    return await tx(async (t) => {
      // Get current version.
      const [{ version: currentVersion }] = await t.execute<{
        version: number;
      }>(
        sql`select version from replicache_server where id = ${replicacheServerId}`,
      );

      if (fromVersion > currentVersion) {
        throw new Error(
          `fromVersion ${fromVersion} is from the future - aborting. This can happen in development if the server restarts. In that case, clear appliation data in browser and refresh.`,
        );
      }

      // Get lmids for requesting client groups.
      const lastMutationIDChanges = await getLastMutationIDChanges(
        t,
        clientGroupID,
        fromVersion,
      );

      // Get changed domain objects since requested version.
      const changed = await t.execute<{
        id: string;
        sender: string;
        content: string;
        ord: number;
        version: number;
        deleted: boolean;
      }>(
        sql`select id, sender, content, ord, version, deleted from messages where version > ${fromVersion}`,
      );

      // Build and return response.
      const patch: PatchOperation[] = [];
      for (const row of changed) {
        const { id, sender, content, ord, version: rowVersion, deleted } = row;
        if (deleted) {
          if (rowVersion > fromVersion) {
            patch.push({
              op: "del",
              key: `messages/${id}`,
            });
          }
        } else {
          patch.push({
            op: "put",
            key: `messages/${id}`,
            value: {
              from: sender,
              content,
              order: ord,
            },
          });
        }
      }

      const body: PullResponse = {
        lastMutationIDChanges: lastMutationIDChanges ?? {},
        cookie: currentVersion,
        patch,
      };

      return body;
    });
  } catch (e) {
    ereplog(e);
    return json({ error: e }, { status: 500 });
  } finally {
    replog("Processed pull in", Date.now() - t0);
  }
}

async function getLastMutationIDChanges(
  t: TransactionExecutor,
  clientGroupID: string,
  fromVersion: number,
) {
  const rows = await t.execute<{ id: string; last_mutation_id: number }>(
    sql`select id, last_mutation_id
      from replicache_client
      where client_group_id = ${clientGroupID} and version > ${fromVersion}`,
  );
  return Object.fromEntries(rows.map((r) => [r.id, r.last_mutation_id]));
}
