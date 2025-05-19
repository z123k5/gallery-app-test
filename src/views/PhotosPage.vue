<template>
    <ion-page>
        <ion-header>
            <ion-toolbar>
                <ion-title>图库</ion-title>
            </ion-toolbar>
            <ion-searchbar :value="queryString" @keyup.enter="handleSearch($event)" @ionClear="handleClearSearch"
                placeholder="搜索图片"></ion-searchbar>
        </ion-header>
        <ion-content :fullscreen="true">


            <ion-header collapse="condense">
                <ion-toolbar>
                    <ion-title size="large">按日期排序</ion-title>
                </ion-toolbar>
            </ion-header>

            <p v-if="displaySearchResult"> {{ searchResult }} </p>

            <ion-list>
                <ion-item v-for="media in visibleMedias" :key="media.id" @click="showActionSheet(media)" :button="true">
                    <ion-thumbnail slot="start">
                        <img loading="lazy" :src="media.thumbnailV1" />
                    </ion-thumbnail>
                    <ion-label>
                        <h3>{{ media.name }}</h3>
                        <p><ion-icon :icon="calendarOutline"></ion-icon> {{ new
                            Date(media.createdAt).toLocaleDateString('zh-CN') }}</p>
                        <!-- Analyze pending, analyze done, not analyzed -->
                        <ion-icon v-if="getVisibleMediaDOById(media.id)" :icon="(getVisibleMediaDOById(media.id)?.processInfo ?? 0) & 1
                            ? checkmarkCircleOutline
                            : (getVisibleMediaDOById(media.id)?.processInfo ?? 0) & 8
                                ? removeCircleOutline
                                : (getVisibleMediaDOById(media.id)?.processInfo ?? 0) & 4
                                    ? syncOutline
                                    : null
                            " :class="{
                                'rotating': (getVisibleMediaDOById(media.id)?.processInfo ?? 0) & 4
                            }">
                        </ion-icon>
                        <ion-icon v-if="getVisibleMediaDOById(media.id)?.source?.startsWith('cloud')"
                            :icon="cloudOutline"></ion-icon>
                    </ion-label>
                    <ion-note color="medium" slot="end">{{ media.fileSize ? (
                        media.fileSize < 1024 ? (media.fileSize + ' B' ) : media.fileSize < 1048576 ? ((media.fileSize /
                            1024).toFixed(2) + ' KB' ) : ((media.fileSize / (1024 * 1024)).toFixed(2) + ' MB' )) : "未知"
                            }}</ion-note>
                </ion-item>
            </ion-list>


            <ion-infinite-scroll :disabled="displaySearchResult" @ionInfinite="onIonInfinite" threshold="100px"
                position="bottom">
                <ion-infinite-scroll-content loadingSpinner="bubbles" loadingText="Loading more data...">
                </ion-infinite-scroll-content>
            </ion-infinite-scroll>

        </ion-content>
    </ion-page>
</template>

<script lang="ts">
import { camera, videocam, images, calendarOutline, syncOutline, removeCircleOutline, checkmarkCircleOutline, cloudOutline } from 'ionicons/icons';
import {
    IonPage,
    IonHeader,
    IonFab,
    IonFabButton,
    // IonButton,
    IonIcon,
    IonToolbar,
    IonTitle,
    IonContent,
    IonItem,
    IonLabel,
    IonNote,
    // IonGrid,
    // IonRow,
    // IonCol,
    // IonImg,
    IonSearchbar,
    modalController,
    toastController,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonList,
    IonThumbnail,
    InfiniteScrollCustomEvent,
    // GestureDetail,
} from '@ionic/vue';
import { getCurrentInstance, Ref, ref } from 'vue';
// import { Camera, CameraResultType, CameraSource, Photo } from "@capacitor/camera";
import { GalleryPlus, MediaItem } from 'capacitor-gallery-plus';
// import { Media } from '@capacitor-community/media'
import MediaInfoModalComponent from '@/components/MediaInfoModalComponent.vue';

import { StorageService } from '../implements/StorageService';
import { PhotosPageService } from '@/implements/PhotosPageService';
import { ISQLiteService } from '@/implements/SqliteService';
// import { GalleryEngineService } from '@/implements/GalleryEngine';
import { GalleryDuplicateService } from '@/implements/GalleryDuplicateService';
import { MediaDO } from '@/components/models';
import { Capacitor } from '@capacitor/core';

