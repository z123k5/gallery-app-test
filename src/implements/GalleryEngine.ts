import { GalleryEngine } from "capacitor-plugin-tflite-cosines-calc"


class GalleryEngineService {
    static async echo(value: string): Promise<string> {
        const result = GalleryEngine.echo({ value });
        return (await result).value;
    }
    static async loadTensorFromDB(): Promise<void> {
        console.log("loadTensorFromDB");
        await GalleryEngine.loadTensorFromDB({ emptyArg: 0 });
        console.log("loadTensorFromDB done");
    }

    static async offloadTensor(): Promise<void> {
        await GalleryEngine.offloadTensor({ emptyArg: 0 });
    }

    static async calculateCosineSimilarity(tensorArray: number[]): Promise<number[]> {
        const result = await GalleryEngine.calculateCosineSimilarity({ tensorArray: tensorArray });
        return result.prob;
    }
}

export { GalleryEngineService };