/**
 * DependencyInjector provides module instantiation, dependency resolution,
 * singleton management, and lifecycle hooks for orchestrated modules.
 */

type ModuleFactory<T> = (deps: Record<string, unknown>, config?: unknown) => T;

interface RegisteredModule<T> {
  factory: ModuleFactory<T>;
  instance?: T;
  singleton: boolean;
  dependencies: string[];
  config?: unknown;
}

export class DependencyInjector {
  private registry: Map<string, RegisteredModule<any>> = new Map();

  /**
   * Register a module with its factory, dependencies, and singleton flag.
   */
  register<T>(
    name: string,
    factory: ModuleFactory<T>,
    dependencies: string[] = [],
    singleton = true,
    config?: unknown
  ) {
    if (this.registry.has(name)) {
      throw new Error(`Module "${name}" is already registered.`);
    }
    this.registry.set(name, { factory, dependencies, singleton, config });
  }

  /**
   * Resolve and instantiate a module and its dependencies.
   */
  resolve<T>(name: string): T {
    const mod = this.registry.get(name);
    if (!mod) throw new Error(`Module "${name}" is not registered.`);
    if (mod.singleton && mod.instance) return mod.instance as T;

    // Recursively resolve dependencies
    const deps: Record<string, unknown> = {};
    for (const depName of mod.dependencies) {
      deps[depName] = this.resolve(depName);
    }

    const instance = mod.factory(deps, mod.config);
    if (mod.singleton) mod.instance = instance;
    return instance;
  }

  /**
   * Get an already-instantiated singleton module.
   */
  get<T>(name: string): T | undefined {
    const mod = this.registry.get(name);
    return mod?.instance as T | undefined;
  }

  /**
   * Call shutdown/cleanup on all modules that provide it.
   */
  async shutdownAll() {
    for (const [name, mod] of this.registry.entries()) {
      if (mod.instance && typeof (mod.instance as any).shutdown === 'function') {
        try {
          await (mod.instance as any).shutdown();
        } catch (err) {
          // Log and continue
          // eslint-disable-next-line no-console
          console.error(`Error shutting down module "${name}":`, err);
        }
      }
    }
  }

  /**
   * Reset all singleton instances (for testing or re-init).
   */
  resetAll() {
    for (const mod of this.registry.values()) {
      mod.instance = undefined;
    }
  }
}