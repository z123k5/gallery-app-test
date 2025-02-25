import { platform } from '../main';
import { BehaviorSubject } from 'rxjs';
import { ISQLiteService } from './SqliteService';
import { IDbVersionService } from './dbVersionService';
import { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { UserUpgradeStatements } from '../upgrades/models.upgrade.statements';
import { MediaDO, UserDO } from '../components/models';
import { MediaItem } from 'capacitor-gallery-plus'

export interface IStorageService {
    initializeDatabase(): Promise<void>
    getUsers(): Promise<UserDO[]>
    addUser(user: UserDO): Promise<number>
    updateUserById(id: string, active: number): Promise<void>
    deleteUserById(id: string): Promise<void>
    getDatabaseName(): string
    getDatabaseVersion(): number
}
class StorageService implements IStorageService {
    versionUpgrades = UserUpgradeStatements;
    loadToVersion = UserUpgradeStatements[UserUpgradeStatements.length - 1].toVersion;
    db!: SQLiteDBConnection;
    database: string = 'media';
    sqliteServ!: ISQLiteService;
    dbVerServ!: IDbVersionService;
    isInitCompleted = new BehaviorSubject(false);

    constructor(sqliteService: ISQLiteService, dbVersionService: IDbVersionService) {
        this.sqliteServ = sqliteService;
        this.dbVerServ = dbVersionService;
    }

    getDatabaseName(): string {
        return this.database;
    }
    getDatabaseVersion(): number {
        return this.loadToVersion;
    }
    async initializeDatabase(): Promise<void> {
        // create upgrade statements
        try {
            await this.sqliteServ.addUpgradeStatement({
                database: this.database,
                upgrade: this.versionUpgrades
            });
            this.db = await this.sqliteServ.openDatabase(this.database, this.loadToVersion, false);
            const isData = await this.db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='media' COLLATE NOCASE");
            if (isData.values!.length === 0) {
                // create table
                try {
                    UserUpgradeStatements[UserUpgradeStatements.length - 1].statements.forEach(async sql => {
                        this.db
                        await this.db.execute(sql);
                    });
                    this.sqliteServ.saveToStore(this.database);
                    console.log('initializeApp: create table');
                } catch (error: any) {
                    await this.db.execute("ROLLBACK");
                    console.log('initializeApp: create table error');
                }
            }

            this.dbVerServ.setDbVersion(this.database, this.loadToVersion);
            if (platform === 'web') {
                await this.sqliteServ.saveToStore(this.database);
            }
            this.isInitCompleted.next(true);
        } catch (error: any) {
            const msg = error.message ? error.message : error;
            throw new Error(`storageService.initializeDatabase: ${msg}`);
        }
    }
    async getUsers(): Promise<UserDO[]> {
        return (await this.db.query('SELECT * FROM users;')).values as UserDO[];
    }
    async addUser(user: UserDO): Promise<number> {
        const sql = `INSERT INTO users (name) VALUES (?);`;
        const res = await this.db.run(sql, [user.name]);
        if (res.changes !== undefined
            && res.changes.lastId !== undefined && res.changes.lastId > 0) {
            return res.changes.lastId;
        } else {
            throw new Error(`storageService.addUser: lastId not returned`);
        }
    }
    async updateUserById(id: string, active: number): Promise<void> {
        const sql = `UPDATE users SET active=${active} WHERE id=${id}`;
        await this.db.run(sql);
    }
    async deleteUserById(id: string): Promise<void> {
        const sql = `DELETE FROM users WHERE id=${id}`;
        await this.db.run(sql);
    }

    async getMedias(): Promise<MediaDO[]> {
        return (await this.db.query('SELECT * FROM media;')).values as MediaDO[];
    }

    async addMedia(media: MediaDO): Promise<number> {
        const sql = `INSERT INTO media (identifier, name, type, created_at, thumbnail, processStep) VALUES (?, ?, ?, ?, ?, ?);`;
        const res = await this.db.run(sql, [media.identifier, media.name, media.type, media.created_at, media.thumbnail, media.processStep]);
        if (res.changes !== undefined
            && res.changes.lastId !== undefined && res.changes.lastId > 0) {
                console.log(`sqliteService.addMedia: ${media.identifier}`);
            return res.changes.lastId;
        } else {
            throw new Error(`storageService.addMedia: lastId not returned`);
        }
    }

    async addManyMedias(medias: MediaDO[]): Promise<void> {
        try {
            const sql = `INSERT INTO media (identifier, name, type, created_at, thumbnail, processStep) VALUES (?, ?, ?, ?, ?, ?);`;
            await this.db.run(sql, medias.map(media => [media.identifier, media.name, media.type, media.created_at, media.thumbnail, media.processStep]));
            console.log(`sqliteService.addManyMedias: ${medias.length}`);
        } catch (error: any) {
            const msg = error.message ? error.message : error;
            throw new Error(`storageService.addManyMedias: ${msg}`);
        }
    }
    async updateMediaByIdentifier(identifier: string, processStep: number, feature: Blob | null = null): Promise<void> {
    let sql: string;
    let params: any[];

    if (processStep === 2) {
        if (feature) {
            // Convert Blob to ArrayBuffer
            const arrayBuffer = await feature.arrayBuffer();
            // Convert ArrayBuffer to Uint8Array
            const uint8Array = new Uint8Array(arrayBuffer);
            sql = `UPDATE media SET processStep = ?, feature = ? WHERE identifier = ?`;
            params = [processStep, uint8Array, identifier];
        } else {
            sql = `UPDATE media SET processStep = ? WHERE identifier = ?`;
            params = [processStep, identifier];
        }
    } else {
        sql = `UPDATE media SET processStep = ? WHERE identifier = ?`;
        params = [processStep, identifier];
    }

    try {
        await this.db.run(sql, params);
        console.log(`storageService.updateMediaByIdentifier: ${sql}`);
    } catch (error: any) {
        console.error(`Error updating media by identifier: ${error.message}`);
        throw new Error(`storageService.updateMediaByIdentifier: ${error.message}`);
    }
}

    async deleteMediaByIdentifier(identifier: string): Promise<void> {
        const sql = `DELETE FROM media WHERE identifier=${identifier}`;
        await this.db.run(sql);
    }

    async deleteMediaByManyIdentifier(identifiers: string[]) {
        try {
            const sql = `DELETE FROM media WHERE identifier IN (${identifiers.join(',')})`;
            await this.db.run(sql);
        }
        catch (error: any) {
            const msg = error.message ? error.message : error;
            throw new Error(`storageService.deleteMediaByManyIdentifier: ${msg}`);
        }
    }

    async autoAddOrDeleteMedia(medias: MediaItem[]): Promise<void> {
            // 取数据库中行与medias公共的交集
            // 先删去数据库中的行，再添加medias中不存在的行
            const mediasInDb = await this.getMedias();

            // 求数据库中待删的identifier集合
            const mediasIdsInDb = new Set(mediasInDb.map(media => media.identifier));
            const mediasIdsInArg = new Set(medias.map(media => media.id));

            const mediasIdsInDbToDelete = new Set(mediasIdsInDb.difference(mediasIdsInArg));
            const mediasIdsInDbToAdd = new Set(mediasIdsInArg.difference(mediasIdsInDb));

            await this.deleteMediaByManyIdentifier([...mediasIdsInDbToDelete]);
            // 将mediasIdsInDbToAdd映射到medias的MediaAsset[]类型中构造一个新的数组，然后转为MediaDO[]
            const mediasToAdd = [...mediasIdsInDbToAdd].map((id: string): MediaDO => {
                const media = medias.find(media => media.id === id);
                if (media === undefined) {
                    throw new Error(`storageService.autoAddOrDeleteMedia: media not found`);
                }
                // MediaDO
                return {
                    identifier: media.id,
                    name: media.name ?? '',
                    type: media.type,
                    created_at: media.createdAt,
                    thumbnail: "",
                    processStep: 0,
                    feature: new Blob(),
                }
            })
            await this.addManyMedias(mediasToAdd);
    }
}
export default StorageService;