export default {
    name: 'PhotosPage',
    components: { IonPage, IonHeader, IonFab, IonFabButton, IonIcon, IonToolbar, IonTitle, IonContent, IonSearchbar, IonInfiniteScroll, IonInfiniteScrollContent, IonList, IonItem, IonLabel, IonNote, IonThumbnail },
    emits: ['onClick'],
    setup() {
        const appInstance = getCurrentInstance();
        const sqliteService: ISQLiteService = appInstance?.appContext.config.globalProperties.$sqliteServ;
        const storageService: StorageService = appInstance?.appContext.config.globalProperties.$storageServ;
        // const galleryEngineServ: GalleryEngineService = appInstance?.appContext.config.globalProperties.$galleryEngineServ;
        const galleryDuplicateService: GalleryDuplicateService = appInstance?.appContext.config.globalProperties.$galleryDuplicateServ;
        const photosPageService: PhotosPageService = appInstance?.appContext.config.globalProperties.$photosPageService;
        const platform = sqliteService.getPlatform();

        
        galleryDuplicateService.loadStateFromStorage();
        photosPageService.startPrefetchService();
        // photosPageService.startMediaUploadService();
        photosPageService.startPHashComputeService();
        photosPageService.startAutoCleanService();

        return {
            storageService, photosPageService, galleryDuplicateService,
            toastController,
            camera, videocam, images, calendarOutline, syncOutline, removeCircleOutline, checkmarkCircleOutline, cloudOutline,
            platform
        }
    },
    data(): {
        serverUrl: string,
        displaySearchResult: boolean,
        queryString: string,
        colSize: number,
        start: number,
        limit: number,
        dis: boolean,
        searchMediasItemList: Ref<MediaItem[]>,
        searchResult: string,
        // modalController,
        // toastController,
        // IonIcon,
        // IonButton,
        // IonImg,
        // IonGrid,
        // medias: MediaItem[]
    } {
        return {
            // serverUrl: 'https://frp-dad.com:34952', // frp Server
            // serverUrl: 'http://10.12.80.224:8443',
            // serverUrl: 'http://172.20.10.5:8443', // localhost
            serverUrl: 'http://192.168.2.104:8443',
            displaySearchResult: false,
            searchMediasItemList: ref<MediaItem[]>([]),
            queryString: '',
            colSize: 3,
            start: 0,
            limit: 20,
            dis: false,
            searchResult: "",
        };
    },
    computed: {
        visibleMedias() {
            if (this.displaySearchResult)
                // return this.searchMedias.filter(media => !media.isHidden);
                return this.searchMediasItemList;
            else
                // return this.medias.filter(media => !media.isHidden);
                return this.photosPageService.visibleMediasItem.value;
        }
    },

    async mounted() {
        const maxRetries = 5;
        let attempt = 0;
        let success = false;

        while (attempt < maxRetries && !success) {
            try {
                await this.photosPageService.getPaginatedMediaList(this.start, this.limit);
                success = true;
            } catch (error: any) {
                attempt++;
                await this.sleep(1000); // 等待1秒再重试
            }
        }
        if (!success) {
            this.searchResult = "加载图库失败，请检查本地图库访问权限";
            this.displaySearchResult = true;
            console.error('Failed to load media list after multiple attempts');
        }
    },
    methods: {
        // async takePhotoAction() {
        //     const photo = await Camera.getPhoto({
        //         resultType: CameraResultType.Uri,
        //         source: CameraSource.Camera,
        //         quality: 100
        //     });
        //     const modal = await modalController.create({
        //         component: 'PhotoModal',
        //         componentProps: { photo },
        //         cssClass: 'my-custom-class'
        //     });
        // },
        async showActionSheet(media: MediaItem) {
            const fullMedia = await GalleryPlus.getMedia({
                id: media.id,
                includeBaseColor: true,
                includeDetails: true,
                includePath: true,
            });
            const mediaDO = await this.storageService.getMediaByIdentifier(media.id);

            let mediaMetadata: any;
            try {
                mediaMetadata = await this.storageService.getMediaMetadataById(media.id);
            } catch (error) {
                mediaMetadata = [];
            }

            const cats = await this.storageService.getMediaTagNamesByIdentifier(media.id);

            const modal = await modalController.create({
                component: MediaInfoModalComponent,
                componentProps: {
                    media: fullMedia,
                    mediaDO: mediaDO,
                    mediaMetadata: mediaMetadata,
                    cats: cats
                },
                presentingElement: document.querySelector('.ion-page') as any
            });

            await modal.present();
        },

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
        },

        async handleClearSearch() {
            this.queryString = '';
            this.displaySearchResult = false;
        },

        async handleSearch(event: any) {
            // 1. fetch server /engine/query
            // 2. get feature from server
            // 3. calculate the cosine similarity
            // 4. show the result

            if (event.target.value === "") {
                this.displaySearchResult = false;
                return;
            } else {
                this.displaySearchResult = true;
                this.searchResult = "正在搜索...";
                this.searchMediasItemList = [];
            }

            // /users/active
            try {
                const response = await fetch(`${this.serverUrl}/users/active`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.getCookie('token')}`,
                    },
                });

                if (response.status === 401) {
                    // Token is invalid, perform login
                    const token = await this.performLogin();
                    if (token !== null) {
                        this.setCookie('token', token);
                    } else {
                        toastController.create({
                            message: 'Login failed',
                            duration: 2000,
                        }).then((toast) => { toast.present(); })
                    }
                }
            } catch (error) {
                console.log(error);
            }

            try {
                ///////// Query V1 //////////
                // const response = await fetch(`${this.serverUrl}/engine/query?query=${encodeURIComponent(event.target.value)}`, {
                //   method: 'GET',
                //   headers: {
                //     'Content-Type': 'application/json',
                //     'Authorization': 'Bearer ' + this.getCookie('token'),
                //     'X-Requested-With': 'XMLHttpRequest',
                //   },
                // })

                // const contentType = response.headers.get('Content-Type');
                // if (contentType === 'application/octet-stream') {
                //   response.arrayBuffer().then(async (arrayBuffer) => {
                //     console.log("Got Array Buffer, length = " + arrayBuffer.byteLength);

                //     // ✅ 转换 `ArrayBuffer` 为 `Uint8Array`
                //     const float32Array = new Float32Array(arrayBuffer);

                //     // ✅ 转换为 JS 数组（否则 Capacitor 不支持）
                //     const tensorArray = Array.from(float32Array);

                //     const prob = await GalleryEngineService.calculateCosineSimilarity(tensorArray)

                //     // TODO: show the result
                //     // resultType: [1,0,0,0,0,0,0,...]
                //     // invisiblize the img which corelation is less than 0.8
                //     // for a turple, the first is the prob, the second is the image

                //     // 方法一：小于0.6的隐藏
                //     // this.medias = this.medias.map((media, index) => {
                //     //   if (prob[index] < 0.6) {
                //     //     media.isHidden = true;
                //     //   } else {
                //     //     media.isHidden = false;
                //     //   }
                //     //   return media;
                //     // });
                //     // console.log(prob);

                //     // 方法二：将medias和prob看成整体，按照prob对应的大小、位置降序排序，取前五个设置isHidden为false，其余为true
                //     const probWithIndex = prob.map((value, index) => ({ value, index }));
                //     probWithIndex.sort((a, b) => b.value - a.value);
                //     // console.log(probWithIndex);
                //     this.searchMedias = [];
                //     const right = Math.min(5, probWithIndex.length);
                //     probWithIndex.slice(0, right).forEach((item) => {
                //       this.searchMedias.push(this.medias[item.index]);
                //     });

                //     // 输出前10个
                //     console.log(probWithIndex.slice(0, right));
                //     console.log(this.searchMedias.slice(0, right));

                //   });
                // }
                ///////// Query V1 //////////

                ///////// Query V3 //////////
                const response = await fetch(`${this.serverUrl}/engine/query_v3?query=${encodeURIComponent(event.target.value)}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + this.getCookie('token'),
                    },
                })

                if (response.status === 200) {
                    const responseData = await response.json();
                    const images = responseData["images"] as { id: string, score: number }[];
                    const prompt = responseData["prompt"] as string;
                    // images structure: { id: string, score: number }[]

                    const searchResultIds = images.map(image => image.id);

                    const result = await GalleryPlus.getMediaListByManyId({
                        ids: searchResultIds,
                        includeBaseColor: true,
                        includeDetails: true,
                    });
                    this.searchResult = `关于 "${prompt}" 的搜索结果有 ${result.media.length} 个：`;
                    this.searchMediasItemList = result.media.map((media) => {
                        if (this.platform !== "web") {
                            return {
                                ...media,
                                thumbnailV1: Capacitor.convertFileSrc(media.thumbnailV1 as string),
                                thumbnailV2: Capacitor.convertFileSrc(media.thumbnailV2 as string),
                            } as MediaItem;
                        }
                        return media;
                    })
                } else if (response.status === 404) {
                    this.searchMediasItemList = [];
                    this.searchResult = "搜索结果为空";
                } else if (response.status === 500) {
                    this.searchMediasItemList = [];
                    this.searchResult = "搜索失败: " + response.statusText;
                }
                this.displaySearchResult = true;
                ///////// Query V3 //////////
            } catch (error) {
                console.error('Error:', error);
            }
        },


        async onIonInfinite(ev: InfiniteScrollCustomEvent) {
            this.start += this.limit;
            await this.photosPageService.getPaginatedMediaList(this.start, this.limit);
            ev.target.complete();
        },

        getCookie(key: string) {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.startsWith(key + '=')) {
                    return cookie.substring(key.length + 1);
                }
            }
            return null;
        },
        setCookie(key: string, value: string) {
            document.cookie = key + '=' + value;
        },
        sleep(ms: number) {
            return new Promise(resolve => setTimeout(resolve, ms));
        },
        getVisibleMediaDOById(id: string): MediaDO | undefined {
            return this.photosPageService.visibleMediaDOs.value.find(
                (mediaDO) => mediaDO.identifier === id
            );
        },
    }
}

</script>

<style scoped>
.rotating {
    animation: spin 2s linear infinite;
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }

    100% {
        transform: rotate(360deg);
    }
}
</style>