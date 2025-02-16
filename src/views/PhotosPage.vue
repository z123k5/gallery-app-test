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
          <ion-title size="large">Photo Gallery</ion-title>
        </ion-toolbar>
      </ion-header>

      <!-- 自动隐藏的搜索框 -->
      <ion-searchbar v-if="showSearchBar"></ion-searchbar>
      <br />

      <p>Thumbnails</p>
      <ion-button @click="MakeMediaData"> Generate 25 Images </ion-button>
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

      <p> zoom: {{ colSize }} </p>
      <ion-button @click="zoomIn"> Zoom in </ion-button>
      <ion-button @click="zoomOut"> Zoom out </ion-button>

      <div v-if="highQualityPath">
        <img alt="High Quality" :src="highQualityPath" />
      </div>

      <ion-grid>
        <ion-row>
          <ion-col :size="colSize" v-for="media in medias" :key="media">
            <ion-img :src="media.data" @click="showActionSheet(media.identifier)" />
            <div v-if="media.duration"
              style="position: absolute; bottom: 5px; left: 5px; color: white; background-color: rgba(0, 0, 0, 0.5); padding: 2px 5px; border-radius: 3px; font-size: 10px">
              {{ Math.round(media.duration) }} s
            </div>
          </ion-col>
        </ion-row>
      </ion-grid>

      <ion-fab vertical="bottom" horizontal="end" slot="fixed">
        <ion-fab-button @click="takePhotoAction()">
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
  IonButton,
  IonIcon,
  IonToolbar,
  IonTitle,
  IonContent,
  IonGrid,
  IonRow,
  IonCol,
  IonImg,
  IonSearchbar,

  toastController,
} from '@ionic/vue';
import { ref, onMounted, onUnmounted, Ref, watch } from 'vue';
import { Camera, CameraResultType, CameraSource, Photo } from "@capacitor/camera";
import { Media, MediaAsset, MediaSaveOptions } from "@capacitor-community/media";
import { Capacitor, CapacitorException } from "@capacitor/core";
import { createGesture } from '@ionic/vue';
import CryptoJS from 'crypto-js';
import * as jdenticon from 'jdenticon';

// Local Database
import { CapacitorSQLite } from '@capacitor-community/sqlite';

const db = new CapacitorSQLite();



export default {
  components: { IonPage, IonHeader, IonFab, IonFabButton, IonButton, IonIcon, IonToolbar, IonTitle, IonContent, IonGrid, IonRow, IonCol, IonImg, IonSearchbar },
  emits: ['onClick'],
  setup() {
    // const colSize = ref(6);

    const gesture = createGesture({
      el: document.body,
      gestureName: 'scale',
      threshold: 0,
      onMove: (ev) => {
        // if (ev.scale > 1) {
        //   // 放大手势
        //   if (colSize.value < 24) {
        //     colSize.value += 3;
        //   }
        // } else if (ev.scale < 1) {
        //   // 缩小手势
        //   if (colSize.value > 3) {
        //     colSize.value -= 3;
        //   }
        // }
      },
    });
    return {
      camera
    }
  },
  data(): { medias: MediaAsset[]; highQualityPath?: string; showSearchBar: boolean, photos: Photo[], colSize: number } {
    return {
      medias: [], // 存储所有媒体
      photos: [],
      highQualityPath: undefined, // 高质量图像路径
      showSearchBar: true,
      colSize: 6,
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
    generateBase64Identicon(hash : string) {
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
        const canvas = this.$refs.identiconCanvas;

        var duration = undefined;
        if (i > 15)
          duration = Math.floor(Math.random() * 10) * 1000;
        
        this.medias.push({
          identifier: `${i}`,
          data: this.generateBase64Identicon(hash),
          creationDate: new Date().toISOString(),
          duration: duration,
          fullWidth: 100,
          fullHeight: 100,
          thumbnailWidth: 100,
          thumbnailHeight: 100,
          location: {
            latitude: 0,
            longitude: 0,
            altitude: 0,
            heading: 0,
            speed: 0,
          },
        }
        )
      }
    },
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

    async ensureDemoAlbum() {
      const { albums } = await Media.getAlbums();
      let demoAlbum = undefined;
      if (Capacitor.getPlatform() === "android") {
        const albumsPath = (await Media.getAlbumsPath()).path
        demoAlbum = albums.find(a => a.name === "Media Demo Album" && a.identifier.startsWith(albumsPath));
        console.log(demoAlbum);
      } else {
        demoAlbum = albums.find(a => a.name === "Media Demo Album");
      }

      if (!demoAlbum) {
        throw new Error("Demo album does not exist");
      }

      return demoAlbum.identifier;
    },

    /**
     * Actions
     */

    async takePhotoAction() {
      // show toast message
      const toast = await toastController.create({
        message: 'Taking photo...',
        duration: 2000,
      });

      const image = await Camera.getPhoto({
        resultType: CameraResultType.Uri
      });

      try {
        let opts: MediaSaveOptions = { path: image.path!, albumIdentifier: await this.ensureDemoAlbum() };
        var photoResponse = await Media.savePhoto(opts);

        var nowDate = new Date();

        await this.getMedias();

        toastController.create({
          message: "照片成功存入相册",
          duration: 2000,
        }).then((toast) => { toast.present(); })

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

    async showActionSheet(name: string) {
      // show toast message media name
      toastController.create({
        message: name,
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
    zoomIn() {
      this.colSize += 3;
    },

    zoomOut() {
      this.colSize -= 3;
    },
  }
};

/**
 * Gallery Funtions
 */
// 初始化数据库
async function initDB() {
  try {
    await db.createConnection({
      database: 'medias.db',
      version: 1,
      encrypted: false,
      mode: 'default',
    });

    // 创建表格
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS uploads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        uploaded INTEGER DEFAULT 0
        calculated INTEGER DEFAULT 0
        feature_vector INTEGER DEFAULT 0
      );
    `;
    await db.executeSql(createTableQuery);
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

// 插入文件上传记录
async function insertFile(filename) {
  const query = 'INSERT INTO uploads (filename, uploaded) VALUES (?, ?)';
  await db.executeSql(query, [filename, 0]); // 0 表示未上传
}

// 更新文件的上传状态
async function markAsUploaded(filename) {
  const query = 'UPDATE uploads SET uploaded = 1 WHERE filename = ?';
  await db.executeSql(query, [filename]); // 1 表示已上传
}

// 获取未上传的文件列表
async function getPendingUploads() {
  const query = 'SELECT * FROM uploads WHERE uploaded = 0';
  const result = await db.executeSql(query);
  return result.rows;
}

// 获取所有文件上传状态
async function getAllUploads() {
  const query = 'SELECT * FROM uploads';
  const result = await db.executeSql(query);
  return result.rows;
}


</script>

<!-- <style scoped> -->
.photo-img {
width: 100%;
height: auto;
border-radius: 8px;
}
<!-- </style> -->