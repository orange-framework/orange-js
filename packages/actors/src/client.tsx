"use client";
import { useEffect, useState } from "react";

const createFromReadableStream = import.meta.env.SSR
  ? () => {
      throw new Error("createFromReadableStream is not available in SSR");
    }
  : await import("@vitejs/plugin-rsc/browser").then(
      (m) => m.createFromReadableStream
    );

type ClientComponentProps = {
  children: React.ReactNode;
  actorName: string;
  id: string;
};

export function ClientComponent({
  children,
  actorName,
  id,
}: ClientComponentProps) {
  const [component, setComponent] = useState<React.ReactNode | null>(null);

  if (!import.meta.env.SSR) {
    useEffect(() => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(
        `${protocol}//${window.location.host}/${actorName}/${id}`
      );

      ws.addEventListener("message", async (event) => {
        const data = event.data as Blob;
        const bytes = await data.arrayBuffer();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(bytes));
            controller.close();
          },
        });
        const created = await createFromReadableStream(stream);
        setComponent((created as any).root);
      });

      return () => ws.close();
    }, []);
  }

  if (!component) {
    return children;
  }

  return component;
}
