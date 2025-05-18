import { ISQLiteService } from './SqliteService';
import { IStorageService } from './StorageService';
// import { IStorageService } from '../services/storageService';

export interface IInitializeAppService {
    initializeApp(): Promise<boolean>;
}

class InitializeAppService implements IInitializeAppService {
    appInit = false;
    sqliteServ!: ISQLiteService;
    storageServ!: IStorageService;
    platform!: string;

    constructor(sqliteService: ISQLiteService, storageService: IStorageService) {
        this.sqliteServ = sqliteService;
        this.storageServ = storageService;
        this.platform = this.sqliteServ.getPlatform();
    }
    async initializeApp(): Promise<boolean> {
        console.log('initializeApp');
        if (!this.appInit) {
            try {
                if (this.platform === 'web') {
                    await this.sqliteServ.initWebStore();
                }
                await this.storageServ.initializeDatabase();
                if (this.platform === 'web') {
                    // await this.sqliteServ.saveToStore(this.storageServ.getDatabaseName());
                }
                this.appInit = true;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
                const msg = error.message ? error.message : error;
                throw new Error(`initializeAppError.initializeApp: ${msg}`);
            }
        }
        return this.appInit;
    }
}
export default InitializeAppService;