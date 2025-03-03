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
      <ion-searchbar :debounce="1000" :value="queryString" @keyup.enter="handleSearch($event)"
        placeholder="搜索图片"></ion-searchbar>
      <br />

      <p> Identicons Generate </p>
      <ion-button @click="MakeMediaData"> Generate 25 Images </ion-button>

      <p> Query All </p>
      <ion-button @click="QueryAll"> Query All </ion-button>

      <p> Photos & videos </p>

      <div id="photo-wall" class="photo-wall">
        <div v-for="media in visibleMedias" :key="media.id" class="photo-item" @click="showActionSheet(media)"
          oading="lazy" :style="{ backgroundImage: 'url(' + media.thumbnail + ')' }">
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
        <ion-fab-button>
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
  modalController,
  toastController,
  // IonThumbnail,
  // GestureDetail,
} from '@ionic/vue';
import { ref, getCurrentInstance, computed } from 'vue';
import { Camera, CameraResultType, CameraSource, Photo } from "@capacitor/camera";
import { GalleryPlus, MediaItem } from 'capacitor-gallery-plus';
import { Media } from '@capacitor-community/media'
import { Capacitor, CapacitorException, CapacitorCookies } from "@capacitor/core";
import CryptoJS from 'crypto-js';
import * as jdenticon from 'jdenticon';

// Local Database
import { UserDO } from '@/components/models';
import StorageService from '@/implements/StorageService';
import MediaInfoModalComponent from '../components/MediaInfoModalComponent.vue';
import Compressor from 'compressorjs';
import SQLiteService from '@/implements/SqliteService';
import { SQLiteDBConnection } from '@capacitor-community/sqlite';


// Plugin tflite cosines calc
import { GalleryEngineService } from '../implements/GalleryEngine';

