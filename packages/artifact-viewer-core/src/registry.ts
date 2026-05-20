import type { ArtifactAdapter } from './types.ts';

type AdapterFactory = () => Promise<ArtifactAdapter>;

export class ArtifactViewerRegistry {
  private readonly _factories: AdapterFactory[] = [];
  private readonly _cache = new Map<AdapterFactory, Promise<ArtifactAdapter>>();

  register(factory: AdapterFactory): void {
    this._factories.push(factory);
  }

  async resolveByMime(mime: string): Promise<ArtifactAdapter | null> {
    for (const factory of this._factories) {
      const adapter = await this._load(factory);
      if (adapter.canRender(mime)) {
        return adapter;
      }
    }
    return null;
  }

  private _load(factory: AdapterFactory): Promise<ArtifactAdapter> {
    let cached = this._cache.get(factory);
    if (!cached) {
      cached = factory();
      this._cache.set(factory, cached);
    }
    return cached;
  }
}
