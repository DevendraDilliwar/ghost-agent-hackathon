import type { MetaModelId, ModelConnectionInfo } from '../../shared/contracts/model';

export class ModelConnection {
  private apiKey: string;
  private verified = false;
  private source: ModelConnectionInfo['source'];
  private testing = false;
  private operation: AbortController | null = null;

  constructor(key: string, readonly model: MetaModelId, private readonly probe: (key: string, signal: AbortSignal) => Promise<void>) {
    this.apiKey = key.trim();
    this.source = this.apiKey ? 'environment' : 'none';
  }

  getKey(): string { return this.apiKey; }

  info(): ModelConnectionInfo {
    return { model: this.model, configured: Boolean(this.apiKey), verified: this.verified, source: this.source };
  }

  async test(candidate: unknown): Promise<ModelConnectionInfo> {
    if (this.testing) throw new Error('A connection test is already running.');
    if (candidate !== null) {
      if (typeof candidate !== 'string' || !/^[\x21-\x7e]{1,4096}$/.test(candidate.trim())) throw new Error('Enter a Meta API key without spaces.');
      this.apiKey = candidate.trim();
      this.source = 'session';
    }
    if (!this.apiKey) throw new Error('Enter your Meta API key first.');
    this.verified = false;
    this.testing = true;
    const operation = new AbortController();
    this.operation = operation;
    try {
      await this.probe(this.apiKey, operation.signal);
      operation.signal.throwIfAborted();
      this.verified = true;
      return this.info();
    } finally {
      this.testing = false;
      if (this.operation === operation) this.operation = null;
    }
  }

  dispose(): void { this.operation?.abort(); this.apiKey = ''; this.verified = false; this.source = 'none'; }
}
