import { DataSource } from 'typeorm';
import { Task } from './models/Task';
import { Workflow } from './models/Workflow';
import { config } from './config';

export const AppDataSource = new DataSource({
    type: 'better-sqlite3',
    database: config.DB_PATH,
    dropSchema: false,
    entities: [Task, Workflow],
    synchronize: true,
    logging: false,
});
