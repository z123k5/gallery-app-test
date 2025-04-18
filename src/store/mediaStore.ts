// src/stores/mediaStore.ts
import { defineStore } from 'pinia';
import { MediaItem } from 'capacitor-gallery-plus'

export const useMediaStore = defineStore('media', {
    state: () => ({
        medias: [] as MediaItem[],
    }),
    actions: {
        setMedias(medias: MediaItem[]) {
            this.medias = medias;
        },
    },
});