//// filepath: d:\Projects\IOSProjects\gallery-app-test\src\implements\StorageService.ts
import { platform } from '../main';
import { BehaviorSubject } from 'rxjs';
import { ISQLiteService } from './SqliteService';
import { IDbVersionService } from './dbVersionService';
import { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { UserUpgradeStatements } from '../upgrades/models.upgrade.statements';
import { MediaDO, MediaMetaDataDO, UserDO } from '../components/models';
import { MediaItem } from 'capacitor-gallery-plus';
import { Buffer } from 'buffer';
import { toastController } from '@ionic/vue';
import Lock from '@/lock';
import { truncate } from 'fs';

export interface IStorageService {
    initializeDatabase(): Promise<void>;
    getUsers(): Promise<UserDO[]>;
    addUser(user: UserDO): Promise<number>;
    updateUserById(id: string, active: number): Promise<void>;
    deleteUserById(id: string): Promise<void>;
    getDatabaseName(): string;
    getDatabaseVersion(): number;
}

export class StorageService implements IStorageService {
    versionUpgrades = UserUpgradeStatements;
    loadToVersion = UserUpgradeStatements[UserUpgradeStatements.length - 1].toVersion;
    db!: SQLiteDBConnection;
    database: string = 'media';
    sqliteServ!: ISQLiteService;
    dbVerServ!: IDbVersionService;
    isInitCompleted = new BehaviorSubject(false);
    tagsListCache: string[] = [];
    private lock = new Lock();

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
    private lockCount: number = 0;

    async initializeDatabase(): Promise<void> {
        //         console.debug('lockCount++ initializeDatabase', ++this.lockCount);
        const transaction = await this.lock.lock('w');
        try {
            await this.sqliteServ.addUpgradeStatement({
                database: this.database,
                upgrade: this.versionUpgrades
            });
            this.db = await this.sqliteServ.openDatabase(this.database, this.loadToVersion, false);

            const mediaTableStructure = await this.db.query(`PRAGMA table_info(media);`);
            if (mediaTableStructure.values !== undefined) {
                console.log('media table structure:', mediaTableStructure.values);
            }

            if (platform === 'web') {
                await this.sqliteServ.saveToStore(this.database);
            }
            this.isInitCompleted.next(true);
        } catch (error: any) {
            const msg = error.message ? error.message : error;
            throw new Error(`storageService.initializeDatabase: ${msg}`);
        } finally {
            //             console.debug('lockCount-- initializeDatabase', --this.lockCount);
            transaction.unlock();
        }
    }

    // 内部函数，不加锁
    private async getMediasNoLock(): Promise<MediaDO[]> {
        return (await this.db.query('SELECT * FROM media;')).values as MediaDO[];
    }

    // 对外暴露的获取接口，带锁
    async getMedias(): Promise<MediaDO[]> {
        //         console.debug('lockCount++ getMedias', ++this.lockCount);

        const transaction = await this.lock.lock('w');
        try {
            return await this.getMediasNoLock();
        } finally {
            //             console.debug('lockCount-- getMedias', --this.lockCount);

            transaction.unlock();
        }
    }
    async getUsers(): Promise<UserDO[]> {
        //         console.debug('lockCount++ getUsers', ++this.lockCount);

        const transaction = await this.lock.lock('w');
        try {
            return (await this.db.query('SELECT * FROM users;')).values as UserDO[];
        } finally {
            //             console.debug('lockCount-- getUsers', --this.lockCount);

            transaction.unlock();
        }
    }

    async addUser(user: UserDO): Promise<number> {
        //         console.debug('lockCount++ addUser', ++this.lockCount);

        const transaction = await this.lock.lock('w');
        try {
            const sql = `INSERT INTO users (name) VALUES (?);`;
            const res = await this.db.run(sql, [user.name]);
            if (
                res.changes !== undefined &&
                res.changes.lastId !== undefined &&
                res.changes.lastId > 0
            ) {
                if (platform === 'web') {
                    await this.sqliteServ.saveToStore(this.database);
                }
                return res.changes.lastId;
            } else {
                throw new Error(`storageService.addUser: lastId not returned`);
            }
        } finally {
            //             console.debug('lockCount-- addUser', --this.lockCount);

            transaction.unlock();
        }
    }

    async updateUserById(id: string, active: number): Promise<void> {
        //         console.debug('lockCount++ updateUserById', ++this.lockCount);

        const transaction = await this.lock.lock('w');
        try {
            const sql = `UPDATE users SET active = ? WHERE id = ?;`;
            await this.db.run(sql, [active, id]);
            if (platform === 'web') {
                await this.sqliteServ.saveToStore(this.database);
            }
        } finally {
            //             console.debug('lockCount-- updateUserById', --this.lockCount);

            transaction.unlock();
        }
    }

    async deleteUserById(id: string): Promise<void> {
        //         console.debug('lockCount++ deleteUserById', ++this.lockCount);

        const transaction = await this.lock.lock('w');
        try {
            const sql = `DELETE FROM users WHERE id=${id}`;
            await this.db.run(sql);
            if (platform === 'web') {
                await this.sqliteServ.saveToStore(this.database);
            }
        } finally {
            //             console.debug('lockCount-- deleteUserById', --this.lockCount);

            transaction.unlock();
        }
    }

    async getMediaProcessInfoByIndentifier(identifier: string): Promise<number> {
        //         console.debug('lockCount++ getMediaProcessInfoByIndentifier', ++this.lockCount);

        const transaction = await this.lock.lock('w');
        try {
            const sql = `SELECT processInfo FROM media WHERE identifier = ?;`;
            const res = await this.db.query(sql, [identifier]);
            return res.values![0].processInfo;
        } finally {
            //             console.debug('lockCount-- getMediaProcessInfoByIndentifier', --this.lockCount);

            transaction.unlock();
        }
    }

    async getMediaTagCountsByIndentifier(identifier: string): Promise<number | undefined> {
        //         console.debug('lockCount++ getMediaTagCountsByIndentifier', ++this.lockCount);

        const transaction = await this.lock.lock('w');
        try {
            const sql = `SELECT COUNT(class_id) AS cnt FROM media_classes WHERE media_id = ?;`;
            const res = await this.db.query(sql, [identifier]);
            return res.values![0].cnt;
        } finally {
            //             console.debug('lockCount-- getMediaTagCountsByIndentifier', --this.lockCount);

            transaction.unlock();
        }
    }


    /////// Database V3 Start ////////

    async getMediaByIdentifier(identifier: string): Promise<MediaDO | undefined> {
        //         console.debug('lockCount++ getMediaByIdentifier', ++this.lockCount);

        const transaction = await this.lock.lock('w');
        try {
            return (
                await this.db.query(`SELECT * FROM media WHERE identifier = ?;`, [identifier])
            ).values![0] as MediaDO;
        } finally {
            //             console.debug('lockCount-- getMediaByIdentifier', --this.lockCount);

            transaction.unlock();
        }
    }

    async addMedia(media: MediaDO): Promise<number> {
        //         console.debug('lockCount++ addMedia', ++this.lockCount);

        const transaction = await this.lock.lock('w');
        try {
            const sql = `INSERT INTO media (identifier, name, type, created_at, modified_at, isDeleted, processInfo) VALUES (?, ?, ?, ?, ?, ?, ?);`;
            const res = await this.db.run(sql, [
                media.identifier,
                media.name,
                media.type,
                media.created_at,
                media.modified_at,
                media.isDeleted,
                media.processInfo,
            ]);
            if (
                res.changes !== undefined &&
                res.changes.lastId !== undefined &&
                res.changes.lastId > 0
            ) {
                if (platform === 'web') {
                    await this.sqliteServ.saveToStore(this.database);
                }
                return res.changes.lastId;
            } else {
                throw new Error(`storageService.addMedia: lastId not returned`);
            }
        } finally {
            //             console.debug('lockCount-- addMedia', --this.lockCount);

            transaction.unlock();
        }
    }
    // 不加锁内部方法
    private async addManyMediasNoLock(medias: MediaDO[], batchSize: number = 3): Promise<void> {
        if (medias.length === 0) {
            return;
        }
        let sql = ``;
        for (let i = 0; i < medias.length; i += batchSize) {
            const batchMedias = medias.slice(i, i + batchSize);
            sql = `INSERT OR IGNORE INTO media (identifier, name, type, created_at, modified_at, thumbnailV1Path, thumbnailV2Path, source, isDeleted, processInfo, feature, phash) VALUES ${batchMedias
                .map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
                .join(',')};`;
            const params = batchMedias.map((m) => [
                m.identifier,
                m.name,
                m.type,
                m.created_at,
                m.modified_at,
                m.thumbnailV1Path,
                m.thumbnailV2Path,
                m.source,
                m.isDeleted,
                m.processInfo,
                m.feature,
                m.phash
            ]);
            await this.db.run(sql, params.flat());

            const batchMetadatas = batchMedias.map((m) => [
                m.identifier,
                m.created_at,
            ]);


            await this.db.run(
                `INSERT OR IGNORE INTO media_metadata (media_id, timestamp) VALUES ${batchMedias
                    .map(() => '(?, ?)')
                    .join(',')};`,
                batchMetadatas.flat(),
            );

            if (platform === 'web') {
                await this.sqliteServ.saveToStore(this.database);
            }
        }
    }

    // 带锁对外方法
    async addManyMedias(medias: MediaDO[], batchSize: number = 5): Promise<void> {
        //         console.debug('lockCount++ addManyMedias', ++this.lockCount);

        const transaction = await this.lock.lock('w');
        try {
            await this.addManyMediasNoLock(medias, batchSize);
        } catch (error: any) {
            const msg = error.message ? error.message : error;
            throw new Error(`storageService.addManyMedias: ${msg}`);
        } finally {
            //             console.debug('lockCount-- addManyMedias', --this.lockCount);

            transaction.unlock();
        }
    }

    async updateMediaUploadByIdentifier(
        mediaId: string,
        imageFeature: ArrayBuffer,
        catgoriesName: string[],
        metaData: MediaMetaDataDO
    ): Promise<void> {
        let sql = ``;
        let params: any[] = [];
        // Process bits, binary, bit0: uploaded & featured & catgoried & metaData, bit1: phashed

        let transaction;
        //         
        console.debug('lockCount++ updateMediaUploadByIdentifier', ++this.lockCount);

        console.log("updateMediaUploadByIdentifier id", mediaId);
        try {
            const dbMedia = await this.getMediaByIdentifier(mediaId);
            const buffer = Buffer.from(imageFeature);

            transaction = await this.lock.lock('w');
            if (!dbMedia) {
                throw new Error(`storageService.updateMediaUploadByIdentifier: media not found`);
            } else {
                // update media feature
                sql = `UPDATE media SET feature = ? WHERE identifier = ?`;
                params = [buffer, mediaId];
                await this.db.run(sql, params);
            }


            console.log("delete old categories if not artificial...");
            // delete old categories if not artificial
            sql = `DELETE FROM media_classes WHERE artificial = 0 AND media_id = ?`;
            await this.db.run(sql, [mediaId]);

            console.log("insert new categories...");
            // insert new categories
            sql = `INSERT INTO media_classes (media_id, class_id) VALUES (?, ?) ON CONFLICT DO NOTHING`;

            const taggoriesId = this.getTagIdsByTagNames(catgoriesName);

            for (const cat of taggoriesId) {
                await this.db.run(sql, [mediaId, cat]);
            }

            console.log("update media_classes...");
            // update media metadata
            sql = `UPDATE media_metadata SET exif_lat = ?, exif_lon = ?, exif_dev = ?, location = ? WHERE media_id = ?`;
            await this.db.run(sql, [
                metaData.exif_lat ?? null,
                metaData.exif_lon ?? null,
                metaData.exif_dev ?? null,
                metaData.location ?? null,
                mediaId,
            ]);

            console.log("update media metadata");
            // set processInfo |= PROCESS_UPLOAD_MASK
            sql = `UPDATE media SET processInfo = (processInfo | 1) WHERE identifier = ?`;
            await this.db.run(sql, [mediaId]);

            console.log("save to store...");
            if (platform === 'web') {
                await this.sqliteServ.saveToStore(this.database);
            }
            console.log("done", mediaId);
        } catch (error: any) {
            console.error(`Error updating media by identifier: ${error.message}`);
            throw new Error(`storageService.updateMediaByIdentifier: ${error.message}`);
        } finally {
            //             console.debug('lockCount-- updateMediaUploadByIdentifier', --this.lockCount);

            transaction?.unlock();
            console.log("done unlock");
        }
    }

    async updateMediaPHashByIdentifier(
        identifier: string,
        imagePHash: string
    ): Promise<void> {
        //         console.debug('lockCount++ updateMediaPHashByIdentifier', ++this.lockCount);

        const transaction = await this.lock.lock('w');
        try {
            // Process bits, binary, bit0: uploaded & featured & catgoried & metaData, bit1: phashed

            const sql = `UPDATE media SET processInfo = (processInfo | 2), phash = ? WHERE identifier = ?`;
            const params = [imagePHash, identifier];

            await this.db.run(sql, params);
            if (platform === 'web') {
                await this.sqliteServ.saveToStore(this.database);
            }
        } catch (error: any) {
            console.error(`Error updating media PHash by identifier: ${error.message}`);
            throw new Error(`storageService.updateMediaByIdentifier: ${error.message}`);
        } finally {
            //             console.debug('lockCount-- updateMediaPHashByIdentifier', --this.lockCount);

            transaction.unlock();
        }
    }

    async updateMediaProcessInfoNoProcessable(identifier: string): Promise<void> {
        const transaction = await this.lock.lock('w');
        try {
            const sql = `UPDATE media SET processInfo = (processInfo | 8) WHERE identifier = ?`;
            const params = [identifier];

            await this.db.run(sql, params);
            if (platform === 'web') {
                await this.sqliteServ.saveToStore(this.database);
            }
        } catch (error: any) {
            console.error(`Error updating media ProcessInfo No Processable by identifier: ${identifier}: ${error.message}`);
        } finally {
            transaction.unlock();
        }
    }

    async deleteMediaByIdentifier(identifier: string): Promise<void> {
        //         console.debug('lockCount++ deleteMediaByIdentifier', ++this.lockCount);

        const transaction = await this.lock.lock('w');
        try {
            const sql = `DELETE FROM media WHERE identifier = ?`;
            await this.db.run(sql, [identifier]);
            if (platform === 'web') {
                await this.sqliteServ.saveToStore(this.database);
            }
        } finally {
            //             console.debug('lockCount-- deleteMediaByIdentifier', --this.lockCount);

            transaction.unlock();
        }
    }
    // No lock
    private async deleteMediaByManyIdentifierNoLock(identifiers: string[]): Promise<number> {
        if (identifiers.length === 0) return 0;
        let changes = 0;

        const batchSize = 99;
        for (let i = 0; i < identifiers.length; i += batchSize) {
            const batchIdentifiers = identifiers.slice(i, i + batchSize);
            const placeholders = batchIdentifiers.map(() => '?').join(',');

            const sql = `DELETE FROM media WHERE identifier IN (${placeholders})`;
            changes += (await this.db.run(sql, batchIdentifiers)).changes?.changes ?? 0;

            // const sql2 = `DELETE FROM media_classes WHERE media_id IN (${placeholders})`;
            // await this.db.run(sql2, batchIdentifiers);

            if (platform === 'web') {
                await this.sqliteServ.saveToStore(this.database);
            }
        }
        return changes;
    }

    // Lock
    async deleteMediaByManyIdentifier(identifiers: string[], verbol: boolean = true): Promise<number> {
        //         console.debug('lockCount++ deleteMediaByManyIdentifier', ++this.lockCount);
        if (identifiers.length === 0)
            return 0;

        const transaction = await this.lock.lock('w');
        try {
            if (verbol) {
                // Update isDeleted and return
                const sql = `UPDATE media SET isDeleted = 1 WHERE identifier IN ${identifiers.map(id => `'${id}'`).join(',')}`
                return (await this.db.run(sql)).changes?.changes ?? 0;
            }

            // Delete straightly and return
            return await this.deleteMediaByManyIdentifierNoLock(identifiers);
        } finally {
            //             console.debug('lockCount-- deleteMediaByManyIdentifier', --this.lockCount);
            transaction.unlock();
        }
    }

    getTagIdsByTagNames(tagNames: string[]): number[] {
        // get from tagsListCache
        return tagNames.map(tagName => {
            const index = this.tagsListCache.indexOf(tagName);
            if (index === -1) {
                throw new Error(`Tag ${tagName} not found`);
            }
            return index + 1;
        });
    }

    async getMediaMetadataById(id: string): Promise<MediaMetaDataDO> {
        //         console.debug('lockCount++ getMediaMetadataById', ++this.lockCount);

        const transaction = await this.lock.lock('w');
        try {
            const sql = `SELECT * FROM media_metadata WHERE media_id = ?`;
            const result = await this.db.query(sql, [id]);

            const row = result.values?.[0];
            if (!row) {
                throw new Error(`storageService.getMediaMetadataById: metadata not found for id ${id}`);
            }

            return row as MediaMetaDataDO;
        } finally {
            //         console.debug('lockCount-- getMediaMetadataById', --this.lockCount);

            transaction.unlock();
        }
    }

    async getMediaListNoLock(limit: number, startAt: number, sort: string): Promise<MediaDO[]> {
        const sql = `SELECT idenntifier, name, type, created_at, modified_at, thumbnailV1Path, thumbnailV2Path, source FROM media WHERE thumbnail IS NOT NULL ORDER BY ${sort} LIMIT ? OFFSET ?`;
        const medias = (await this.db.query(sql, [limit, startAt])).values as MediaDO[];
        return medias;
    }

    async getMediaList(limit: number, startAt: number, sort: string): Promise<MediaDO[]> {
        //         console.debug('lockCount++ initializeDatabase', ++this.lockCount);

        const transaction = await this.lock.lock('w');
        try {
            const medias = await this.getMediaListNoLock(limit, startAt, sort);
            return medias;
        } catch (error: any) {
            console.error(`Error getMediaList: ${error.message}`);
            throw new Error(`storageService.getMediaList: ${error.message}`);
        } finally {
            //             console.debug('lockCount-- getMediaList', --this.lockCount);

            transaction.unlock();
        }
    }

    async getMediaIdListPaged(startAt: number, limit: number): Promise<string[]> {
        //         console.debug('lockCount++ getMediaIdListPaged', ++this.lockCount);

        const transaction = await this.lock.lock('w');
        try {
            const sql = `SELECT identifier FROM media LIMIT ? OFFSET ?`;
            const mediaIdList = (await this.db.query(sql, [limit, startAt])).values as MediaDO[];
            return mediaIdList.map((entry) => entry.identifier);
        } catch (error: any) {
            console.error(`Error getMediaIdListPaged: ${error.message}`);
            throw new Error(`storageService.getMediaIdListPaged: ${error.message}`);
        } finally {
            //             console.debug('lockCount-- getMediaIdListPaged', --this.lockCount);

            transaction.unlock();
        }
    }

    /**
     * Select media from db, where its media_classid is the category name
     * @param startAt 
     * @param limit 
     * @param category 
     */
    async getCatgoryMediaList(startAt: number, limit: number, category: string | undefined): Promise<MediaDO[]> {
        const transaction = await this.lock.lock('w');
        let sql = '';
        try {
            if (category === undefined) {
                // 查询所有媒体，不带分类过滤
                sql = `
                SELECT m.* 
                FROM media m
                LEFT JOIN media_classes mc ON m.identifier = mc.media_id
                GROUP BY m.identifier
                ORDER BY m.created_at DESC
                LIMIT ? OFFSET ?
            `;
                const result = await this.db.query(sql, [limit, startAt]);
                return result.values as MediaDO[];
            } else {
                // 查询指定分类的媒体
                sql = `
                SELECT m.* 
                FROM media m
                INNER JOIN media_classes mc ON m.identifier = mc.media_id
                INNER JOIN classes c ON mc.class_id = c.id
                WHERE c.name = ?
                GROUP BY m.identifier
                ORDER BY m.created_at DESC
                LIMIT ? OFFSET ?
            `;
                const result = await this.db.query(sql, [category, limit, startAt]);
                return result.values as MediaDO[];
            }
        } catch (error: any) {
            console.error(`Error fetching media by category: ${error.message}`);
            throw new Error(`storageService.getCatgoryMediaList: ${error.message}`);
        } finally {
            transaction.unlock();
        }
    }

    async getMediaListByManyIdentifier(identifierList: string[]): Promise<MediaDO[]> {
        const transaction = await this.lock.lock('w');
        try {
            const sql = `SELECT * FROM media WHERE identifier IN (${identifierList.map(() => '?').join(',')})`;
            return (await this.db.query(sql, identifierList)).values as MediaDO[];
        } catch (error: any) {
            console.error('Error getting media list by many identifier:', error);
            throw error;
        }
        finally {
            transaction.unlock();
        }
    }

    async getMediaIdListDeleted(): Promise<string[]> {
        const transaction = await this.lock.lock('w');
        try {
            const sql = `SELECT identifier FROM media WHERE isDeleted=1`;
            const medias = (await this.db.query(sql)).values as MediaDO[];
            return medias.map((entry) => entry.identifier);

        } catch (error: any) {
            console.error('Error getting media list by many identifier:', error);
            throw error;
        }
        finally {
            transaction.unlock();
        }
    }

    async getMediaListNoUploadedPaged(startAt: number, limit: number): Promise<MediaDO[]> {
        //         console.debug('lockCount++ getMediaListNoUploadedPaged', ++this.lockCount);

        const transaction = await this.lock.lock('w');
        try {
            const sql = `SELECT * FROM media WHERE processInfo & 9 = 0 LIMIT ? OFFSET ?`;
            const mediaList = (await this.db.query(sql, [limit, startAt])).values as MediaDO[];
            return mediaList;
        } catch (error: any) {
            console.error(`Error getMediaListNoUploadedPaged: ${error.message}`);
            throw new Error(`storageService.getMediaListNoUploadedPaged: ${error.message}`);
        } finally {
            //             console.debug('lockCount-- getMediaListNoUploadedPaged', --this.lockCount);

            transaction.unlock();
        }
    }

    async getMediaListNoPHashPaged(startAt: number, limit: number): Promise<MediaDO[]> {
        //         console.debug('lockCount++ getMediaListNoPHashPaged', ++this.lockCount);

        const transaction = await this.lock.lock('w');
        try {
            const sql = `SELECT * FROM media WHERE phash IS NULL AND (thumbnailV1Path IS NOT NULL OR thumbnailV2Path IS NOT NULL) LIMIT ? OFFSET ?`;
            const mediaList = (await this.db.query(sql, [limit, startAt])).values as MediaDO[];
            return mediaList;
        } catch (error: any) {
            console.error(`Error getMediaListNoPHashPaged: ${error.message}`);
            throw new Error(`storageService.getMediaListNoPHashPaged: ${error.message}`);
        } finally {
            //             console.debug('lockCount-- getMediaListNoPHashPaged', --this.lockCount);

            transaction.unlock();
        }
    }

    /////// Database V3 End ////////

    async autoAddOrDeleteMedia(medias: MediaItem[]): Promise<void> {
        //         console.debug('lockCount++ autoAddOrDeleteMedia', ++this.lockCount);

        const transaction = await this.lock.lock('w');
        try {
            const sql = `DELETE FROM media WHERE thumbnail IS NULL`;
            await this.db.run(sql);

            // 这里直接用不加锁的 getMediasNoLock() 避免死锁
            const mediasInDb = await this.getMediasNoLock();

            const mediasIdsInDb = new Set(mediasInDb.map((media) => media.identifier));
            const mediasIdsInArg = new Set(medias.map((media) => media.id));

            const mediasIdsInDbToDelete = new Set(
                [...mediasIdsInDb].filter((id) => !mediasIdsInArg.has(id))
            );
            const mediasIdsInDbToAdd = new Set(
                [...mediasIdsInArg].filter((id) => !mediasIdsInDb.has(id))
            );

            await this.deleteMediaByManyIdentifierNoLock([...mediasIdsInDbToDelete]);

            const mediasToAdd = [...mediasIdsInDbToAdd].map((id: string): MediaDO => {
                const media = medias.find((m) => m.id === id);
                if (!media) {
                    throw new Error(`storageService.autoAddOrDeleteMedia: media not found`);
                }
                return {
                    identifier: media.id,
                    name: media.name!,
                    type: media.type,
                    created_at: media.createdAt,
                    modified_at: media.modifiedAt,
                    thumbnailV1Path: media.thumbnailV1,
                    processInfo: 0,
                    feature: new Blob(),
                    phash: '',
                } as MediaDO;
            });

            await this.addManyMediasNoLock(mediasToAdd);

            toastController
                .create({
                    message: `storageService.autoAddOrDeleteMedia: mediasIdsInDbToDelete: ${[...mediasIdsInDbToDelete].length
                        }, mediasIdsInDbToAdd: ${[...mediasIdsInDbToAdd].length}
        `,
                    duration: 5000
                })
                .then((toast) => toast.present());
        } finally {
            //             console.debug('lockCount-- autoAddOrDeleteMedia', --this.lockCount);

            transaction.unlock();
        }
    }

    async addTagToMedia(identifier: string, tags: string[]): Promise<void> {
        //         console.debug('lockCount++ addTagToMedia', ++this.lockCount);

        const transaction = await this.lock.lock('w');
        try {
            const sql = `INSERT INTO media_classes (media_id, class_id) VALUES (?, ?)`;
            const tagIds = tags.map((tag) => {
                const tagId = this.tagsListCache.indexOf(tag) + 1;
                if (tagId === -1) {
                    throw new Error(`storageService.addTagToMedia: tag not found`);
                }
                return tagId;
            });
            for (const tagId of tagIds) {
                await this.db.run(sql, [identifier, tagId]);
                if (platform === 'web') {
                    await this.sqliteServ.saveToStore(this.database);
                }
            }
        } finally {
            //             console.debug('lockCount-- addTagToMedia', --this.lockCount);

            transaction.unlock();
        }
    }

    async getTagsNames(): Promise<string[]> {
        //         console.debug('lockCount++ getTagsNames', ++this.lockCount);

        const transaction = await this.lock.lock('w');
        try {
            const sql = `SELECT name FROM classes`;
            const res = await this.db.query(sql);
            return res.values!.map((item: any) => item.name);
        } finally {
            //             console.debug('lockCount-- getTagsNames', --this.lockCount);

            transaction.unlock();
        }
    }

    async getMediaTagNamesByIdentifier(identifier: string): Promise<string[]> {
        //         console.debug('lockCount++ getMediaTagNamesByIdentifier', ++this.lockCount);

        const transaction = await this.lock.lock('w');
        try {
            const sql = `SELECT c.name FROM classes c 
        INNER JOIN media_classes mc ON c.id = mc.class_id 
        WHERE mc.media_id = ?`;
            const res = await this.db.query(sql, [identifier]);
            return res.values!.map((item: any) => item.name);
        } finally {
            //             console.debug('lockCount-- getMediaTagNamesByIdentifier', --this.lockCount);

            transaction.unlock();
        }
    }

    async getMediasByTag(tag: string): Promise<MediaDO[]> {
        //         console.debug('lockCount++ getMediasByTag', ++this.lockCount);

        const transaction = await this.lock.lock('w');
        try {
            const sql = `SELECT m.* FROM media m 
        INNER JOIN media_classes mc ON m.identifier = mc.media_id 
        INNER JOIN classes c ON mc.class_id = c.id 
        WHERE c.name = ?`;
            const res = await this.db.query(sql, [tag]);
            return res.values as MediaDO[];
        } finally {
            //             console.debug('lockCount-- getMediasByTag', --this.lockCount);

            transaction.unlock();
        }
    }

    async getMediaIdsByTagIds(tags: number[]): Promise<string[]> {
        //         console.debug('lockCount++ getMediaIdsByTagIds', ++this.lockCount);

        const transaction = await this.lock.lock('w');
        try {
            const sql = `SELECT media_id FROM media_classes WHERE class_id IN (?)`;
            const params = [tags.join(',')];
            const res = await this.db.query(sql, params);
            return res.values!.map((item: any) => item.media_id);
        } finally {
            //             console.debug('lockCount-- getMediaIdsByTagIds', --this.lockCount);

            transaction.unlock();
        }
    }
}

export default StorageService;