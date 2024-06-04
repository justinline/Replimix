export type Message = {
  from: string;
  content: string;
  order: number;
};

export type MessageWithID = Message & { id: string };

export function replog(...args: Parameters<typeof console.log>) {
  console.log("[replicache]", ...args);
}

export function ereplog(...args: Parameters<typeof console.error>) {
  console.error("[replicache]", ...args);
}
