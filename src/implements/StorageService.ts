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
};
class StorageService implements IStorageService {
    versionUpgrades = UserUpgradeStatements;
    loadToVersion = UserUpgradeStatements[UserUpgradeStatements.length - 1].toVersion;
    db!: SQLiteDBConnection;
    database: string = 'myuserdb';
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
            const isData = await this.db.query("select * from sqlite_sequence");
            if (isData.values!.length === 0) {
                // create database initial users if any

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
        return (await this.db.query('SELECT * FROM medias;')).values as MediaDO[];
    }

    async addMedia(media: MediaDO): Promise<number> {
        const sql = `INSERT INTO medias (identidier, name, type, created_at, thumbnail, processStep) VALUES (?, ?, ?, ?, ?, ?);`;
        const res = await this.db.run(sql, [media.identifier, media.name, media.type, media.created_at, media.thumbnail, media.processStep]);
        if (res.changes !== undefined
            && res.changes.lastId !== undefined && res.changes.lastId > 0) {
            return res.changes.lastId;
        } else {
            throw new Error(`storageService.addMedia: lastId not returned`);
        }
    }

    async addManyMedias(medias: MediaDO[]): Promise<void> {
        try {
            const sql = `INSERT INTO medias (identidier, name, type, created_at, thumbnail, processStep) VALUES (?, ?, ?, ?, ?, ?);`;
            await this.db.run(sql, medias.map(media => [media.identifier, media.name, media.type, media.created_at, media.thumbnail, media.processStep]));
        } catch (error: any) {
            const msg = error.message ? error.message : error;
            throw new Error(`storageService.addManyMedias: ${msg}`);
        }
    }
    async updateMediaByIentifier(identifier: string, processStep: number): Promise<void> {
        const sql = `UPDATE medias SET processStep=${processStep} WHERE identifier=${identifier}`;
        await this.db.run(sql);
    }

    async deleteMediaByIdentifier(identifier: string): Promise<void> {
        const sql = `DELETE FROM medias WHERE identifier=${identifier}`;
        await this.db.run(sql);
    }

    async deleteMediaByManyIdentifier(identifiers: string[]) {
        try {
            const sql = `DELETE FROM medias WHERE identifier IN (${identifiers.join(',')})`;
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
                    processStep: 0
                }
            })
            await this.addManyMedias(mediasToAdd);
    }
}
export default StorageService;