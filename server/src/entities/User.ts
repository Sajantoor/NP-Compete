import { Entity, BaseEntity, PrimaryColumn } from 'typeorm';

@Entity()
export default class User extends BaseEntity {
    @PrimaryColumn()
    username: string;
}