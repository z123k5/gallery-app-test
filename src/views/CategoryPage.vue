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
        <ion-card id="photo-wall" class="photo-wall">
          <ion-card-header>
            <ion-card-title>{{ cat.name }}</ion-card-title>
            <ion-button>
              <ion-icon :icon="arrowForward"></ion-icon>
            </ion-button>
          </ion-card-header>
          <ion-card-content>
            <div>
              <div v-for="media in cat.medias" :key="media.id" class="photo-item" @click="showActionSheet(media)"
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
import { camera, arrowForward, videocam } from 'ionicons/icons';
import StorageService from '@/implements/StorageService';
import { getCurrentInstance } from 'vue';
import { useMediaStore } from '@/store/mediaStore';

interface Category {
  id: number;
  name: string;
  medias: MediaItem[];
}

export default {
  name: 'CategoryPage',
  setup() {
    const appInstance = getCurrentInstance();
    const storageServ: StorageService = appInstance?.appContext.config.globalProperties.$storageServ;
    const mediaStore = useMediaStore();
    return {
      storageServ,
      mediaStore,
      camera,
      arrowForward,
      videocam,
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
    }
  },

  // activated is called when the component is activated (when the user navigates to this page) and retrieves the media from PhotosPage.
  created() {
    // get medias from database by category
    // wait until this.cats is populated
    // then get medias from database by category
    this.cats = [];

    // get medias from router params
    const allMedias: MediaItem[] = this.mediaStore.medias;
    console.log('allMedias', allMedias);

    // Get tags names from database
    this.storageServ.getTagsNames().then((tags) => {
      console.log('tags', tags);
      tags.forEach(async (tag, index) => {
        // 从media_class表中获取分类的所有媒体ID
        const catMediasIds = await this.storageServ.getMediaIdsByTagIds([index])

        // 根据媒体ID获取媒体对象
        const catMedias = catMediasIds.map((mediaId) => {
          return allMedias.find((media) => media.id === mediaId);
        }).filter((media) => media !== undefined) as MediaItem[];

        console.log('catMedias', catMedias);



        this.cats.push({
          id: index,
          name: tag,
          medias: catMedias,
        });
      });
    });
    console.log('this.cats', this.cats);
  },
  mounted() {
    console.log('Category page mounted');
    // get tags names from database
    this.cats = [];
    this.storageServ.getTagsNames().then((tags) => {
      tags.forEach((tag, index) => {
        this.cats.push({
          id: index,
          name: tag,
          medias: []
        });
      });
    });

    toastController.create({
      message: '分类集锦 onmounted',
      duration: 2000,
      position: 'top',
      cssClass: 'toast-class'
    }).then((toast) => {
      toast.present();
    });

    console.log('this.cats', this.cats);

    
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

<style scoped>
ion-toast.newline {
  --white-space: pre-line;
  color: blue;
  text-decoration-color: blue;
}

.photo-img {
  width: 100%;
  height: auto;
  border-radius: 8px;
}


.photo-wall {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  /* 默认每列最小宽度200px */
  grid-gap: 10px;
  /* transition: grid-template-columns 0.3s ease; */
  /* 平滑过渡 */
  width: 100%;
  height: 100%;
}

.photo-item {
  background-size: cover;
  background-position: center;
  aspect-ratio: 1;
  /* 保证图片是正方形 */
  height: 100%;
}

.photo-wall.full-size {
  grid-template-columns: 1fr;
  /* 只有一张图片时显示占满宽度 */
}
</style>