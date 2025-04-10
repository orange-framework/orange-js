// Adapted from: https://github.com/bombshell-dev/clack/blob/main/packages/prompts/src/index.ts

import {
  block,
  PasswordPrompt,
  SelectPrompt,
  State,
  TextPrompt,
  isCancel,
  ConfirmPrompt,
  MultiSelectPrompt,
} from "@clack/core";
import c from "chalk";
import util from "node:util";
import isUnicodeSupported from "is-unicode-supported";
import type { Readable, Writable } from "node:stream";
import { WriteStream } from "node:tty";
import { match } from "ts-pattern";
import { cursor, erase } from "sisteransi";
import { Option } from "@clack/prompts";

export const orange = (text: string) => c.rgb(249, 115, 22)(text);

const unicode = isUnicodeSupported();
const s = (c: string, fallback: string) => (unicode ? c : fallback);

const S_STEP_ACTIVE = s('◆', '*');
const S_STEP_CANCEL = s('■', 'x');
const S_STEP_ERROR = s('▲', 'x');
const S_STEP_SUBMIT = s('◇', 'o');

const S_BAR_START = s('┌', 'T');
const S_BAR = s('│', '|');
const S_BAR_END = s('└', '—');

const S_RADIO_ACTIVE = s('●', '>');
const S_RADIO_INACTIVE = s('○', ' ');
const S_CHECKBOX_ACTIVE = s('◻', '[•]');
const S_CHECKBOX_SELECTED = s('◼', '[+]');
const S_CHECKBOX_INACTIVE = s('◻', '[ ]');
const S_PASSWORD_MASK = s('▪', '•');

const S_BAR_H = s('─', '-');
const S_CORNER_TOP_RIGHT = s('╮', '+');
const S_CONNECT_LEFT = s('├', '+');
const S_CORNER_BOTTOM_RIGHT = s('╯', '+');

const S_INFO = s('●', '•');
const S_SUCCESS = s('◆', '*');
const S_WARN = s('▲', '!');
const S_ERROR = s('■', 'x');

const symbol = (state: State) => {
  switch (state) {
    case "initial":
    case "active":
      return c.rgb(249, 115, 22)(S_INFO);
    case "cancel":
      return c.red(S_STEP_CANCEL);
    case "error":
      return c.yellow(S_STEP_ERROR);
    case "submit":
      return c.green(S_STEP_SUBMIT);
  }
};

const colorByState = (state: State, text: string) => {
  switch (state) {
    case "initial":
    case "active":
      return c.rgb(249, 115, 22)(text);
    case "cancel":
      return c.red(text);
    case "error":
      return c.yellow(text);
    case "submit":
      return c.green(text);
  }
};

export async function select<T>(options: {
  message: string;
  options: { title: string; value: T }[];
}): Promise<T | symbol> {
  const highlight = (
    text: string,
    state: "inactive" | "active" | "selected" | "cancelled",
  ) =>
    match(state)
      .with("inactive", () => `${c.dim(S_RADIO_INACTIVE)} ${c.dim(text)}`)
      .with("active", () => `${orange(S_STEP_ACTIVE)} ${c.dim(text)}`)
      .with("selected", () => c.dim(text))
      .with("cancelled", () => c.strikethrough(c.dim(text)))
      .exhaustive();

  const prompt = new SelectPrompt({
    options: options.options,
    render() {
      const title = `${c.gray(S_BAR)}\n${symbol(this.state)}  ${
        options.message
      }\n`;

      return match(this.state)
        .with(
          "cancel",
          () =>
            `${title}${c.gray(S_BAR)}  ${highlight(
              this.options[this.cursor].title,
              "cancelled",
            )}\n${c.gray(S_BAR)}`,
        )
        .with(
          "submit",
          () =>
            `${title}${c.gray(S_BAR)}  ${highlight(
              this.options[this.cursor].title,
              "selected",
            )}`,
        )
        .otherwise(
          () =>
            `${title}${orange(S_BAR)}  ${limitOptions({
              cursor: this.cursor,
              options: this.options,
              maxItems: 10,
              style: (item, active) =>
                highlight(item.title, active ? "active" : "inactive"),
            }).join(`\n${orange(S_BAR)}  `)}\n${orange(S_BAR_END)}\n`,
        );
    },
  });

  return (await prompt.prompt()) as T | symbol;
}

