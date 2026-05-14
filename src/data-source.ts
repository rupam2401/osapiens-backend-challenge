import { DataSource } from 'typeorm';
import { Task } from './models/Task';
import { Workflow } from './models/Workflow';

export const AppDataSource = new DataSource({
    type: 'better-sqlite3',
    database: 'data/database.sqlite',
    dropSchema: false,
    entities: [Task, Workflow],
    synchronize: true,
    logging: false,
});
