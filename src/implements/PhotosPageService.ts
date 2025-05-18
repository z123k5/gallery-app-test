//// filepath: d:\Projects\IOSProjects\gallery-app-test\src\implements\PhotosPageService.ts
import { GalleryPlus, getMediaListResponse, MediaItem } from 'capacitor-gallery-plus';
import StorageService from './StorageService';
import { GalleryDuplicateService } from './GalleryDuplicateService';
import { MediaDO, MediaMetaDataDO, UserDO } from '@/components/models';
import { Capacitor } from '@capacitor/core';
import { toastController } from '@ionic/vue';
import { ref, Ref } from 'vue';
// import { useMediaStore } from '@/store/mediaStore';
import Lock from '@/lock';
import { ISQLiteService } from './SqliteService';

export class PhotosPageService {
    private storageService: StorageService;
    private duplicateService: GalleryDuplicateService;
    private isUploadServiceRunning = false;
    private isPHashServiceRunning = false;
    private isPrefetchServiceRunning = false;
    private isAutoCleanServiceRunning = false;
    private serverUrl: string;
    private tagsListCache: string[] = [];
    private medias: MediaItem[] = [];
    public visibleMediasItem: Ref<MediaItem[]>;
    public visibleMediaDOs: Ref<MediaDO[]>;
    private platform: string;
    private prefetchStartAt: number;
    private prefetchLimit: number;
    private queueLock = new Lock();
    private currentUser: UserDO | null = null;
    private aheadUploadingList: string[] = [];
    private uploadLimit: number = 2;


    constructor(storageService: StorageService, duplicateService: GalleryDuplicateService, sqliteService: ISQLiteService) {
        this.storageService = storageService;
        this.duplicateService = duplicateService;
        // this.serverUrl = 'https://frp-dad.com:34952'; // frp Server
        // this.serverUrl = 'http://10.12.80.224:8443'; // 
        this.serverUrl = 'http://172.20.10.5:8443'; // 
        this.platform = sqliteService.getPlatform();
        this.visibleMediasItem = ref<MediaItem[]>([]);
        this.visibleMediaDOs = ref<MediaDO[]>([]);
        this.storageService.getTagsNames().then((v: string[]) => {
            this.tagsListCache = v;
        })
        // this.tagsListCache = await this.storageService.getTagsNames();

        this.prefetchStartAt = 0;
        this.prefetchLimit = 10;
    }

