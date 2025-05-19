import { bmvbhash, ImageData as bmvImage } from 'blockhash-core'
import { MediaDO } from '@/components/models';
import StorageService from './StorageService';
import { LRUCache } from 'lru-cache'; // 或者使用 'lru_map' 根据你安装的包调整
import Lock from '@/lock';
import { Capacitor } from '@capacitor/core';

export interface SimilarPair {
    id1: string;
    id2: string;
    hammingDistance: number;
}


interface DuplicateState {
    processedIdentifiers: string[];              // 已处理过的 identifier
    pHashMap: Record<string, string>;            // id => pHash
    unionFindMap: Record<string, string>;        // id => parentId
}

export class GalleryDuplicateService {
    private threshold: number = 5;
    private storageService: StorageService;
    public medias: MediaDO[] = [];
    public recentMedias: MediaDO[] = [];
    public similarPairs: SimilarPair[] = [];

    private pairKeySet: Set<string> = new Set(); // 用于全局去重
    private lock = new Lock();

    // 带LRU替换策略的pHash Mapping Cache
    private pHashCache: LRUCache<string, string> = new LRUCache<string, string>({ max: 100 });
    // 并查集结构：图中联通子图的快速查询结构
    private parent: Map<string, string> = new Map();

    constructor(storageService: StorageService) {
        this.storageService = storageService;
    }

    // 保存状态到永久存储
    async saveStateToStorage(): Promise<void> {
        const state: DuplicateState = {
            processedIdentifiers: this.medias.map(m => m.identifier),
            pHashMap: Object.fromEntries(this.pHashCache.dump().map(([k, v]) => [k, v.value])),
            unionFindMap: Object.fromEntries(this.parent.entries()),
        };
        await this.storageService.setItem('duplicateState', JSON.stringify(state));
    }

    // 从永久存储恢复状态
    async loadStateFromStorage(): Promise<void> {
        const raw = await this.storageService.getItem('duplicateState');
        if (!raw) return;
        try {
            const state: DuplicateState = JSON.parse(raw);
            this.pHashCache.clear();
            for (const [k, v] of Object.entries(state.pHashMap)) {
                this.pHashCache.set(k, v);
            }
            this.parent.clear();
            for (const [k, v] of Object.entries(state.unionFindMap)) {
                this.parent.set(k, v);
            }
            // 可选：恢复 medias/recentMedias
            const allMedias = await this.storageService.getMedias();
            this.medias = allMedias.filter(m => state.processedIdentifiers.includes(m.identifier));
        } catch (err) {
            console.warn('恢复状态失败:', err);
        }
    }

    private generatePairKey(id1: string, id2: string): string {
        return id1 < id2 ? `${id1}-${id2}` : `${id2}-${id1}`;
    }

    private find(id: string): string {
        if (!this.parent.has(id)) this.parent.set(id, id);
        if (this.parent.get(id) !== id) {
            this.parent.set(id, this.find(this.parent.get(id)!));
        }
        return this.parent.get(id)!;
    }

    private union(id1: string, id2: string) {
        const root1 = this.find(id1);
        const root2 = this.find(id2);
        if (root1 !== root2) {
            this.parent.set(root1, root2);
        }
    }

    async checkAndSaveDuplicateAsync(newMedia: MediaDO): Promise<SimilarPair[]> {
        const similarPairsTemp: SimilarPair[] = [];
        const thumbnailWebpath = Capacitor.convertFileSrc(newMedia.thumbnailV2Path ?? newMedia.thumbnailV1Path);

        let pHashNew = "";
        if (!newMedia.phash) {
            pHashNew = await this.calculatePHash(thumbnailWebpath);
            if (!pHashNew) return [];
            newMedia.phash = pHashNew;
        }
        this.cachePHash(newMedia.identifier, newMedia.phash);

        const mutex = await this.lock.lock();

        // 对比 recentMedias
        const compareList = [...this.recentMedias, ...(await this.getSampledMedias(20))];
        for (const media of compareList) {
            if (media.identifier === newMedia.identifier) continue;

            const id1 = newMedia.identifier;
            const id2 = media.identifier;
            const root1 = this.find(id1);
            const root2 = this.find(id2);
            if (root1 === root2) continue; // 在同一个连通分量中，跳过比较

            const pHashOld = await this.getPHashWithCache(media);
            const distance = this.calculateHammingDistance(newMedia.phash, pHashOld);

            if (distance <= this.threshold) {
                similarPairsTemp.push({ id1, id2, hammingDistance: distance });
                this.union(id1, id2); // 合并两个集合
            }
        }

        if (pHashNew) {
            await this.storageService.updateMediaPHashByIdentifier(newMedia.identifier, pHashNew);
        }

        if (similarPairsTemp.length > 0) {
            this.similarPairs = this.similarPairs.concat(similarPairsTemp);
        }

        this.recentMedias.push(newMedia);
        if (this.recentMedias.length > 10) {
            this.recentMedias.shift();
        }

        mutex.unlock();

        this.saveStateToStorage();

        return similarPairsTemp;
    }

