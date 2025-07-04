export class DisposeScope {
  #tasks: Array<() => void | Promise<void>> = [];

  register(task: () => void) {
    this.#tasks.push(task);
  }

  async [Symbol.asyncDispose]() {
    for (const task of this.#tasks) {
      task();
    }
  }
}