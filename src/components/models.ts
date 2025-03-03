export interface UserDO {
    id: number;
    name: string;
    email: string;
    active: number;
    token_expire: Date;
}

export interface MediaDO {
    identifier: string; // Media Identifier
    name: string;
    type: "image" | "video";
    created_at: number;
    thumbnail: string;
    feature: Blob; // Feature
    processStep: number; // Process Step, 0: Not Processed, 1: Uploaded, 2: calculated

}