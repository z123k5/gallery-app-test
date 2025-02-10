import { ref, onMounted, onUnmounted, Ref, watch } from 'vue';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';

export interface Photo {
    filepath: string;
    webviewPath?: string;
}

export const usePhotoGallery = () => {
    const photos = ref<Photo[]>([]);

    const takePhoto = async () => {
        const photo = await Camera.getPhoto({
            resultType: CameraResultType.Uri,
            source: CameraSource.Camera,
            quality: 100,
        });
        
        const fileName = new Date().getTime() + '.jpeg';
        const savedFileImage = {
            filepath: fileName,
            webviewPath: photo.webPath
        };

        photos.value = [savedFileImage, ...photos.value];
    }
    
    
    return {
        takePhoto, photos
    }
}