export interface TextOptions extends CommonOptions {
  message: string;
  placeholder?: string;
  defaultValue?: string;
  initialValue?: string;
  validate?: (value: string) => string | Error | undefined;
}

export const text = (opts: TextOptions) => {
  return new TextPrompt({
    validate: opts.validate,
    placeholder: opts.placeholder,
    defaultValue: opts.defaultValue,
    initialValue: opts.initialValue,
    output: opts.output,
    input: opts.input,
    render() {
      const title = `${c.gray(S_BAR)}\n${symbol(this.state)}  ${
        opts.message
      }\n`;
      const placeholder = opts.placeholder
        ? c.inverse(opts.placeholder[0]) + c.dim(opts.placeholder.slice(1))
        : c.inverse(c.hidden("_"));
      const value = !this.value ? placeholder : this.valueWithCursor;

      switch (this.state) {
        case "error":
          return `${title.trim()}\n${c.yellow(S_BAR)}  ${value}\n${c.yellow(
            S_BAR_END,
          )}  ${c.yellow(this.error)}\n`;
        case "submit":
          return `${title}${c.gray(S_BAR)}  ${c.dim(
            this.value || opts.placeholder,
          )}`;
        case "cancel":
          return `${title}${c.gray(S_BAR)}  ${c.strikethrough(
            c.dim(this.value ?? ""),
          )}${this.value?.trim() ? `\n${c.gray(S_BAR)}` : ""}`;
        default:
          return `${title}${orange(S_BAR)}  ${value}\n${orange(S_BAR_END)}\n`;
      }
    },
  }).prompt() as Promise<string | symbol>;
};

export interface PasswordOptions extends CommonOptions {
  message: string;
  placeholder?: string;
  mask?: string;
  validate?: (value: string) => string | Error | undefined;
}
export const password = (opts: PasswordOptions) => {
  return new PasswordPrompt({
    validate: opts.validate,
    mask: opts.mask ?? S_PASSWORD_MASK,
    input: opts.input,
    output: opts.output,
    render() {
      const isDefault =
        this.state !== "error" &&
        this.state !== "submit" &&
        this.state !== "cancel";
      const title =
        opts.message
          .split("\n")
          .map(
            (line, index) =>
              `${!isDefault || index === 0 ? c.gray(S_BAR) : orange(S_BAR)} ${
                index === 0 ? `\n${symbol(this.state)} ` : ""
              } ${line}`,
          )
          .join("\n") + "\n";
      const value = this.valueWithCursor;
      const masked = this.masked;

      switch (this.state) {
        case "error":
          return `${title.trim()}\n${c.yellow(S_BAR)}  ${masked}\n${c.yellow(
            S_BAR_END,
          )}  ${c.yellow(this.error)}\n`;
        case "submit":
          return `${title}${c.gray(S_BAR)}  ${c.dim(masked)}`;
        case "cancel":
          return `${title}${c.gray(S_BAR)}  ${c.strikethrough(
            c.dim(masked ?? ""),
          )}${masked ? `\n${c.gray(S_BAR)}` : ""}`;
        default:
          return `${title}${orange(S_BAR)}  ${
            this.value.length === 0 ? c.dim(opts.placeholder) : value
          }\n${orange(S_BAR_END)}\n`;
      }
    },
  }).prompt() as Promise<string | symbol>;
};

export interface CommonOptions {
  input?: Readable;
  output?: Writable;
}

interface LimitOptionsParams<TOption> extends CommonOptions {
  options: TOption[];
  maxItems: number | undefined;
  cursor: number;
  style: (option: TOption, active: boolean) => string;
}

