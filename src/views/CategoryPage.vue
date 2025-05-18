<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>分类浏览</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">分类浏览</ion-title>
        </ion-toolbar>
      </ion-header>

      <!-- <div v-for="cat in cats" :key="cat.id" @click="goToCategory(cat)">
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
                oading="lazy" :style="{ backgroundImage: 'url(' + media.thumbnailV1 + ')' }">
                <div v-if="media.type === 'video'"
                  style="position: absolute; bottom: 5px; left: 5px; color: white; background-color: rgba(0, 0, 0, 0.5); padding: 2px 5px; border-radius: 3px; font-size: 10px">
                  <ion-icon :icon="videocam"></ion-icon>
                </div>
              </div>
            </div>
          </ion-card-content>
        </ion-card>
      </div> -->

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
              1024).toFixed(2) + ' KB' ) : ((media.fileSize / (1024 * 1024)).toFixed(2) + ' MB' )) : "未知" }}</ion-note>
        </ion-item>
      </ion-list>

      <ion-infinite-scroll :disabled="displaySearchResult" @ionInfinite="onIonInfinite" threshold="100px"
        position="bottom">
        <ion-infinite-scroll-content loadingSpinner="bubbles" loadingText="Loading more data...">
        </ion-infinite-scroll-content>
      </ion-infinite-scroll>

      <ion-fab vertical="bottom" horizontal="end" slot="fixed">
        <ion-fab-button>
          <ion-icon :icon="camera"></ion-icon>
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonFab, IonFabButton, IonIcon, toastController, modalController, IonCardContent, IonCardHeader, IonCard, IonButton, IonCardTitle } from '@ionic/vue';
import { GalleryPlus, MediaItem } from 'capacitor-gallery-plus';
import MediaInfoModalComponent from '@/components/MediaInfoModalComponent.vue';
import { camera, arrowForward, videocam } from 'ionicons/icons';
import StorageService from '@/implements/StorageService';
import { getCurrentInstance } from 'vue';
import { useMediaStore } from '@/store/mediaStore';
import Lock from '@/lock';

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
    IonCard,
    IonCardContent,
    IonCardTitle,
    IonCardHeader,
    IonFab,
    IonFabButton,
    IonButton,
    IonIcon
  },
  data() {
    return {
      onceLock: new Lock(),
      cats: [] as Category[],
      visibleMedias: [] as MediaItem[],
    }
  },

  watch: {
    "$route.path": async function (newVal, oldVal) {
      if (newVal != oldVal && newVal == "/tabs/tab1") {
        console.log('newVal', newVal);
        const mutex = await this.onceLock.lock('w');

        try {
          // get medias from database by category
          // wait until this.cats is populated
          // then get medias from database by category
          this.cats = [];

          // get medias from router params
          const allMedias: MediaItem[] = this.mediaStore.medias;

          // Get tags names from database
          this.storageServ.getTagsNames().then((tags) => {
            console.log('tags', tags);
            tags.forEach(async (tag, index) => {
              // 从media_class表中获取分类的所有媒体ID
              const catMediasIds = await this.storageServ.getMediaIdsByTagIds([index + 1])

              // 根据媒体ID获取媒体对象
              const catMedias = catMediasIds.map((mediaId) => {
                return allMedias.find((media) => media.id === mediaId);
              }).filter((media) => media !== undefined) as MediaItem[];

              console.log('catMedias', catMedias);

              this.cats.push({
                id: index + 1,
                name: tag,
                medias: catMedias,
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
        } catch (error: any) {
          console.error(error.message);
          this.cats = [];
        } finally {
          mutex.unlock();

        }
      }
    }
  },

  // activated is called when the component is activated (when the user navigates to this page) and retrieves the media from PhotosPage.
  created() {
    
  },
  methods: {
    async showActionSheet(media: MediaItem) {
      const fullMedia = await GalleryPlus.getMedia({
        id: media.id,
        includeBaseColor: true,
        includeDetails: true,
        includePath: true,
      });

      const mediaDO = await this.storageServ.getMediaByIdentifier(media.id);

      const modal = await modalController.create({
        component: MediaInfoModalComponent,
        componentProps: {
          media: fullMedia,
          mediaDO: mediaDO
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