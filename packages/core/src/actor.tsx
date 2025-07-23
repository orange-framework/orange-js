import type { Actor } from "@orange-js/actors";

export function isActor(value: unknown): value is Actor<any> {
  // @ts-ignore
  return typeof value === "function" && value["__orangeIsActor"] === true;
}
