export type Message = {
  from: string;
  content: string;
  order: number;
};

export type MessageWithID = Message & { id: string };

export function replog(...args: any[]) {
  console.log("[replicache]", ...args);
}

export function ereplog(...args: any[]) {
  console.error("[replicache]", ...args);
}
