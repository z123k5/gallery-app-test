<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>相似图片列表</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true">
      <ion-list>
        <ion-item v-for="(pair, index) in similarPairs" :key="index" lines="full">
          <div style="display: flex; align-items: center; width: 100%; justify-content: space-between;">
            <!-- 图片1 -->
            <div style="text-align: center; flex: 1;">
              <ion-thumbnail style="margin: auto;">
                <img loading="lazy" :src="getThumbnailById(pair.id1)" @click="showActionSheetByIdentifier(pair.id1)" />
              </ion-thumbnail>
              <p style="font-size: 0.75em; margin-top: 4px;">{{ pair.id1 }}</p>
            </div>

            <!-- 分隔箭头 -->
            <div style="padding: 0 8px;">
              <ion-icon name="arrow-forward-outline"></ion-icon>
            </div>

            <!-- 图片2 -->
            <div style="text-align: center; flex: 1;">
              <ion-thumbnail style="margin: auto;">
                <img loading="lazy" :src="getThumbnailById(pair.id2)" @click="showActionSheetByIdentifier(pair.id2)" />
              </ion-thumbnail>
              <p style="font-size: 0.75em; margin-top: 4px;">{{ pair.id2 }}</p>
            </div>

            <!-- 显示汉明距离 -->
            <ion-note color="medium" style="min-width: 60px; text-align: right;">
              相似度: {{ getSimilarityPercentage(pair.hammingDistance) }}%
            </ion-note>
          </div>
        </ion-item>
      </ion-list>
    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, modalController, toastController, IonThumbnail, IonIcon, IonNote, IonItem, IonList } from '@ionic/vue';
import { ref, getCurrentInstance } from 'vue';
import { GalleryDuplicateService, SimilarPair } from '@/implements/GalleryDuplicateService';
import StorageService from '@/implements/StorageService';
import { MediaDO } from '@/components/models';
import { GalleryPlus } from 'capacitor-gallery-plus';
import MediaInfoModalComponent from '../components/MediaInfoModalComponent.vue';
import Lock from '@/lock';


export default {
  name: 'DuplicatePage',
  components: {
    IonThumbnail,
    IonIcon,
    IonNote,
    IonItem,
    IonList,
    IonPage,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent
  },

  setup() {
    const appInstance = getCurrentInstance();
    const storageServ: StorageService = appInstance?.appContext.config.globalProperties.$storageServ;
    const galleryDuplicateServ: GalleryDuplicateService = appInstance?.appContext.config.globalProperties.$galleryDuplicateServ;
    return {
      modalController,
      mediaList: ref<MediaDO[]>([]),
      storageServ,
      similarPairs: ref<SimilarPair[]>([]),
      galleryDuplicateServ
    };
  },
  data() {
    return {
      onceLock : new Lock()
    }
  },
  watch: {
    "$route.path" : async function (newVal, oldVal) {
      if (newVal != oldVal && newVal == "/tabs/tab3") {
        console.log('newVal', newVal);
        const mutex = await this.onceLock.lock('w');
        try {
          // fech similarpairs from galleryDuplicateServ
          this.mediaList = await this.storageServ.getMedias();

          this.similarPairs = this.galleryDuplicateServ.similarPairs;
        } catch (error : any) {
          toastController.create({
            message: error.message,
            duration: 2000,
            color: 'danger'
          }).then(toast => toast.present());
        } finally {
          console.log(this.similarPairs);
          mutex.unlock();
        }
      }
    }
  },

  async created() {
    
  },

  methods: {
    // 根据 ID 获取对应图片的 thumbnail
    getThumbnailById(id: string): string {
      const media = this.mediaList.find(m => m.identifier === id);
      return media?.thumbnailPath || '';
    },
    async showActionSheetByIdentifier(identifier: string) {
      const fullMedia = await GalleryPlus.getMedia({
        id: identifier,
        includeBaseColor: true,
        includeDetails: true,
        includePath: true,
      });
      const mediaDO = await this.storageServ.getMediaByIdentifier(identifier);

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

    // 将 hammingDistance 映射到 70% ~ 100%
    getSimilarityPercentage(hammingDistance: number): number {
      return 100 - (hammingDistance / 5) * 30;
    }
  },
};

</script>
