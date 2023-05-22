export interface Room {
    name: string;
    size: number;
    uuid: string;
    owner?: string;
    password?: string;
    members: string[];
    question?: number;
}
