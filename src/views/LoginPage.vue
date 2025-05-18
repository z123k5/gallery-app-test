<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>登录</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="login-container">
        <!-- 登录卡片 -->
        <ion-card v-if="!showRegister">
          <ion-card-header>
            <ion-card-title>欢迎登录GalleryApp</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-item>
              <ion-label position="stacked">用户名</ion-label>
              <ion-input type="text" v-model="username"></ion-input>
            </ion-item>
            <ion-item>
              <ion-label position="stacked">密码</ion-label>
              <ion-input type="password" v-model="password"></ion-input>
            </ion-item>
            <ion-button expand="full" fill="clear" @click="forgetPassword">
              忘记密码
            </ion-button>
            <ion-button expand="block" @click="login">登录</ion-button>
            <!-- 切换到注册 -->
            <ion-button expand="block" color="secondary" @click="showRegister = true">
              注册
            </ion-button>
          </ion-card-content>
        </ion-card>

        <!-- 注册卡片 -->
        <ion-card v-else>
          <ion-card-header>
            <ion-card-title>注册新账户</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-item>
              <ion-label position="stacked">用户名</ion-label>
              <ion-input type="text" v-model="username"></ion-input>
            </ion-item>
            <ion-item>
              <ion-label position="stacked">邮箱</ion-label>
              <ion-input type="email" v-model="email"></ion-input>
            </ion-item>
            <ion-item>
              <ion-label position="stacked">密码</ion-label>
              <ion-input type="password" v-model="password"></ion-input>
            </ion-item>
            <ion-button expand="block" @click="registerUser">注册</ion-button>
            <ion-button expand="block" fill="clear" @click="showRegister = false">
              返回登录
            </ion-button>
          </ion-card-content>
        </ion-card>
      </div>
    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import {
  CapacitorCookies
} from '@capacitor/core';
import {
  IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonContent, IonHeader,
  IonInput, IonItem, IonLabel, IonPage, IonTitle, IonToolbar, toastController
} from '@ionic/vue';

export default {
  name: 'LoginPage',
  components: {
    IonPage,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonLabel,
    IonInput,
    IonButton
  },
  data() {
    return {
      serverUrl: 'http://172.20.10.5:8443',
      username: '',
      password: '',
      email: '',
      showRegister: false
    };
  },
  created() {
    this.isActive().then(isActive => {
      if (isActive) {
        this.$router.push('/tabs/tab2');
      } else {
        this.deleteCookie('token');
      }
    });
  },
  methods: {
    async isActive() {
      try {
        const response = await fetch(`${this.serverUrl}/users/active`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.getCookie('token')}`
          },
        });
        if (response.status === 200) {
          return true;
        }
        if (response.status === 401) {
          return false;
        }
      } catch (error) {
        console.log(error);
      }
      return false;
    },
    async login() {
      if (!this.username || !this.password) {
        toastController.create({
          message: '请输入用户名和密码',
          duration: 2000,
          position: 'top',
          color: 'danger'
        }).then(toast => toast.present());
        return;
      }
      try {
        const formData = new URLSearchParams();
        formData.append('username', this.username);
        formData.append('password', this.password);
        const response = await fetch(this.serverUrl + '/users/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData
        });
        const data = await response.json();
        if (response.status !== 200 || !data.access_token) {
          toastController.create({
            message: '登录失败，' + (data.detail || '服务器错误'),
            duration: 2000,
            position: 'top',
            color: 'danger'
          }).then(toast => toast.present());
          return;
        }
        this.setCookie('token', data.access_token);
        toastController.create({
          message: '登录成功',
          duration: 2000,
          position: 'top',
          color: 'success'
        }).then(toast => toast.present());
        this.$router.push('/tabs/tab2');
      } catch (error) {
        toastController.create({
          message: '登录失败，请稍后再试',
          duration: 2000,
          position: 'top',
          color: 'danger'
        }).then(toast => toast.present());
      }
    },
    async forgetPassword() {
      toastController.create({
        message: '请联系管理员重置密码',
        duration: 2000,
        position: 'top',
        color: 'warning'
      }).then(toast => toast.present());
    },
    async registerUser() {
      if (!this.username || !this.password || !this.email) {
        toastController.create({
          message: '请输入用户名、邮箱和密码',
          duration: 2000,
          position: 'top',
          color: 'danger'
        }).then(toast => toast.present());
        return;
      }
      try {
        const formData = new URLSearchParams();
        formData.append('username', this.username);
        formData.append('email', this.email);
        formData.append('password', this.password);
        const response = await fetch(this.serverUrl + '/users/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData
        });
        const data = await response.json();
        if (response.status !== 200) {
          toastController.create({
            message: '注册失败，' + (data.detail || '请稍后再试'),
            duration: 2000,
            position: 'top',
            color: 'danger'
          }).then(toast => toast.present());
          return;
        }
        toastController.create({
          message: '注册成功，请登录',
          duration: 2000,
          position: 'top',
          color: 'success'
        }).then(toast => toast.present());
        this.showRegister = false;
      } catch (error) {
        toastController.create({
          message: '注册失败，请稍后再试',
          duration: 2000,
          position: 'top',
          color: 'danger'
        }).then(toast => toast.present());
      }
    },
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
        url,
        key
      });
    },
  }
};
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  position: relative;
  background-image: url('https://t.alcy.cc/mp');
  background-size: cover;
  background-position: center;
}
ion-card-title {
  color: rgba(0, 0, 0, 0.5);
}
.login-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(255, 255, 255, 0.5);
  z-index: 1;
}
ion-card {
  width: 90%;
  max-width: 400px;
  position: relative;
  background-color: rgba(255, 255, 255, 0.5);
  z-index: 2;
}
ion-card-title {
  font-size: 24px;
  font-weight: bold;
  text-align: center;
}
ion-item {
  background-color: rgba(255, 255, 255, 0.5);
}
ion-button {
  margin-top: 16px;
}
ion-button[fill="clear"] {
  margin-bottom: 16px;
  color: #007aff;
}
</style>
