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

      <div v-for="cat in cats" :key="cat.id" style="margin-bottom: 20px;">
        <ion-card>
          <!-- Add a long press listener on the header -->
          <ion-card-header
            @mousedown.right.prevent
            @touchstart.prevent="startLongPress(cat)"
            @touchend="endLongPress"
            @mouseup="endLongPress"
          >
            <ion-card-title>{{ cat.name }}</ion-card-title>
          </ion-card-header>

          <ion-card-content>
            <ion-list>
              <ion-item v-for="media in cat.medias" :key="media.id" @click="showActionSheet(media)" :button="true">
                <ion-thumbnail slot="start">
                  <img loading="lazy" :src="media.thumbnailV1" />
                </ion-thumbnail>
                <ion-label>
                  <h3>{{ media.name }}</h3>
                  <p>
                    <ion-icon :icon="calendarOutline" />
                    {{ new Date(media.createdAt).toLocaleDateString('zh-CN') }}
                  </p>
                </ion-label>
                <ion-note color="medium" slot="end">
                  {{ media.fileSize
                    ? (
                      media.fileSize < 1024 ? media.fileSize + ' B' : media.fileSize < 1048576 ? (media.fileSize /
                        1024).toFixed(2) + ' KB' : (media.fileSize / (1024 * 1024)).toFixed(2) + ' MB') : '未知' }}
                </ion-note>
              </ion-item>
            </ion-list>
            <ion-button @click="loadMoreForCategory(cat)">显示更多</ion-button>
          </ion-card-content>
        </ion-card>
      </div>

      <ion-fab vertical="bottom" horizontal="end" slot="fixed">
        <ion-fab-button @click="refresh">
          <ion-icon :icon="refreshOutline"></ion-icon>
        </ion-fab-button>
      </ion-fab>

      <ion-fab vertical="bottom" horizontal="end" slot="fixed" style="margin-bottom: 60px;">
        <ion-fab-button @click="showAddCategoryDialog">
          <ion-icon :icon="add"></ion-icon>
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonFab,
  IonFabButton,
  IonIcon,
  toastController,
  modalController,
  alertController,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonButton,
} from '@ionic/vue';
import { GalleryPlus, MediaItem } from 'capacitor-gallery-plus';
import MediaInfoModalComponent from '@/components/MediaInfoModalComponent.vue';
import { camera, arrowForward, videocam, refreshOutline, refresh } from 'ionicons/icons';
import { calendarOutline, add } from 'ionicons/icons';
import StorageService from '@/implements/StorageService';
import { getCurrentInstance, ref, Ref } from 'vue';
import { useMediaStore } from '@/store/mediaStore';
import Lock from '@/lock';
import { PhotosPageService } from '@/implements/PhotosPageService';

interface Category {
  id: number;
  name: string;
  medias: MediaItem[];
  offset?: number;
  artificial?: number;
}

