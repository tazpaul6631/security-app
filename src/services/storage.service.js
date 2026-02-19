import { Storage } from '@ionic/storage';

class StorageService {
  constructor() {
    this.store = new Storage();
    this.init();
  }
  async init() {
    await this.store.create();
  }
  async set(key, value) { await this.store.set(key, value); }
  async get(key) { return await this.store.get(key); }
}

export default new StorageService();