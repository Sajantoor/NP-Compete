export interface Room {
    name: string;
    size: number;
    uuid: string;
    owner?: string;
    members: string[];
}