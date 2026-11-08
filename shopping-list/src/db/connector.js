import { UpdateType } from '@powersync/web';

export class SupabasePowerSyncConnector {
  constructor(supabase, powersyncUrl) {
    this.supabase = supabase;
    this.powersyncUrl = powersyncUrl;
  }

  async fetchCredentials() {
    const { data, error } = await this.supabase.auth.getSession();
    if (error || !data.session) throw new Error('A signed-in Supabase session is required for synchronisation.');
    return { endpoint: this.powersyncUrl, token: data.session.access_token };
  }

  async uploadData(database) {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;
    let lastOperation = null;
    try {
      for (const operation of transaction.crud) {
        lastOperation = operation;
        const table = this.supabase.from(operation.table);
        let result;
        switch (operation.op) {
          case UpdateType.PUT:
            result = await table.upsert({ ...operation.opData, id: operation.id });
            break;
          case UpdateType.PATCH:
            result = await table.update(operation.opData).eq('id', operation.id);
            break;
          case UpdateType.DELETE:
            result = await table.delete().eq('id', operation.id);
            break;
          default:
            throw new Error(`Unsupported PowerSync operation: ${operation.op}`);
        }
        if (result.error) throw result.error;
      }
      await transaction.complete();
    } catch (error) {
      // Retain failed writes for retry rather than silently discarding offline changes.
      console.error('PowerSync upload failed; queued changes were retained.', lastOperation, error);
      throw error;
    }
  }
}
