export interface Room {
    name: string;
    size: number;
    uuid: string;
    owner?: number;
    password?: string;
    members: number[];
}
