<template>
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
import { usePhotoGallery } from "@/implements/PhotosUseImpl.ts";

export default {
  name : "PhotosPage",
  components: { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonGrid, IonRow, IonCol, IonImg, IonFab, IonFabButton, IonIcon },
  setup() {
    const { takePhoto, photos } = usePhotoGallery();
    return { camera, trash, close, takePhoto, photos };
  }
}



</script>
