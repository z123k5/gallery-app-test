<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>重复图片管理</ion-title>
        <ion-button v-if="selectedIds.length > 0" @click="deleteSelected">删除</ion-button>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div v-for="(group, index) in duplicateGroups" :key="index" class="group-section">
        <h3>重复组 {{ index + 1 }}</h3>
        <ion-grid>
          <ion-row>
            <ion-col
              v-for="media in group"
              :key="media.id"
              size="4"
              class="image-cell"
            >
              <img
                :src="media.thumbnailV1 || media.thumbnailV2"
                class="thumb-img"
                @click="showActionSheetByIdentifier(media.id)"
                @mousedown.right.prevent="toggleSelection(media.id)"
                @contextmenu.prevent
              />
            </ion-col>
          </ion-row>
        </ion-grid>
      </div>
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
  IonCol,
  IonGrid,
  IonRow,
  modalController,
  toastController
} from '@ionic/vue';
import { ref, getCurrentInstance } from 'vue';
import { GalleryDuplicateService } from '@/implements/GalleryDuplicateService';
import StorageService from '@/implements/StorageService';
import { MediaDO } from '@/components/models';
import { GalleryPlus, MediaItem } from 'capacitor-gallery-plus';
import MediaInfoModalComponent from '../components/MediaInfoModalComponent.vue';
import Lock from '@/lock';
import { Capacitor } from '@capacitor/core';

export default {
  name: 'SettingsPage',
  components: {
    IonPage,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonCol,
    IonGrid,
    IonRow,
    MediaInfoModalComponent
  },
  setup() {
    const appInstance = getCurrentInstance();
    const storageServ: StorageService = appInstance?.appContext.config.globalProperties.$storageServ;
    const galleryDuplicateServ: GalleryDuplicateService = appInstance?.appContext.config.globalProperties.$galleryDuplicateServ;
    const duplicateGroups = ref<MediaItem[][]>([]);
    const selectedIds = ref<string[]>([]);

    async function deleteSelected() {
      try {
        const result = await GalleryPlus.deleteMediaByManyId({ ids: selectedIds.value });
        selectedIds.value = [];

        // delete selected items from duplicateGroups which not in result.failedIds
        duplicateGroups.value = duplicateGroups.value.map(group => {
          return group.filter(media => !result.failedIds.includes(media.id));
        });

        // throw error if any id in failedIds
        if(result.failedIds.length > 0) {
          throw new Error(`Failed to delete: ${result.failedIds.join(', ')}`);
        }

        // Refresh logic here if needed
      } catch (error: any) {
        toastController.create({
          message: error.message,
          duration: 2000,
          color: 'danger'
        }).then(toast => toast.present());
      }
    }

    function toggleSelection(id: string) {
      if (selectedIds.value.includes(id)) {
        selectedIds.value = selectedIds.value.filter(el => el !== id);
      } else {
        selectedIds.value.push(id);
      }
    }

    return {
      modalController,
      duplicateGroups,
      storageServ,
      galleryDuplicateServ,
      selectedIds,
      deleteSelected,
      toggleSelection
    };
  },
  data() {
    return {
      onceLock: new Lock()
    };
  },
  watch: {
    "$route.path": async function (newVal, oldVal) {
      if (newVal !== oldVal && newVal === "/tabs/tab3") {
        try {
          const groups: string[][] = this.galleryDuplicateServ.getDuplicateGroups();
          const result: MediaItem[][] = [];
          for (const group of groups) {
            const items = await GalleryPlus.getMediaListByManyId({
              ids: group,
              includeBaseColor: true,
              includeDetails: true
            });
            items.media.forEach((item) => {
              item.thumbnailV1 = Capacitor.convertFileSrc(item.thumbnailV1 || '');
            });
            result.push(items.media);
          }
          this.duplicateGroups = result;
        } catch (error: any) {
          toastController.create({
            message: error.message,
            duration: 2000,
            color: 'danger'
          }).then(toast => toast.present());
        } finally {
          console.log(this.duplicateGroups);
        }
      }
    }
  },
  methods: {
    async showActionSheetByIdentifier(identifier: string) {
      const fullMedia = await GalleryPlus.getMedia({
        id: identifier,
        includeBaseColor: true,
        includeDetails: true,
        includePath: true,
      });
      const mediaDO = await this.storageServ.getMediaByIdentifier(identifier);
      const mediaMetadata = await this.storageServ.getMediaMetadataById(identifier);
      const cats = await this.storageServ.getMediaTagNamesByIdentifier(identifier);

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
    getSimilarityPercentage(hammingDistance: number): number {
      return 100 - (hammingDistance / 5) * 30;
    }
  }
};
</script>

<style scoped>
.thumb-img {
  width: 100px;
  height: 100px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.group-section {
  margin-bottom: 32px;
  padding: 8px;
  border-bottom: 1px solid #ccc;
}
</style>
