<template>
  <ion-app>
    <ion-router-outlet />
  </ion-app>
</template>

<script setup lang="ts">
import { IonApp, IonRouterOutlet } from '@ionic/vue';

</script>



<!-- 2025-05-20 should insert into definition.ts file in capacitor-gallery-plus  project -->
    <!-- /**
     * Deletes media items by their IDs.
     *
     * @param {DeleteMediaOptions} options - The options for deleting media.
     * @returns {Promise<void>} A promise that resolves when the deletion is complete.
     */
    deleteMediaByManyId(options: {
        ids: string[];
    }): Promise<{
        deletedCount: number;
        failedIds: string[];
    }>; -->