<template>
    <ion-header>
        <ion-toolbar>
            <ion-title> 媒体信息：{{ media.name }} </ion-title>
            <ion-buttons slot="end">
                <ion-button @click="closeModal"> 关闭 </ion-button>
            </ion-buttons>
        </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">

        <ion-img v-if="media.type === 'image'" :src="getMediaSrc()" alt="Media Image"></ion-img>
        <video v-if="media.type === 'video'" :src="getMediaSrc()" controls playsinline autoplay
            preload="metadata"></video>

        <ion-list>
            <ion-item>
                <ion-label><strong>状态：</strong> {{
                    mediaDO.processInfo & 8 ? "分析失败"
                        : mediaDO.processInfo & 4 ? "正在分析"
                        : mediaDO.processInfo & 1 ? "分析成功" : "未分析"
                        }}，
                    {{ mediaDO.processInfo & 2 ? "正在查重" : "未查重" }}
                </ion-label>
            </ion-item>
            <ion-item>
                <ion-label><strong>类别：</strong> {{ cats.length ? cats.join("，") : "其他" }}</ion-label>
            </ion-item>
            <ion-item>
                <ion-label>
                    <strong>文件标题：</strong>
                    {{ media.name }}
                </ion-label>
            </ion-item>
            <ion-item>
                <ion-label><strong>创建时间：</strong> {{ new Date(media.createdAt).toLocaleDateString('zh-CN') }} {{ new Date(media.createdAt).toLocaleTimeString('zh-CN')
                }}</ion-label>
            </ion-item>
            <ion-item>
                <ion-label><strong>地点：</strong> {{ mediaMetadata.location }}</ion-label>
            </ion-item>
            <ion-item>
                <ion-label>
                    <strong>文件位置：</strong>
                    {{ media.path }}
                </ion-label>
            </ion-item>
            <ion-item>
                <ion-label>
                    <strong>文件大小：</strong>
                    {{ media.fileSize ? (
                    media.fileSize < 1024 ? (media.fileSize + ' B' ) : media.fileSize < 1048576 ? ((media.fileSize /
                        1024).toFixed(2) + ' KB' ) : ((media.fileSize / (1024 * 1024)).toFixed(2) + ' MB' ) ) : "未知" }}
                        </ion-label>
            </ion-item>
            <ion-item>
                <ion-label><strong>高:</strong> {{ media.height || 'Unknown' }} px</ion-label>
            </ion-item>
            <ion-item>
                <ion-label><strong>宽:</strong> {{ media.width || 'Unknown' }} px</ion-label>
            </ion-item>
            <ion-item>
                <ion-label><strong>MIME 类型:</strong> {{ media.mimeType || 'Unknown' }}</ion-label>
            </ion-item>
            <ion-item>
                <ion-label>
                    <strong>主体色调：</strong>
                    <span class="base-color" :style="{ backgroundColor: media.baseColor }"></span>
                    {{ media.baseColor }}
                </ion-label>
            </ion-item>
            <ion-item>
                <ion-label>
                    <strong>喜爱：</strong>
                    <ion-icon :icon="media.isFavorite ? heart : heartOutline"
                        :style="{ color: media.isFavorite ? 'green' : 'red' }"></ion-icon>
                </ion-label>
            </ion-item>
            <ion-item>
                <ion-label>
                    <strong>隐藏：</strong>
                    <span :style="{ color: media.isHidden ? 'green' : 'red' }">
                        {{ media.isHidden ? '是' : '否' }}
                    </span>
                </ion-label>
            </ion-item>
        </ion-list>

    </ion-content>
</template>


<script lang="ts">
import { MediaDO, MediaMetaDataDO } from '@/components/models';
import { FullMediaItem } from 'capacitor-gallery-plus';
import { Capacitor } from '@capacitor/core';
import { modalController, toastController } from '@ionic/vue';
import { IonIcon, IonButton, IonButtons, IonContent, IonHeader, IonImg, IonItem, IonLabel, IonList, IonTitle, IonToolbar } from '@ionic/vue';
import { heart, heartOutline } from 'ionicons/icons';
import { PhotosPageService } from '@/implements/PhotosPageService';
import { getCurrentInstance } from 'vue';

export default {
    name: 'MediaInfoModalComponent',
    components: {
        IonIcon,
        IonButton,
        IonButtons,
        IonContent,
        IonHeader,
        IonImg,
        IonItem,
        IonLabel,
        IonList,
        IonTitle,
        IonToolbar,
    },
    props: {
        media: {
            type: Object as () => FullMediaItem,
            required: true
        },
        mediaDO: {
            type: Object as () => MediaDO,
            required: true
        },
        mediaMetadata: {
            type: Object as () => MediaMetaDataDO,
            required: true
        },
        cats: {
            type: Array as () => string[],
            required: true
        }
    },

    setup() {
        const appInstance = getCurrentInstance();
        const photosPageService: PhotosPageService = appInstance?.appContext.config.globalProperties.$photosPageService;
        
        return {
            heart,
            heartOutline,
            photosPageService
        }
    },
    methods: {
        getMediaSrc(): string {
            if (!this.media.path) {
                toastController.create({
                    message: "media.path is null",
                    duration: 1000
                }).then(toast => toast.present());
                return '';
            } else {
                return Capacitor.convertFileSrc(this.media.path);
            }
        },
        closeModal() {
            if ((this.mediaDO.processInfo & ~2) === 0) {
                this.photosPageService.addAheadUploadingMedia(this.mediaDO.identifier);
                console.log('addAheadUploadingMedia', this.mediaDO.identifier);
            }
            modalController.dismiss();
        }
    }
};
</script>

<style scoped>
video {
    width: 100%;
}

.base-color {

    width: 25px;
    height: 25px;
    display: inline-block;
    border: 1px solid grey;
    vertical-align: middle;
    margin: 0 0 0 5px;
}
</style>