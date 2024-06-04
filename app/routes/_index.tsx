import type { MetaFunction } from "@remix-run/node";

import { createId } from "@paralleldrive/cuid2";
import { useEffect, useRef, useState } from "react";
import {
  Replicache,
  TEST_LICENSE_KEY,
  type WriteTransaction,
} from "replicache";
import { useSubscribe } from "replicache-react";

import { useEventSource } from "remix-utils/sse/react";
import { Message, MessageWithID } from "~/utils/replicache";

export const meta: MetaFunction = () => {
  return [
    { title: "New Replimix App" },
    { name: "description", content: "Welcome to Replimix!" },
  ];
};

const licenseKey =
  import.meta.env.VITE_REPLICACHE_LICENSE_KEY || TEST_LICENSE_KEY;

if (!licenseKey) {
  throw new Error("Missing VITE_REPLICACHE_LICENSE_KEY");
}

/**
 * Replicache instance for the document with mutators defined.
 */
type DocumentReplicache = Replicache<{
  createMessage: (
    tx: WriteTransaction,
    { id, from, content, order }: MessageWithID,
  ) => Promise<void>;
}>;

function usePullOnPoke(r: DocumentReplicache | null) {
  const lastEventId = useEventSource("/api/replicache/poke", {
    event: "poke",
  });

  useEffect(() => {
    r?.pull();
  }, [lastEventId]);
}

export default function ReplicachePlayground() {
  const [replicache, setReplicache] = useState<DocumentReplicache | null>(null);

  usePullOnPoke(replicache);

  useEffect(() => {
    const r = new Replicache({
      name: "chat-user-id",
      licenseKey,
      schemaVersion: "1",
      mutators: {
        async createMessage(
          tx: WriteTransaction,
          { id, from, content, order }: MessageWithID,
        ) {
          await tx.set(`messages/${id}`, {
            from,
            content,
            order,
          });
        },
      },

      pushURL: "/api/replicache/push",
      pullURL: "/api/replicache/pull",
    });
    setReplicache(r);
    return () => {
      void r.close();
    };
  }, []);

  const messages = useSubscribe(
    replicache,
    async (tx) => {
      const list = await tx
        .scan<Message>({ prefix: "messages/" })
        .entries()
        .toArray();
      list.sort(([, { order: a }], [, { order: b }]) => a - b);
      return list;
    },
    { default: [] },
  );

  const usernameRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLInputElement>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    let last: Message | null = null;
    if (messages.length) {
      const lastMessageTuple = messages[messages.length - 1];
      last = lastMessageTuple[1];
    }
    const order = (last?.order ?? 0) + 1;
    const username = usernameRef.current?.value ?? "";
    const content = contentRef.current?.value ?? "";

    await replicache?.mutate.createMessage({
      id: createId(),
      from: username,
      content,
      order,
    });

    if (contentRef.current) {
      contentRef.current.value = "";
    }
  };

  return (
    <main>
      <form onSubmit={onSubmit} className="flex gap-2 fixed bottom-0 w-full p-4">
        <input className="border-2 border-gray-300 p-2 rounded-md" ref={usernameRef} required placeholder="Your name"/>
        <input className="border-2 border-gray-300 p-2 rounded-md" ref={contentRef} required placeholder="Your message"/> 
        <input type="submit" />
      </form>
        <ul className="flex flex-col gap-2 items-start bg-gray-100 p-4 rounded-sm h-screen">
        {messages.map(([k, v]) => (
          <li key={k} className="px-4 py-2 border-2 border-gray-300 rounded-full max-w-[500px]">
            <p className="text-sm"><b>{v.from}: </b>
            {v.content}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
