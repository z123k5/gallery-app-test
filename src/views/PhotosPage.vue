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

      <!-- 自动隐藏的搜索框 -->
      <ion-searchbar v-if="showSearchBar"></ion-searchbar>
      <br />

      <p>Thumbnails</p>
      <ion-button @click="MakeMediaData"> Generate 25 Images </ion-button>

      <p> zoom: {{ scale }} </p>

      <div v-if="highQualityPath">
        <img alt="High Quality" :src="highQualityPath" />
      </div>

      <div id="photo-wall" class="photo-wall">
        <div v-for="media in medias" :key="media.id" class="photo-item" @click="showActionSheet(media)"
          :style="{ backgroundImage: 'url(' + media.thumbnail + ')' }">
          <div v-if="media.type === 'video'"
            style="position: absolute; bottom: 5px; left: 5px; color: white; background-color: rgba(0, 0, 0, 0.5); padding: 2px 5px; border-radius: 3px; font-size: 10px">
            <ion-icon :icon="videocam"></ion-icon>
          </div>
        </div>
      </div>

      <!-- <ion-grid>
        <ion-row>
          <ion-col :size="colSize" v-for="media in medias" :key="media">

            <ion-img :src="media.thumbnail" @click="showActionSheet(media)" accept="image/*" />
            <div v-if="media.type === 'video'"
              style="position: absolute; bottom: 5px; left: 5px; color: white; background-color: rgba(0, 0, 0, 0.5); padding: 2px 5px; border-radius: 3px; font-size: 10px">
              <ion-icon :icon="videocam"></ion-icon>
            </div>
          </ion-col>
        </ion-row>
      </ion-grid> -->

      <ion-fab vertical="bottom" horizontal="end" slot="fixed">
        <ion-fab-button @click="takePhotoAction()">
          <ion-icon :icon="camera"></ion-icon>
        </ion-fab-button>
      </ion-fab>

      <ion-fab vertical="bottom" horizontal="start" slot="fixed">
        <ion-fab-button @click="getMedia()">
          <ion-icon :icon="images"></ion-icon>
        </ion-fab-button>
      </ion-fab>

    </ion-content>
  </ion-page>
</template>


<script lang="ts">
import { camera, videocam, images } from 'ionicons/icons';
import {
  IonPage,
  IonHeader,
  IonFab,
  IonFabButton,
  IonButton,
  IonIcon,
  IonToolbar,
  IonTitle,
  IonContent,
  // IonGrid,
  // IonRow,
  // IonCol,
  // IonImg,
  IonSearchbar,
  toastController,
  // IonThumbnail,
  // GestureDetail,
} from '@ionic/vue';
import { ref, getCurrentInstance, computed } from 'vue';
import { Camera, CameraResultType, CameraSource, Photo } from "@capacitor/camera";
// import { Media, MediaAsset, MediaSaveOptions } from "@capacitor-community/media";
import { GalleryPlus, MediaItem } from 'capacitor-gallery-plus';
import { Media } from '@capacitor-community/media'
import { CapacitorException } from "@capacitor/core";
import CryptoJS from 'crypto-js';
import * as jdenticon from 'jdenticon';

// Local Database
import { UserDO } from '@/components/models';
import StorageService from '@/implements/StorageService';

