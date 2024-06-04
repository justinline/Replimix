import { EventEmitter } from "node:events";
import { createId } from "@paralleldrive/cuid2";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { eventStream } from "remix-utils/sse/server";
import { replog } from "~/utils/replicache";

const emitter = new EventEmitter();

export const sendPoke = () => emitter.emit("poke");

// TODO: This should be grouped into channels/documents somehow.
export async function loader({ request }: LoaderFunctionArgs) {
  return eventStream(request.signal, function setup(send) {
    function handle() {
      const id = createId();
      send({ event: "poke", data: id });
      replog("poked", id);
    }

    emitter.on("poke", handle);

    return function clear() {
      emitter.off("poke", handle);
    };
  });
}
