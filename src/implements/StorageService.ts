import { platform } from '../main';
import { BehaviorSubject } from 'rxjs';
import { ISQLiteService } from './SqliteService';
import { IDbVersionService } from './dbVersionService';
import { capSQLiteChanges, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { UserUpgradeStatements } from '../upgrades/models.upgrade.statements';
import { MediaDO, UserDO } from '../components/models';
import { MediaItem } from 'capacitor-gallery-plus'
import { Buffer } from 'buffer';
import { toastController } from '@ionic/vue';

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
    tagsListCache: string[] = [];

    constructor(sqliteService: ISQLiteService, dbVersionService: IDbVersionService) {
        this.sqliteServ = sqliteService;
        this.dbVerServ = dbVersionService;
    }

    setTagsListCache(tagsList: string[]): void {
        this.tagsListCache = tagsList;
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
                    // this.sqliteServ.saveToStore(this.database);
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
        const sql = `UPDATE users SET active = ? WHERE id = ?;`;
        const params = [active, id];
        await this.db.run(sql, params);
    }
    async deleteUserById(id: string): Promise<void> {
        const sql = `DELETE FROM users WHERE id=${id}`;
        await this.db.run(sql);
    }

    async getMediaProcessStepByIndentifier(identifier: string): Promise<number | undefined> {
        const sql = `SELECT processStep FROM media WHERE identifier = ?;`;
        const params = [identifier];
        const res = await this.db.query(sql, params);
        return res.values![0].processStep;
    }

    async getMediaTagCountsByIndentifier(identifier: string): Promise<number | undefined> {
        const sql = `SELECT COUNT(class_id) AS cnt FROM media_classes WHERE media_id = ?;`;
        const params = [identifier];
        const res = await this.db.query(sql, params);
        return res.values![0].cnt;
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
        if (medias.length === 0) {
            return;
        }
        try {
            const batchSize = 10; // 根据数据库限制设置批次大小
            for (let i = 0; i < medias.length; i += batchSize) {
                const batchMedias = medias.slice(i, i + batchSize);
                const sql = `INSERT INTO media (identifier, name, type, created_at, thumbnail, processStep) VALUES ${batchMedias.map(() => '(?, ?, ?, ?, ?, ?)').join(',')};`;
                const params = batchMedias.map(media => [media.identifier, media.name, media.type, media.created_at, media.thumbnail, media.processStep]);
                await this.db.run(sql, params.flat());
            }

            // 以下是单次插入的写法
            // const sql = `INSERT INTO media (identifier, name, type, created_at, thumbnail, processStep) VALUES (?, ?, ?, ?, ?, ?);`;
            // await this.db.run(sql, medias.map(media => [media.identifier, media.name, media.type, media.created_at, media.thumbnail, media.processStep]));
            // console.log(`sqliteService.addManyMedias: ${medias.length}`);
        } catch (error: any) {
            const msg = error.message ? error.message : error;
            throw new Error(`storageService.addManyMedias: ${msg}`);
        }
    }
    async updateMediaByIdentifier(identifier: string, processStep: number, arrayBuffer: ArrayBuffer | null = null): Promise<void> {
        let sql: string;
        let params: any[];

        if (processStep === 2) {
            if (arrayBuffer) {
                // Convert Blob to ArrayBuffer
                const buffer = Buffer.from(arrayBuffer);
                sql = `UPDATE media SET processStep = ?, feature = ? WHERE identifier = ?`;
                // TODO: Pull Request for android: Not supported for Buffer
                params = [processStep, buffer, identifier];
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
            console.error(`KKError updating media by identifier: ${error.message}`);
            throw new Error(`storageService.updateMediaByIdentifier: ${error.message}`);
        }
    }

    async deleteMediaByIdentifier(identifier: string): Promise<void> {
        const sql = `DELETE FROM media WHERE identifier = ?`;
        const params = [identifier];
        await this.db.run(sql, params);
    }

    async deleteMediaByManyIdentifier(identifiers: string[]): Promise<void> {
        if (identifiers.length === 0) {
            return; // 如果 identifiers 为空，直接返回
        }

        try {
            const batchSize = 99; // 根据数据库限制设置批次大小
            for (let i = 0; i < identifiers.length; i += batchSize) {
                const batchIdentifiers = identifiers.slice(i, i + batchSize);
                const placeholders = batchIdentifiers.map(() => '?').join(',');
                const sql = `DELETE FROM media WHERE identifier IN (${placeholders})`;
                await this.db.run(sql, batchIdentifiers);

                const sql2 = `DELETE FROM media_classes WHERE media_id IN (${placeholders})`;
                await this.db.run(sql2, batchIdentifiers);
            }
        } catch (error: any) {
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
                name: media.name!,
                type: media.type,
                created_at: media.createdAt,
                thumbnail: media.thumbnail!,
                processStep: 0,
                feature: new Blob(),
            }
        })

        await this.addManyMedias(mediasToAdd);
        toastController.create({
            message: `storageService.autoAddOrDeleteMedia: mediasIdsInDbToDelete: ${[...mediasIdsInDbToDelete].length}, mediasIdsInDbToAdd: ${[...mediasIdsInDbToAdd].length}
            `, duration: 5000
        }).then(toast => toast.present());
    }

    async addTagToMedia(identifier: string, tags: string[]): Promise<void> {
        const sql = `INSERT INTO media_classes (media_id, class_id) VALUES (?, ?)`;
        // convert tag names to tag ids
        const tagIds = tags.map(tag => {
            const tagId = this.tagsListCache.indexOf(tag);
            if (tagId === -1) {
                throw new Error(`storageService.addTagToMedia: tag not found`);
            }
            return tagId;
        });
        const params = tagIds.map(tagId => [identifier, tagId]);
        console.log(params);

        for (const param of params) {
            await this.db.run(sql, param);
        }
    }




}
export default StorageService;