export default {
  components: { IonPage, IonHeader, IonFab, IonFabButton, IonButton, IonIcon, IonToolbar, IonTitle, IonContent, IonSearchbar },
  emits: ['onClick'],
  setup() {
    const appInstance = getCurrentInstance();
    const sqliteServ = appInstance?.appContext.config.globalProperties.$sqliteServ;
    const storageServ : StorageService = appInstance?.appContext.config.globalProperties.$storageServ;

    const dbNameRef = ref('');
    const isInitComplete = ref(false);
    const isDatabase = ref(false);
    const users = ref<UserDO[]>([]);

    const db = ref(null);
    const dbInitialized = computed(() => !!db.value);
    const platform = sqliteServ.getPlatform();





    console.log('ok');

    // Open Database
    const openDatabase = async () => {
      try {
        const dbUsersName = storageServ.getDatabaseName();
        dbNameRef.value = dbUsersName;
        const version = storageServ.getDatabaseVersion();

        const database = await sqliteServ.openDatabase(dbUsersName, version, false);
        db.value = database;
        isDatabase.value = true;
      } catch (error) {
        const msg = `Error open database: ${error}`;
        console.error(msg);
        toastController.create({
          message: msg,
          duration: 2000,
          cssClass: 'newline',
        }).then((toast) => { toast.present(); })
      }
    };

    return {
      camera, images, videocam,
      sqliteServ, storageServ, db, dbInitialized, platform, openDatabase,
      isInitComplete, dbNameRef, isDatabase, users
    }
  },
  mounted() {
    const initSubscription = this.storageServ.isInitCompleted.subscribe(async (value: boolean) => {
      this.isInitComplete = value;
      if (this.isInitComplete === true) {
        // const dbUsersName = this.storageServ.getDatabaseName();
        if (this.platform === "web") {
          customElements.whenDefined('jeep-sqlite').then(async () => {
            await this.openDatabase();
          }).catch((error) => {
            const msg = `Error open database: ${error}`;
            console.log(msg);
            toastController.create({
              message: msg,
              duration: 2000,
            }).then((toast) => { toast.present(); })
          });
        } else {
          await this.openDatabase();
        }
      }
    });

    // 添加触摸手势支持
    // let scale = 1;  // 缩放比例
    // let startDistance = 0;
    // const photoItems = document.querySelectorAll<HTMLElement>('.photo-item');
    const photoWall = document.getElementById('photo-wall');
    console.log(photoWall);
    if (photoWall) {
      console.log('event ok');

      // photoWall.addEventListener('touchstart', (e) => {
      //   console.log('touchstart');
      //   if (e.touches.length === 2) {
      //     startDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      //   }
      // });

      // photoWall.addEventListener('touchmove', (e) => {
      //   if (e.touches.length === 2) {
      //     const endDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      //     const scaleChange = startDistance / endDistance;
      //     this.scale *= 1 / scaleChange;
      //     startDistance = endDistance;
      //     updateLayout();
      //   }
      // });


      // const updateLayout = () => {
      //   console.log('updateLayout');
      //   if (this.scale < 1) {
      //     this.scale = 1;
      //   }

      //   if (this.scale > 10) {
      //     this.scale = 10;  // 限制最大放大比例
      //   }

      //   // 动态调整网格每行的列数
      //   const numColumns = Math.max(1, Math.floor(this.scale / 10)); // 根据缩放比例计算每行的列数
      //   photoWall.style.gridTemplateColumns = `repeat(${numColumns}, 1fr)`;  // 设置动态列数

      //   // 调整每个图片的大小
      //   photoItems.forEach(item => {
      //     item.style.transform = `scale(${this.scale})`;  // 图片缩放
      //   });
      // }

      // 可选：点击重置缩放比例
      // photoWall.addEventListener('click', () => {
      //   console.log('click');
      //   this.scale = 1;
      //   updateLayout();
      // });
    }
    // this.getMedia();
  },
  beforeMount() {
    this.sqliteServ.closeDatabase(this.dbNameRef, false)
      .then(() => {
        this.isDatabase = false;
      }).catch((error: any) => {
        const msg = `Error close database:
                            ${error.message ? error.message : error}`;
        console.error(msg);
        toastController.create({
          message: msg,
          duration: 2000,
        }).then((toast) => { toast.present(); })
      });
  },
  data(): { medias: MediaItem[]; highQualityPath?: string; showSearchBar: boolean, photos: Photo[], scale: number } {
    return {
      medias: [], // 存储所有媒体
      photos: [],
      highQualityPath: undefined, // 高质量图像路径
      showSearchBar: true,
      scale: 1,
    };
  },
  watch: {
    medias() {
      this.highQualityPath = undefined; // 当 medias 更新时，重置高质量路径
    },
  },
  methods: {

    /**
     * Media
     */
    // 根据哈希生成 Identicon 的 Base64 字符串
    generateBase64Identicon(hash: string) {
      // 创建一个 canvas 元素
      const canvas = document.createElement('canvas');

      // 使用 jdenticon 更新 canvas 内容
      jdenticon.update(canvas, hash);

      // 将 canvas 内容转换为 base64 字符串
      return canvas.toDataURL();
    },
    async MakeMediaData() {
      for (let i = 0; i < 25; i++) {
        // data: base64 encoded image data
        // 
        const hash = CryptoJS.MD5("key" + i).toString(CryptoJS.enc.Hex);

        const thumbnail = this.generateBase64Identicon(hash)
        this.medias.push({
          id: `fakeid-${i}`,
          type: 'image',
          createdAt: new Date().getMilliseconds(),
          baseColor: '#000000',
          name: `fake-image-${i}`,
          width: 100,
          height: 100,
          thumbnail: thumbnail,
          fileSize: thumbnail.length,
          // path: `fake-image-${i}`,
          mimeType: 'image/jpeg',
        }
        )
      }
      toastController.create({
        message: 'Media data created: ' + this.medias.length + "first is " + this.medias[0].thumbnail?.substring(0, 20),
        duration: 2000,
      }).then((toast) => { toast.present(); })
    },
    async getMedia() {
      if (this.platform == "android") {

        const result = (await Media.getMedias({})).medias;
        // Map MediaAsset[] to MediaItem[]
        this.medias = result.map((result) => {
          const mediaItem: MediaItem = {
            id: result.identifier,
            name: result.identifier,
            type: result.duration ? "video" : "image",
            createdAt: new Date(result.creationDate).getTime(),
            thumbnail: result.data,
            width: result.fullWidth,
            height: result.fullHeight,
            mimeType: result.duration ? "video/mp4" : "image/jpeg",
          };
          return mediaItem;
        });

      } else {
        const checkPermission = async () => {
          const permission = await GalleryPlus.checkPermissions();

          if (permission.status !== "granted") {
            const request = await GalleryPlus.requestPermissions();

            if (request.status !== "granted") {
              toastController.create({
                message: "Gallery Permission denied, please allow access.",
                duration: 5000
              }).then(toast => toast.present());
              console.error("Permission denied.");
            } else {
              toastController.create({
                message: "Gallery Permission granted.",
                duration: 2000
              }).then(toast => toast.present());
            }
          }
        }
        checkPermission();
        toastController.create({
          message: "Requesting Gallery Permission Done.",
          duration: 300
        }).then(toast => toast.present());
        try {
          this.medias = []
          const result = await GalleryPlus.getMediaList({
            limit: 25,
            thumbnailSize: 1024,
            sort: 'oldest',
            includeDetails: true,
          })
          this.medias = result.media

          for (const media of this.medias) {
            if (!media.thumbnail) {
              // const { base64 } = await this.readUriAsBlobImage(media.path)
              console.log('media.thumbnail is null: ');
              console.log(media);
              // media.thumbnail = base64
            }
          }
          toastController.create({
            message: "medias length: " + this.medias.length + " first is " + this.medias[0].thumbnail?.substring(0, 20),

            duration: 1000
          }).then(toast => toast.present());
        } catch (error) {
          toastController.create({
            message: 'Error retrieving media: ' + error,
            duration: 2000,
          }).then((toast) => { toast.present(); })
          console.error('Error retrieving media:', error)
        }
      }
    },

    /**
     * Actions
     */

    async readUriAsBlobImage(uri: string) {
      if (!uri) {
        return { base64: '', width: 0, height: 0 };
      }
      const response = await fetch(uri);
      const blob = await response.blob();

      return new Promise<{ base64: string; width: number; height: number }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            const img = new Image();
            img.onload = () => {
              resolve({
                base64: reader.result as string,
                width: img.width,
                height: img.height,
              });
            };
            img.onerror = () => reject(new Error('无法获取图片尺寸'));
            img.src = reader.result;
          } else {
            reject(new Error('无法获取 Base64 字符串'));
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    },

    async takePhotoAction() {
      // show toast message
      await toastController.create({
        message: 'Taking photo...',
        duration: 2000,
      }).then((toast) => toast.present());

      const image = await Camera.getPhoto({
        resultType: CameraResultType.Uri,
        saveToGallery: true,
        quality: 100,
        source: CameraSource.Prompt,
        promptLabelHeader: '选择来源',
        promptLabelPhoto: '从相册中选择',
        promptLabelPicture: '拍照',
        promptLabelCancel: '取消',
        // webUseInput: true,
        // allowEditing: true,
        // width: 100,
        // height: 100,
      });

      console.log(image)

      try {
        const { base64, width, height } = await this.readUriAsBlobImage(image.path ?? '');
        toastController.create({
          message: `width: ${width}, height: ${height}`,
          duration: 2000,
        }).then((toast) => { toast.present(); })
        this.medias = [...this.medias, {
          id: `captured-${image.webPath?.substring(image.webPath?.lastIndexOf('/') + 1)}`,
          type: 'image',
          createdAt: new Date().getMilliseconds(),
          baseColor: '#000000',
          name: `${image.webPath?.substring(image.webPath?.lastIndexOf('/') + 1)}.${image.format}`,
          width: width,
          height: height,
          thumbnail: base64,
          fileSize: image.base64String?.length,
          // path: image.path,
          mimeType: 'image/jpeg',
        }]
        // toastController.create({
        //   message: "照片成功存入相册",
        //   duration: 2000,
        // }).then((toast) => { toast.present(); })

      } catch (e: unknown) {
        // show toast message
        if (e instanceof CapacitorException) {
          toastController.create({
            message: "错误：" + e.message,
            duration: 2000,
          }).then((toast) => { toast.present(); })
        }
      }
    },

    async showActionSheet(media: MediaItem) {
      // show toast message media name
      toastController.create({
        message: `id: ${media.id}\n <br/>type: ${media.type}\nwidth: ${media.width}\nheight: ${media.height}\nfileSize: ${media.fileSize}\n`,
        duration: 2000,
      }).then((toast) => { toast.present(); })

      // handleScroll(event: any) {
      //   if (event.detail.scrollTop > 50) {
      //     this.showSearchBar = false;
      //   } else {
      //     this.showSearchBar = true;
      //   }
      // }
    },

    /**
     * UI
     */
    // zoomIn() {
    //   this.scale += 1.5;
    //   if (this.scale > 3) {
    //     this.scale = 3;  // 限制最大放大比例
    //   }
    // },

    // zoomOut() {
    //   this.scale -= 1.5;
    //   if (this.scale < 1) {
    //     this.scale = 1;  // 限制最大放大比例
    //   }
    // },
  }
};


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
  grid-template-columns: repeat(4, 1fr);
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