    async performLogin(): Promise<string> {
        try {
            const formData = new URLSearchParams();
            formData.append('username', 'admin');
            formData.append('password', 'admin');
            const response = await fetch(this.serverUrl + '/users/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData
            });
            const data = await response.json();
            return data.access_token;
        } catch (error) {
            console.error('Error:', error);
            return '';
        }
    }

    getCookie(key: string) {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.startsWith(key + '=')) {
                return cookie.substring(key.length + 1);
            }
        }
        return null;
    }

    getCurrentUser(): UserDO | null {
        return this.currentUser;
    }

    setCurrentUser(user: UserDO) {
        this.currentUser = user;
    }

    // 1. 分页加载媒体
    async getPaginatedMediaList(startAt: number, limit: number): Promise<MediaItem[]> {
        // improve permission check in user experiments
        const permission = await GalleryPlus.checkPermissions();
        if (permission.status !== 'granted') {
            const request = await GalleryPlus.requestPermissions();
            if (request.status !== 'granted') {
                console.error('No permission granted.');
                throw new Error('No permission granted.');
            }
        }

        const result = await GalleryPlus.getMediaList({ startAt, limit, includeDetails: true });

        const mappedMedia = result.media.map(entry => {

            if (this.platform !== "web") {
                return {
                    ...entry,
                    thumbnailV1: Capacitor.convertFileSrc(entry.thumbnailV1 as string)
                }
            }

            return entry;
        })
        if (startAt === 0) {
            this.visibleMediasItem.value = mappedMedia;
        } else {
            this.visibleMediasItem.value.push(...mappedMedia);
        }

        if (mappedMedia) {
            // update visible mediaDO
            const newMediaDOs = await this.storageService.getMediaListByManyIdentifier(result.media.map(entry => entry.id));
            this.visibleMediaDOs.value.push(...newMediaDOs);

        }

        return result.media;
    }

    async getPaginatedCatgoryMediaList(startAt: number, limit: number, category: string | undefined): Promise<MediaItem[]> {
        // improve permission check in user experiments
        const permission = await GalleryPlus.checkPermissions();
        if (permission.status !== 'granted') {
            const request = await GalleryPlus.requestPermissions();
            if (request.status !== 'granted') {
                console.error('No permission granted.');
                throw new Error('No permission granted.');
            }
        }

        const mediaDO = await this.storageService.getCatgoryMediaList(startAt, limit, category);

        const mediaIds = mediaDO.map(entry => entry.identifier);

        const mediaItems = await GalleryPlus.getMediaListByManyId({ ids: mediaIds, includeDetails: true, includeBaseColor: false });

        const mappedMedia = mediaItems.media.map(entry => {

            if (this.platform !== "web") {
                return {
                    ...entry,
                    thumbnailV1: Capacitor.convertFileSrc(entry.thumbnailV1 as string)
                } as MediaItem;
            }

            return entry;
        })
        if (startAt === 0) {
            this.visibleMediasItem.value = mappedMedia;
        } else {
            this.visibleMediasItem.value.push(...mappedMedia);
        }

        if (mappedMedia) {
            // update visible mediaDO
            const newMediaDOs = await this.storageService.getMediaListByManyIdentifier(mediaDO.map(entry => entry.identifier));
            this.visibleMediaDOs.value.push(...newMediaDOs);
        }
    }

    addAheadUploadingMedia(id: string) {
        if (this.aheadUploadingList.find((item) => item === id)) {
            return;
        }
        // add to index 0
        if (this.aheadUploadingList.length >= this.uploadLimit) {
            this.aheadUploadingList.pop()
        }
        this.aheadUploadingList.unshift(id);
    }

    // 2. 启动持续上传服务：processInfo != 2 的图片上传后更新数据库
    async startMediaUploadService(intervalMs = 10000) {
        if (this.isUploadServiceRunning) return;
        this.isUploadServiceRunning = true;

        // tagsListCache
        await this.storageService.getTagsNames().then((tagsList) => {
            this.tagsListCache = tagsList;
            this.storageService.setTagsListCache(tagsList);
        });

        this.uploadLimit = 5;
        const uploadQueue: Promise<any>[] = [];
        const uploadMediaIdQueue: string[] = [];

        const checkPermission = async () => {
            const permission = await GalleryPlus.checkPermissions();
            if (permission.status !== "granted") {
                const request = await GalleryPlus.requestPermissions();
                if (request.status !== "granted") {
                    toastController.create({
                        message: "Gallery Permission denied, please allow access.",
                        duration: 5000
                    }).then(toast => toast.present());
                    console.error("Permission denied.");
                } else {
                    toastController.create({
                        message: "Gallery Permission granted.",
                        duration: 2000
                    }).then(toast => toast.present());
                }
            }
        }

        checkPermission();

        // 异步处理上传任务队列
        const processQueue = async () => {
            while (this.isUploadServiceRunning) {
                // 如果队列未满，继续拉取并上传
                if (uploadQueue.length < this.uploadLimit) {
                    const mediaList: MediaDO[] = [];
                    while (uploadQueue.length < this.uploadLimit && this.aheadUploadingList.length > 0) {
                        const mediaId = this.aheadUploadingList.shift();
                        if (mediaId && uploadMediaIdQueue.indexOf(mediaId) === -1) {
                            const media = await this.storageService.getMediaByIdentifier(mediaId);
                            if(media)
                                mediaList.push(media);
                        }
                    }
                    if (mediaList.length < this.uploadLimit) {
                        const mediaList2: MediaDO[] = await this.storageService.getMediaListNoUploadedPaged(0, this.uploadLimit - mediaList.length);

                        // do cross check
                        for (let i = 0; i < mediaList2.length; i++) {
                            if (!mediaList.find(m => m.identifier === mediaList2[i].identifier)) {
                                mediaList.push(mediaList2[i]);
                            }
                        }
                    }

                    for (let i = 0; i < mediaList.length; i++) {
                        const media = mediaList[i];
                        if (media.processInfo & 0x1) {
                            continue; // 跳过不需要上传的媒体
                        }

                        // update visible media
                        const index = this.visibleMediaDOs.value.findIndex(item => item.identifier === media.identifier);
                        if (index !== -1) {
                            this.visibleMediaDOs.value[index].processInfo |= 4;
                        }


                        const uploadTask = this.uploadMedia(media)
                            .catch(error => {
                                console.error('Upload failed:', error);
                                // TODO : delay 5s
                                return new Promise(resolve => setTimeout(resolve, 5000));
                            })
                            .finally(() => {
                                // 上传完成后从队列中移除
                                const index = uploadQueue.indexOf(uploadTask);
                                if (index > -1) {
                                    uploadQueue.splice(index, 1);
                                    uploadMediaIdQueue.splice(index, 1);
                                }

                                // update visible media
                                const id = this.visibleMediaDOs.value.findIndex((entry) => media.identifier === entry.identifier);
                                // Mask off the uploading bit
                                if (id > -1) this.visibleMediaDOs.value[id].processInfo &= ~4;
                            });

                        uploadQueue.push(uploadTask);
                        uploadMediaIdQueue.push(media.identifier);
                    }
                }

                // 如果队列已满，等待任意一个任务完成
                if (uploadQueue.length >= this.uploadLimit) {
                    await Promise.race(uploadQueue);
                } else {
                    // 否则短暂休眠再循环
                    await new Promise(resolve => setTimeout(resolve, intervalMs));
                }
            }
        };

        // 启动主处理逻辑
        processQueue();
    }

    // 单个媒体上传方法抽离出来便于复用和测试
    private async uploadMedia(media: MediaDO): Promise<void> {
        return this.uploadWithRetry(media, 0);
    }

    private async uploadWithRetry(media: MediaDO, retryCount: number): Promise<void> {
        if (retryCount > 3) {
            console.warn(`Upload retry exceeded for media: ${media.identifier}`);
            // update database
            this.storageService.updateMediaProcessInfoNoProcessable(media.identifier);
            // update visible media
            this.visibleMediaDOs.value.map(media => {
                if (media.identifier === media.identifier) {
                    media.processInfo |= 8;
                }
            });
            return;
        }

        let blob: Blob | null = null;
        const formData: FormData = new FormData();

        try {
            const fullMedia = await GalleryPlus.getMedia({
                id: media.identifier,
                includePath: true,
                includeBaseColor: false,
                includeDetails: true
            });

            const mediaWebSrc = Capacitor.convertFileSrc(fullMedia.path ?? "");

            if (media.type === 'video') {
                const video = document.createElement('video');
                video.src = mediaWebSrc;
                video.load();
                video.currentTime = 0;
                video.width = 100;
                video.height = 100;
                video.crossOrigin = 'anonymous';
                video.play();
                video.pause();

                const canvas = document.createElement('canvas');
                canvas.width = video.width;
                canvas.height = video.height;
                const ctx = canvas.getContext('2d');

                if (ctx) {
                    ctx.drawImage(video, 0, 0, video.width, video.height);
                    blob = await new Promise((resolve, reject) => {
                        canvas.toBlob(b => {
                            if (b) resolve(b);
                            else reject(new Error("Failed to generate blob from canvas"));
                        }, 'image/png', 1.0);
                    });
                }
            } else {
                const responseFile = await fetch(mediaWebSrc);
                blob = await responseFile.blob();
            }

            if (blob) formData.append("file", blob, "image.png");

            formData.append("identifier", fullMedia.id);
            formData.append("name", fullMedia.name ?? fullMedia.id);
            formData.append("type", fullMedia.type);
            formData.append("created_at", fullMedia.createdAt?.toString() ?? '');
            formData.append("lat", (fullMedia.exif_lat ?? '0').toString());
            formData.append("lon", (fullMedia.exif_lon ?? '0').toString());
            formData.append("dev", fullMedia.exif_dev ?? '');

            const response = await fetch(this.serverUrl + '/engine/resolve_v3', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + this.getCookie('token'),
                    'Accept': 'application/json'
                },
                body: formData
            });

            if (response.ok) {
                const responseJson = await response.json();
                const encoded_data = responseJson["feat"];
                const decodedData = atob(encoded_data);
                const arrayBuffer = new ArrayBuffer(decodedData.length);
                const uint8Array = new Uint8Array(arrayBuffer);
                for (let i = 0; i < decodedData.length; i++) {
                    uint8Array[i] = decodedData.charCodeAt(i);
                }

                const tags = responseJson["tags"] as string[];

                const location = responseJson["location"] as string;

                const metaData = {
                    media_id: fullMedia.id,
                    timestamp: fullMedia.createdAt,
                    exif_lat: fullMedia.exif_lat,
                    exif_lon: fullMedia.exif_lon,
                    exif_dev: fullMedia.exif_dev,
                    location: location,
                } as MediaMetaDataDO;


                // Update database
                await this.storageService.updateMediaUploadByIdentifier(media.identifier, arrayBuffer, tags, metaData);
                // Update visible media
                const mediaIdx = this.visibleMediaDOs.value.findIndex(m => m.identifier === media.identifier);
                if (mediaIdx >= 0) {
                    this.visibleMediaDOs.value[mediaIdx].processInfo |= 1;
                }
            } else if (response.status === 401) {
                console.warn('Token expired. Trying to refresh token...');
                await this.performLogin(); // 登录刷新 token
                await this.uploadWithRetry(media, retryCount + 1); // 重试上传
            } else if (response.status === 415) {
                // update database
                this.storageService.updateMediaProcessInfoNoProcessable(media.identifier);
                // update visible media
                this.visibleMediaDOs.value.map(media => {
                    if (media.identifier === media.identifier) {
                        media.processInfo = media.processInfo | 8;
                    }
                });

                console.error("Unsupported Media Type: ", fullMedia.mimeType, ", Media Id:", fullMedia.id);
            } else {
                throw new Error(`Upload failed with status ${response.status}`);
            }
        } catch (error) {
            console.error(`Error uploading media (attempt ${retryCount}):`, error);
            // 延迟后继续（不再重试上传）
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }


    // 3. 启动持续pHash计算服务：从数据库获取未计算pHash的媒体，调用duplicateService
    startPHashComputeService(intervalMs = 3000): void {
        if (this.isPHashServiceRunning) return;
        this.isPHashServiceRunning = true;

        const phashLoop = async () => {
            while (this.isPHashServiceRunning) {
                let computeStart = 0;
                const computeLimit = 100;
                let mediaList: MediaDO[] = [];

                try {
                    do {
                        mediaList = await this.storageService.getMediaListNoPHashPaged(computeStart, computeLimit);

                        for (const media of mediaList) {
                            await this.duplicateService.checkAndSaveDuplicateAsync(media);
                        }

                        computeStart += mediaList.length;
                    } while (mediaList.length > 0);
                } catch (error) {
                    console.error('Error during pHash compute:', error);
                    await new Promise(resolve => setTimeout(resolve, 5000)); // 如果出错，延迟重试
                }

                await new Promise(resolve => setTimeout(resolve, intervalMs)); // 间隔等待
            }
        };

        phashLoop(); // 启动循环
    }


    startPrefetchService(intervalMs: number = 60000): void {
        if (this.isPrefetchServiceRunning)
            return;

        this.isPrefetchServiceRunning = true;
        console.log('Starting prefetch service...');

        const prefetchLoop = async () => {
            while (this.isPrefetchServiceRunning) {
                this.prefetchStartAt = 0;
                let totalCount = 0;

                try {
                    do {
                        const mediaList = await GalleryPlus.getMediaList({
                            startAt: this.prefetchStartAt,
                            limit: this.prefetchLimit,
                        }) as getMediaListResponse;
                        totalCount = mediaList.totalCount;
                        const count = mediaList.media.length;

                        const mappedMedias: MediaDO[] = mediaList.media.map((media: MediaItem) => ({
                            identifier: media.id,
                            name: media.name ?? 'undefined',
                            type: media.type,
                            created_at: media.createdAt,
                            modified_at: media.modifiedAt,
                            thumbnailV1Path: media.thumbnailV1,
                            thumbnailV2Path: media.thumbnailV2,
                            source: 'local',
                            processInfo: 0,
                        } as MediaDO));

                        if (mappedMedias.length > 0) {
                            console.log(`Adding ${mappedMedias.length} medias to database`);
                            await this.storageService.addManyMedias(mappedMedias, Math.ceil(this.prefetchLimit / 2));
                        }

                        this.prefetchStartAt += count;
                        // console.log(`storageService.prefetchMedias: prefetchStartAt: ${this.prefetchStartAt}, totalCount: ${totalCount}`);

                        // wait for 5000ms
                        await new Promise(resolve => setTimeout(resolve, 5000));
                    } while (this.prefetchStartAt < totalCount);

                } catch (error) {
                    console.error('Error fetching medias:', error);
                    await new Promise(resolve => setTimeout(resolve, 5000)); // 出错后等待 5 秒
                }

                await new Promise(resolve => setTimeout(resolve, intervalMs)); // 等待 intervalMs 后再执行下一轮
            }
        }

        prefetchLoop(); // 启动任务
    }

    startAutoCleanService(intervalMs: number = 20000): void {
        if (this.isAutoCleanServiceRunning)
            return;

        this.isAutoCleanServiceRunning = true;

        const autoCleanLoop = async () => {
            while (this.isAutoCleanServiceRunning) {
                let checkStart = 0;
                const checkLimit = 20;
                let mediaIdList: string[] = [];

                try {
                    // delete where media isDeleted=1
                    mediaIdList = await this.storageService.getMediaIdListDeleted() as string[];
                    // submit to server
                    if (mediaIdList.length > 0) {
                        console.log('准备删除的媒体ID:', mediaIdList); // 确保输出为非空数组
                        const result = await fetch(`${this.serverUrl}/users/media_delete`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${this.getCookie('token')}`,
                            },
                            body: JSON.stringify({
                                media_ids: mediaIdList,
                            }),
                        });

                        if (result.ok) {
                            const response = await result.json();
                            if (response.changes > 0) {
                                if (response.changes !== mediaIdList.length)
                                    console.error('Failed to delete some media in server(server vs local):', response.changes, mediaIdList.length);
                            
                                const changes2 = await this.storageService.deleteMediaByManyIdentifier(mediaIdList, false);
                                if (changes2 !== mediaIdList.length)
                                    console.error('Failed to delete some media in local(db queried vs db changed):', changes2, mediaIdList.length);
                            }
                        } else {
                            console.error('Failed to delete media:', result.statusText);
                        }
                    }


                    do {
                        // Get mediaIds from database
                        mediaIdList = await this.storageService.getMediaIdListPaged(checkStart, checkLimit);

                        if (mediaIdList && mediaIdList.length > 0) {
                            // Get media IDs that should be deleted
                            const mediaIdsToDelete = await GalleryPlus.getMediaListShouldBeDelete({ ids: mediaIdList });

                            if (mediaIdsToDelete.length > 0) {
                                const deletedCount = await this.storageService.deleteMediaByManyIdentifier(mediaIdsToDelete, true);
                                checkStart += mediaIdList.length - deletedCount;
                            } else {
                                checkStart += mediaIdList.length;
                            }
                        }

                        // delay 5s
                        await new Promise(resolve => setTimeout(resolve, 5000));
                    } while (mediaIdList && mediaIdList.length > 0);
                } catch (error) {
                    console.error('Error during auto clean:', error);
                    // 如果出错，延迟 5 秒再继续
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }

                await new Promise(resolve => setTimeout(resolve, intervalMs)); // 等待间隔时间
            }
        };

        autoCleanLoop(); // 启动清理循环
    }

}