export default {
  name: 'PhotosPage',
  components: { IonPage, IonHeader, IonFab, IonFabButton, IonButton, IonIcon, IonToolbar, IonTitle, IonContent, IonSearchbar },
  emits: ['onClick'],
  setup() {
    const appInstance = getCurrentInstance();
    const sqliteServ: SQLiteService = appInstance?.appContext.config.globalProperties.$sqliteServ;
    const storageServ: StorageService = appInstance?.appContext.config.globalProperties.$storageServ;
    const galleryEngineServ: GalleryEngineService = appInstance?.appContext.config.globalProperties.$galleryEngineServ;

    const dbNameRef = ref('');
    const isInitComplete = ref(false);
    const isDatabase = ref(false);
    const users = ref<UserDO[]>([]);

    const db = ref<SQLiteDBConnection | null>(null); // Initialize db as null
    const dbInitialized = computed(() => !!db.value);
    const platform = sqliteServ.getPlatform();

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
      galleryEngineServ, sqliteServ, storageServ, db, dbInitialized, platform, openDatabase,
      isInitComplete, dbNameRef, isDatabase, users
    }
  },
  computed: {
    visibleMedias() {
      if (this.displaySearchResult)
        // return this.searchMedias.filter(media => !media.isHidden);
        return this.searchMedias;
      else
        // return this.medias.filter(media => !media.isHidden);
        return this.medias;
    }
  },
  mounted() {
    this.getMedia().then(async () => {
      await this.saveMediaToDatabase();
      await this.uploadAndFetchCalculateResults();
      if (this.medias && this.medias.length > 0)
        await GalleryEngineService.loadTensorFromDB();
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  data(): { medias: MediaItem[]; searchMedias: MediaItem[]; displaySearchResult: boolean; queryString: string; highQualityPath?: string; showSearchBar: boolean, photos: Photo[], scale: number, serverUrl: string, databaseTensorShouldBeReload: boolean } {
    return {
      medias: [], // 存储所有媒体
      searchMedias: [], // 存储搜索结果
      displaySearchResult: false, // 是否显示搜索结果
      queryString: '', // 搜索关键字
      photos: [],
      highQualityPath: undefined, // 高质量图像路径
      showSearchBar: true,
      scale: 1,
      // serverUrl: 'https://10.12.80.224:8443',
      serverUrl: 'http://10.12.80.224:8443',
      databaseTensorShouldBeReload: false,
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
          isHidden: false,
        }
        )
      }

      // save to database
      await this.saveMediaToDatabase();

      // upload to server
      await this.uploadAndFetchCalculateResults();

      // Load Tensor
      await GalleryEngineService.loadTensorFromDB();

      toastController.create({
        message: 'Media data created: ' + this.medias.length + "first is " + this.medias[0].thumbnail?.substring(0, 20),
        duration: 2000,
      }).then((toast) => { toast.present(); })
    },

    // Async save to database
    async saveMediaToDatabase() {
      if (this.medias && this.medias.length === 0) {
        console.log('No need to save to DB, medias is empty');
        return;
      }
      for (const media of this.medias) {
        try {
          if (media.thumbnail) {
            const base64 = await this.readUriAsBlobImage(media.thumbnail as string)
            media.thumbnail = base64.base64
          } else {
            console.log('media.thumbnail is null: ');
            console.log(media);
          }
          await this.storageServ.addMedia({
            identifier: media.id,
            type: media.type,
            created_at: media.createdAt,
            name: media.name ?? 'undefined',
            thumbnail: media.thumbnail ?? 'undefined',
            processStep: 0,
            feature: new Blob,
          })
        } catch (error) {
          console.log('Error saving media:', error)
        }
      }
    },
    // Async upload to server and fetch calculate results to db
    async uploadAndFetchCalculateResults() {
      // Get token from cookie
      let token = this.getCookie('token');

      if (token === null) {
        token = await this.performLogin();
      } else {
        // check token
        const response = await fetch(`${this.serverUrl}/users/active`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        })

        if (response.status === 401) {
          // Token is invalid, perform login
          const token = await this.performLogin();
          if (token !== null) {
            this.setCookie('token', token);
          } else {
            toastController.create({
              message: 'Login failed',
              duration: 2000,
            }).then((toast) => { toast.present(); })
          }
        }
      }

      if (this.medias && this.medias.length === 0) {
        console.log('No need to upload, medias is empty');
        return;
      }

      // 逐个上传文件
      for (const media of this.medias) {
        let blob: Blob;
        const formData: FormData = new FormData();
        try {
          // query db, if in database and processStep is 2, skip
          const processStep: number | undefined = await this.storageServ.getMediaProcessStepByIndentifier(media.id);
          if (processStep === 2) {
            continue;
          }

          if (media.id.startsWith('fakeid')) {
            // base64 to blob image
            const blob = await fetch(media.thumbnail as string).then(r => r.blob());
            // fetch upload
            const formData = new FormData();
            formData.append("file", blob, "image.png");  // 传标准文件名

            const responseBin = await fetch(this.serverUrl + '/engine/resolve', {
              method: 'POST',
              headers: {
                'Authorization': 'Bearer ' + token,
                'Accept': 'application/octet-stream'  // 让服务器返回纯二进制
              },
              body: formData
            });

            if (responseBin.ok) {
              const encoded_data = (await responseBin.json())["feat"]
              // // 将其按字节转为uint8数组
              // const array = new Uint8Array(byteString.length);
              // for (let i = 0; i < byteString.length; i++) {
              //   array[i] = byteString.charCodeAt(i);
              // }
              // // 转为ArrayBuffer
              // const arrayBuffer = array.buffer;
              // // 存入数据库
              // console.log("Got Array Buffer, length = " + arrayBuffer.byteLength, arrayBuffer);
              // await this.storageServ.updateMediaByIdentifier(media.id, 2, arrayBuffer);





              const decodedData = atob(encoded_data);
              const arrayBuffer = new ArrayBuffer(decodedData.length);
              const uint8Array = new Uint8Array(arrayBuffer);
              // 将二进制数据填充到 Uint8Array
              for (let i = 0; i < decodedData.length; i++) {
                uint8Array[i] = decodedData.charCodeAt(i);
              }

              // const arrayBuffer = await responseBin.arrayBuffer();
              // console.log("Got Array Buffer, length = " + arrayBuffer.byteLength, arrayBuffer);

              // 存入数据库
              await this.storageServ.updateMediaByIdentifier(media.id, 2, arrayBuffer);
              // await this.sqliteServ.saveToLocalDisk(this.storageServ.getDatabaseName()); // TODO: not implemented on android
            } else {
              console.error('Error uploading media:', responseBin.statusText);
            }

          } else {
            const fullMedia = await GalleryPlus.getMedia({ id: media.id, includePath: true, includeBaseColor: false, includeDetails: false });

            const mediaWebSrc = Capacitor.convertFileSrc(fullMedia.path ?? "")
            console.log(mediaWebSrc);
            const response = await fetch(mediaWebSrc);
            blob = await response.blob();

            // 压缩文件
            new Compressor(blob, {
              quality: 0.8,
              maxWidth: 800,
              maxHeight: 800,
              convertTypes: ['image/jpeg'],
              success: async (result) => {
                formData.append("file", result, "image.png");

                await fetch(this.serverUrl + '/engine/resolve', {
                  method: 'POST',
                  headers: {
                    'Authorization': 'Bearer ' + token,
                  },
                  body: formData
                }).then(async (response: Response) => {
                  if (response.ok) {
                    const encoded_data = (await response.json())["feat"]
                    const decodedData = atob(encoded_data);
                    const arrayBuffer = new ArrayBuffer(decodedData.length);
                    const uint8Array = new Uint8Array(arrayBuffer);
                    // 将二进制数据填充到 Uint8Array
                    for (let i = 0; i < decodedData.length; i++) {
                      uint8Array[i] = decodedData.charCodeAt(i);
                    }
                    try {
                      await this.storageServ.updateMediaByIdentifier(media.id, 2, arrayBuffer);
                      console.log('updateMediaByIdentifier success');
                    } catch (error) {
                      console.error('Failed to save result to database:', error);
                    }

                    // 在所有数据处理完毕后统一保存到数据库
                    try {
                      // await this.sqliteServ.saveToStore(this.storageServ.getDatabaseName()); // TODO: delete
                      await this.sqliteServ.saveToLocalDisk(this.storageServ.getDatabaseName());
                      console.log('All data saved successfully');
                    } catch (error) {
                      console.error('Failed to save all data to database:', error);
                    }

                  } else {
                    console.error('Error uploading media:', response.statusText);
                    // 如果需要，可以在这里处理具体的错误码
                    if (response.status === 400) {
                      response.json().then(data => {
                        console.error('Server validation errors:', data);
                      });
                    }
                  }
                }).catch(error => {
                  console.error('Network error:', error);
                });
              },
              error: (err) => {
                console.error(`Error compressing file ${media.name}:`, err.message);
              },
            });
          }
        } catch (err: any) {
          console.error(`Error fetching file ${media.name}:`, err.message);
        }
      }
    },

    async getMedia() {
      const imagesUris = [
        './temp/_DSC2035.JPG',
        './temp/_DSC2056.JPG',
        './temp/_DSC2807.JPG',
        './temp/_DSC2808.JPG',
        './temp/_DSC2809.JPG',
        './temp/_DSC2845.JPG',
        './temp/_DSC2848.JPG',
        './temp/_DSC2851.JPG',
        './temp/_DSC2852.JPG',
        './temp/_DSC2857.JPG',
      ]
      this.medias = []
      if (this.platform == "android") {
        // from database
        const resultdb = await this.storageServ.getMedias();
        resultdb.forEach(async (media) => {
          this.medias.push({
            id: media.identifier,
            type: media.type,
            createdAt: media.created_at,
            baseColor: '#000000',
            name: media.name,
            width: 100,
            height: 100,
            thumbnail: media.thumbnail,
            fileSize: media.thumbnail.length,
            // path: `fake-image-${i}`,
            mimeType: 'image/jpeg',
            isHidden: false,
          }
          )
        });
        if (this.medias.length > 0) {
          return;
        }

        // If Empty, load photo by fetch from public/temp/*.JPG
        this.medias = (await Promise.all(imagesUris.map(url => fetch(url)
          .then(response => response.blob())
          .then(blob => new Promise((resolve, reject) => {
            new Compressor(blob, {
              quality: 0.8, // 压缩质量
              width: 200,
              height: 200,
              convertTypes: ['image/jpeg'],
              success(result) {
                resolve(URL.createObjectURL(result));
              },
              error(err) {
                console.log(err.message);
                reject(err);
              },
            });
          })))) as string[]
        ).map((img, index) => ({
          id: `fakeid-${index}`,
          type: 'image',
          createdAt: new Date().getMilliseconds(),
          thumbnail: img,
          baseColor: '#000000',
          name: `fake-image-${index}`,
          width: 100,
          height: 100,
          fileSize: img.length,
          mimeType: 'image/jpeg',
        }));



        // TODO: Not Implemented
        // const result = (await Media.getMedias({})).medias;
        // // Map MediaAsset[] to MediaItem[]
        // this.medias = result.map((result) => {
        //   const mediaItem: MediaItem = {
        //     id: result.identifier,
        //     name: result.identifier,
        //     type: result.duration ? "video" : "image",
        //     createdAt: new Date(result.creationDate).getTime(),
        //     thumbnail: result.data,
        //     width: result.fullWidth,
        //     height: result.fullHeight,
        //     mimeType: result.duration ? "video/mp4" : "image/jpeg",
        //   };
        //   return mediaItem;
        // });

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
            limit: 200,
            type: 'all',
            thumbnailSize: 200,
            sort: 'newest',
            includeDetails: true, // TODO: edit
            includeBaseColor: false,
          })
          this.medias = result.media


          for (const media of this.medias) {
            if (media.name === undefined) {
              media.name = media.id;
            }
            if (media.thumbnail) {
              media.thumbnail = Capacitor.convertFileSrc(media.thumbnail as string)
            } else {
              // const { base64 } = await this.readUriAsBlobImage(media.path)
              console.log('media.thumbnail is null: ');
              console.log(media);
              // media.thumbnail = base64
            }
          }

          // store to database
          for (const media of this.medias) {
            try {
              await this.storageServ.addMedia({
                identifier: media.id,
                type: media.type,
                created_at: media.createdAt,
                name: media.name!,
                thumbnail: media.thumbnail!,
                processStep: 0,
                feature: new Blob,
              })
            } catch (error) {
              console.log('Error saving media:', error)
            }
          }
        } catch (error) {
          toastController.create({
            message: 'Error retrieving media: ' + error,
            duration: 2000,
          }).then((toast) => { toast.present(); })
          console.error('Error retrieving media:', error)
        }
      }
    },

    async QueryAll() {
      const result = await this.storageServ.getMedias();
      console.log(result);
      toastController.create({
        message: 'Query all media: ' + this.medias.length,
        duration: 2000,
      }).then((toast) => { toast.present(); })
    },

    /**
     * Browser
     */
    getCookies() {
      return document.cookie;
    },
    getCookie(key: string) {
      const cookies = document.cookie.split(';');
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        if (cookie.startsWith(key + '=')) {
          return cookie.substring(key.length + 1);
        }
      }
      return null;
    },
    setCookie(key: string, value: string) {
      document.cookie = key + '=' + value;
    },
    async deleteCookie(key: string) {
      const url = this.serverUrl;
      await CapacitorCookies.deleteCookie({
        url: url,
        key: key
      });
    },
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

    /**
     * Actions
     */
    async performLogin(): Promise<string> {
      try {
        const formData = new URLSearchParams();
        formData.append('username', 'admin');
        formData.append('password', 'admin');
        const response = await fetch(this.serverUrl + '/users/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData
        });
        const data = await response.json();
        return data.access_token;
      } catch (error) {
        console.error('Error:', error);
        return '';
      }
    },

    async readUriAsBlobImage(uri: string) {
      if (!uri) {
        return { base64: '', width: 0, height: 0 };
      }

      if (this.platform === 'android') {
        // In Android ,fetch file is not available

      }

      const response = await fetch(uri)
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

    async handleSearch(event: any) {
      // 1. fetch server /engine/query
      // 2. get feature from server
      // 3. calculate the cosine similarity
      // 4. show the result

      // /users/active
      if (this.databaseTensorShouldBeReload) {
        await GalleryEngineService.loadTensorFromDB();
        this.databaseTensorShouldBeReload = false;
      }
      try {
        const response = await fetch(`${this.serverUrl}/users/active`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.getCookie('token')}`,
          },
        });

        if (response.status === 401) {
          // Token is invalid, perform login
          const token = await this.performLogin();
          if (token !== null) {
            this.setCookie('token', token);
          } else {
            toastController.create({
              message: 'Login failed',
              duration: 2000,
            }).then((toast) => { toast.present(); })
          }
        }
      } catch (error) {
        console.log(error);
      }

      try {
        if (event.target.value === "") {
          this.displaySearchResult = false;
          return;
        } else {
          this.displaySearchResult = true;
        }
        const response = await fetch(`${this.serverUrl}/engine/query?query=${encodeURIComponent(event.target.value)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + this.getCookie('token'),
            'X-Requested-With': 'XMLHttpRequest',
          },
        })

        const contentType = response.headers.get('Content-Type');
        if (contentType === 'application/octet-stream') {
          response.arrayBuffer().then(async (arrayBuffer) => {
            console.log("Got Array Buffer, length = " + arrayBuffer.byteLength);

            // ✅ 转换 `ArrayBuffer` 为 `Uint8Array`
            const float32Array = new Float32Array(arrayBuffer);

            // ✅ 转换为 JS 数组（否则 Capacitor 不支持）
            const tensorArray = Array.from(float32Array);

            const prob = await GalleryEngineService.calculateCosineSimilarity(tensorArray)

            // TODO: show the result
            // resultType: [1,0,0,0,0,0,0,...]
            // invisiblize the img which corelation is less than 0.8
            // for a turple, the first is the prob, the second is the image

            // 方法一：小于0.6的隐藏
            // this.medias = this.medias.map((media, index) => {
            //   if (prob[index] < 0.6) {
            //     media.isHidden = true;
            //   } else {
            //     media.isHidden = false;
            //   }
            //   return media;
            // });
            console.log(prob);

            // 方法二：将medias和prob看成整体，按照prob对应的大小、位置降序排序，取前五个设置isHidden为false，其余为true
            const probWithIndex = prob.map((value, index) => ({ value, index }));
            probWithIndex.sort((a, b) => b.value - a.value);
            console.log(probWithIndex);
            this.searchMedias = [];
            const right = Math.min(5, probWithIndex.length);
            probWithIndex.slice(0, right).forEach((item) => {
              this.searchMedias.push(this.medias[item.index]);
            });

            console.log(this.searchMedias);


          });
        }
      } catch (error) {
        console.error('Error:', error);
      }
    },

    async showActionSheet(media: MediaItem) {
      // show toast message media name
      // toastController.create({
      //   message: `id: ${media.id}\n <br/>type: ${media.type}\nwidth: ${media.width}\nheight: ${media.height}\nfileSize: ${media.fileSize}\n`,
      //   duration: 2000,
      // }).then((toast) => { toast.present(); })

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

      // handleScroll(event: any) {
      //   if (event.detail.scrollTop > 50) {
      //     this.showSearchBar = false;
      //   } else {
      //     this.showSearchBar = true;
      //   }
      // }
    }
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