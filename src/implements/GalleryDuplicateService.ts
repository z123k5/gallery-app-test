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

    constructor(storageService: StorageService) {
        this.storageService = storageService;
    }

    private generatePairKey(id1: string, id2: string): string {
        return id1 < id2 ? `${id1}-${id2}` : `${id2}-${id1}`;
    }

    async checkAndSaveDuplicateAsync(newMedia: MediaDO): Promise<SimilarPair[]> {
        const similarPairsTemp: SimilarPair[] = [];
        const thumbnailWebpath = Capacitor.convertFileSrc(newMedia.thumbnailV2Path?? newMedia.thumbnailV1Path);

        let pHashNew = "";
        if (!newMedia.phash) {
            pHashNew = await this.calculatePHash(thumbnailWebpath);
            if (!pHashNew) return [];
            newMedia.phash = pHashNew;
        }
        this.cachePHash(newMedia.identifier, newMedia.phash);

        const mutex = await this.lock.lock();

        // 对比 recentMedias
        for (const media of this.recentMedias) {
            if (media.identifier === newMedia.identifier) continue;

            const pHashOld = await this.getPHashWithCache(media);
            const distance = this.calculateHammingDistance(newMedia.phash, pHashOld);

            if (distance <= this.threshold) {
                const pairKey = this.generatePairKey(media.identifier, newMedia.identifier);
                if (!this.pairKeySet.has(pairKey)) {
                    similarPairsTemp.push({
                        id1: pairKey.split("-")[0],
                        id2: pairKey.split("-")[1],
                        hammingDistance: distance
                    });
                    this.pairKeySet.add(pairKey);
                }
            }
        }

        // 对比历史 sampled 图片
        const sampledPhotos = await this.getSampledMedias(20);
        for (const photo of sampledPhotos) {
            if (photo.identifier === newMedia.identifier) continue;

            const pHashOld = await this.getPHashWithCache(photo);
            const distance = this.calculateHammingDistance(newMedia.phash, pHashOld);

            if (distance <= this.threshold) {
                const pairKey = this.generatePairKey(photo.identifier, newMedia.identifier);
                if (!this.pairKeySet.has(pairKey)) {
                    similarPairsTemp.push({
                        id1: pairKey.split("-")[0],
                        id2: pairKey.split("-")[1],
                        hammingDistance: distance
                    });
                    this.pairKeySet.add(pairKey);
                }
            }
        }

        if (pHashNew) {
            await this.storageService.updateMediaPHashByIdentifier(
                newMedia.identifier,
                pHashNew
            );
        }

        if (similarPairsTemp.length > 0) {
            this.similarPairs = this.similarPairs.concat(similarPairsTemp);
        }

        this.recentMedias.push(newMedia);
        if (this.recentMedias.length > 10) {
            this.recentMedias.shift();
        }
        mutex.unlock();

        return similarPairsTemp;
    }


    async getSampledMedias(count: number) {
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
        const sampledMedias = [];
        for (let i = 0; i < count; i++) {
            const randomIndex = Math.floor(Math.random() * this.medias.length);
            sampledMedias.push(this.medias[randomIndex]);
        }
        return sampledMedias;
    }

    // TODO: Deprecated
    get_base64_image_size(base64: string) {
        //确认处理的是png格式的数据
        if (base64.substring(0, 22) === 'data:image/png;base64,') {
            // base64 是用四个字符来表示3个字节
            // 我们只需要截取base64前32个字符(不计开头那22个字符)便可（24 / 3 * 4）
            // 这里的data包含12个字符，9个字节，除去第1个字节，后面8个字节就是我们想要的宽度和高度
            const data = base64.substring(22 + 20, 22 + 32);
            const base64Characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
            const nums = [];
            for (const c of data) {
                nums.push(base64Characters.indexOf(c));
            }
            const bytes = [];
            for (let i = 0; i < nums.length; i += 4) {
                bytes.push((nums[i] << 2) + (nums[i + 1] >> 4));
                bytes.push(((nums[i + 1] & 15) << 4) + (nums[i + 2] >> 2));
                bytes.push(((nums[i + 2] & 3) << 6) + nums[i + 3]);
            }
            const width = (bytes[1] << 24) + (bytes[2] << 16) + (bytes[3] << 8) + bytes[4];
            const height = (bytes[5] << 24) + (bytes[6] << 16) + (bytes[7] << 8) + bytes[8];
            return {
                width,
                height,
            };
        }
        throw Error('unsupported image type:' + base64.substring(0, 22));
    }
    base64ToUint8Array(base64String: string): Uint8Array {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            // .replace(/\-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
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
                    const { data } = imageData;

                    resolve({ width: canvas.width, height: canvas.height, data: new Uint8Array(data.buffer) });
                };

                image.onerror = (err) => {
                    reject(new Error('图片加载失败，检查thumbnail是否已转换WebPath: ' + JSON.stringify(err)));
                };
            });
        }

        const url = thumbnailWebPath;
        console.log("prePhash url=" + url);
        const data = await imageUrlToUint8Array(url).then((ret) => {
            return ret
        }).catch(console.error);
        return bmvbhash(data as bmvImage, 8);
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
}