export type MetaModelId = 'muse-spark-1.3' | 'muse-wonder-1.0';

export interface ModelConnectionInfo {
  readonly model: MetaModelId;
  readonly configured: boolean;
  readonly verified: boolean;
  readonly source: 'environment' | 'session' | 'stored' | 'none';
  readonly hasStored?: boolean;
}
