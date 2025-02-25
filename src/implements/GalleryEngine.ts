import { registerPlugin } from '@capacitor/core';

const GalleryEngine = registerPlugin('GalleryEngine');

class GalleryEngineService {
    async loadTensorFromBytes(tensorBytes: ArrayBuffer): Promise<void> {
        try {
            const base64Tensor = this.arrayBufferToBase64(tensorBytes);
            await GalleryEngine.loadTensorFromBytes({ tensorBytes: base64Tensor });
            console.log('Tensor loaded successfully');
        } catch (error) {
            console.error('Error loading tensor:', error);
        }
    }

    async calculateCosineSimilarity(inputTensor: number[]): Promise<any> {
        try {
            const result = await GalleryEngine.calculateCosineSimilarity({ inputTensor });
            console.log('Cosine similarity result:', result);
            return result;
        } catch (error) {
            console.error('Error calculating cosine similarity:', error);
        }
    }

    private arrayBufferToBase64(buffer: ArrayBuffer): string {
        const binary = String.fromCharCode.apply(null, new Uint8Array(buffer));
        return window.btoa(binary);
    }
}

export { GalleryEngineService };