    async getSampledMedias(count: number): Promise<MediaDO[]> {
        // if there no enough medias, return all
        if (this.medias.length === 0) {
            const mutex = await this.lock.lock();
            this.medias = await this.storageService.getMedias();
            mutex.unlock();
        }

        if (this.medias.length < count) {
            return this.medias;
        }

        // randomly sample
        const sampledMedias: MediaDO[] = [];
        const selected = new Set<number>();
        while (sampledMedias.length < count) {
            const randomIndex = Math.floor(Math.random() * this.medias.length);
            if (!selected.has(randomIndex)) {
                sampledMedias.push(this.medias[randomIndex]);
                selected.add(randomIndex);
            }
        }
        return sampledMedias;
    }

    calculateHammingDistance(hash1: string, hash2: string): number {
        let distance = 0;
        for (let i = 0; i < hash1.length; i++) {
            if (hash1[i] !== hash2[i]) {
                distance++;
            }
        }
        return distance;
    }

    // 缓存 pHash
    cachePHash(id: string, hash: string) {
        this.pHashCache.set(id, hash);
    }

    // 带缓存获取 pHash
    async getPHashWithCache(media: MediaDO): Promise<string> {
        // 从缓存里获取pHash
        if (this.pHashCache.has(media.identifier)) {
            return this.pHashCache.get(media.identifier)!;
        } else {
            // 从数据库获取pHash
            const pHash = (await this.storageService.getMediaByIdentifier(media.identifier))?.phash;
            if (pHash) {
                this.cachePHash(media.identifier, pHash);
                return pHash;
            }
        }

        // 计算pHash
        const hash = await this.calculatePHash(Capacitor.convertFileSrc(media.thumbnailV2Path ?? media.thumbnailV1Path));
        this.cachePHash(media.identifier, hash);
        return hash;
    }

    async calculatePHash(thumbnailWebPath: string): Promise<string> {
        // const base64Data = thumbnail.split(',')[1];
        // const buffer = this.base64ToUint8Array(base64Data);
        // const size = this.get_base64_image_size(thumbnail);

        const imageUrlToUint8Array = (url: string): Promise<{ width: number, height: number, data: Uint8Array }> => {
            return new Promise((resolve, reject) => {
                const image = new Image();
                image.crossOrigin = 'anonymous'; // 避免跨域问题
                image.src = url;

                image.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = image.width;
                    canvas.height = image.height;

                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        reject(new Error('无法获取 canvas 上下文'));
                        return;
                    }

                    ctx.drawImage(image, 0, 0);
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    resolve({ width: canvas.width, height: canvas.height, data: new Uint8Array(imageData.data.buffer) });
                };

                image.onerror = (err) => {
                    reject(new Error('图片加载失败，检查thumbnail是否已转换WebPath: ' + JSON.stringify(err)));
                };
            });
        };

        const data = await imageUrlToUint8Array(thumbnailWebPath);
        return bmvbhash(data as bmvImage, 8);
    }

    public getDuplicateGroups(): string[][] {
        const groups: Map<string, Set<string>> = new Map();

        for (const id of this.parent.keys()) {
            const root = this.find(id);
            if (!groups.has(root)) groups.set(root, new Set());
            groups.get(root)!.add(id);
        }

        // 只保留有两个以上的相似图的集合
        const result: string[][] = [];
        for (const group of groups.values()) {
            if (group.size > 1) {
                result.push(Array.from(group));
            }
        }

        return result;
    }

}
