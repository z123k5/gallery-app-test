import { createApp } from 'vue'
import App from './App.vue'
import router from './router';

import { IonicVue } from '@ionic/vue';

/* Core CSS required for Ionic components to work properly */
import '@ionic/vue/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/vue/css/normalize.css';
import '@ionic/vue/css/structure.css';
import '@ionic/vue/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/vue/css/padding.css';
import '@ionic/vue/css/float-elements.css';
import '@ionic/vue/css/text-alignment.css';
import '@ionic/vue/css/text-transformation.css';
import '@ionic/vue/css/flex-utils.css';
import '@ionic/vue/css/display.css';

/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

/* @import '@ionic/vue/css/palettes/dark.always.css'; */
/* @import '@ionic/vue/css/palettes/dark.class.css'; */
import '@ionic/vue/css/palettes/dark.system.css';

/* Theme variables */
import './theme/variables.css';

import { defineCustomElements } from '@ionic/pwa-elements/loader';
import { Capacitor } from '@capacitor/core';
import SqliteService from './implements/SqliteService';
import DbVersionService from './implements/dbVersionService';
import StorageService from './implements/StorageService';
import InitializeAppService from './implements/initializeAppService';
defineCustomElements(window);


const app = createApp(App)
  .use(IonicVue)
  .use(router);

router.isReady().then(() => {
  app.mount('#app');
});

export const platform = Capacitor.getPlatform();
// Set the platform as global properties on the app
app.config.globalProperties.$platform = platform;
// Define and instantiate the required services
const sqliteServ = new SqliteService();
const dbVersionServ = new DbVersionService();
const storageServ = new StorageService(sqliteServ, dbVersionServ);
// Set the services as global properties on the app
app.config.globalProperties.$sqliteServ = sqliteServ;
app.config.globalProperties.$dbVersionServ = dbVersionServ;
app.config.globalProperties.$storageServ = storageServ;
//Define and instantiate the InitializeAppService
const initAppServ = new InitializeAppService(sqliteServ, storageServ);
