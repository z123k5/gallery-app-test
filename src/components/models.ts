export interface UserDO {
    id: number;
    name: string;
    email: string;
    active: number;
    token_expire: Date;
}

export interface MediaDO {
    identifier: string; // Media Identifier
    name: string | undefined;
    type: "image" | "video" | undefined;
    created_at: number;
    modified_at: number;
    thumbnailV1Path: string;
    thumbnailV2Path: string | undefined;
    source: string | undefined; // local gallery or cloud
    isDeleted: number | undefined;
    processInfo: number; // Process bits, binary, bit0: uploaded & featured & catgoried & metaData, bit1: phashed, bit2: uploading, bit3: not processable
    feature: Blob | undefined; // Feature
    phash: string | undefined;
}

export interface MediaMetaDataDO {
    media_id: string;
    timestamp: number;
    exif_lat: number | undefined;
    exif_lon: number | undefined;
    exif_dev: string | undefined;
    location: string | undefined;
}