export default {
  name: 'CategoryPage',
  setup() {
    const appInstance = getCurrentInstance();
    const storageServ: StorageService =
      appInstance?.appContext.config.globalProperties.$storageServ;
    const mediaStore = useMediaStore();
    const photosPageService: PhotosPageService =
      appInstance?.appContext.config.globalProperties.$photosPageService;

    let cats: Ref<Category[]> = ref<Category[]>([]);
    // 去掉自动向 tags 中添加 “其他”
    try {
      storageServ.getTagsNames().then((tags) => {
        tags.forEach((tag, index) => {
          cats.value.push({
            id: index + 1,
            name: tag,
            medias: [],
            offset: 0,
            // 不再根据 tag 判断 artificial
            artificial: 0,
          });
        });
        // 仅在 UI 层面添加“其他”
        cats.value.push({
          id: new Date().getTime(),
          name: '其他',
          medias: [],
          offset: 0,
          artificial: 1,
        });
      });
    } catch (error: any) {
      console.error(error.message);
      cats.value = [];
    }

    return {
      cats,
      storageServ,
      photosPageService,
      mediaStore,
      camera,refreshOutline,
      arrowForward,
      videocam,
      calendarOutline,
      add,
    };
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
    IonIcon,
  },
  data() {
    return {
      // 单选当前选中的类别，选中“其他”时取消其它，选中非“其他”时取消“其他”
      selectedCategory: '',
      onceLock: new Lock(),
      longPressTimeout: null as any,
      pressDuration: 700,
      pressedCategory: null as Category | null,
    };
  },
  methods: {
    refresh() {
      this.cats = [];
      try {
      this.storageServ.getTagsNames().then((tags) => {
        tags.forEach((tag, index) => {
          this.cats.push({
            id: index + 1,
            name: tag,
            medias: [],
            offset: 0,
            // 不再根据 tag 判断 artificial
            artificial: 0,
          });
        });
        // 仅在 UI 层面添加“其他”
        this.cats.push({
          id: new Date().getTime(),
          name: '其他',
          medias: [],
          offset: 0,
          artificial: 1,
        });
      });
    } catch (error: any) {
      console.error(error.message);
      this.cats = [];
    }
      this.cats.forEach((cat) => {
        cat.medias = [];
        cat.offset = 0;
        this.loadMoreForCategory(cat);
      });
      
    },
    selectCategory(cat: Category) {
      if (cat.name === '其他') {
        this.selectedCategory = '其他';
      } else {
        this.selectedCategory = cat.name;
      }
    },
    async showActionSheet(media: MediaItem) {
      // 保持原逻辑：若无类别，自动视为“其他”
      const fullMedia = await GalleryPlus.getMedia({
        id: media.id,
        includeBaseColor: true,
        includeDetails: true,
        includePath: true,
      });
      const mediaDO = await this.storageServ.getMediaByIdentifier(media.id);
      const mediaMetadata = await this.storageServ.getMediaMetadataById(media.id);
      const cats = await this.storageServ.getMediaTagNamesByIdentifier(media.id);

      if (!cats || cats.length === 0) {
        cats.push('其他');
      }

      const modal = await modalController.create({
        component: MediaInfoModalComponent,
        componentProps: {
          media: fullMedia,
          mediaDO,
          mediaMetadata,
          cats,
        },
        presentingElement: document.querySelector('.ion-page') as any,
      });
      await modal.present();
    },
    async loadMoreForCategory(cat: Category) {
      if (!cat.offset) cat.offset = 0;
      const newMedias = await this.photosPageService.getPaginatedCatgoryMediaList(
        cat.offset,
        10,
        cat.name,
      );
      cat.medias.push(...newMedias);
      cat.offset += newMedias.length;
    },
    async showAddCategoryDialog() {
      const alert = await alertController.create({
        header: '添加类别',
        inputs: [
          {
            name: 'categoryName',
            type: 'text',
            placeholder: '输入类别名称',
          },
        ],
        buttons: [
          {
            text: '取消',
            role: 'cancel',
          },
          {
            text: '确定',
            handler: (data) => {
              if (!data.categoryName) {
                return false;
              }
              // 禁止手动添加“其他”
              if (data.categoryName === '其他') {
                return false;
              }
              try {
                this.addCategory(data.categoryName);
              } catch (e) {
                return false;
              }
            },
          },
        ],
      });
      await alert.present();
    },
    addCategory(name: string) {
      if (!name) return;
      this.storageServ.addTagManually(name);
      this.cats.push({
        id: this.cats.length + 1,
        name,
        medias: [],
        offset: 0,
        artificial: 1,
      });
      this.loadMoreForCategory(this.cats[this.cats.length - 1]);
    },
    startLongPress(cat: Category) {
      this.pressedCategory = cat;
      this.longPressTimeout = setTimeout(() => {
        this.openCategoryMenu(cat);
      }, this.pressDuration);
    },
    endLongPress() {
      clearTimeout(this.longPressTimeout);
      this.longPressTimeout = null;
      this.pressedCategory = null;
    },
    async openCategoryMenu(cat: Category) {
      if (cat.artificial !== 1 || cat.name === '其他') return;
      const actionAlert = await alertController.create({
        header: '操作',
        buttons: [
          {
            text: '删除分类',
            handler: () => {
              this.removeCategory(cat);
            },
          },
          {
            text: '取消',
            role: 'cancel',
          },
        ],
      });
      await actionAlert.present();
    },
    removeCategory(cat: Category) {
      this.storageServ.deleteTagManually(cat.name);
      this.cats = this.cats.filter((c) => c !== cat);
    },
  },
};
</script>