const limitOptions = <TOption>(
  params: LimitOptionsParams<TOption>,
): string[] => {
  const { cursor, options, style } = params;
  const output: Writable = params.output ?? process.stdout;
  const rows =
    output instanceof WriteStream && output.rows !== undefined
      ? output.rows
      : 10;

  const paramMaxItems = params.maxItems ?? Number.POSITIVE_INFINITY;
  const outputMaxItems = Math.max(rows - 4, 0);
  // We clamp to minimum 5 because anything less doesn't make sense UX wise
  const maxItems = Math.min(outputMaxItems, Math.max(paramMaxItems, 5));
  let slidingWindowLocation = 0;

  if (cursor >= slidingWindowLocation + maxItems - 3) {
    slidingWindowLocation = Math.max(
      Math.min(cursor - maxItems + 3, options.length - maxItems),
      0,
    );
  } else if (cursor < slidingWindowLocation + 2) {
    slidingWindowLocation = Math.max(cursor - 2, 0);
  }

  const shouldRenderTopEllipsis =
    maxItems < options.length && slidingWindowLocation > 0;
  const shouldRenderBottomEllipsis =
    maxItems < options.length &&
    slidingWindowLocation + maxItems < options.length;

  return options
    .slice(slidingWindowLocation, slidingWindowLocation + maxItems)
    .map((option, i, arr) => {
      const isTopLimit = i === 0 && shouldRenderTopEllipsis;
      const isBottomLimit = i === arr.length - 1 && shouldRenderBottomEllipsis;
      return isTopLimit || isBottomLimit
        ? c.dim("...")
        : style(option, i + slidingWindowLocation === cursor);
    });
};

export interface ConfirmOptions extends CommonOptions {
  message: string;
  active?: string;
  inactive?: string;
  initialValue?: boolean;
}
export const confirm = (opts: ConfirmOptions) => {
  const active = opts.active ?? "Yes";
  const inactive = opts.inactive ?? "No";
  return new ConfirmPrompt({
    active,
    inactive,
    input: opts.input,
    output: opts.output,
    initialValue: opts.initialValue ?? true,
    render() {
      const title = `${c.gray(S_BAR)}\n${symbol(this.state)}  ${opts.message}\n`;
      const value = this.value ? active : inactive;

      switch (this.state) {
        case "submit":
          return `${title}${c.gray(S_BAR)}  ${c.dim(value)}`;
        case "cancel":
          return `${title}${c.gray(S_BAR)}  ${c.strikethrough(
            c.dim(value),
          )}\n${c.gray(S_BAR)}`;
        default: {
          return `${title}${orange(S_BAR)}  ${
            this.value
              ? `${c.green(S_RADIO_ACTIVE)} ${active}`
              : `${c.dim(S_RADIO_INACTIVE)} ${c.dim(active)}`
          } ${c.dim("/")} ${
            !this.value
              ? `${c.green(S_RADIO_ACTIVE)} ${inactive}`
              : `${c.dim(S_RADIO_INACTIVE)} ${c.dim(inactive)}`
          }\n${orange(S_BAR_END)}\n`;
        }
      }
    },
  }).prompt() as Promise<boolean | symbol>;
};

export interface SpinnerOptions extends CommonOptions {
  indicator?: "dots" | "timer";
  onCancel?: () => void;
}

export interface SpinnerResult {
  start(msg?: string): void;
  stop(msg?: string, code?: number): void;
  message(msg?: string): void;
  readonly isCancelled: boolean;
}

