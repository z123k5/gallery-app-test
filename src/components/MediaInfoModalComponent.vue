<template>
    <ion-header>
        <ion-toolbar>
            <ion-title> 媒体信息 </ion-title>
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
                <ion-label><strong>Width:</strong> {{ media.width || 'Unknown' }} px</ion-label>
            </ion-item>
            <ion-item>
                <ion-label><strong>Height:</strong> {{ media.height || 'Unknown' }} px</ion-label>
            </ion-item>
            <ion-item>
                <ion-label><strong>File Size:</strong> {{ media.fileSize }}</ion-label>
            </ion-item>
            <ion-item>
                <ion-label><strong>MIME Type:</strong> {{ media.mimeType || 'Unknown' }}</ion-label>
            </ion-item>
            <ion-item>
                <ion-label>
                    <strong>Base-Color:</strong>
                    <span class="base-color" :style="{ backgroundColor: media.baseColor }"></span>
                    {{ media.baseColor }}
                </ion-label>
            </ion-item>
            <ion-item>
                <ion-label>
                    <strong>Favorite:</strong>
                    <span :style="{ color: media.isFavorite ? 'green' : 'red' }">
                        {{ media.isFavorite ? 'Yes' : 'No' }}
                    </span>
                </ion-label>
            </ion-item>
            <ion-item>
                <ion-label>
                    <strong>Hidden:</strong>
                    <span :style="{ color: media.isHidden ? 'green' : 'red' }">
                        {{ media.isHidden ? 'Yes' : 'No' }}
                    </span>
                </ion-label>
            </ion-item>
        </ion-list>

    </ion-content>
</template>


<script lang="ts">
import { FullMediaItem } from 'capacitor-gallery-plus';
import { Capacitor } from '@capacitor/core';
import { modalController, toastController } from '@ionic/vue';
import { IonButton, IonButtons, IonContent, IonHeader, IonImg, IonItem, IonLabel, IonList, IonTitle, IonToolbar } from '@ionic/vue';

export default {
    name: 'MediaInfoModalComponent',
    components: {
        IonButton,
        IonButtons,
        IonContent,
        IonHeader,
        IonImg,
        IonItem,
        IonLabel,
        IonList,
        IonTitle,
        IonToolbar
    },
    props: {
        media: {
            type: Object as () => FullMediaItem,
            required: true
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

            } else
                // toastController.create({
                //     message: "path:" + this.media.path + ", src:" + Capacitor.convertFileSrc(this.media.path),
                //     duration: 1000
                // }).then(toast => toast.present());
            return Capacitor.convertFileSrc(this.media.path);
        },
        closeModal() {
            modalController.dismiss();
        }
    }
}

</script>