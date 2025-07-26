// @ts-ignore
export type CloudflareEnv = Env;

// biome-ignore lint/complexity/noBannedTypes: <explanation>
export type ContextFrom<T extends () => {}> = Awaited<ReturnType<T>>;

export interface Context {}