export function spinner({
  indicator = "dots",
  onCancel,
  output = process.stdout,
}: SpinnerOptions = {}): SpinnerResult {
  const frames = unicode ? ["◒", "◐", "◓", "◑"] : ["•", "o", "O", "0"];
  const delay = unicode ? 80 : 120;
  const isCI = process.env.CI === "true";

  let unblock: () => void;
  let loop: NodeJS.Timeout;
  let isSpinnerActive = false;
  let isCancelled = false;
  let _message = "";
  let _prevMessage: string | undefined = undefined;
  let _origin: number = performance.now();

  const handleExit = (code: number) => {
    const msg = code > 1 ? "Something went wrong" : "Canceled";
    isCancelled = code === 1;
    if (isSpinnerActive) {
      stop(msg, code);
      if (isCancelled && typeof onCancel === "function") {
        onCancel();
      }
    }
  };

  const errorEventHandler = () => handleExit(2);
  const signalEventHandler = () => handleExit(1);

  const registerHooks = () => {
    // Reference: https://nodejs.org/api/process.html#event-uncaughtexception
    process.on("uncaughtExceptionMonitor", errorEventHandler);
    // Reference: https://nodejs.org/api/process.html#event-unhandledrejection
    process.on("unhandledRejection", errorEventHandler);
    // Reference Signal Events: https://nodejs.org/api/process.html#signal-events
    process.on("SIGINT", signalEventHandler);
    process.on("SIGTERM", signalEventHandler);
    process.on("exit", handleExit);
  };

  const clearHooks = () => {
    process.removeListener("uncaughtExceptionMonitor", errorEventHandler);
    process.removeListener("unhandledRejection", errorEventHandler);
    process.removeListener("SIGINT", signalEventHandler);
    process.removeListener("SIGTERM", signalEventHandler);
    process.removeListener("exit", handleExit);
  };

  const clearPrevMessage = () => {
    if (_prevMessage === undefined) return;
    if (isCI) output.write("\n");
    const prevLines = _prevMessage.split("\n");
    output.write(cursor.move(-999, prevLines.length - 1));
    output.write(erase.down(prevLines.length));
  };

  const parseMessage = (msg: string): string => {
    return msg.replace(/\.+$/, "");
  };

  const formatTimer = (origin: number): string => {
    const duration = (performance.now() - origin) / 1000;
    const min = Math.floor(duration / 60);
    const secs = Math.floor(duration % 60);
    return min > 0 ? `[${min}m ${secs}s]` : `[${secs}s]`;
  };

  const start = (msg = ""): void => {
    isSpinnerActive = true;
    // @ts-ignore
    unblock = block({ output });
    _message = parseMessage(msg);
    _origin = performance.now();
    output.write(`${c.gray(S_BAR)}\n`);
    let frameIndex = 0;
    let indicatorTimer = 0;
    registerHooks();
    loop = setInterval(() => {
      if (isCI && _message === _prevMessage) {
        return;
      }
      clearPrevMessage();
      _prevMessage = _message;
      const frame = orange(frames[frameIndex]);

      if (isCI) {
        output.write(`${frame}  ${_message}...`);
      } else if (indicator === "timer") {
        output.write(`${frame}  ${_message} ${formatTimer(_origin)}`);
      } else {
        const loadingDots = ".".repeat(Math.floor(indicatorTimer)).slice(0, 3);
        output.write(`${frame}  ${_message}${loadingDots}`);
      }

      frameIndex = frameIndex + 1 < frames.length ? frameIndex + 1 : 0;
      indicatorTimer =
        indicatorTimer < frames.length ? indicatorTimer + 0.125 : 0;
    }, delay);
  };

  const stop = (msg = "", code = 0): void => {
    isSpinnerActive = false;
    clearInterval(loop);
    clearPrevMessage();
    const step =
      code === 0
        ? c.green(S_STEP_SUBMIT)
        : code === 1
          ? c.red(S_STEP_CANCEL)
          : c.red(S_STEP_ERROR);
    _message = parseMessage(msg ?? _message);
    if (indicator === "timer") {
      output.write(`${step}  ${_message} ${formatTimer(_origin)}\n`);
    } else {
      output.write(`${step}  ${_message}\n`);
    }
    clearHooks();
    unblock();
  };

  const message = (msg = ""): void => {
    _message = parseMessage(msg ?? _message);
  };

  return {
    start,
    stop,
    message,
    get isCancelled() {
      return isCancelled;
    },
  };
}


