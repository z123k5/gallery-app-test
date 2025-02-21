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
    type: string;
    created_at: number;
    thumbnail: string;
    processStep: number; // Process Step, 0: Not Processed, 1: Uploaded, 2: calculated
}