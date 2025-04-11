<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Tab 1</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">分类集锦</ion-title>
        </ion-toolbar>
      </ion-header>

      <div v-for="cat in cats" :key="cat.id" @click="goToCategory(cat)">
        <ion-card>
          <ion-card-header>
            <ion-card-title>{{ cat.name }}</ion-card-title>
            <ion-button>
              <ion-icon :icon="arrowForward"></ion-icon>
            </ion-button>
          </ion-card-header>
          <ion-card-content>
            <p> {{ cat.name }} </p>
            <div id="photo-wall" class="photo-wall">
              <div v-for="media in visibleMedias" :key="media.id" class="photo-item" @click="showActionSheet(media)"
                oading="lazy" :style="{ backgroundImage: 'url(' + media.thumbnail + ')' }">
                <div v-if="media.type === 'video'"
                  style="position: absolute; bottom: 5px; left: 5px; color: white; background-color: rgba(0, 0, 0, 0.5); padding: 2px 5px; border-radius: 3px; font-size: 10px">
                  <ion-icon :icon="videocam"></ion-icon>
                </div>
              </div>
            </div>
          </ion-card-content>
        </ion-card>
      </div>

      <ion-fab vertical="bottom" horizontal="end" slot="fixed">
        <ion-fab-button>
          <ion-icon :icon="camera"></ion-icon>
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonFab, IonFabButton, IonIcon, toastController, modalController } from '@ionic/vue';
import { GalleryPlus, MediaItem } from 'capacitor-gallery-plus';
import MediaInfoModalComponent from '@/components/MediaInfoModalComponent.vue';
import { camera, arrowForward } from 'ionicons/icons';

interface Category {
  id: number;
  name: string;
  medias: MediaItem[];
}

export default {
  name: 'CategoryPage',
  setup() {
    return {
      camera
    }
  },
  components: {
    IonPage,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonFab,
    IonFabButton,
    IonIcon
  },
  data() {
    return {
      cats: [] as Category[],
      visibleMedias: [] as MediaItem[],
      arrowForward,
      videocam: 'videocam'
    }
  },
  methods: {
    async showActionSheet(media: MediaItem) {
      const data = await GalleryPlus.getMedia({
        id: media.id,
        includeBaseColor: true,
        includeDetails: true,
        includePath: true,
      });

      const modal = await modalController.create({
        component: MediaInfoModalComponent,
        componentProps: {
          media: data
        },
        presentingElement: document.querySelector('.ion-page') as any
      });

      await modal.present();
    },
    async goToCategory(cat: Category) {
      // TODO: navigate to category page
      this.visibleMedias = cat.medias;
    }
  }
}

</script>