export interface MultiSelectOptions<Value> extends CommonOptions {
	message: string;
	options: Option<Value>[];
	initialValues?: Value[];
	maxItems?: number;
	required?: boolean;
	cursorAt?: Value;
}
export const multiselect = <Value>(opts: MultiSelectOptions<Value>) => {
	const opt = (
		option: Option<Value>,
		state: 'inactive' | 'active' | 'selected' | 'active-selected' | 'submitted' | 'cancelled'
	) => {
		const label = option.label ?? String(option.value);
		if (state === 'active') {
			return `${orange(S_CHECKBOX_ACTIVE)} ${label} ${
				option.hint ? c.dim(`(${option.hint})`) : ''
			}`;
		}
		if (state === 'selected') {
			return `${orange(S_CHECKBOX_SELECTED)} ${c.dim(label)} ${
				option.hint ? c.dim(`(${option.hint})`) : ''
			}`;
		}
		if (state === 'cancelled') {
			return `${c.strikethrough(c.dim(label))}`;
		}
		if (state === 'active-selected') {
			return `${orange(S_CHECKBOX_SELECTED)} ${label} ${
				option.hint ? c.dim(`(${option.hint})`) : ''
			}`;
		}
		if (state === 'submitted') {
			return `${c.dim(label)}`;
		}
		return `${c.dim(S_CHECKBOX_INACTIVE)} ${c.dim(label)}`;
	};

	return new MultiSelectPrompt({
		options: opts.options,
		input: opts.input,
		output: opts.output,
		initialValues: opts.initialValues,
		required: opts.required ?? true,
		cursorAt: opts.cursorAt,
		validate(selected: Value[]) {
			if (this.required && selected.length === 0)
				return `Please select at least one option.\n${c.reset(
					c.dim(
						`Press ${c.gray(c.bgWhite(c.inverse(' space ')))} to select, ${c.gray(
							c.bgWhite(c.inverse(' enter '))
						)} to submit`
					)
				)}`;
		},
		render() {
      const active = this.state === 'active' || this.state === 'initial';
			const title = `${c.gray(S_BAR)}\n${symbol(this.state)}  ${opts.message}\n`;
      const controls = `${active ? orange(S_BAR) : c.gray(S_BAR)}  ${c.dim("(space to select, enter to submit)")}\n`;

			const styleOption = (option: Option<Value>, active: boolean) => {
				const selected = this.value.includes(option.value);
				if (active && selected) {
					return opt(option, 'active-selected');
				}
				if (selected) {
					return opt(option, 'selected');
				}
				return opt(option, active ? 'active' : 'inactive');
			};

			switch (this.state) {
				case 'submit': {
					return `${title}${controls}${c.gray(S_BAR)}  ${
						this.options
							.filter(({ value }) => this.value.includes(value))
							.map((option) => opt(option, 'submitted'))
							.join(c.dim(', ')) || c.dim('none')
					}`;
				}
				case 'cancel': {
					const label = this.options
						.filter(({ value }) => this.value.includes(value))
						.map((option) => opt(option, 'cancelled'))
						.join(c.dim(', '));
					return `${title}${controls}${c.gray(S_BAR)}  ${
						label.trim() ? `${label}\n${c.gray(S_BAR)}` : ''
					}`;
				}
				case 'error': {
					const footer = this.error
						.split('\n')
						.map((ln, i) =>
							i === 0 ? `${c.yellow(S_BAR_END)}  ${c.yellow(ln)}` : `   ${ln}`
						)
						.join('\n');
					return `${title + controls + c.yellow(S_BAR)}  ${limitOptions({
						output: opts.output,
						options: this.options,
						cursor: this.cursor,
						maxItems: opts.maxItems,
						style: styleOption,
					}).join(`\n${c.yellow(S_BAR)}  `)}\n${footer}\n`;
				}
				default: {
					return `${title}${controls}${orange(S_BAR)}  ${limitOptions({
						output: opts.output,
						options: this.options,
						cursor: this.cursor,
						maxItems: opts.maxItems,
						style: styleOption,
					}).join(`\n${orange(S_BAR)}  `)}\n${orange(S_BAR_END)}\n`;
				}
			}
		},
	}).prompt() as Promise<Value[] | symbol>;
};

export async function loader<T>(
  promise: Promise<T>,
  opts: {
    start: string;
    success: (value: T) => string;
    error: string;
  },
) {
  const r = spinner();
  r.start(opts.start);
  try {
    const result = await promise;
    r.stop(opts.success(result));
    return result;
  } catch (error) {
    r.stop(`${opts.error}: ${error}`, 1);
    throw error;
  }
}

export function log(...messages: unknown[]) {
  for (const message of messages) {
    const str = Array.isArray(message)
      ? message.join("\n")
      : typeof message === "object"
        ? util.inspect(message)
        : `${message}`;
    const lines = str.split("\n");

    lines.forEach((line) => {
      console.log(`${c.gray(S_BAR)}  ${line}`);
    });
  }
}

export function step(message: string, compact = false) {
  if (!compact) {
    log("");
  }
  console.log(`${symbol("submit")}  ${message}`);
  if (!compact) {
    log("");
  }
}

export function warn(message: string) {
  log("");
  message.split("\n").forEach((line) => {
    console.log(`${c.yellow(S_WARN)}  ${line}`);
  });
  log("");
}

export function error(message: string, compact = false) {
  if (!compact) {
    log("");
  }
  console.error(`${symbol("error")}  ${message}`);
  if (!compact) {
    log("");
  }
}

export function assertNotCancelled<T>(input: T | symbol): asserts input is T {
  if (isCancel(input)) {
    process.exit(0);
  }
}
