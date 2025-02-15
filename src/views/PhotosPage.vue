<!-- <template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>图库</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true">

      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">图库</ion-title>
        </ion-toolbar>
      </ion-header>

      <ion-grid>
        <ion-row>
          <ion-col size="6" v-for="photo in photos" :key="photo">
            <ion-img :src="photo.webviewPath" @click="showActionSheet(photo)" />
          </ion-col>
        </ion-row>
      </ion-grid>

      <ion-fab vertical="bottom" horizontal="end" slot="fixed">
        <ion-fab-button @click="takePhoto()">
          <ion-icon :icon="camera"></ion-icon>
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  </ion-page>
</template> -->
<template>
  <ion-content>
    <p>Thumbnails</p>
    <ion-button @click="getMedias">Get 25 (Default) Last Images</ion-button>
    <ion-button @click="getNineImages">Get 9 Last Images</ion-button>
    <ion-button @click="getNineVideos">Get 9 Last Video Thumbnails</ion-button>
    <ion-button @click="getNineAny">Get 9 Last Images/Video Thumbnails</ion-button>
    <ion-button @click="getLowQualityMedias">Get 9 Last Images, Low Quality</ion-button>
    <ion-button @click="getMediasFavorites">Get 9 Favorites</ion-button>
    <ion-button @click="getMediasSortedFavorites">Get 9 Images Last Created in Favorites</ion-button>
    <p>Full-Size</p>
    <ion-button @click="getHighQualityImage">Get Full-Size Image</ion-button>
    <ion-button @click="getHighQualityVideo">Get Full-Size Video</ion-button>
    <br />

    <div v-for="media in medias" :key="media.identifier" style="position: relative; display: inline-block">
      <img alt="Media Result" style="width: 50px" :src="'data:image/jpeg;base64,' + media.data" />
      <div v-if="media.duration"
        style="position: absolute; bottom: 5px; left: 5px; color: white; background-color: rgba(0, 0, 0, 0.5); padding: 2px 5px; border-radius: 3px; font-size: 10px">
        {{ Math.round(media.duration) }} s
      </div>
    </div>

    <div v-if="highQualityPath">
      <img alt="High Quality" :src="highQualityPath" />
    </div>
  </ion-content>
</template>


<script lang="ts">
import { camera, trash, close } from 'ionicons/icons';
import {
  IonPage,
  IonHeader,
  IonFab,
  IonFabButton,
  IonIcon,
  IonToolbar,
  IonTitle,
  IonContent,
  IonGrid,
  IonRow,
  IonCol,
  IonImg,
} from '@ionic/vue';
// import { usePhotoGallery } from "@/implements/PhotosUseImpl.ts";

import { Media, MediaAsset } from "@capacitor-community/media";
import { Capacitor } from "@capacitor/core";

export default {
  data(): { medias: MediaAsset[]; highQualityPath?: string } {
    return {
      medias: [], // 存储所有媒体
      highQualityPath: undefined, // 高质量图像路径
    };
  },
  watch: {
    medias() {
      this.highQualityPath = undefined; // 当 medias 更新时，重置高质量路径
    },
  },
  methods: {
    async getMedias() {
      this.medias = [];
      const medias = await Media.getMedias({});
      this.medias = medias.medias;
    },

    async getNineImages() {
      this.medias = [];
      const medias = await Media.getMedias({ quantity: 9, types: "photos" });
      this.medias = medias.medias;
    },

    async getNineVideos() {
      this.medias = [];
      const medias = await Media.getMedias({ quantity: 9, types: "videos" });
      this.medias = medias.medias;
    },

    async getNineAny() {
      this.medias = [];
      const medias = await Media.getMedias({ quantity: 9, types: "all" });
      this.medias = medias.medias;
    },

    async getLowQualityMedias() {
      this.medias = [];
      const medias = await Media.getMedias({ quantity: 9, thumbnailQuality: 10 });
      this.medias = medias.medias;
    },

    async getMediasFavorites() {
      this.medias = [];
      const medias = await Media.getMedias({ quantity: 9, sort: "isFavorite" });
      this.medias = medias.medias;
    },

    async getMediasSortedFavorites() {
      this.medias = [];
      const medias = await Media.getMedias({
        quantity: 9,
        sort: [
          { key: "isFavorite", ascending: false },
          { key: "creationDate", ascending: false },
        ],
      });
      this.medias = medias.medias;
    },

    async getHighQualityImage() {
      this.medias = [];
      const { medias } = await Media.getMedias({ quantity: 1, types: "photos" });
      const { path } = await Media.getMediaByIdentifier({ identifier: medias[0].identifier });
      this.highQualityPath = Capacitor.convertFileSrc(path);
    },

    async getHighQualityVideo() {
      this.medias = [];
      const { medias } = await Media.getMedias({ quantity: 1, types: "videos" });
      const { path } = await Media.getMediaByIdentifier({ identifier: medias[0].identifier });
      this.highQualityPath = Capacitor.convertFileSrc(path);
    },
  },
};
</script>

<style scoped>
.photo-img {
  width: 100%;
  height: auto;
  border-radius: 8px;
}
</style>